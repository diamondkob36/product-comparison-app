import mysql.connector

def get_db_connection():
    return mysql.connector.connect(
        host='localhost',
        user='root',
        password='',
        database='recipes_db'
    )

def get_all_ingredient_units():
    return _get_all("ingredient_units")

def get_all_recipes():
    return _get_all("recipes")

def get_all_users():
    return _get_all("users")

def get_all_unit_conversions():
    return _get_all("unit_conversions")

def get_all_categories():
    return _get_all("categories")

def get_all_ingredient_categories():
    return _get_all("ingredient_categories")

def get_all_ingredient_nutrition():
    return _get_all("ingredient_nutrition")

def get_all_user_ingredients():
    return _get_all("user_ingredients")

def get_all_user_selected_menus():
    return _get_all("user_selected_menus")


# 🔁 ฟังก์ชันกลางสำหรับ SELECT *
def _get_all(table_name):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(f"SELECT * FROM {table_name}")
    results = cursor.fetchall()
    cursor.close()
    conn.close()
    return results

def get_count_from_table(table_name):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cursor.fetchone()[0]
    cursor.close()
    conn.close()
    return count