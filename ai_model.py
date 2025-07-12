import mysql.connector
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.metrics.pairwise import cosine_similarity
import json

def load_recipes():
    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor()

        # ✅ เพิ่ม `servings` ในคำสั่ง SQL
        cursor.execute('''
            SELECT id, name, ingredients, secondary_ingredients, instructions, image_url, category_id, servings 
            FROM recipes 
            WHERE JSON_CONTAINS(menu_type, '"system"')
        ''')

        recipes = []
        for row in cursor.fetchall():
            # ✅ ป้องกัน NULL ใน image_url
            image_url = row[5] if row[5] is not None else "default.jpg"

            # ✅ ป้องกัน NULL หรือค่าว่างใน ingredients และ secondary_ingredients
            ingredients = json.loads(row[2]) if row[2] else []
            secondary_ingredients = json.loads(row[3]) if row[3] else []

            # ✅ ป้องกัน NULL ใน instructions
            instructions = row[4] if row[4] else ""

            # ✅ ป้องกัน NULL ใน servings (ถ้า NULL ให้ใช้ค่าเริ่มต้นเป็น 1)
            servings = row[7] if row[7] is not None else 1

            recipes.append({
                'id': row[0],  
                'name': row[1],
                'ingredients': ingredients,
                'secondary_ingredients': secondary_ingredients,
                'instructions': instructions,
                'image_url': image_url,
                'category_id': row[6],
                'servings': servings  # ✅ เพิ่ม servings
            })
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        recipes = []
    finally:
        if conn.is_connected():
            conn.close()
    return recipes

def load_categories():
    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor()
        cursor.execute('SELECT id, name FROM categories')
        categories = {row[0]: row[1] for row in cursor.fetchall()}
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        categories = {}
    finally:
        if conn.is_connected():
            conn.close()
    return categories

# ฟังก์ชันโหลดข้อมูลแคลอรี่ของวัตถุดิบ
def load_nutrition():
    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor()
        cursor.execute('SELECT ingredient_name, energy_kcal FROM ingredient_nutrition')
        nutrition = {row[0]: row[1] for row in cursor.fetchall()}
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        nutrition = {}
    finally:
        if conn.is_connected():
            conn.close()
    return nutrition

# ฟังก์ชันสำหรับฝึกโมเดล Decision Tree
def train_model():
    recipes = load_recipes()
    if not recipes:
        raise ValueError("No recipes found. Please check your database.")

    recipe_names = [recipe['name'] for recipe in recipes]
    ingredients = [recipe['ingredients'] for recipe in recipes]

    # แปลงวัตถุดิบเป็นข้อมูลเชิงตัวเลข
    mlb = MultiLabelBinarizer()
    ingredient_matrix = mlb.fit_transform(
        [[item['name'] for item in ing if item['name']] for ing in ingredients]
    )

    # สร้างและฝึกโมเดล
    model = DecisionTreeClassifier(random_state=42)
    model.fit(ingredient_matrix, recipe_names)

    return model, mlb

