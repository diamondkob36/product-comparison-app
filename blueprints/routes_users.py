from flask import Blueprint, render_template, session, flash, redirect, url_for, jsonify, request
import mysql.connector
import json
from ai_model import recommend_recipes, train_model, calculate_bmr_tdee, calculate_daily_intake, process_ingredients, deduct_ingredients, convert_to_grams, display_converted_amount, calculate_bmi

# สร้าง Blueprint
users_bp = Blueprint('users', __name__, template_folder='/users', url_prefix='/users')

@users_bp.route('/index')
def homeuser():
    # ตรวจสอบว่ามี user_id ใน session หรือไม่
    if "user" not in session or "id" not in session["user"]:
        flash('กรุณาเข้าสู่ระบบก่อน!', 'danger')  # แสดงข้อความแจ้งเตือน
        return redirect(url_for('auth.login'))  # รีไดเรกต์ไปหน้าเข้าสู่ระบบ

    # หากมี user_id ใน session ให้แสดงหน้า users-index.html
    return render_template('users-index.html')

@users_bp.route('/add_ingredient', methods=['POST'])
def add_ingredient():
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "กรุณาเข้าสู่ระบบก่อน"}), 403

    # รับข้อมูลจาก JSON
    data = request.json
    ingredient_id = data.get('ingredient_id')
    amount = data.get('amount')
    user_id = session["user"]["id"]

    # ตรวจสอบข้อมูลเบื้องต้น
    if not ingredient_id or amount is None:
        return jsonify({"error": "กรุณาระบุข้อมูลให้ครบถ้วน"}), 400

    try:
        # ตรวจสอบว่า amount เป็นค่าบวก
        if float(amount) <= 0:
            return jsonify({"error": "ปริมาณวัตถุดิบต้องมากกว่าศูนย์"}), 400

        # เชื่อมต่อฐานข้อมูล
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)

        # ตรวจสอบว่า ingredient_id มีอยู่จริง
        cursor.execute('SELECT id FROM ingredient_units WHERE id = %s', (ingredient_id,))
        if cursor.fetchone() is None:
            return jsonify({"error": "วัตถุดิบไม่ถูกต้อง"}), 400

        # ตรวจสอบว่ามีวัตถุดิบนี้ในคลังผู้ใช้อยู่แล้วหรือไม่
        cursor.execute('''
            SELECT amount FROM user_ingredients
            WHERE user_id = %s AND ingredient_id = %s
        ''', (user_id, ingredient_id))
        existing = cursor.fetchone()

        if existing:
            # ✅ ถ้ามีอยู่แล้ว → อัปเดตจำนวน
            new_amount = existing["amount"] + float(amount)
            cursor.execute('''
                UPDATE user_ingredients SET amount = %s
                WHERE user_id = %s AND ingredient_id = %s
            ''', (new_amount, user_id, ingredient_id))
            message = "อัปเดตปริมาณวัตถุดิบแล้ว"
        else:
            # ✅ ถ้าไม่มี → เพิ่มใหม่
            cursor.execute('''
                INSERT INTO user_ingredients (user_id, ingredient_id, amount)
                VALUES (%s, %s, %s)
            ''', (user_id, ingredient_id, amount))
            message = "เพิ่มวัตถุดิบสำเร็จ!"

        conn.commit()
        return jsonify({"message": message}), 200

    except mysql.connector.Error as err:
        return jsonify({"error": f"เกิดข้อผิดพลาดในฐานข้อมูล: {err}"}), 500

    except Exception as e:
        return jsonify({"error": f"เกิดข้อผิดพลาด: {str(e)}"}), 500

    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()

@users_bp.route('/delete_ingredient/<int:ingredient_id>', methods=['DELETE'])
def delete_ingredient(ingredient_id):
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "กรุณาเข้าสู่ระบบก่อน"}), 403

    user_id = session["user"]["id"]

    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor()

        # ตรวจสอบว่าวัตถุดิบนี้เป็นของผู้ใช้หรือไม่
        cursor.execute('SELECT id FROM user_ingredients WHERE id = %s AND user_id = %s', (ingredient_id, user_id))
        if cursor.fetchone() is None:
            return jsonify({"error": "วัตถุดิบไม่พบหรือคุณไม่มีสิทธิ์ลบ"}), 404

        # ลบวัตถุดิบ
        cursor.execute('DELETE FROM user_ingredients WHERE id = %s AND user_id = %s', (ingredient_id, user_id))
        conn.commit()

        return jsonify({"message": "ลบวัตถุดิบสำเร็จ!"}), 200

    except mysql.connector.Error as err:
        return jsonify({"error": f"เกิดข้อผิดพลาดในฐานข้อมูล: {err}"}), 500

    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()

