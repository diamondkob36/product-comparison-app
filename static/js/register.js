document.addEventListener("DOMContentLoaded", function () {
    $('#subgoal').select2({
        placeholder: "เลือกเป้าหมายรอง",
        closeOnSelect: false,
        width: '100%'
    });

    const registerForm = document.getElementById("register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            // ✅ ดึงค่าจาก input
            const weight = parseFloat(document.getElementById("weight").value) || 0;
            const height = parseFloat(document.getElementById("height").value) || 0;
            const age = parseInt(document.getElementById("age").value) || 0;

            if (weight <=0 || height <=0 || age <=0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'ข้อมูลไม่ถูกต้อง',
                    text: 'กรุณากรอกน้ำหนัก ส่วนสูง และอายุที่มากกว่า 0',
                heightAuto: false,
                timer: 1500,
                timerProgressBar: true,
                showConfirmButton: false
                });
                return;
            }

            const formData = new FormData(registerForm);
            const payload = Object.fromEntries(formData);
            payload.subgoal = $('#subgoal').val();

            try {
                const response = await fetch("/auth/api/register", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (data.error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'เกิดข้อผิดพลาด',
                        text: data.error,
                    heightAuto: false,
                    timer: 1500,
                    timerProgressBar: true,
                    showConfirmButton: false
                    });
                    return;
                }

                Swal.fire({
                    icon: 'success',
                    title: 'สำเร็จ!',
                    text: data.message,
                heightAuto: false,
                timer: 1000,
                timerProgressBar: true,
                showConfirmButton: false
                }).then(() => {
                    window.location.href = "/auth/login";
                });
            } catch (error) {
                console.error("Error registering user:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: 'ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง',
                heightAuto: false,
                timer: 1500,
                timerProgressBar: true,
                showConfirmButton: false
                });
            }
        });
    }
});
