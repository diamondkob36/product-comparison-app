document.addEventListener("DOMContentLoaded", () => {
    const flashEl = document.getElementById("flash-data");
    const alertBox = document.getElementById("custom-alert");

    if (flashEl && alertBox) {
        const category = flashEl.dataset.category; // success / error / info
        const message = flashEl.dataset.message;

        // ใส่ข้อความ
        alertBox.textContent = message;

        // ลบคลาสเดิมก่อน
        alertBox.className = "custom-alert hidden";

        // ใส่คลาสตามประเภท
        alertBox.classList.add(category); // เช่น .success
        alertBox.classList.remove("hidden");
        alertBox.classList.add("show");

        // หายไปเองใน 3 วินาที
        setTimeout(() => {
            alertBox.classList.remove("show");
            alertBox.classList.add("hidden");
        }, 3000);
    }
});
