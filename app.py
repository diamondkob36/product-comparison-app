from datetime import timedelta
import secrets
from flask import Flask
from blueprints.routes_main import main_bp
from blueprints.routes_api import api_bp
from blueprints.routes_auth import auth_bp
from blueprints.routes_users import users_bp
from blueprints.routes_admin import admin_bp
app = Flask(__name__)

# ตั้งค่า secret_key
app.secret_key = secrets.token_hex(32)  # ✅ ใช้ secret key แบบสุ่มเพื่อความปลอดภัย  # เปลี่ยนเป็นคีย์ที่ซับซ้อนและไม่ซ้ำกัน

app.register_blueprint(main_bp)
app.register_blueprint(api_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(users_bp, url_prefix='/users')
app.register_blueprint(admin_bp, url_prefix='/admin')

if __name__ == '__main__':
    app.run(debug=True)


# ✅ ตั้งค่าความปลอดภัยสำหรับ session
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,  # เปลี่ยนเป็น True เมื่อใช้ HTTPS
    PERMANENT_SESSION_LIFETIME=timedelta(hours=1)
)
