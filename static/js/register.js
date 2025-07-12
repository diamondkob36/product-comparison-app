document.addEventListener("DOMContentLoaded", function () {
    // ✅ ทำให้ select เป้าหมายรองรองรับ Select2
    $('#subgoal').select2({
        placeholder: "เลือกเป้าหมายรอง",
        closeOnSelect: false,
        width: '100%'
    });

    // ✅ ตรวจสอบว่ามี flash message เพื่อแสดง popup
    const flashEl = document.getElementById("flash-data");
    const alertBox = document.getElementById("custom-alert");

    if (flashEl && alertBox) {
        const category = flashEl.dataset.category;  // เช่น 'success', 'error'
        const message = flashEl.dataset.message;
        const redirectURL = flashEl.dataset.redirect; // 👈 new!

        alertBox.textContent = message;
        alertBox.className = "custom-alert " + category + " show";

        setTimeout(() => {
            alertBox.classList.remove("show");
            alertBox.classList.add("hidden");

            // ✅ ถ้ามี redirect ให้เปลี่ยนหน้าอัตโนมัติ
            if (redirectURL) {
                window.location.href = redirectURL;
            }
        }, 1500); // หรือ 3000 ก็ได้ตามต้องการ
    }
});
