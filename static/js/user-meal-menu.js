document.addEventListener("DOMContentLoaded", function () {
    const resultsContainer = document.getElementById("results");

    let ingredients = []; // เก็บรายการวัตถุดิบของผู้ใช้

    // ฟังก์ชันโหลดวัตถุดิบของผู้ใช้จาก API
    window.loadUserIngredientsForRecommendation = async function loadUserIngredientsForRecommendation() {
        try {
            const response = await fetch('/users/get_user_ingredients');
            const data = await response.json();

            if (data.ingredients && data.ingredients.length > 0) {
                console.log("Raw ingredients from API:", data.ingredients); // ตรวจสอบข้อมูลดิบจาก API

                const aggregatedIngredients = {};

                data.ingredients.forEach(ing => {
                    // จัดรูปแบบข้อมูล: ตัดช่องว่างและเปลี่ยนตัวอักษรเป็นพิมพ์เล็ก
                    const normalizedName = ing.name.trim().toLowerCase();
                    const normalizedUnit = ing.unit.trim().toLowerCase();

                    // สร้างคีย์สำหรับรวมวัตถุดิบ
                    const key = `${normalizedName}-${normalizedUnit}`;

                    if (!aggregatedIngredients[key]) {
                        aggregatedIngredients[key] = {
                            name: ing.name.trim(), // แสดงชื่อในรูปแบบเดิม
                            amount: ing.amount,
                            unit: ing.unit.trim() // แสดงหน่วยในรูปแบบเดิม
                        };
                    } else {
                        aggregatedIngredients[key].amount += ing.amount; // รวมจำนวน
                    }
                });

                console.log("Aggregated ingredients:", aggregatedIngredients); // ตรวจสอบข้อมูลที่รวมแล้ว

                // แปลงกลับเป็นอาร์เรย์
                ingredients = Object.values(aggregatedIngredients);

                console.log("Ingredients array for recommendation:", ingredients); // ตรวจสอบข้อมูลสุดท้ายก่อนส่งไปแนะนำเมนู

                // เรียกฟังก์ชันแนะนำเมนู
                recommendMenu();
            } else {
                ingredients = [];
                resultsContainer.innerHTML = `
                    <div class="empty-ingredient-box">
                        <i class="fas fa-box-open fa-2x text-muted"></i>
                        <p>ไม่มีวัตถุดิบในคลัง</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error("Error loading user ingredients for recommendation:", error);
            resultsContainer.innerHTML = "<p>เกิดข้อผิดพลาดในการโหลดวัตถุดิบ</p>";
        }
    };

    // ฟังก์ชันแนะนำเมนู
    window.recommendMenu = async function recommendMenu() {
        if (!ingredients || ingredients.length === 0 || ingredients.every(item => item.amount <= 0)) {
            resultsContainer.innerHTML = `
                <div class="empty-ingredient-box">
                    <i class="fas fa-box-open fa-2x text-muted"></i>
                    <p>ไม่มีวัตถุดิบในคลัง</p>
                </div>
            `;
            return;
        }

        try {
            const response = await fetch('/users/recommend', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ingredients }) 
            });

            const data = await response.json();

            if (data.error) {
                console.error("API Error:", data.error);
                resultsContainer.innerHTML = `<p>${data.error}</p>`;
                return;
            }

            // ✅ แสดงผลรวมเมนูแบบเรียบง่าย
            const totalFound = (data.full_match?.length || 0) + (data.partial_match?.length || 0);
            const totalAll = data.total_recipes || 0;

            const summaryContainer = document.getElementById("summary-container");
            if (summaryContainer) {
                summaryContainer.innerHTML = `
                    <span class="summary-text">
                        พบเมนูที่ตรงกับวัตถุดิบหลัก <strong>${totalFound}</strong> เมนู จากทั้งหมด <strong>${totalAll}</strong> เมนูในระบบ<br>
                    </span>
                `;
            }

            resultsContainer.innerHTML = `
                <h2><i class="fas fa-check-circle text-success"></i> เมนูที่มีวัตถุดิบหลักครบทั้งหมด</h2>
                <div id="full-match-recipes"></div>
                <h2>⚠️ เมนูที่มีวัตถุดิบหลักแต่ไม่ครบ</h2>
                <div id="partial-match-recipes"></div>
            `;

            const fullMatchContainer = document.getElementById("full-match-recipes");
            const partialMatchContainer = document.getElementById("partial-match-recipes");

            function renderRecipes(recipeGroups, container) {
                recipeGroups.forEach(([category, recipes]) => {
                    const categoryTitle = document.createElement("div");
                    categoryTitle.className = "category-title";
                    categoryTitle.textContent = `อาหารประเภท: ${category}`;
                    categoryTitle.setAttribute("data-category", category);
                    categoryTitle.setAttribute("data-match", container.id === "full-match-recipes" ? "full" : "partial");

                    container.appendChild(categoryTitle);

                    let highestSimilarity = Math.max(...recipes.map(r => r.similarity));
                    let isFirstHighlighted = false;

                    recipes.forEach(recipe => {
                        const recipeDiv = document.createElement("div");
                        recipeDiv.className = "recipe-container";

                        // ✅ ตรวจสอบ image_url และกำหนดภาพเริ่มต้น
                        const imageUrl = recipe.image_url && recipe.image_url !== "default.jpg" 
                            ? `/static/images/${recipe.image_url}` 
                            : "/static/images/default.jpg";

                        recipeDiv.innerHTML = `
                            <div class="recipe-left">
                                <img src="${imageUrl}" alt="${recipe.name}" class="recipe-image">
                                <h3><i class="fas fa-utensils text-main"></i> ${recipe.name}</h3>
                                <p><i class="fas fa-star text-gold"></i> คะแนนความใกล้เคียง: ${recipe.stars}</p>
                                <p><i class="fas fa-burn text-energy"></i> แคลอรี่รวม: ${recipe.calories} kcal</p>
                                <p><i class="fas fa-users text-teal"></i> เมนูนี้สามารถแบ่งทานได้: ${recipe.servings} หน่วยบริโภค</p>
                                <p><i class="fas fa-chart-pie text-info"></i> พลังงานต่อหน่วย: ${recipe.calories_per_serving} kcal</p>
                            </div>
                            <div class="recipe-right">
                                <p><strong><i class="fas fa-leaf text-dark-green"></i> วัตถุดิบหลัก:</strong></p>
                                <ul>
                                    ${(recipe.primary_ingredients || []).map(ing => {
                                        let icon = ing.status === "ครบ" 
                                            ? '<i class="fa-solid fa-check-circle text-success"></i>' 
                                            : ing.status.includes("มีไม่เพียงพอ") 
                                                ? '<i class="fa-solid fa-exclamation-circle text-warning"></i>' 
                                                : '<i class="fa-solid fa-times-circle text-danger"></i>';
                                        return `<li>${icon} ${ing.name} ${ing.converted_display} (${ing.status})</li>`;
                                    }).join("")}
                                </ul>

                                <p><strong><i class="fas fa-pepper-hot text-danger"></i> วัตถุดิบเสริม / เครื่องปรุง:</strong></p>
                                    ${(recipe.secondary_ingredients && recipe.secondary_ingredients.length > 0)
                                    ? `<ul>${
                                        recipe.secondary_ingredients.map(ing => {
                                            let icon = ing.status === "ครบ"
                                            ? '<i class="fa-solid fa-check-circle text-success"></i>'
                                            : ing.status.includes("มีไม่เพียงพอ")
                                                ? '<i class="fa-solid fa-exclamation-circle text-warning"></i>'
                                                : '<i class="fa-solid fa-times-circle text-danger"></i>';
                                            return `<li>${icon} ${ing.name} ${ing.converted_display} (${ing.status})</li>`;
                                        }).join("")
                                        }</ul>`
                                    : `<p class="text-muted"><i class="fa-solid fa-ban text-danger"></i> ไม่มีการใช้วัตถุดิบเสริมหรือเครื่องปรุง</p>`}

                                <div style="display: flex; gap: 10px; margin-top: 10px;">
                                    <button class="save-menu-button" onclick="saveMenu(${recipe.id})">
                                        <i class="fas fa-check-circle"></i> บันทึกเมนู
                                    </button>
                                    <a href="/users/view-menu?recipe_id=${recipe.id}" class="view-detail-button">
                                        <i class="fas fa-info-circle"></i> รายละเอียด
                                    </a>
                                </div>
                            </div>
                        `;

                        // ✅ ไฮไลต์เฉพาะเมนูที่มีคะแนนสูงสุดของหมวดหมู่
                        if (recipe.similarity === highestSimilarity && !isFirstHighlighted) {
                            recipeDiv.classList.add("highlight");
                            isFirstHighlighted = true;
                        }

                        container.appendChild(recipeDiv);
                    });
                });
            }

            // ✅ แสดงเมนูแยกส่วน
            renderRecipes(data.full_match, fullMatchContainer);
            renderRecipes(data.partial_match, partialMatchContainer);
            renderCategoryButtons(data.full_match, data.partial_match);

            function renderCategoryButtons(fullMatchGroups, partialMatchGroups) {
                const fullContainer = document.getElementById("category-buttons-full");
                const partialContainer = document.getElementById("category-buttons-partial");

                fullContainer.innerHTML = "";
                partialContainer.innerHTML = "";

                const added = new Set();

                function createButton(category, matchType, container) {
                    const key = `${category}-${matchType}`;
                    if (added.has(key)) return;
                    added.add(key);

                    const btn = document.createElement("button");
                    btn.className = "category-jump-btn " + (matchType === "full" ? "full-match" : "partial-match");
                    btn.innerHTML = matchType === "full" 
                        ? `<i class="fas fa-check-circle"></i> ${category}` 
                        : `<i class="fas fa-exclamation-triangle"></i> ${category}`;
                    btn.title = matchType === "full"
                        ? "เมนูในหมวดนี้มีวัตถุดิบหลักครบทั้งหมด"
                        : "เมนูในหมวดนี้มีวัตถุดิบหลักบางส่วนไม่ครบ";

                    btn.addEventListener("click", () => {
                        const target = document.querySelector(`[data-category="${category}"][data-match="${matchType}"]`);
                        if (target) {
                            target.scrollIntoView({ behavior: "smooth" });
                        }
                    });

                    container.appendChild(btn);
                }

                fullMatchGroups.forEach(([category]) => createButton(category, "full", fullContainer));
                partialMatchGroups.forEach(([category]) => createButton(category, "partial", partialContainer));
            }


        } catch (error) {
            console.error("Error fetching recommendations:", error);
            resultsContainer.innerHTML = "<p>เกิดข้อผิดพลาดในการแนะนำเมนู</p>";
        }
    };
    
    // โหลดข้อมูลวัตถุดิบสำหรับการแนะนำเมนูเมื่อเริ่มต้น
    loadUserIngredientsForRecommendation();

    // ✅ ฟังก์ชันสำหรับบันทึกเมนู (ไปที่หน้าแก้ไขก่อนบันทึกจริง)
    window.saveMenu = async function saveMenu(recipeId) {
        // ✅ เปลี่ยนเส้นทางไปยังหน้าแก้ไขเมนู
        window.location.href = `/users/menu-detail?recipe_id=${recipeId}`;
    };

    window.loadBmrTdee = async function loadBmrTdee() {
        try {
            const response = await fetch('/users/calculate_bmr_tdee');
            const data = await response.json();
    
            if (data.error) {
                console.error("Error calculating BMR and TDEE:", data.error);
                document.getElementById("daily-intake").innerHTML = `<p>${data.error}</p>`;
            } else {
                // ตรวจสอบและอัปเดต TDEE ที่ปรับตามเป้าหมาย
                const adjustedTdee = data.daily_intake?.tdee || data.tdee;
                document.getElementById("total-energy").innerText = adjustedTdee;
    
                // แสดงเป้าหมายปัจจุบัน
                const goal = data.goal || "ยังไม่ได้ตั้งเป้าหมาย";
                const goalElement = document.getElementById("current-goal");
                if (goalElement) {
                    goalElement.innerText = goal;
                }
    
                // อัปเดตข้อมูลปริมาณสารอาหารที่ควรได้รับต่อวัน
                const intake = data.daily_intake || {};
                document.getElementById("intake-protein").innerText = intake.protein || "-";
                document.getElementById("intake-fat").innerText = intake.fat || "-";
                document.getElementById("intake-carb").innerText = intake.carb || "-";
                document.getElementById("intake-sugar").innerText = intake.sugar || "-";
                document.getElementById("intake-sodium").innerText = intake.sodium || "-";
            }
        } catch (error) {
            console.error("Error loading BMR and TDEE:", error);
            document.getElementById("daily-intake").innerHTML = "<p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>";
        }
    };

    window.loadSelectedMenus = async function loadSelectedMenus(rowsPerPage = 10, page = 1) {
        try {
            const response = await fetch("/users/selected_menus");
            const data = await response.json();
    
            const tableBody = document.querySelector("#selected-menus-table tbody");
            tableBody.innerHTML = "";
    
            if (data.error) {
                console.error("Error loading selected menus:", data.error);
                tableBody.innerHTML = `<tr><td colspan='3' style="color: red;">${data.error}</td></tr>`;
                return;
            }
    
            if (data.selected_menus && data.selected_menus.length > 0) {
                const startIndex = (page - 1) * rowsPerPage;
                const endIndex = startIndex + rowsPerPage;
                const paginatedMenus = data.selected_menus.slice(startIndex, endIndex);
    
                paginatedMenus.forEach(menu => {
                    const row = document.createElement("tr");
    
                    row.innerHTML = `
                        <td>${menu.recipe_name}</td>
                        <td>${menu.user_servings}</td>
                        <td>
                            <a href="/users/selected-menu-detail/${menu.id}" class="view-detail-btn" title="ดูรายละเอียด">
                                <i class="fas fa-file-alt"></i>
                            </a>
                        </td>
                        <td>
                        <button class="delete-menu-btn" data-id="${menu.id}">
                            <i class="fa fa-trash"></i>
                        </button>
                        </td>
                    `;
    
                    tableBody.appendChild(row);
                });
    
                // ✅ เชื่อมปุ่มลบกับฟังก์ชัน deleteSelectedMenu()
                document.querySelectorAll(".delete-menu-btn").forEach(button => {
                    button.addEventListener("click", function () {
                        const menuId = this.getAttribute("data-id");
                        deleteSelectedMenu(menuId);
                    });
                });
    
                updatePagination(data.selected_menus.length, rowsPerPage, page, "menu-pagination");
            } else {
                tableBody.innerHTML = "<tr><td colspan='4'>ยังไม่มีเมนูที่เลือก</td></tr>";
                document.getElementById("menu-pagination").innerHTML = ""; // ✅ แก้ปัญหา pagination แสดงแม้ไม่มีข้อมูล
            }
    
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการโหลดเมนู:", error);
            document.querySelector("#selected-menus-table tbody").innerHTML = "<tr><td colspan='3' style='color: red;'>เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>";
        }
    };
    
    // ✅ อัปเดตฟังก์ชัน deleteSelectedMenu ให้ถามก่อนลบ
    window.deleteSelectedMenu = async function deleteSelectedMenu(menuId) {
        // ✅ แสดงหน้าต่างยืนยันก่อนลบ
        const confirmDelete = confirm("คุณแน่ใจหรือไม่ว่าต้องการลบเมนูนี้?");
        if (!confirmDelete) {
            return; // ถ้าผู้ใช้กด "ยกเลิก" จะไม่ทำอะไร
        }

        try {
            const response = await fetch(`/users/delete_selected_menu/${menuId}`, { method: "DELETE" });
            const data = await response.json();

            if (data.error) {
                console.error("Error deleting menu:", data.error);
                alert("เกิดข้อผิดพลาด: " + data.error);
            } else {
                alert(data.message); // แสดงข้อความสำเร็จ
                loadSelectedMenus(); // โหลดข้อมูลใหม่
                window.loadNutritionChart(); // ✅ อัปเดตกราฟหลังลบเมนู
                window.loadNutritionData();  
            }
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการลบเมนู:", error);
            alert("เกิดข้อผิดพลาดในการลบเมนู");
        }
    };

    // ✅ ฟังก์ชันอัปเดตการแบ่งหน้า
    function updatePagination(totalRows, rowsPerPage, currentPage, paginationId) {
        const paginationDiv = document.getElementById(paginationId);
        paginationDiv.innerHTML = "";

        const totalPages = Math.ceil(totalRows / rowsPerPage);

        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement("button");
            pageBtn.innerText = i;
            pageBtn.classList.add("page-btn");

            if (i === currentPage) {
                pageBtn.classList.add("active");
            }

            pageBtn.addEventListener("click", () => {
                loadSelectedMenus(rowsPerPage, i);
            });

            paginationDiv.appendChild(pageBtn);
        }
    }

    // ✅ ดักจับการเปลี่ยนค่าแถวที่ต้องการแสดง
    document.getElementById("menu-rows-per-page").addEventListener("change", function () {
        const selectedRows = parseInt(this.value);
        loadSelectedMenus(selectedRows, 1);
    });
        
    // เรียกฟังก์ชันโหลดข้อมูลทันที
    window.loadBmrTdee();
    window.loadSelectedMenus();
});
