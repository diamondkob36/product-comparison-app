document.addEventListener("DOMContentLoaded", function () {
  const buttons = document.querySelectorAll(".btn-save-menu");

  buttons.forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;
      const servings = button.dataset.servings;
      const primary = JSON.parse(button.dataset.primary || "[]");
      const secondary = JSON.parse(button.dataset.secondary || "[]");

      // ✅ แทน confirm ด้วย SweetAlert2
      const result = await Swal.fire({
        title: 'ยืนยันการบันทึก',
        text: 'คุณต้องการบันทึกเมนูนี้หรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        scrollbarPadding: false,
        heightAuto: false
      });
      if (!result.isConfirmed) return;

      fetch("/users/save-menu-no-deduct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: id,
          user_servings: servings,
          primary_ingredients: primary,
          secondary_ingredients: secondary
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            Swal.fire({
              icon: 'success',
              title: 'สำเร็จ!',
              text: 'บันทึกเมนูสำเร็จ',
              timer: 1000,
              timerProgressBar: true,
              showConfirmButton: false,
              heightAuto: false
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'เกิดข้อผิดพลาด',
              text: 'ไม่สามารถบันทึกเมนูได้',
              scrollbarPadding: false,
              heightAuto: false
            });
          }
        })
        .catch(() => {
          Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
            scrollbarPadding: false,
            heightAuto: false
          });
        });
    });
  });
});

function showFlashPopup(message, type) {
    const box = document.createElement("div");
    box.className = "flash-popup " + type;
    box.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(box);

    // เริ่มจากเลื่อนขึ้นนิดๆ แล้วเลื่อนลง
    box.style.opacity = "0";
    box.style.transform = "translateX(-50%) translateY(-20px)";
    requestAnimationFrame(() => {
        box.style.transition = "all 0.3s ease";
        box.style.opacity = "1";
        box.style.transform = "translateX(-50%) translateY(0)";
    });

    setTimeout(() => {
        box.style.opacity = "0";
        box.style.transform = "translateX(-50%) translateY(-20px)";
    }, 2000);

    setTimeout(() => {
        box.remove();
    }, 3000);
}

function updatePlaceholderVisibility() {
  const placeholders = document.querySelectorAll(".js-removable");
  const shouldHide = window.innerWidth <= 1024; // ✅ ปิดบนแท็บเล็ต & มือถือ

  placeholders.forEach(card => {
    card.style.display = shouldHide ? "none" : "flex";
  });
}

window.addEventListener("DOMContentLoaded", updatePlaceholderVisibility);
window.addEventListener("resize", updatePlaceholderVisibility);

document.addEventListener("DOMContentLoaded", function () {
  const nameInput = document.getElementById("menu-search-name");
  const categoryInput = document.getElementById("menu-search-category");

  function filterMenus() {
    const nameQuery = nameInput.value.toLowerCase();
    const categoryQuery = categoryInput.value.toLowerCase();

    const categories = document.querySelectorAll(".category-block");
    let totalVisibleMenus = 0;
    let visibleCategories = 0;

    categories.forEach(catBlock => {
      const catTitle = catBlock.querySelector(".category-title").textContent.toLowerCase();
      const menuCards = catBlock.querySelectorAll(".menu-card.single-column:not(.placeholder)");

      let categoryHasVisible = false;

      menuCards.forEach(card => {
        const title = card.querySelector("h3").textContent.toLowerCase();
        const isNameMatch = title.includes(nameQuery);
        const isCategoryMatch = catTitle.includes(categoryQuery);

        const visible = isNameMatch && isCategoryMatch;
        card.style.display = visible ? "flex" : "none";

        if (visible) {
          categoryHasVisible = true;
          totalVisibleMenus++;
        }
      });

      catBlock.style.display = categoryHasVisible ? "block" : "none";
      if (categoryHasVisible) visibleCategories++;
    });

    // สรุปผลการค้นหา
    const summary = document.getElementById("search-summary");
    summary.textContent = nameQuery || categoryQuery
      ? `พบ ${totalVisibleMenus} เมนู ใน ${visibleCategories} หมวดหมู่`
      : "";

    // จัดการข้อความไม่พบผลลัพธ์
    const noResultMessageId = "no-results-message";
    let existingMsg = document.getElementById(noResultMessageId);

    if (totalVisibleMenus === 0) {
      if (!existingMsg) {
        const msg = document.createElement("p");
        msg.id = noResultMessageId;
        msg.className = "text-neutral text-center";
        msg.innerHTML = `<i class="fas fa-search text-warning"></i> ไม่พบเมนูที่ตรงกับคำค้นหา`;
        document.querySelector(".menu-grid").prepend(msg);
      }
    } else {
      if (existingMsg) existingMsg.remove();
    }
    updateCategoryJumpButtons();
  }

  const clearBtn = document.getElementById("clear-search");
  clearBtn.addEventListener("click", () => {
    nameInput.value = "";
    categoryInput.value = "";
    filterMenus();
  });

  nameInput.addEventListener("input", filterMenus);
  categoryInput.addEventListener("input", filterMenus);
  updateCategoryJumpButtons();
});

function updateCategoryJumpButtons() {
  const container = document.getElementById("category-jump-buttons");
  container.innerHTML = "";

  const visibleCategories = Array.from(document.querySelectorAll(".category-block"))
    .filter(block => block.style.display !== "none");

  visibleCategories.forEach(block => {
    const titleEl = block.querySelector(".category-title");
    const categoryName = titleEl.textContent.replace("อาหารประเภท:", "").trim();

    const btn = document.createElement("button");
    btn.className = "category-jump-btn";
    btn.textContent = categoryName;
    btn.title = `เลื่อนไปยังหมวดหมู่: ${categoryName}`;
    btn.addEventListener("click", () => {
      block.scrollIntoView({ behavior: "smooth" });
    });

    container.appendChild(btn);
  });
}

