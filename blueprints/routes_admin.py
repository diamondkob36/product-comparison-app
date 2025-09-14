from flask import Blueprint, session, redirect,url_for, flash, render_template, request
import mysql.connector
from db_utils import get_count_from_table

# สร้าง Blueprint
admin_bp = Blueprint('admin', __name__, template_folder='/admin', url_prefix='/admin')

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
        image_url = request.form.get("image_url")
        ingredients = request.form.get("ingredients", "[]")
        secondary_ingredients = request.form.get("secondary_ingredients", "[]")
        instructions = request.form.get("instructions", "[]")
        servings = request.form.get("servings", 1)
        category_id = request.form.get("category_id")
        source = request.form.get("source", "{}")
        menu_type = request.form.get("menu_type", '["general"]')  # ค่าเริ่มต้น

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

