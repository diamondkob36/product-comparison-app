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

        # ✅ ถ้ามีไฟล์อัปโหลด → ใช้แทนค่า image_url
        if file and allowed_file(file.filename):
            if image_url:  # ถ้ากรอกชื่อไฟล์มา
                filename = os.path.basename(image_url)  # ใช้ชื่อจากฟอร์ม
            else:
                filename = secure_filename(file.filename)  # ถ้าไม่กรอก ใช้ชื่อไฟล์จริง

            save_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(save_path)  # เซฟไฟล์ใหม่ (ทับไฟล์เก่าได้เลย)
            image_url = filename  # เก็บ path แบบ relative ใน DB

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

@admin_bp.route('/edit-menu/<int:menu_id>', methods=['GET', 'POST'])
def edit_menu(menu_id):
    if "user" not in session or "id" not in session["user"]:
        flash('กรุณาเข้าสู่ระบบก่อน!', 'danger')
        return redirect(url_for('auth.login'))

    if session["user"].get("role") != "admin":
        flash('คุณไม่มีสิทธิ์เข้าถึงหน้านี้!', 'danger')
        return redirect(url_for('auth.login'))

    conn = mysql.connector.connect(
        host="localhost", user="root", password="", database="recipes_db"
    )
    cursor = conn.cursor(dictionary=True)

    if request.method == "POST":
        name = request.form.get("name")
        image_url = request.form.get("image_url")  # ค่า URL ที่กรอก
        file = request.files.get("image_file")

        # ✅ ถ้ามีไฟล์ใหม่ → ใช้ชื่อจาก image_url ถ้ามี กรณีไม่กรอกใช้ชื่อไฟล์จริง
        if file and allowed_file(file.filename):
            if image_url:
                filename = os.path.basename(image_url)
            else:
                filename = secure_filename(file.filename)

            save_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(save_path)  # บันทึกทับไฟล์เก่าได้เลย
            image_url = filename

        ingredients = request.form.get("ingredients", "[]")
        secondary_ingredients = request.form.get("secondary_ingredients", "[]")
        instructions = request.form.get("instructions", "[]")
        servings = request.form.get("servings", 1)
        category_id = request.form.get("category_id")
        source = request.form.get("source", "{}")
        menu_type = request.form.get("menu_type", '["general"]')

        try:
            cursor.execute("""
                UPDATE recipes
                SET name=%s, image_url=%s, ingredients=%s, secondary_ingredients=%s,
                    instructions=%s, servings=%s, category_id=%s, source=%s, menu_type=%s
                WHERE id=%s
            """, (
                name, image_url, ingredients, secondary_ingredients, instructions,
                servings, category_id, source, menu_type, menu_id
            ))
            conn.commit()
            flash("แก้ไขเมนูสำเร็จ!", "success")
            return redirect(url_for("admin.all_menus"))
        except mysql.connector.Error as err:
            flash(f"เกิดข้อผิดพลาด: {err}", "danger")

    # ✅ ดึงข้อมูลเมนูมาแสดงในฟอร์ม
    cursor.execute("SELECT * FROM recipes WHERE id = %s", (menu_id,))
    menu = cursor.fetchone()

    # โหลดหมวดหมู่
    cursor.execute("SELECT id, name FROM categories ORDER BY name ASC")
    categories = cursor.fetchall()

    cursor.close()
    conn.close()

    return render_template("admin-edit-menu.html", menu=menu, categories=categories)

@admin_bp.route('/delete-menu/<int:menu_id>', methods=['POST'])
def delete_menu(menu_id):
    try:
        conn = mysql.connector.connect(
            host="localhost", user="root", password="", database="recipes_db"
        )
        cursor = conn.cursor(dictionary=True)

        # ✅ ดึงข้อมูลเมนู (เอา image_url มาก่อน)
        cursor.execute("SELECT image_url FROM recipes WHERE id = %s", (menu_id,))
        recipe = cursor.fetchone()

        # ✅ ลบข้อมูลใน DB
        cursor.execute("DELETE FROM recipes WHERE id = %s", (menu_id,))
        conn.commit()

        # ✅ ถ้ามีรูป → ลบไฟล์ออกจาก static/images
        if recipe and recipe.get("image_url"):
            image_url = recipe["image_url"]
            filename = os.path.basename(image_url)  # ตัด path ออก เหลือแค่ชื่อไฟล์
            file_path = os.path.join("static/images", filename)
            if os.path.exists(file_path):
                os.remove(file_path)

        cursor.close()
        conn.close()
        flash("ลบเมนูและไฟล์รูปภาพเรียบร้อยแล้ว", "success")

    except mysql.connector.Error as err:
        flash(f"เกิดข้อผิดพลาด: {err}", "danger")

    return redirect(url_for("admin.all_menus"))

@admin_bp.route('/image-library')
def image_library():
    if "user" not in session or "id" not in session["user"]:
        flash('กรุณาเข้าสู่ระบบก่อน!', 'danger')
        return redirect(url_for('auth.login'))

    if session["user"].get("role") != "admin":
        flash('คุณไม่มีสิทธิ์เข้าถึงหน้านี้!', 'danger')
        return redirect(url_for('auth.login'))

    image_folder = os.path.join("static", "images")
    images = []

    # ✅ อ่านไฟล์ใน static/images
    if os.path.exists(image_folder):
        for filename in os.listdir(image_folder):
            file_path = os.path.join(image_folder, filename)

            if os.path.isfile(file_path):
                # เช็คว่าไฟล์ถูกใช้โดยเมนูใดบ้าง
                conn = mysql.connector.connect(
                    host="localhost", user="root", password="", database="recipes_db"
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT id, name FROM recipes WHERE image_url = %s", (filename,))
                used_by = cursor.fetchall()
                cursor.close()
                conn.close()

                images.append({
                    "filename": filename,
                    "url": f"images/{filename}",
                    "used_by": used_by
                })

    return render_template("admin-image-library.html", images=images)

@admin_bp.route('/delete-image/<filename>', methods=['POST'])
def delete_image(filename):
    if "user" not in session or "id" not in session["user"]:
        flash('กรุณาเข้าสู่ระบบก่อน!', 'danger')
        return redirect(url_for('auth.login'))

    if session["user"].get("role") != "admin":
        flash('คุณไม่มีสิทธิ์เข้าถึงหน้านี้!', 'danger')
        return redirect(url_for('auth.login'))

    file_path = os.path.join("static/images", filename)

    # ✅ เช็คว่ามีเมนูใช้ไฟล์นี้อยู่หรือไม่
    conn = mysql.connector.connect(
        host="localhost", user="root", password="", database="recipes_db"
    )
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM recipes WHERE image_url = %s", (filename,))
    count = cursor.fetchone()[0]
    cursor.close()
    conn.close()

    if count == 0 and os.path.exists(file_path):
        os.remove(file_path)
        flash("ลบไฟล์รูปภาพเรียบร้อยแล้ว", "success")
    else:
        flash("ไม่สามารถลบไฟล์นี้ได้ (ยังถูกใช้งานอยู่)", "warning")

    return redirect(url_for("admin.image_library"))



