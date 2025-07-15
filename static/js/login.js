document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(loginForm);
      const payload = Object.fromEntries(formData);

      try {
        const response = await fetch("/auth/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: data.error || 'เกิดข้อผิดพลาด ไม่สามารถเข้าสู่ระบบได้',
            heightAuto: false,
            timer: 1000,
            showConfirmButton: false,
            timerProgressBar: true
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
          window.location.href = "/users/index"; // หรือ path ที่คุณใช้จริง
        });

      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
        heightAuto: false,
        timer: 1500,
        showConfirmButton: false,
        timerProgressBar: true
        });
      }
    });
  }
});
