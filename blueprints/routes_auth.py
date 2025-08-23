from flask import Blueprint, render_template, redirect, url_for, request, session, flash, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# 🔹 เพิ่มผู้ใช้ลงฐานข้อมูล
def add_user_to_db(username, name, hashed_password, weight, height, age, gender, activity_level, goal, subgoal):
    conn = mysql.connector.connect(
        host='localhost',
        user='root',
        password='',
        database='recipes_db'
    )
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (username, name, password, weight, height, age, gender, activity_level, goal, subgoal)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (username, name, hashed_password, weight, height, age, gender, activity_level, goal, subgoal))
    conn.commit()
    cursor.close()
    conn.close()

# 🔍 ค้นหาผู้ใช้จากชื่อผู้ใช้ (username)
def get_user_by_username(username):
    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM users WHERE username = %s', (username,))
        user = cursor.fetchone()
    except mysql.connector.Error as e:
        print(f"Database error: {e}")
        user = None
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()
    return user

# 🔹 หน้า Register (แค่เสิร์ฟฟอร์ม)
@auth_bp.route('/register', methods=['GET'])
def register():
    return render_template('register.html')

# 🔹 API Register (รับ JSON)
@auth_bp.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()

    name = data.get('name')
    username = data.get('username')
    password = data.get('password')
    weight = data.get('weight')
    height = data.get('height')
    age = data.get('age')
    gender = data.get('gender')
    activity_level = data.get('activity_level')
    goal = data.get('goal')
    subgoal_list = data.get('subgoal') or []
    subgoal = ','.join(subgoal_list) if subgoal_list else None

    # ✅ ตรวจสอบค่าห้าม <= 0
    try:
        weight_val = float(weight)
        height_val = float(height)
        age_val = int(age)
        if weight_val <= 0 or height_val <= 0 or age_val <= 0:
            return jsonify({"error": "น้ำหนัก ส่วนสูง และอายุ ต้องมากกว่า 0"}), 400
    except ValueError:
        return jsonify({"error": "กรุณากรอกข้อมูลน้ำหนัก ส่วนสูง และอายุให้ถูกต้อง"}), 400

    # 🔍 ตรวจสอบชื่อผู้ใช้ซ้ำ
    user = get_user_by_username(username)
    if user:
        return jsonify({"error": "ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว!"}), 400

    # ✅ แฮชรหัสผ่าน
    hashed_password = generate_password_hash(password)
    add_user_to_db(username, name, hashed_password, weight, height, age,
                   gender, activity_level, goal, subgoal)

    return jsonify({"message": "สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ"}), 200

# 🔹 ล็อกอิน
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    return render_template('login.html')

@auth_bp.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = get_user_by_username(username)

    if user and check_password_hash(user['password'], password):
        session["user"] = {
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "role": user["role"]  # ✅ เก็บ role ลง session
        }
        return jsonify({
            "message": "เข้าสู่ระบบสำเร็จ!",
            "role": user["role"]  # ✅ ส่ง role กลับมาด้วย
        }), 200

    return jsonify({"error": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"}), 401


# 🔹 ออกจากระบบ
@auth_bp.route('/logout')
def logout():
    session.clear()  # ✅ ล้าง session ทั้งหมด
    return redirect(url_for('main.home'))


