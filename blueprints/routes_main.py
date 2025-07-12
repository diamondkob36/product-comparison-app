from flask import Blueprint, render_template, redirect, url_for

# สร้าง Blueprint
main_bp = Blueprint('main', __name__, template_folder='../main')

@main_bp.route('/')
def home():
    return redirect(url_for('auth.login'))
