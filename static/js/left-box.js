document.addEventListener('DOMContentLoaded', () => {
    const scrollToTopButton = document.querySelector('.scroll-to-top');
    const tooltip = document.getElementById('tooltip');
    const logoutButton = document.querySelector('.logout-button');
    const menuGeneralButton = document.querySelector('.menuGeneral-Button');
    const homebutton = document.querySelector('.home-button');
    const aboutbutton = document.querySelector('.about-Button');

    // ฟังก์ชันเลื่อนกลับด้านบน
    if (scrollToTopButton) {
        // เมื่อคลิก → เลื่อนขึ้นบนอย่างสมูท
        scrollToTopButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // ✅ ตั้ง tooltip คงที่ (ไม่เปลี่ยน)
        scrollToTopButton.setAttribute('data-tooltip', 'เลื่อนกลับขึ้นด้านบน');
    }
    // ฟังก์ชันออกจากระบบ
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            window.location.href = "/auth/logout";
        });
    }

    if (menuGeneralButton) {
        menuGeneralButton.addEventListener('click', () => {
            window.location.href = "/users/general-menus";
        });
    }

    if (homebutton) {
        homebutton.addEventListener('click', () => {
            window.location.href = "/users/index";
        });
    }

    if (aboutbutton) {
        aboutbutton.addEventListener('click', () => {
            window.location.href = "/users/about";
        });
    }

    // การจัดการ Tooltip
    document.querySelectorAll('.icon-button').forEach(button => {
        button.addEventListener('mouseenter', () => {
            const tooltipText = button.getAttribute('data-tooltip');
            const tooltipIcon = button.getAttribute('data-icon');
            const rect = button.getBoundingClientRect();
            tooltip.innerHTML = `<span class="icon">${tooltipIcon}</span>${tooltipText}`;
            tooltip.style.top = `${rect.bottom + 10}px`;
            tooltip.style.left = `${rect.left}px`;
            tooltip.classList.add('show');
        });

        button.addEventListener('mouseleave', () => {
            tooltip.classList.remove('show');
        });
    });
    
});