def recommend_recipes(available_ingredients, model, mlb):
    recipes = load_recipes()
    categories = load_categories()
    calories_data = load_nutrition()

    available_dict = {ing['name']: ing for ing in available_ingredients}

    recipe_matrix = mlb.transform(
        [[item['name'] for item in recipe['ingredients']] for recipe in recipes]
    )
    available_vector = mlb.transform([[ing['name'] for ing in available_ingredients]])[0]

    similarity_scores = cosine_similarity([available_vector], recipe_matrix).flatten()

    full_match_recipes = []  # ✅ เมนูที่มีวัตถุดิบหลักครบ
    partial_match_recipes = []  # ✅ เมนูที่มีวัตถุดิบหลักแต่ไม่ครบ

    for i, recipe in enumerate(recipes):
        total_calories = 0
        weighted_score = 0
        match_count = 0
        total_count = len(recipe['ingredients'])

        primary_ingredients = []
        secondary_ingredients = []
        all_ingredients_match = True  
        has_primary_ingredients = False  

        for ing in recipe['ingredients']:
            name, amount, unit = ing['name'], ing['amount'], ing['unit']
            status = "ไม่มี"

            if name in available_dict:
                has_primary_ingredients = True  # ✅ มีวัตถุดิบหลักอย่างน้อย 1 อย่าง
                available_amount = available_dict[name]['amount']

                if available_amount >= amount:
                    match_count += 1
                    weighted_score += 1
                    status = "ครบ"
                elif available_amount > 0:
                    match_count += available_amount / amount
                    weighted_score += available_amount / amount
                    status = f"มีไม่เพียงพอ ({available_amount}/{amount})"
                    all_ingredients_match = False
                else:
                    status = "ไม่มี"
                    all_ingredients_match = False
            else:
                status = "ไม่มี"
                all_ingredients_match = False

            if name in calories_data:
                amount_in_grams = convert_to_grams(name, amount, unit)
                total_calories += (amount_in_grams / 100) * calories_data[name]

            primary_ingredients.append({
                "name": name,
                "amount": amount,
                "unit": unit,
                "status": status,
                "converted_display": display_converted_amount(name, amount, unit)
            })

        for ing in recipe['secondary_ingredients']:
            name, amount, unit = ing['name'], ing['amount'], ing['unit']
            status = "ไม่มี"

            if name in available_dict:
                available_amount = available_dict[name]['amount']
                if available_amount >= amount:
                    status = "ครบ"
                elif available_amount > 0:
                    status = f"มีไม่เพียงพอ ({available_amount}/{amount})"
                else:
                    status = "ไม่มี"

            if name in calories_data:
                amount_in_grams = convert_to_grams(name, amount, unit)
                total_calories += (amount_in_grams / 100) * calories_data[name]

            secondary_ingredients.append({
                "name": name,
                "amount": amount,
                "unit": unit,
                "status": status,
                "converted_display": display_converted_amount(name, amount, unit)
            })

        similarity = (similarity_scores[i] * weighted_score / total_count) * 100 if total_count > 0 else 0

        # ✅ เงื่อนไขใหม่: ถ้า similarity = 0 และไม่มีวัตถุดิบหลักเลย → ไม่ต้องเพิ่มในผลลัพธ์
        if similarity == 0 or not has_primary_ingredients:
            continue

        # ✅ ดึงจำนวน servings จากฐานข้อมูล
        servings = recipe.get("servings", 1)  # ถ้าไม่มี ให้ค่าเริ่มต้นเป็น 1

        # ✅ คำนวณพลังงานต่อหน่วยการแบ่งทาน
        calories_per_serving = total_calories / servings if servings > 0 else total_calories

        recipe_data = {
            'id': recipe['id'],
            'name': recipe['name'],
            'category': categories.get(recipe['category_id'], f"ประเภท {recipe['category_id']}"),
            'similarity': similarity,
            'stars': similarity_to_stars(similarity),
            'calories': round(total_calories, 2),
            'calories_per_serving': round(calories_per_serving, 2),
            'servings': servings,
            'match': match_count,
            'total': total_count,
            'image_url': recipe['image_url'],
            'primary_ingredients': primary_ingredients,
            'secondary_ingredients': secondary_ingredients,
        }

        if all_ingredients_match:
            full_match_recipes.append(recipe_data)  
        else:
            partial_match_recipes.append(recipe_data)  

    def categorize_and_sort(recipes_list):
        categorized_results = {}
        for recipe in recipes_list:
            category = recipe['category']
            if category not in categorized_results:
                categorized_results[category] = []
            categorized_results[category].append(recipe)

        for category in categorized_results:
            # 🔻 เรียงตาม similarity มาก → น้อย และตัดแค่ 5 เมนู
            categorized_results[category] = sorted(
                categorized_results[category], key=lambda x: -x['similarity']
            )[:5]
        
        return sorted(
            categorized_results.items(),
            key=lambda x: max(recipe['similarity'] for recipe in x[1]),
            reverse=True
        ) if categorized_results else []

    return {
        "full_match": categorize_and_sort(full_match_recipes),
        "partial_match": categorize_and_sort(partial_match_recipes)
    }

