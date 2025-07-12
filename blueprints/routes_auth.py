from flask import Blueprint, render_template, redirect, url_for, request, session, flash
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

# 🔹 สมัครสมาชิก
@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form['name']
        username = request.form['username']
        password = request.form['password']
        weight = request.form['weight']
        height = request.form['height']
        age = request.form['age']
        gender = request.form['gender']
        activity_level = request.form['activity_level']
        goal = request.form['goal']

        # ✅ รับค่าจาก <select multiple> ด้วย getlist()
        subgoal_list = request.form.getlist('subgoal')
        subgoal = ','.join(subgoal_list) if subgoal_list else None

        # 🔍 ตรวจสอบว่าชื่อผู้ใช้ซ้ำหรือไม่
        user = get_user_by_username(username)
        if user:
            flash("ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว!", "register-username-error")
            return redirect(url_for('auth.register'))

        # ✅ แฮชรหัสผ่านก่อนบันทึก
        hashed_password = generate_password_hash(password)
        add_user_to_db(username, name, hashed_password, weight, height, age,
                       gender, activity_level, goal, subgoal)

        flash("สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ", "register-success")
        return render_template('register.html')

    return render_template('register.html')

# 🔹 ล็อกอิน
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        user = get_user_by_username(username)

        # 🔐 ตรวจสอบรหัสผ่านแบบแฮช
        if user and check_password_hash(user['password'], password):
            session["user"] = {
                "id": user["id"],
                "username": user["username"],
                "name": user["name"],
            }
            flash('เข้าสู่ระบบสำเร็จ!', 'login-success')
            return redirect(url_for('users.homeuser'))
        else:
            flash('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'login-error')
            return redirect(url_for('auth.login'))

    return render_template('login.html')

# 🔹 ออกจากระบบ
@auth_bp.route('/logout')
def logout():
    session.clear()
    flash('ออกจากระบบสำเร็จ!', 'success')
    return redirect(url_for('main.home'))