@users_bp.route('/get_user_ingredients', methods=['GET'])
def get_user_ingredients():
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "กรุณาเข้าสู่ระบบก่อน"}), 403

    user_id = session["user"]["id"]

    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)
        query = '''
            SELECT 
                ui.id AS ingredient_id,
                iu.ingredient_name AS name,
                ui.amount,
                iu.unit
            FROM user_ingredients ui
            JOIN ingredient_units iu ON ui.ingredient_id = iu.id
            WHERE ui.user_id = %s
            ORDER BY iu.ingredient_name ASC
        '''
        cursor.execute(query, (user_id,))
        ingredients = cursor.fetchall()
        return jsonify({"ingredients": ingredients}), 200
    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

@users_bp.route('/recommend', methods=['POST'])
def recommend():
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "กรุณาเข้าสู่ระบบก่อน"}), 403

    try:
        # รับข้อมูลวัตถุดิบที่ผ่านการคำนวณจาก Frontend
        data = request.json
        ingredients = data.get('ingredients')

        if not ingredients or not isinstance(ingredients, list):
            return jsonify({"error": "ข้อมูลวัตถุดิบไม่ถูกต้อง"}), 400

        # ฝึกโมเดลและแนะนำเมนู
        model, mlb = train_model()
        recommendations = recommend_recipes(ingredients, model, mlb)

        # ✅ เพิ่มจำนวนเมนูทั้งหมดในระบบ (ดึงจากฐานข้อมูล)
        conn = mysql.connector.connect(
            host="localhost", user="root", password="", database="recipes_db"
        )
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM recipes WHERE JSON_CONTAINS(menu_type, '\"system\"')")
        total_recipes = cursor.fetchone()[0]
        cursor.close()
        conn.close()

        # ✅ แนบลงในผลลัพธ์
        recommendations["total_recipes"] = total_recipes

        return jsonify(recommendations), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@users_bp.route('/calculate_bmr_tdee', methods=['GET'])
def calculate_bmr_tdee_route():
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "กรุณาเข้าสู่ระบบก่อน"}), 403

    user_id = session["user"]["id"]

    try:
        # เชื่อมต่อฐานข้อมูลและดึงข้อมูลผู้ใช้
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)
        cursor.execute('''
            SELECT weight, height, age, gender, activity_level, goal, subgoal
            FROM users
            WHERE id = %s
        ''', (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "ไม่พบข้อมูลผู้ใช้"}), 404

        # คำนวณค่า BMR และ TDEE
        bmr, tdee = calculate_bmr_tdee(
            weight=user['weight'],
            height=user['height'],
            age=user['age'],
            gender=user['gender'],
            activity_level=user['activity_level']
        )

        # คำนวณสารอาหารที่ควรได้รับ
        daily_intake = calculate_daily_intake(bmr, tdee, goal=user.get('goal', "ปกติ"), subgoal=user.get('subgoal'))

        # ใช้ daily_intake เป็น max_values
        max_values = daily_intake.copy()

        return jsonify({
            "bmr": bmr,
            "tdee": tdee,
            "goal": user.get('goal', "ปกติ"),
            "subgoal": user.get('subgoal'),
            "daily_intake": daily_intake,
            "max_values": max_values
        }), 200

    except mysql.connector.Error as err:
        return jsonify({"error": f"เกิดข้อผิดพลาดในฐานข้อมูล: {err}"}), 500

    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

