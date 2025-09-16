from flask import Blueprint, session, redirect,url_for, flash, render_template, request
import mysql.connector, os, json
from db_utils import get_count_from_table
from werkzeug.utils import secure_filename

# สร้าง Blueprint
admin_bp = Blueprint('admin', __name__, template_folder='/admin', url_prefix='/admin')

UPLOAD_FOLDER = "static/images"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@admin_bp.route('/index')
def adminindex():
    if "user" not in session or "id" not in session["user"]:
        flash('กรุณาเข้าสู่ระบบก่อน!', 'danger')
        return redirect(url_for('auth.login'))

    # ✅ ตรวจสอบว่าเป็น admin หรือไม่
    if session["user"].get("role") != "admin":
        flash('คุณไม่มีสิทธิ์เข้าถึงหน้านี้!', 'danger')
        return redirect(url_for('auth.login'))

    recipe_count = get_count_from_table("recipes")
    user_count = get_count_from_table("users")
    unit_count = get_count_from_table("ingredient_units")
    conversion_count = get_count_from_table("unit_conversions")   # ✅ เพิ่มตรงนี้

    return render_template("admin-index.html",
                           recipe_count=recipe_count,
                           user_count=user_count,
                           unit_count=unit_count,
                           conversion_count=conversion_count)  # ✅ ส่งค่าไปหน้า HTML

@admin_bp.route('/add-menu', methods=['GET', 'POST'])
def add_menu():
    if "user" not in session or "id" not in session["user"]:
        flash('กรุณาเข้าสู่ระบบก่อน!', 'danger')
        return redirect(url_for('auth.login'))

    if session["user"].get("role") != "admin":
        flash('คุณไม่มีสิทธิ์เข้าถึงหน้านี้!', 'danger')
        return redirect(url_for('auth.login'))

    if request.method == "POST":
        name = request.form.get("name")
        image_url = request.form.get("image_url")  # กรณีกรอกเอง
        file = request.files.get("image_file")     # ✅ อัปโหลดไฟล์

        # ถ้ามีการอัปโหลดไฟล์ → ใช้ไฟล์แทน URL
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            save_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(save_path)
            image_url = f"images/{filename}"   # เก็บ path แบบ relative ใน DB

        ingredients = request.form.get("ingredients", "[]")
        secondary_ingredients = request.form.get("secondary_ingredients", "[]")
        instructions = request.form.get("instructions", "[]")
        servings = request.form.get("servings", 1)
        category_id = request.form.get("category_id")
        source = request.form.get("source", "{}")
        menu_type = request.form.get("menu_type", '["general"]')

        if not name:
            flash("กรุณากรอกชื่อเมนู", "danger")
            return redirect(url_for("admin.add_menu"))

        try:
            conn = mysql.connector.connect(
                host="localhost", user="root", password="", database="recipes_db"
            )
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO recipes 
                (name, image_url, ingredients, secondary_ingredients, instructions, servings, category_id, source, menu_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                name,
                image_url,
                ingredients,
                secondary_ingredients,
                instructions,
                servings,
                category_id,
                source,
                menu_type
            ))
            conn.commit()
            cursor.close()
            conn.close()

            flash("เพิ่มเมนูสำเร็จ!", "success")
            return redirect(url_for("admin.adminindex"))

        except mysql.connector.Error as err:
            flash(f"เกิดข้อผิดพลาด: {err}", "danger")

    # โหลดหมวดหมู่เมนูจาก DB
    try:
        conn = mysql.connector.connect(
            host="localhost", user="root", password="", database="recipes_db"
        )
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name FROM categories ORDER BY name ASC")
        categories = cursor.fetchall()
        cursor.close()
        conn.close()
    except:
        categories = []

    return render_template("admin-add-menu.html", categories=categories)

@admin_bp.route('/all-menus')
def all_menus():
    if "user" not in session or "id" not in session["user"]:
        flash('กรุณาเข้าสู่ระบบก่อน!', 'danger')
        return redirect(url_for('auth.login'))

    if session["user"].get("role") != "admin":
        flash('คุณไม่มีสิทธิ์เข้าถึงหน้านี้!', 'danger')
        return redirect(url_for('auth.login'))

    try:
        conn = mysql.connector.connect(
            host="localhost", user="root", password="", database="recipes_db"
        )
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT r.*, c.name AS category_name
            FROM recipes r
            LEFT JOIN categories c ON r.category_id = c.id
            ORDER BY r.id DESC
        """)
        recipes = cursor.fetchall()
        cursor.close()
        conn.close()
    except mysql.connector.Error as err:
        flash(f"เกิดข้อผิดพลาด: {err}", "danger")
        recipes = []

    # ตรวจสอบไฟล์รูป
    for r in recipes:
        if r.get("image_url"):
            file_path = os.path.join("static/images", r["image_url"])
            r["image_exists"] = os.path.exists(file_path)
            r["image_url"] = f"images/{r['image_url']}"
        else:
            r["image_exists"] = False

        # แปลง JSON
        for field in ["ingredients", "secondary_ingredients", "instructions", "menu_type"]:
            try:
                parsed = json.loads(r[field]) if r[field] else []
            except:
                parsed = []

            # ✅ format ให้เป็น string อ่านง่าย
            if isinstance(parsed, list):
                formatted = []
                for item in parsed:
                    if isinstance(item, dict) and "name" in item:
                        # เช่น {"name": "...", "amount": 6, "unit": "ช้อนชา"}
                        amount = item.get("amount", "")
                        unit = item.get("unit", "")
                        formatted.append(f"{item['name']} - {amount} {unit}".strip())
                    else:
                        formatted.append(str(item))
                r[field] = formatted
            elif isinstance(parsed, dict):
                # ✅ เอาเฉพาะ key ที่มีค่า (ไม่เอาค่าว่าง)
                r[field] = [f"{k}: {v}" for k, v in parsed.items() if v not in (None, "", [])]
            else:
                r[field] = [str(parsed)]

    return render_template("admin-all-menus.html", recipes=recipes)