# ฟังก์ชันแปลง similarity เป็นดาวแบบใช้ไอคอน Font Awesome
def similarity_to_stars(similarity):
    max_stars = 5
    stars = (similarity / 100) * max_stars
    full_stars = int(stars)
    has_half_star = stars - full_stars >= 0.5
    empty_stars = max_stars - full_stars - (1 if has_half_star else 0)

    # สร้าง HTML string สำหรับดาว
    result = ''
    result += '<i class="fas fa-star text-gold"></i>' * full_stars
    if has_half_star:
        result += '<i class="fas fa-star-half-alt text-gold"></i>'
    result += '<i class="far fa-star text-gold"></i>' * empty_stars

    return result  # คืนค่าเป็น string เช่นเดิม


def calculate_bmr_tdee(weight, height, age, gender, activity_level):
    """
    คำนวณ BMR และ TDEE
    Parameters:
        - weight: น้ำหนัก (กิโลกรัม)
        - height: ส่วนสูง (เซนติเมตร)
        - age: อายุ (ปี)
        - gender: เพศ ('ชาย', 'หญิง')
        - activity_level: ระดับกิจกรรม
    Returns:
        - bmr: พลังงานพื้นฐาน (kcal)
        - tdee: พลังงานที่ใช้ต่อวัน (kcal)
    """
    if not all([weight, height, age, gender, activity_level]):
        raise ValueError("ข้อมูลไม่ครบถ้วนสำหรับการคำนวณ")

    # คำนวณ BMR
    if gender == 'ชาย':
        bmr = 66 + (13.7 * weight) + (5 * height) - (6.8 * age)
    elif gender == 'หญิง':
        bmr = 655 + (9.6 * weight) + (1.8 * height) - (4.7 * age)
    else:
        raise ValueError("เพศไม่ถูกต้อง")

    # คำนวณ TDEE ตามระดับกิจกรรม
    activity_multipliers = {
        'ไม่ออกกำลังกาย': 1.2,
        'ออกกำลังกายเบา (1-3 วัน/สัปดาห์)': 1.375,
        'ออกกำลังกายปานกลาง (3-5 วัน/สัปดาห์)': 1.55,
        'ออกกำลังกายหนัก (6-7 วัน/สัปดาห์)': 1.725,
        'ใช้แรงกายหนักมาก': 1.9
    }

    tdee = bmr * activity_multipliers.get(activity_level, 1.2)

    return round(bmr, 2), round(tdee, 2)

def calculate_daily_intake(bmr, tdee, goal=None, subgoal=None):
    """
    คำนวณปริมาณโปรตีน ไขมัน คาร์โบไฮเดรต น้ำตาล และโซเดียมที่ควรได้รับต่อวัน
    รองรับเป้าหมายรองหลายค่า เช่น ['ลดน้ำตาล', 'ลดโซเดียม']
    """
    # สัดส่วนแนะนำของพลังงานที่ได้จากสารอาหารหลัก
    protein_percentage = 0.15
    fat_percentage = 0.25
    carb_percentage = 0.60

    # ปรับค่าตามเป้าหมายหลัก
    if goal == "ลดน้ำหนัก":
        tdee -= 500
    elif goal == "เพิ่มน้ำหนัก":
        tdee += 500

    # คำนวณสารอาหารหลัก
    protein = (tdee * protein_percentage) / 4
    fat = (tdee * fat_percentage) / 9
    carb = (tdee * carb_percentage) / 4
    sugar = (tdee * 0.10) / 4  # 10% ของพลังงาน
    sodium = 2000

    # ✅ รองรับ subgoal หลายค่า
    if subgoal:
        subgoals = subgoal.split(',') if isinstance(subgoal, str) else subgoal

        if "ลดน้ำตาล" in subgoals:
            sugar *= 0.5
        if "ลดโซเดียม" in subgoals:
            sodium = 1500

    # คืนค่าที่คำนวณแล้ว
    intake = {
        "protein": round(protein, 2),
        "fat": round(fat, 2),
        "carb": round(carb, 2),
        "sugar": round(sugar, 2),
        "sodium": int(sodium),
        "tdee": round(tdee, 2)
    }

    return intake

