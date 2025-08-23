from flask import Blueprint, session, redirect,url_for, flash, render_template

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

    return render_template('admin-index.html')