@users_bp.route('/default_intake', methods=['GET'])
def default_intake():
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "กรุณาเข้าสู่ระบบก่อน"}), 403

    try:
        user_id = session["user"]["id"]

        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT weight, height, age, gender, activity_level
            FROM users WHERE id = %s
        """, (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "ไม่พบข้อมูลผู้ใช้"}), 404

        # คำนวณ BMR และ TDEE โดยไม่ใช้ goal/subgoal
        bmr, tdee = calculate_bmr_tdee(
            weight=user["weight"],
            height=user["height"],
            age=user["age"],
            gender=user["gender"],
            activity_level=user["activity_level"]
        )

        # คำนวณค่าที่ควรได้รับ (แบบไม่ปรับตาม goal/subgoal)
        default = calculate_daily_intake(bmr, tdee, goal="ปกติ", subgoal=[])

        return jsonify(default), 200

    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals() and conn.is_connected(): conn.close()

@users_bp.route('/get_user_info', methods=['GET'])
def get_user_info():
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "กรุณาเข้าสู่ระบบก่อน"}), 403

    user_id = session["user"]["id"]

    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)
        query = '''
            SELECT name, weight, height, age, gender, activity_level, goal, subgoal
            FROM users
            WHERE id = %s
        '''
        cursor.execute(query, (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "ไม่พบข้อมูลผู้ใช้"}), 404

        return jsonify(user), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500

    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

@users_bp.route('/update_user_info', methods=['POST'])
def update_user_info():
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "กรุณาเข้าสู่ระบบก่อน"}), 403

    user_id = session["user"]["id"]
    data = request.json

    try:
        # ✅ ตรวจสอบค่า: ต้องมากกว่า 0
        weight = float(data.get('weight', 0))
        height = float(data.get('height', 0))
        age = int(data.get('age', 0))

        if weight <= 0 or height <= 0 or age <= 0:
            return jsonify({"error": "น้ำหนัก ส่วนสูง และอายุ ต้องมากกว่า 0"}), 400

        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor()

        # ✅ แปลง subgoal เป็น string
        subgoal = data.get('subgoal')
        if isinstance(subgoal, list):
            subgoal_str = ",".join(subgoal)
        else:
            subgoal_str = subgoal or ""

        query = '''
            UPDATE users
            SET name = %s, weight = %s, height = %s, age = %s,
                gender = %s, activity_level = %s, goal = %s, subgoal = %s
            WHERE id = %s
        '''
        cursor.execute(query, (
            data['name'], weight, height, age,
            data['gender'], data['activity-level'], data['goal'], subgoal_str, user_id
        ))
        conn.commit()

        return jsonify({"message": "อัปเดตข้อมูลสำเร็จ!"}), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500

    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

@users_bp.route('/menu-detail', methods=['GET', 'POST'])
def menu_detail():
    if "user" not in session or "id" not in session["user"]:
        return redirect(url_for("auth.login"))

    user_id = session["user"]["id"]
    recipe_id = request.args.get("recipe_id")

    if not recipe_id:
        return redirect(url_for("users.homeuser"))

    conn = mysql.connector.connect(
        host='localhost',
        user='root',
        password='',
        database='recipes_db'
    )
    cursor = conn.cursor(dictionary=True, buffered=True)

    # ✅ ดึงข้อมูลเมนู
    cursor.execute("""
        SELECT id, name, image_url, ingredients, secondary_ingredients, servings
        FROM recipes
        WHERE id = %s
    """, (recipe_id,))
    recipe = cursor.fetchone()

    if not recipe:
        cursor.close()
        conn.close()
        return redirect(url_for("users.homeuser"))

    # ✅ ประมวลผลวัตถุดิบ
    primary_ingredients = process_ingredients(recipe.get('ingredients'))
    secondary_ingredients = process_ingredients(recipe.get('secondary_ingredients'))
    servings = recipe.get('servings', 1)

    for ing in primary_ingredients + secondary_ingredients:
        ing["converted_display"] = display_converted_amount(ing["name"], ing["amount"], ing.get("unit", "กรัม"))

    if request.method == "POST":
        try:
            form_primary = request.form.get("primary_ingredients", "[]")
            form_secondary = request.form.get("secondary_ingredients", "[]")
            user_servings = request.form.get("user_servings", "1")

            primary_ingredients_list = json.loads(form_primary)
            secondary_ingredients_list = json.loads(form_secondary)

            # ✅ ตรวจสอบวัตถุดิบหลัก: อย่างน้อย 1 รายการ และมีปริมาณ > 0
            if not primary_ingredients_list or not any(float(p.get("amount", 0)) > 0 for p in primary_ingredients_list):
                cursor.close()
                conn.close()
                return jsonify({"error": "กรุณาเพิ่มวัตถุดิบหลักอย่างน้อย 1 ชนิด และปริมาณมากกว่า 0"}), 400

            # ✅ หักวัตถุดิบ
            deduct_ingredients(user_id, primary_ingredients_list)
            deduct_ingredients(user_id, secondary_ingredients_list)

            # ✅ บันทึกเมนูที่ผู้ใช้เลือก
            cursor.execute("""
                INSERT INTO user_selected_menus (user_id, recipe_id, ingredients, secondary_ingredients, user_servings)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                user_id,
                recipe_id,
                json.dumps(primary_ingredients_list, ensure_ascii=False),
                json.dumps(secondary_ingredients_list, ensure_ascii=False),
                user_servings
            ))

            conn.commit()
            cursor.close()
            conn.close()

            return jsonify({
                "message": "บันทึกเมนูสำเร็จ!",
                "data": {
                    "user_id": user_id,
                    "recipe_id": recipe_id,
                    "ingredients": primary_ingredients_list,
                    "secondary_ingredients": secondary_ingredients_list,
                    "user_servings": user_servings
                }
            }), 201

        except mysql.connector.Error as err:
            cursor.close()
            conn.close()
            return jsonify({"error": str(err)}), 500

    cursor.close()
    conn.close()

    return render_template("menu_detail.html", recipe={
        'id': recipe.get('id', ""),
        'name': recipe.get('name', "ไม่พบชื่อเมนู"),
        'image_url': recipe.get('image_url', "default.jpg"),
        'primary_ingredients': primary_ingredients,
        'secondary_ingredients': secondary_ingredients,
        'user_servings': servings,
        'servings': recipe.get('servings', 1)
    })

