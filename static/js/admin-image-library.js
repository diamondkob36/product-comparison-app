document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  const captionText = document.getElementById("caption");
  const closeBtn = document.querySelector(".close");

  document.querySelectorAll(".image-link").forEach(link => {
    link.addEventListener("click", () => {
      modal.style.display = "block";

      // ซ่อนรูปก่อนโหลดใหม่
      modalImg.style.opacity = 0;
      modalImg.src = ""; 

      // ตั้งค่า src ใหม่
      const newSrc = link.getAttribute("data-img");
      modalImg.src = newSrc;
      captionText.innerHTML = link.innerText;

      // แสดงรูปแบบ fade-in เมื่อโหลดเสร็จ
      modalImg.onload = () => {
        modalImg.style.opacity = 1;
      };
    });
  });

  closeBtn.onclick = () => {
    modal.style.display = "none";
    modalImg.src = ""; // เคลียร์รูปออกตอนปิด
  };

  window.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
      modalImg.src = ""; // เคลียร์รูปออกตอนปิด
    }
  };
});
