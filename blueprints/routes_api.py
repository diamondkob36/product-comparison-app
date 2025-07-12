from flask import Blueprint, jsonify, request
from ai_model import recommend_recipes, train_model
import mysql.connector

# สร้าง Blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

# ฝึกโมเดล Decision Tree เมื่อเริ่มต้นระบบ
model, mlb = train_model()

@api_bp.route('/recommend', methods=['POST'])
def recommend():
    try:
        # ตรวจสอบว่า Content-Type เป็น JSON หรือไม่
        if not request.is_json:
            return jsonify({"error": "Invalid Content-Type. Expected application/json"}), 415

        data = request.get_json()
        ingredients = data.get('ingredients', [])

        if not ingredients:
            return jsonify({"error": "No ingredients provided"}), 400

        # เรียกฟังก์ชัน recommend_recipes
        recommendations = recommend_recipes(ingredients, model, mlb)

        return jsonify(recommendations)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/get_ingredients', methods=['GET'])
def get_ingredients():
    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='recipes_db'
        )
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT id, ingredient_name AS name, unit FROM ingredient_units')
        ingredients = cursor.fetchall()
        return jsonify({"ingredients": ingredients})
    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()