@users_bp.route('/view-menu')
def view_menu():
    if "user" not in session or "id" not in session["user"]:
        return redirect(url_for("auth.login"))

    recipe_id = request.args.get("recipe_id")
    if not recipe_id:
        return redirect(url_for("users.homeuser"))

    try:
        from ai_model import display_converted_amount  # ✅ เพิ่ม import

        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, name, image_url, source,
                   ingredients, secondary_ingredients,
                   servings, instructions
            FROM recipes
            WHERE id = %s
        """, (recipe_id,))
        recipe = cursor.fetchone()

        if not recipe:
            return redirect(url_for("users.homeuser"))

        recipe['primary_ingredients'] = process_ingredients(recipe.get('ingredients'))
        recipe['secondary_ingredients'] = process_ingredients(recipe.get('secondary_ingredients'))

        try:
            recipe['instructions'] = json.loads(recipe.get('instructions') or "[]")
        except json.JSONDecodeError:
            recipe['instructions'] = []

        cursor.execute("""
            SELECT ingredient_name, energy_kcal, protein_g,
                   fat_g, carbohydrate_g, sugar_g, sodium_mg
            FROM ingredient_nutrition
        """)
        nutrition_data = {row["ingredient_name"]: row for row in cursor.fetchall()}

        total = {
            "calories": 0,
            "protein": 0,
            "fat": 0,
            "carbs": 0,
            "sugar": 0,
            "sodium": 0
        }

        for ing in recipe['primary_ingredients'] + recipe['secondary_ingredients']:
            name = ing["name"]
            amount = ing["amount"]
            unit = ing.get("unit", "กรัม")
            amount_in_grams = convert_to_grams(name, amount, unit)

            if name in nutrition_data:
                nutri = nutrition_data[name]
                total["calories"] += (nutri["energy_kcal"] * amount_in_grams) / 100
                total["protein"] += (nutri["protein_g"] * amount_in_grams) / 100
                total["fat"] += (nutri["fat_g"] * amount_in_grams) / 100
                total["carbs"] += (nutri["carbohydrate_g"] * amount_in_grams) / 100
                total["sugar"] += (nutri["sugar_g"] * amount_in_grams) / 100 if nutri["sugar_g"] else 0
                total["sodium"] += (nutri["sodium_mg"] * amount_in_grams) / 100 if nutri["sodium_mg"] else 0

        servings = recipe.get("servings") or 1
        recipe['nutrition'] = {
            "total": total,
            "per_serving": {
                "calories": round(total["calories"] / servings, 2),
                "protein": round(total["protein"] / servings, 2),
                "fat": round(total["fat"] / servings, 2),
                "carbs": round(total["carbs"] / servings, 2),
                "sugar": round(total["sugar"] / servings, 2),
                "sodium": round(total["sodium"] / servings, 2)
            }
        }

        cursor.execute("""
            SELECT iu.ingredient_name, ui.amount
            FROM user_ingredients ui
            JOIN ingredient_units iu ON ui.ingredient_id = iu.id
            WHERE ui.user_id = %s
        """, (session["user"]["id"],))
        stock = {row["ingredient_name"]: row["amount"] for row in cursor.fetchall()}

        for ing in recipe['primary_ingredients'] + recipe['secondary_ingredients']:
            ing["stock"] = stock.get(ing["name"], 0)
            ing["converted_display"] = display_converted_amount(ing["name"], ing["amount"], ing.get("unit", "กรัม"))  # ✅ เพิ่มบรรทัดนี้
        
        try:
            recipe["source"] = json.loads(recipe.get("source") or "{}")
        except json.JSONDecodeError:
            recipe["source"] = {}

        return render_template("view_menu.html", recipe=recipe)

    except mysql.connector.Error as err:
        return f"เกิดข้อผิดพลาด: {err}", 500

    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals() and conn.is_connected(): conn.close()

@users_bp.route('/nutrition_chart', methods=['GET'])
def nutrition_chart():
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "กรุณาเข้าสู่ระบบก่อน"}), 403

    user_id = session["user"]["id"]

    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)

        # ✅ ดึง ingredients และ secondary_ingredients + servings
        cursor.execute('''
            SELECT usm.ingredients, usm.secondary_ingredients, usm.user_servings,
                   r.servings AS recipe_servings
            FROM user_selected_menus usm
            JOIN recipes r ON usm.recipe_id = r.id
            WHERE usm.user_id = %s AND DATE(usm.created_at) = CURDATE()
        ''', (user_id,))
        
        menus = cursor.fetchall()

        # ดึงข้อมูลโภชนาการจาก ingredient_nutrition
        cursor.execute('''
            SELECT ingredient_name, energy_kcal, protein_g, fat_g, 
                   carbohydrate_g, sugar_g, sodium_mg 
            FROM ingredient_nutrition
        ''')
        nutrition_data = {row['ingredient_name']: row for row in cursor.fetchall()}

        # ค่าเริ่มต้น
        total_nutrition = {
            'tdee': 0, 'protein': 0, 'fat': 0, 'carb': 0, 'sugar': 0, 'sodium': 0
        }

        for menu in menus:
            # ✅ โหลดวัตถุดิบหลัก + วัตถุดิบรอง
            primary_ingredients = json.loads(menu['ingredients'])
            secondary_ingredients = json.loads(menu['secondary_ingredients'] or "[]")

            # รวมรายการทั้งหมด
            all_ingredients = primary_ingredients + secondary_ingredients

            user_servings = float(menu.get('user_servings') or 1)
            recipe_servings = float(menu.get('recipe_servings') or 1)
            ratio = user_servings / recipe_servings  # ✅ อัตราส่วนที่ผู้ใช้กินจริง

            for ing in all_ingredients:
                name = ing['name']
                amount = ing['amount'] * ratio
                unit = ing.get("unit", "กรัม")
                amount_in_grams = convert_to_grams(name, amount, unit)

                if name in nutrition_data:
                    nutri = nutrition_data[name]
                    total_nutrition['tdee'] += (nutri['energy_kcal'] * amount_in_grams) / 100
                    total_nutrition['protein'] += (nutri['protein_g'] * amount_in_grams) / 100
                    total_nutrition['fat'] += (nutri['fat_g'] * amount_in_grams) / 100
                    total_nutrition['carb'] += (nutri['carbohydrate_g'] * amount_in_grams) / 100
                    total_nutrition['sugar'] += (nutri['sugar_g'] * amount_in_grams) / 100 if nutri['sugar_g'] is not None else 0
                    total_nutrition['sodium'] += (nutri['sodium_mg'] * amount_in_grams) / 100 if nutri['sodium_mg'] is not None else 0

        return jsonify(total_nutrition), 200

    except mysql.connector.Error as err:
        return jsonify({"error": f"เกิดข้อผิดพลาดในฐานข้อมูล: {err}"}), 500

    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals() and conn.is_connected(): conn.close()

@users_bp.route('/selected_menus', methods=['GET'])
def selected_menus():
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "กรุณาเข้าสู่ระบบก่อน"}), 403

    user_id = session["user"]["id"]

    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)

        # ดึง `id` ของ user_selected_menus มาด้วย
        cursor.execute('''
            SELECT usm.id, usm.recipe_id, r.name AS recipe_name, usm.user_servings
            FROM user_selected_menus usm
            JOIN recipes r ON usm.recipe_id = r.id
            WHERE usm.user_id = %s AND DATE(usm.created_at) = CURDATE()
            ORDER BY usm.created_at ASC
        ''', (user_id,))
        
        menus = cursor.fetchall()

        formatted_menus = [
            {
                "id": menu["id"],  # ✅ เพิ่ม id ของ user_selected_menus
                "recipe_id": menu["recipe_id"],
                "recipe_name": menu["recipe_name"],
                "user_servings": menu["user_servings"]
            }
            for menu in menus
        ]

        return jsonify({"selected_menus": formatted_menus}), 200

    except mysql.connector.Error as err:
        return jsonify({"error": f"เกิดข้อผิดพลาดในฐานข้อมูล: {err}"}), 500

    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()

@users_bp.route('/delete_selected_menu/<int:menu_id>', methods=['DELETE'])
def delete_selected_menu(menu_id):
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "กรุณาเข้าสู่ระบบก่อน"}), 403

    user_id = session["user"]["id"]

    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor()

        # ตรวจสอบว่ารายการเมนูมีอยู่จริงและเป็นของผู้ใช้ที่ล็อกอินอยู่
        cursor.execute(
            "DELETE FROM user_selected_menus WHERE user_id = %s AND id = %s",
            (user_id, menu_id)
        )
        conn.commit()

        return jsonify({"message": "ลบเมนูสำเร็จ!"}), 200

    except mysql.connector.Error as err:
        return jsonify({"error": f"เกิดข้อผิดพลาดในฐานข้อมูล: {err}"}), 500

    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()

@users_bp.route('/selected-menu-detail/<int:selected_id>')
def selected_menu_detail(selected_id):
    if "user" not in session or "id" not in session["user"]:
        return redirect(url_for("auth.login"))

    user_id = session["user"]["id"]

    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)

        # ✅ ดึงเมนูที่เลือกจาก user_selected_menus
        cursor.execute('''
            SELECT usm.recipe_id, usm.ingredients, usm.secondary_ingredients, usm.user_servings,
                   r.name, r.image_url, r.servings, r.instructions
            FROM user_selected_menus usm
            JOIN recipes r ON usm.recipe_id = r.id
            WHERE usm.id = %s AND usm.user_id = %s
        ''', (selected_id, user_id))

        record = cursor.fetchone()
        if not record:
            return "ไม่พบเมนูนี้", 404

        # ✅ แปลงข้อมูลวัตถุดิบ
        record['primary_ingredients'] = process_ingredients(record.get('ingredients'))
        record['secondary_ingredients'] = process_ingredients(record.get('secondary_ingredients'))

        # ✅ เพิ่ม display_converted_amount
        for ing in record['primary_ingredients'] + record['secondary_ingredients']:
            ing["converted_display"] = display_converted_amount(ing["name"], ing["amount"], ing.get("unit", "กรัม"))

        try:
            record['instructions'] = json.loads(record.get('instructions') or "[]")
        except:
            record['instructions'] = []

        # ✅ ดึงข้อมูลโภชนาการจาก ingredient_nutrition
        cursor.execute("""SELECT * FROM ingredient_nutrition""")
        nutrition_data = {row["ingredient_name"]: row for row in cursor.fetchall()}

        # ✅ คำนวณโภชนาการรวม (ไม่คูณ ratio)
        total_base = {"calories": 0, "protein": 0, "fat": 0, "carbs": 0, "sugar": 0, "sodium": 0}
        for ing in record['primary_ingredients'] + record['secondary_ingredients']:
            name = ing["name"]
            amount = ing["amount"]
            unit = ing.get("unit", "กรัม")
            amount_in_grams = convert_to_grams(name, amount, unit)

            if name in nutrition_data:
                nutri = nutrition_data[name]
                total_base["calories"] += (nutri["energy_kcal"] * amount_in_grams) / 100
                total_base["protein"] += (nutri["protein_g"] * amount_in_grams) / 100
                total_base["fat"] += (nutri["fat_g"] * amount_in_grams) / 100
                total_base["carbs"] += (nutri["carbohydrate_g"] * amount_in_grams) / 100
                total_base["sugar"] += (nutri["sugar_g"] or 0) * amount_in_grams / 100
                total_base["sodium"] += (nutri["sodium_mg"] or 0) * amount_in_grams / 100

        # ✅ คำนวณโภชนาการตามหน่วยที่ผู้ใช้เลือก
        ratio = float(record['user_servings']) / float(record['servings'] or 1)
        total_user = {key: value * ratio for key, value in total_base.items()}

        # ✅ ใส่ข้อมูลลงใน record
        record['nutrition'] = {
            "total": total_base,
            "user_selected": total_user
        }
        record['user_servings'] = float(record['user_servings'])

        return render_template("view_selected_menu.html", recipe=record, selected_id=selected_id)

    except mysql.connector.Error as err:
        return f"เกิดข้อผิดพลาด: {err}", 500

    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals() and conn.is_connected(): conn.close()

@users_bp.route('/edit-selected-menu/<int:selected_id>', methods=['GET', 'POST'])
def edit_selected_menu(selected_id):
    if "user" not in session or "id" not in session["user"]:
        return redirect(url_for("auth.login"))

    user_id = session["user"]["id"]
    conn = mysql.connector.connect(
        host='localhost',
        user='root',
        password='',
        database='recipes_db'
    )
    cursor = conn.cursor(dictionary=True)

    if request.method == 'POST':
        user_servings = request.form.get("user_servings")
        primary = json.loads(request.form.get("primary_ingredients") or "[]")
        secondary = json.loads(request.form.get("secondary_ingredients") or "[]")

        # ✅ ตรวจสอบวัตถุดิบหลักต้องมีอย่างน้อย 1 ชนิด และมีปริมาณ > 0
        if not primary or not any(float(p.get("amount", 0)) > 0 for p in primary):
            cursor.close()
            conn.close()
            return jsonify({"error": "กรุณาเพิ่มวัตถุดิบหลักอย่างน้อย 1 ชนิด และปริมาณมากกว่า 0"}), 400

        cursor.execute('''
            UPDATE user_selected_menus
            SET ingredients=%s, secondary_ingredients=%s, user_servings=%s
            WHERE id=%s AND user_id=%s
        ''', (json.dumps(primary, ensure_ascii=False),json.dumps(secondary, ensure_ascii=False),user_servings, selected_id, user_id))

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True})

    # GET - โหลดข้อมูลเมนู
    cursor.execute('''
        SELECT usm.id, usm.recipe_id, usm.ingredients, usm.secondary_ingredients, usm.user_servings,
               r.name, r.image_url, r.servings
        FROM user_selected_menus usm
        JOIN recipes r ON usm.recipe_id = r.id
        WHERE usm.id = %s AND usm.user_id = %s
    ''', (selected_id, user_id))

    record = cursor.fetchone()
    cursor.close()
    conn.close()

    if not record:
        return "ไม่พบเมนูที่เลือก", 404

    record['primary_ingredients'] = process_ingredients(record.get("ingredients"))
    record['secondary_ingredients'] = process_ingredients(record.get("secondary_ingredients"))
    record['id'] = selected_id  # เพื่อให้ใช้ใน template เป็น recipe.id ได้

    # ✅ เพิ่มการแปลง converted_display
    for ing in record['primary_ingredients'] + record['secondary_ingredients']:
        ing["converted_display"] = display_converted_amount(ing["name"], ing["amount"], ing.get("unit", "กรัม"))

    return render_template("edit_selected_menu.html", recipe=record)

@users_bp.route('/convert_display', methods=['POST'])
def convert_display():
    data = request.json
    name = data.get('name')
    amount = data.get('amount')
    unit = data.get('unit')

    if not all([name, amount, unit]):
        return jsonify({"converted": f"{amount} {unit}"})

    try:
        converted = display_converted_amount(name, float(amount), unit)
        return jsonify({"converted": converted})
    except:
        return jsonify({"converted": f"{amount} {unit}"})
    
@users_bp.route('/calculate_nutrition_preview', methods=['POST'])
def calculate_nutrition_preview():
    data = request.json
    ingredients = data.get("ingredients", [])
    secondary_ingredients = data.get("secondary_ingredients", [])
    user_servings = float(data.get("user_servings", 1))
    recipe_servings = float(data.get("recipe_servings", 1))

    try:
        conn = mysql.connector.connect(
            host='localhost', user='root', password='', database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""SELECT * FROM ingredient_nutrition""")
        nutrition_data = {row["ingredient_name"]: row for row in cursor.fetchall()}

        total = {
            "calories": 0, "protein": 0, "fat": 0,
            "carbs": 0, "sugar": 0, "sodium": 0
        }

        ratio = user_servings / recipe_servings

        for ing in ingredients + secondary_ingredients:
            name = ing["name"]
            amount = ing["amount"] * ratio
            unit = ing.get("unit", "กรัม")
            grams = convert_to_grams(name, amount, unit)

            if name in nutrition_data:
                nutri = nutrition_data[name]
                total["calories"] += (nutri["energy_kcal"] * grams) / 100
                total["protein"] += (nutri["protein_g"] * grams) / 100
                total["fat"] += (nutri["fat_g"] * grams) / 100
                total["carbs"] += (nutri["carbohydrate_g"] * grams) / 100
                total["sugar"] += (nutri["sugar_g"] or 0) * grams / 100
                total["sodium"] += (nutri["sodium_mg"] or 0) * grams / 100

        return jsonify({k: round(v, 2) for k, v in total.items()}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@users_bp.route("/get_bmi")
def get_bmi():
    if "user" not in session or "id" not in session["user"]:
        return jsonify({"error": "ไม่ได้เข้าสู่ระบบ"}), 403

    user_id = session["user"]["id"]

    try:
        conn = mysql.connector.connect(
            host="localhost", user="root", password="", database="recipes_db"
        )
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT weight, height FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        conn.close()

        if not user or not user["weight"] or not user["height"]:
            return jsonify({"error": "ยังไม่มีข้อมูลน้ำหนักหรือส่วนสูง"}), 400

        from ai_model import calculate_bmi
        result = calculate_bmi(user["weight"], user["height"])
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@users_bp.route('/general-menus')
def general_menus():
    if "user" not in session or "id" not in session["user"]:
        return redirect(url_for("auth.login"))

    try:
        from ai_model import process_ingredients, display_converted_amount, convert_to_grams

        conn = mysql.connector.connect(
            host='localhost', user='root', password='', database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT r.id, r.name, r.image_url, r.ingredients, r.secondary_ingredients,
                r.servings, c.name AS category, c.id AS category_id
            FROM recipes r
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE JSON_CONTAINS(r.menu_type, '"general"')
            ORDER BY c.id ASC, r.name ASC
        """)

        recipes = cursor.fetchall()

        cursor.execute("SELECT * FROM ingredient_nutrition")
        nutrition_data = {row["ingredient_name"]: row for row in cursor.fetchall()}

        for recipe in recipes:
            recipe["image_url"] = recipe.get("image_url") or "default.jpg"
            recipe["primary_ingredients"] = process_ingredients(recipe.get("ingredients"))
            recipe["secondary_ingredients"] = process_ingredients(recipe.get("secondary_ingredients"))

            # ✅ เตรียมข้อมูลแสดงผล
            for ing in recipe["primary_ingredients"] + recipe["secondary_ingredients"]:
                ing["converted_display"] = display_converted_amount(ing["name"], ing["amount"], ing.get("unit", "กรัม"))

            # ✅ เริ่มต้นค่ารวมสารอาหาร (จากวัตถุดิบหลักเท่านั้น)
            total_calories = 0
            total_protein = 0
            total_fat = 0
            total_carbs = 0
            total_sugar = 0
            total_sodium = 0

            for ing in recipe["primary_ingredients"] + recipe["secondary_ingredients"]:
                grams = convert_to_grams(ing["name"], ing["amount"], ing.get("unit", "กรัม"))
                nutri = nutrition_data.get(ing["name"])
                if nutri:
                    total_calories += (nutri["energy_kcal"] * grams) / 100 if nutri["energy_kcal"] else 0
                    total_protein += (nutri["protein_g"] * grams) / 100 if nutri["protein_g"] else 0
                    total_fat += (nutri["fat_g"] * grams) / 100 if nutri["fat_g"] else 0
                    total_carbs += (nutri["carbohydrate_g"] * grams) / 100 if nutri["carbohydrate_g"] else 0
                    total_sugar += (nutri["sugar_g"] * grams) / 100 if nutri["sugar_g"] else 0
                    total_sodium += (nutri["sodium_mg"] * grams) / 100 if nutri["sodium_mg"] else 0

            servings = recipe.get("servings") or 1
            recipe["calories_per_serving"] = round(total_calories / servings, 2)

            # ✅ เพิ่มสารอาหารต่อเสิร์ฟ
            recipe["protein"] = round(total_protein / servings, 2)
            recipe["fat"] = round(total_fat / servings, 2)
            recipe["carbs"] = round(total_carbs / servings, 2)
            recipe["sugar"] = round(total_sugar / servings, 2)
            recipe["sodium"] = round(total_sodium / servings, 2)

            recipe["category"] = recipe.get("category") or "ไม่มีหมวดหมู่"

        cursor.close()
        conn.close()

        return render_template("general_menus.html", recipes=recipes)

    except mysql.connector.Error as err:
        return f"Database error: {err}", 500

@users_bp.route('/save-menu-no-deduct', methods=['POST'])
def save_menu_without_deduct():
    if "user" not in session or "id" not in session["user"]:
        if request.is_json:
            return jsonify({"success": False, "error": "unauthorized"}), 403
        return redirect(url_for("auth.login"))

    user_id = session["user"]["id"]

    try:
        # ✅ ตรวจว่าเป็น JSON หรือ form
        if request.is_json:
            data = request.get_json()
            recipe_id = data.get("recipe_id")
            servings = data.get("user_servings", "1")
            primary = data.get("primary_ingredients", [])
            secondary = data.get("secondary_ingredients", [])
        else:
            recipe_id = request.form.get("recipe_id")
            servings = request.form.get("user_servings", "1")
            primary = json.loads(request.form.get("primary_ingredients") or "[]")
            secondary = json.loads(request.form.get("secondary_ingredients") or "[]")

        # ✅ บันทึกลงฐานข้อมูล
        conn = mysql.connector.connect(
            host="localhost", user="root", password="", database="recipes_db"
        )
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO user_selected_menus (user_id, recipe_id, ingredients, secondary_ingredients, user_servings)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            recipe_id,
            json.dumps(primary, ensure_ascii=False),
            json.dumps(secondary, ensure_ascii=False),
            servings
        ))

        conn.commit()
        cursor.close()
        conn.close()

        # ✅ ตอบกลับตามประเภท request
        if request.is_json:
            return jsonify({"success": True})
        else:
            flash("บันทึกเมนูสำเร็จ", "success")
            return redirect(url_for("users.general_menus"))

    except Exception as e:
        if request.is_json:
            return jsonify({"success": False, "error": str(e)}), 500
        return f"เกิดข้อผิดพลาด: {e}", 500

@users_bp.route('/about')
def about():
        # ตรวจสอบว่ามี user_id ใน session หรือไม่
    if "user" not in session or "id" not in session["user"]:
        flash('กรุณาเข้าสู่ระบบก่อน!', 'danger')  # แสดงข้อความแจ้งเตือน
        return redirect(url_for('auth.login'))  # รีไดเรกต์ไปหน้าเข้าสู่ระบบ

    return render_template("about.html")
