document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('menu');
    const closeMenu = document.getElementById('close-menu');

    menuToggle.addEventListener('click', () => {
        menu.classList.add('show');
        menuToggle.style.display = 'none';
        document.body.classList.add('no-scroll');  // ✅ ป้องกัน scroll ด้านหลัง
    });

    closeMenu.addEventListener('click', () => {
        menu.classList.remove('show');
        menuToggle.style.display = 'block';
        document.body.classList.remove('no-scroll');  // ✅ เปิด scroll กลับ
    });
});
