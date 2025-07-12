document.addEventListener("DOMContentLoaded", function () {
    const ingredientDropdown = document.getElementById("ingredient-dropdown");
    const ingredientAmount = document.getElementById("ingredient-amount");
    const addIngredientButton = document.getElementById("add-ingredient");
    const ingredientsList = document.getElementById("ingredients-list");
    const submitIngredientsButton = document.getElementById("submit-ingredients");
    const resultsContainer = document.getElementById("results");

    let ingredients = [];

    // ดึงข้อมูลวัตถุดิบจาก API และเติมใน dropdown
    async function loadIngredients() {
        try {
            const response = await fetch('/api/get_ingredients');
            const data = await response.json();
            if (data.ingredients) {
                data.ingredients.forEach(ingredient => {
                    const option = document.createElement("option");
                    option.value = ingredient.name;
                    option.textContent = `${ingredient.name} (${ingredient.unit})`;
                    option.dataset.unit = ingredient.unit;
                    ingredientDropdown.appendChild(option);
                });

                // เรียกใช้งาน Select2 หลังจากเพิ่มตัวเลือก
                $(".select2").select2({
                    placeholder: "ค้นหาวัตถุดิบ",
                    allowClear: true
                });
            }
        } catch (error) {
            console.error("Error loading ingredients:", error);
        }
    }

    // เรียกใช้ฟังก์ชันดึงข้อมูลวัตถุดิบเมื่อโหลดหน้าเว็บ
    loadIngredients();

    // เพิ่มวัตถุดิบลงในรายการ
    addIngredientButton.addEventListener("click", function () {
        const selectedOption = ingredientDropdown.options[ingredientDropdown.selectedIndex];
        const ingredientName = selectedOption.value;
        const ingredientUnit = selectedOption.dataset.unit;
        const amount = parseInt(ingredientAmount.value);

        if (ingredientName && amount > 0) {
            // ตรวจสอบว่าไม่มีวัตถุดิบซ้ำ
            if (ingredients.some(ing => ing.name === ingredientName)) {
                alert("วัตถุดิบนี้ถูกเพิ่มแล้ว");
                return;
            }

            // เพิ่มวัตถุดิบลงในอาร์เรย์
            ingredients.push({ name: ingredientName, amount, unit: ingredientUnit });

            // แสดงวัตถุดิบในรายการ
            const tag = document.createElement("div");
            tag.className = "ingredient-tag";
            tag.textContent = `${ingredientName}: ${amount} ${ingredientUnit}`;

            // เพิ่มปุ่มลบ
            const removeButton = document.createElement("button");
            removeButton.textContent = "×";
            removeButton.className = "remove-tag";
            removeButton.onclick = function () {
                ingredients = ingredients.filter(ing => ing.name !== ingredientName);
                tag.remove();
            };
            tag.appendChild(removeButton);
            ingredientsList.appendChild(tag);

            // ล้างค่าใน input และรีเซ็ต Select2
            $(".select2").val(null).trigger("change"); // รีเซ็ต Select2
            ingredientAmount.value = "";
        } else {
            alert("กรุณาเลือกวัตถุดิบและระบุจำนวนให้ถูกต้อง");
        }
    });

    // ส่งข้อมูลวัตถุดิบไปยังเซิร์ฟเวอร์
    submitIngredientsButton.addEventListener("click", async function () {
        if (ingredients.length === 0) {
            alert("กรุณาเพิ่มวัตถุดิบก่อน");
            return;
        }

        try {
            const response = await fetch("/api/recommend", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ingredients }),
            });

            const data = await response.json();
            resultsContainer.innerHTML = ""; // ล้างผลลัพธ์เก่า

            if (data.error) {
                resultsContainer.innerHTML = `<p>${data.error}</p>`;
            } else if (data.recommendations) {
                let currentCategory = "";
                let categoryHighestScore = 0; // เก็บคะแนนสูงสุดของหมวดหมู่
                let highestScoreRecipe = null; // เก็บ div เมนูที่มีคะแนนสูงสุด

                data.recommendations.forEach((rec) => {
                    // แสดงหมวดหมู่ใหม่
                    if (rec.startsWith("อาหารประเภท")) {
                        // ก่อนแสดงหมวดหมู่ใหม่ ให้ไฮไลต์เมนูคะแนนสูงสุดในหมวดหมู่ก่อนหน้า
                        if (highestScoreRecipe) {
                            highestScoreRecipe.classList.add("highlight");
                        }

                        currentCategory = rec;
                        categoryHighestScore = 0; // รีเซ็ตคะแนนสูงสุดสำหรับหมวดหมู่ใหม่
                        highestScoreRecipe = null;

                        const categoryTitle = document.createElement("div"); // เปลี่ยนจาก h3 เป็น div เพื่อไม่เพิ่มขนาด
                        categoryTitle.className = "category-title"; // เพิ่ม class สำหรับจัดสไตล์เพิ่มเติม
                        categoryTitle.textContent = rec;
                        resultsContainer.appendChild(categoryTitle);
                    } else {
                        const recipeDiv = document.createElement("div");
                        recipeDiv.className = "recipe-item";

                        // ดึงคะแนนความใกล้เคียงจากข้อความ
                        const match = rec.match(/คะแนนความใกล้เคียง: ([\d.]+)%/);
                        const score = match ? parseFloat(match[1]) : 0;

                        // อัปเดตคะแนนสูงสุดและเก็บเมนูที่มีคะแนนสูงสุด
                        if (score > categoryHighestScore) {
                            categoryHighestScore = score;
                            highestScoreRecipe = recipeDiv;
                        }

                        recipeDiv.innerHTML = rec;
                        resultsContainer.appendChild(recipeDiv);
                    }
                });

                // ไฮไลต์เมนูที่มีคะแนนสูงสุดในหมวดหมู่สุดท้าย
                if (highestScoreRecipe) {
                    highestScoreRecipe.classList.add("highlight");
                }
            } else {
                resultsContainer.innerHTML = "<p>ไม่มีเมนูที่ตรงกับวัตถุดิบที่มี</p>";
            }
        } catch (error) {
            console.error("Error:", error);
            resultsContainer.innerHTML = `<p>เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์</p>`;
        }
    });
});