def calculate_bmi(weight_kg, height_cm):
    """คำนวณค่า BMI และตีความผล"""
    try:
        height_m = height_cm / 100
        bmi = weight_kg / (height_m ** 2)
        bmi = round(bmi, 1)

        if bmi < 18.5:
            level = "ผอม"
            icon = '<i class="fas fa-exclamation-circle text-warning"></i>'
            advice = '<i class="fas fa-lightbulb text-warning"></i> คำแนะนำ : <i class="fas fa-weight text-warning"></i> น้ำหนักของคุณน้อยกว่ามาตรฐาน แนะนำให้เพิ่มน้ำหนักอย่างเหมาะสม'

        elif bmi < 23:
            level = "ปกติ"
            icon = '<i class="fas fa-check-circle text-success"></i>'
            advice = '<i class="fas fa-lightbulb text-warning"></i> คำแนะนำ : <i class="fas fa-heartbeat text-success"></i> น้ำหนักอยู่ในเกณฑ์ปกติ รักษาสุขภาพให้ดีต่อเนื่อง'

        elif bmi < 25:
            level = "น้ำหนักเกิน"
            icon = '<i class="fas fa-exclamation-triangle text-warning"></i>'
            advice = '<i class="fas fa-lightbulb text-warning"></i> คำแนะนำ : <i class="fas fa-running text-warning"></i> ควรระมัดระวังเรื่องการกินและออกกำลังกาย'

        elif bmi < 30:
            level = "อ้วนระดับ 1"
            icon = '<i class="fas fa-exclamation-triangle text-warning"></i>'
            advice = '<i class="fas fa-lightbulb text-warning"></i> คำแนะนำ : <i class="fas fa-utensils text-main"></i> ควบคุมอาหาร และ เพิ่มการออกกำลังกาย <i class="fas fa-dumbbell text-teal"></i>'

        else:
            level = "อ้วนระดับ 2"
            icon = '<i class="fas fa-times-circle text-danger"></i>'
            advice = '<i class="fas fa-lightbulb text-warning"></i> คำแนะนำ : <i class="fas fa-user-md text-danger"></i> แนะนำให้พบแพทย์หรือนักโภชนาการเพื่อวางแผนลดน้ำหนัก'

        return {
            "bmi": bmi,
            "level": level,
            "icon": icon,
            "advice": advice
        }

    except Exception as e:
        return {
            "bmi": None,
            "level": "ไม่สามารถคำนวณได้",
            "advice": str(e)
        }

# ฟังก์ชั่นแปลงค่า Null ในฐานข้อมูลของวัตถุดิบ
def process_ingredients(ingredient_data):
    """ แปลงข้อมูลวัตถุดิบจากฐานข้อมูลให้เป็น List JSON ที่ถูกต้อง """
    if ingredient_data is None or ingredient_data == "null":  # ✅ รองรับ NULL และ "null"
        return []  # ✅ แทนที่ NULL เป็น []
    try:
        return json.loads(ingredient_data)  # ✅ แปลง JSON string เป็น Python list
    except json.JSONDecodeError:
        return []  # ✅ ถ้า JSON ผิดพลาดให้คืนค่าเป็น []

def deduct_ingredients(user_id, ingredients):
    """
    หักสต็อกวัตถุดิบของผู้ใช้จากตาราง user_ingredients โดยตัดเฉพาะที่มี
    """
    conn = mysql.connector.connect(
        host='localhost',
        user='root',
        password='',
        database='recipes_db'
    )
    cursor = conn.cursor(dictionary=True)

    for ing in ingredients:
        name = ing["name"]
        amount_needed = ing["amount"]

        # ค้นหาวัตถุดิบจากชื่อ
        cursor.execute("""
            SELECT ui.id, ui.amount
            FROM user_ingredients ui
            JOIN ingredient_units iu ON ui.ingredient_id = iu.id
            WHERE ui.user_id = %s AND iu.ingredient_name = %s
        """, (user_id, name))
        
        row = cursor.fetchone()
        if not row:
            continue  # ถ้าไม่มีวัตถุดิบในคลังให้ข้าม

        current_amount = row["amount"]
        new_amount = max(current_amount - amount_needed, 0)

        cursor.execute("UPDATE user_ingredients SET amount = %s WHERE id = %s", (new_amount, row["id"]))

    conn.commit()
    cursor.close()
    conn.close()

def convert_to_grams(name, amount, unit):
    """
    แปลงหน่วยของวัตถุดิบจากหน่วยอื่น → กรัม
    ถ้าเป็น 'กรัม' อยู่แล้ว → คืนค่าเดิม
    ถ้าไม่พบข้อมูลการแปลง → คืน 0
    """
    if unit == "กรัม":
        return amount  # ✅ ไม่ต้องแปลง

    try:
        conn = mysql.connector.connect(
            host='localhost', user='root', password='', database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT grams_per_unit FROM unit_conversions 
            WHERE ingredient_name = %s AND unit = %s
        """, (name, unit))
        row = cursor.fetchone()

        if row and row["grams_per_unit"]:
            return amount * row["grams_per_unit"]
        else:
            return 0  # ❌ ไม่พบข้อมูล → คืน 0
    except Exception as e:
        print(f"[convert_to_grams] ERROR: {e}")
        return 0
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()

def display_converted_amount(name, amount, unit):
    """
    คืนค่าข้อความแสดงผลปริมาณ พร้อมแปลงเป็นกรัมตามเงื่อนไขที่กำหนด
    """
    unit = unit.strip()

    convert_units = {"หัว", "ใบ", "ราก", "กลีบ", "ต้น", "เม็ด", "ผล", "ช้อนชา"}
    excluded_units = {"ฟอง", "มิลลิลิตร"}

    if unit == "กรัม":
        return f"{amount} กรัม"

    if unit in excluded_units:
        return f"{amount} {unit}"

    if unit == "ช้อนโต๊ะ":
        # แปลงช้อนโต๊ะเป็นช้อนชา (1 ช้อนโต๊ะ ≈ 3 ช้อนชา)
        teaspoon_amount = amount * 3
        grams = convert_to_grams(name, amount, unit)
        return f"{amount} ช้อนโต๊ะ (~{int(teaspoon_amount)} ช้อนชา / ~{int(grams)} กรัม)" if grams > 0 else f"{amount} ช้อนโต๊ะ (~{int(teaspoon_amount)} ช้อนชา)"

    if unit in convert_units:
        grams = convert_to_grams(name, amount, unit)
        return f"{amount} {unit} (~{int(grams)} กรัม)" if grams > 0 else f"{amount} {unit} (ไม่พบข้อมูลแปลง)"

    # default fallback
    grams = convert_to_grams(name, amount, unit)
    return f"{amount} {unit} (~{int(grams)} กรัม)" if grams > 0 else f"{amount} {unit} (ไม่พบข้อมูลแปลง)"


# ฟังก์ชันหลักสำหรับการทดสอบ
if __name__ == "__main__":
    try:
        # ฝึกโมเดลจากข้อมูลในฐานข้อมูล
        print("Training model...")
        model, mlb = train_model()

        # ตัวอย่างข้อมูลวัตถุดิบที่มี (กรอกข้อมูลตามที่ต้องการ)
        available_ingredients = [
            {"name": "ไก่", "amount": 500},
            {"name": "พริกแกงเขียวหวาน", "amount": 50},
            {"name": "มะเขือเปราะ", "amount": 150},
            {"name": "ใบมะกรูด", "amount": 10}
        ]

        # แสดงวัตถุดิบที่มี
        print("\nAvailable Ingredients:")
        for ing in available_ingredients:
            print(f"- {ing['name']}: {ing['amount']}")

        # เรียกใช้ฟังก์ชันแนะนำเมนู
        print("\nRecommending recipes...")
        recommendations = recommend_recipes(available_ingredients, model, mlb)

        # แสดงผลลัพธ์
        print("\nRecommended Recipes:")
        for rec in recommendations["recommendations"]:
            print(rec)

    except Exception as e:
        print(f"An error occurred: {e}")
