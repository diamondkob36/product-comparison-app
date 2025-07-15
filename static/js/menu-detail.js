document.addEventListener("DOMContentLoaded", function () {
    const primaryIngredientsList = document.getElementById("primary-ingredients-list");
    const secondaryIngredientsList = document.getElementById("secondary-ingredients-list");
    const secondaryDropdown = $("#secondary-ingredient-dropdown");
    const secondaryAmountInput = document.getElementById("secondary-ingredient-amount");
    const addSecondaryIngredientBtn = document.getElementById("add-secondary-ingredient");
    const resetButton = document.getElementById("reset-form");
    const form = document.getElementById("save-menu-form");

    let userStockMap = {};
    let initialPrimaryIngredients = [];
    let initialSecondaryIngredients = [];
    let initialUserServings = document.getElementById("user-servings").value;

    function checkEmptyIngredients() {
        if (primaryIngredientsList.children.length === 0) {
            primaryIngredientsList.innerHTML = '<p id="no-primary-ingredients">ไม่มีวัตถุดิบหลัก</p>';
        }
        if (secondaryIngredientsList.children.length === 0) {
            secondaryIngredientsList.innerHTML = '<p id="no-secondary-ingredients">ไม่มีวัตถุดิบรอง</p>';
        }
    }

    function saveInitialData() {
        initialPrimaryIngredients = [...primaryIngredientsList.children].map(li => li.outerHTML);
        initialSecondaryIngredients = [...secondaryIngredientsList.children].map(li => li.outerHTML);
        checkEmptyIngredients();
    }

    async function loadIngredients() {
        try {
            const [userRes, allRes] = await Promise.all([
                fetch('/users/get_user_ingredients'),
                fetch('/api/get_ingredients')
            ]);

            const userData = await userRes.json();
            const allData = await allRes.json();

            if (!userData.ingredients || !allData.ingredients) return;

            const userMap = {};
            userData.ingredients.forEach(i => {
                userMap[i.name] = i.amount;
                userStockMap[i.name] = i.amount;
            });

            const ingredientsWithStock = [];
            const ingredientsWithoutStock = [];

            allData.ingredients.forEach(i => {
                const amount = userMap[i.name] || 0;
                const hasStock = !!userMap[i.name];
                const item = {
                    name: i.name,
                    unit: i.unit,
                    amount,
                    hasStock
                };
                if (hasStock) {
                    ingredientsWithStock.push(item);
                } else {
                    ingredientsWithoutStock.push(item);
                }
            });

            ingredientsWithStock.sort((a, b) => a.amount - b.amount);
            ingredientsWithoutStock.sort((a, b) => a.name.localeCompare(b.name));

            const fullList = [...ingredientsWithStock, ...ingredientsWithoutStock];

            const renderDropdown = (dropdown) => {
                dropdown.empty();
                dropdown.append('<option value="" disabled selected>เลือกวัตถุดิบ</option>');

                fullList.forEach(i => {
                    const icon = i.hasStock ? '✅' : '❌';
                    const text = `${icon} ${i.name} ${i.amount || 0} (${i.unit})`;

                    const option = $(`<option></option>`)
                        .val(i.name)
                        .text(text)
                        .attr("data-unit", i.unit);

                    dropdown.append(option);
                });

                dropdown.select2({
                    templateResult: state => state.text,
                    templateSelection: state => state.text
                });
            };

            renderDropdown(secondaryDropdown);

            updateIngredientStockInfo(); // แสดงคลังกับรายการที่โหลดมาล่วงหน้า

        } catch (err) {
            console.error("โหลดวัตถุดิบล้มเหลว:", err);
        }
    }

    async function addIngredient(targetList, dropdown, amountInput) {
        const name = dropdown.val();
        const amount = parseFloat(amountInput.value);
        const unit = dropdown.find(":selected").data("unit");

        if (!name) {
            await Swal.fire({
                icon: 'warning',
                title: 'ข้อมูลไม่ถูกต้อง',
                text: 'กรุณาเลือกวัตถุดิบก่อนเพิ่ม',
                heightAuto: false
            });
            return;
        }

        if (isNaN(amount)) {
            await Swal.fire({
                icon: 'warning',
                title: 'ข้อมูลไม่ถูกต้อง',
                text: 'กรุณากรอกจำนวนวัตถุดิบ',
                heightAuto: false
            });
            return;
        }

        if (amount <= 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'ข้อมูลไม่ถูกต้อง',
                text: 'กรุณากรอกจำนวนมากกว่า 0',
                heightAuto: false
            });
            return;
        }

        const isAddingToPrimary = targetList.id === "primary-ingredients-list";
        const otherList = isAddingToPrimary ? secondaryIngredientsList : primaryIngredientsList;

        // ✅ เช็คว่าซ้ำในอีกกลุ่ม
        if ([...otherList.children].some(item => item.dataset.name === name)) {
            await Swal.fire({
                icon: 'error',
                title: 'ไม่สามารถเพิ่มได้',
                text: 'วัตถุดิบนี้อยู่ในอีกกลุ่มแล้ว ไม่สามารถเพิ่มได้อีก',
                heightAuto: false
            });
            return;
        }

        // ✅ เช็คว่าซ้ำในกลุ่มเดียวกัน
        const existingItem = [...targetList.children].find(item => item.dataset.name === name);
        if (existingItem) {
            const currentAmount = parseFloat(existingItem.dataset.amount || 0);
            const newAmount = currentAmount + amount;

            const result = await Swal.fire({
                title: 'วัตถุดิบนี้ถูกเพิ่มไปแล้ว',
                text: `ต้องการรวมปริมาณเป็น ${newAmount} หรือไม่?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'รวม',
                cancelButtonText: 'ยกเลิก',
                heightAuto: false
            });

            if (!result.isConfirmed) return;

            existingItem.dataset.amount = newAmount;
            updateIngredientStockInfo();
            amountInput.value = "";
            return;
        }

        // ✅ แปลงปริมาณ (unit conversion)
        const converted = await fetchConvertedDisplay(name, amount, unit);
        const stockAmount = userStockMap[name] || 0;
        const iconClass = isAddingToPrimary ? "fa-pen-to-square" : "fa-trash";

        const newItem = document.createElement("li");
        newItem.classList.add("ingredient-box");
        newItem.dataset.name = name;
        newItem.dataset.amount = amount;
        newItem.dataset.unit = unit;

        const matchedInitial = initialSecondaryIngredients.find(item =>
            item.includes(`data-name="${name}"`)
        );
        const originalDefault = matchedInitial
            ? matchedInitial.match(/data-default="([\d.]+)"/)?.[1] || 0
            : 0;
        newItem.dataset.default = originalDefault;

        let statusClass = "stock-ok";
        let icon = "✅";
        if (stockAmount === 0) {
            statusClass = "stock-none";
            icon = "❌";
        } else if (stockAmount < amount) {
            statusClass = "stock-warning";
            icon = "❗";
        }

        newItem.innerHTML = `
            <div>
                <strong>${name} ${converted}</strong><br>
                <small class="${statusClass}">
                    ${icon} วัตถุดิบในคลัง: ${stockAmount} ${unit} / ใช้จริง: ${amount} ${unit}<br>
                    วัตถุดิบตามสูตรใช้ : ${newItem.dataset.default || 0} ${unit}
                </small>
            </div>
            <i class="fas ${iconClass} remove-ingredient" data-name="${name}" title="${isAddingToPrimary ? "แก้ไขวัตถุดิบ" : "ลบวัตถุดิบ"}"></i>
        `;
        targetList.appendChild(newItem);
        amountInput.value = "";

        if (isAddingToPrimary) {
            document.getElementById("no-primary-ingredients")?.remove();
        } else {
            document.getElementById("no-secondary-ingredients")?.remove();
        }
    }

    async function updateIngredientStockInfo() {
        const items = document.querySelectorAll(".ingredient-box");
    
        for (const item of items) {
            const name = item.dataset.name;
            const amount = parseFloat(item.dataset.amount || 0);
            const defaultAmount = parseFloat(item.dataset.default || amount);
            const unit = item.dataset.unit || "";
            const stock = userStockMap[name] || 0;
            const isPrimary = primaryIngredientsList.contains(item);
            const iconClass = isPrimary ? "fa-pen-to-square" : "fa-trash";
            const iconTitle = isPrimary ? "แก้ไขวัตถุดิบ" : "ลบวัตถุดิบ";
    
            const converted = await fetchConvertedDisplay(name, amount, unit);
    
            let statusClass = "stock-ok";
            let icon = "✅";
            if (stock === 0) {
                statusClass = "stock-none";
                icon = "❌";
            } else if (stock < amount) {
                statusClass = "stock-warning";
                icon = "❗";
            }
    
            item.innerHTML = `
                <div>
                    <strong>${name} ${converted}</strong><br>
                    <small class="${statusClass}">
                        ${icon} วัตถุดิบในคลัง: ${stock} ${unit} / ใช้จริง: ${amount} ${unit}<br>
                        วัตถุดิบตามสูตรใช้ : ${defaultAmount} ${unit}
                    </small>
                </div>
                <i class="fas ${iconClass} remove-ingredient" data-name="${name}" title="${iconTitle}"></i>
            `;
        }
    }

        if (addSecondaryIngredientBtn) addSecondaryIngredientBtn.addEventListener("click", () => {
            addIngredient(secondaryIngredientsList, secondaryDropdown, secondaryAmountInput).then(() => {
                updateNutritionPreview();  // ✅ เรียกหลังเพิ่มวัตถุดิบ
            });
    });
    
    document.addEventListener("click", function (event) {
        if (event.target.classList.contains("remove-ingredient")) {
            const ingredientBox = event.target.closest(".ingredient-box");

            const isPrimary = primaryIngredientsList.contains(ingredientBox);
            if (isPrimary) {
                // ✅ ใช้ popup แทนการลบ
                currentEditItem = ingredientBox;
                popupName.textContent = ingredientBox.dataset.name;
                popupAmount.value = ingredientBox.dataset.amount;
                popup.classList.remove("hidden");
            } else {
                // ✅ ลบได้เฉพาะวัตถุดิบรอง
                ingredientBox.remove();
                checkEmptyIngredients();
                updateNutritionPreview();
            }
        }
    });


    function resetForm() {
        primaryIngredientsList.innerHTML = initialPrimaryIngredients.join("") || '<p id="no-primary-ingredients">ไม่มีวัตถุดิบหลัก</p>';
        secondaryIngredientsList.innerHTML = initialSecondaryIngredients.join("") || '<p id="no-secondary-ingredients">ไม่มีวัตถุดิบรอง</p>';
        document.getElementById("user-servings").value = initialUserServings;
        checkEmptyIngredients();
        updateIngredientStockInfo();
        updateNutritionPreview();
    }

    if (resetButton) {
        resetButton.addEventListener("click", resetForm);
    }

    const userServingsInput = document.getElementById("user-servings");
    const maxServings = parseInt(userServingsInput.getAttribute("max"));
    userServingsInput.addEventListener("input", async function () {
        const value = parseInt(this.value);
        if (value > maxServings) {
            await Swal.fire({
                icon: 'warning',
                title: 'จำนวนเกินกำหนด',
                text: `เมนูนี้สามารถแบ่งทานได้สูงสุด ${maxServings} หน่วยเท่านั้น`,
                heightAuto: false
            });
            this.value = maxServings;
        }
        updateNutritionPreview();
    });

    userServingsInput.addEventListener("blur", function () {
        const value = parseInt(this.value);
        if (isNaN(value) || value <= 0) {
            this.value = 1; // ✅ บังคับกลับเป็น 1 ถ้าเว้นว่างหรือใส่ค่าผิด
            updateNutritionPreview();
        }
    });

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const primaryIngredients = [];
        primaryIngredientsList.querySelectorAll(".ingredient-box").forEach(item => {
            const name = item.dataset.name;
            const amount = parseFloat(item.dataset.amount);
            const unit = item.dataset.unit || "";
            if (!isNaN(amount)) {
                primaryIngredients.push({ name, amount, unit });
            }
        });

        const secondaryIngredients = [];
        secondaryIngredientsList.querySelectorAll(".ingredient-box").forEach(item => {
            const name = item.dataset.name;
            const amount = parseFloat(item.dataset.amount);
            const unit = item.dataset.unit || "";
            if (!isNaN(amount)) {
                secondaryIngredients.push({ name, amount, unit });
            }
        });

        const hasPrimary = primaryIngredients.length > 0;
        const hasValidPrimary = primaryIngredients.some(ing => ing.amount > 0);

        if (!hasPrimary) {
            await Swal.fire({
                icon: 'warning',
                title: 'ข้อมูลไม่ถูกต้อง',
                text: 'กรุณาเพิ่มวัตถุดิบหลักอย่างน้อย 1 รายการ',
                heightAuto: false
            });
            return;
        }

        if (!hasValidPrimary) {
            await Swal.fire({
                icon: 'warning',
                title: 'ข้อมูลไม่ถูกต้อง',
                text: 'วัตถุดิบหลักต้องมีปริมาณมากกว่า 0',
                heightAuto: false
            });
            return;
        }

        // ✅ เช็ควัตถุดิบไม่พอ
        const insufficientIngredients = [];
        [...primaryIngredientsList.querySelectorAll(".ingredient-box"),
        ...secondaryIngredientsList.querySelectorAll(".ingredient-box")].forEach(item => {
            const name = item.dataset.name;
            const amount = parseFloat(item.dataset.amount || 0);
            const stock = userStockMap[name] || 0;
            if (stock < amount) {
                insufficientIngredients.push(`- ${name} (มี ${stock}, ต้องใช้ ${amount})`);
            }
        });

        if (insufficientIngredients.length > 0) {
            const result = await Swal.fire({
                title: 'มีวัตถุดิบบางรายการไม่เพียงพอ',
                icon: 'warning',
                html: `
                    <div style="text-align:left">
                        ${insufficientIngredients.join('<br>')}
                    </div>
                    <br>คุณต้องการบันทึกต่อหรือไม่?
                `,
                showCancelButton: true,
                confirmButtonText: 'บันทึกต่อ',
                cancelButtonText: 'ยกเลิก',
                heightAuto: false
            });
            if (!result.isConfirmed) return;
        }

        // ✅ ยืนยันบันทึก
        const confirmSave = await Swal.fire({
            title: 'ยืนยันการบันทึก',
            text: 'คุณต้องการบันทึกเมนูนี้หรือไม่?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'บันทึก',
            cancelButtonText: 'ยกเลิก',
            heightAuto: false
        });
        if (!confirmSave.isConfirmed) return;

        // ✅ เตรียมข้อมูลส่ง
        const formData = new FormData(form);
        formData.append("primary_ingredients", JSON.stringify(primaryIngredients));
        formData.append("secondary_ingredients", JSON.stringify(secondaryIngredients));

        try {
            const response = await fetch(form.action, {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (data.error) {
                await Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: data.error,
                    heightAuto: false
                });
            } else {
                await Swal.fire({
                    icon: 'success',
                    title: 'สำเร็จ!',
                    text: 'บันทึกเมนูสำเร็จ!',
                    timer: 1000,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    heightAuto: false
                });
                window.location.href = "/users/index";
            }
        } catch (error) {
            console.error("Error saving menu:", error);
            await Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถบันทึกเมนูได้',
                heightAuto: false
            });
        }
    });

    // ✅ เพิ่ม popup logic สำหรับแก้ไขวัตถุดิบหลัก
    const popup = document.getElementById("edit-popup");
    const popupName = document.getElementById("popup-ingredient-name");
    const popupAmount = document.getElementById("popup-ingredient-amount");
    const popupSave = document.getElementById("popup-save");
    const popupCancel = document.getElementById("popup-cancel");

    let currentEditItem = null;

    if (popup && popupCancel && popupSave && popupAmount && popupName) {
        popupCancel.addEventListener("click", () => {
            popup.classList.add("hidden");
            currentEditItem = null;
        });

        popupSave.addEventListener("click", async () => {
            if (!currentEditItem) return;
            const newAmount = parseFloat(popupAmount.value);
            if (isNaN(newAmount) || newAmount <= 0) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'ข้อมูลไม่ถูกต้อง',
                    text: 'กรุณากรอกจำนวนมากกว่า 0',
                    heightAuto: false
                });
                return;
            }

            currentEditItem.dataset.amount = newAmount;
            updateIngredientStockInfo();
            updateNutritionPreview();
            popup.classList.add("hidden");

            await Swal.fire({
                icon: 'success',
                title: 'สำเร็จ!',
                text: 'แก้ไขปริมาณวัตถุดิบสำเร็จ!',
                timer: 1000,
                timerProgressBar: true,
                showConfirmButton: false,
                heightAuto: false
            });
        });
    }

    // ✅ คลิกนอก popup-content แล้วปิด
    popup.addEventListener("click", (e) => {
        if (e.target === popup) {
            popup.classList.add("hidden");
            currentEditItem = null;
        }
    });

    async function fetchConvertedDisplay(name, amount, unit) {
        try {
            const res = await fetch('/users/convert_display', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, amount, unit })
            });
            const data = await res.json();
            return data.converted || `${amount} ${unit}`;
        } catch {
            return `${amount} ${unit}`;
        }
    }

    async function updateNutritionPreview() {
        const primaryIngredients = [...primaryIngredientsList.querySelectorAll(".ingredient-box")].map(item => ({
            name: item.dataset.name,
            amount: parseFloat(item.dataset.amount),
            unit: item.dataset.unit || "กรัม"
        }));
        const secondaryIngredients = [...secondaryIngredientsList.querySelectorAll(".ingredient-box")].map(item => ({
            name: item.dataset.name,
            amount: parseFloat(item.dataset.amount),
            unit: item.dataset.unit || "กรัม"
        }));
        const userServings = parseFloat(document.getElementById("user-servings").value) || 1;
        const recipeServings = parseFloat(document.getElementById("user-servings").getAttribute("max")) || 1;
    
        try {
            const res = await fetch('/users/calculate_nutrition_preview', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ingredients: primaryIngredients,
                    secondary_ingredients: secondaryIngredients,
                    user_servings: userServings,
                    recipe_servings: recipeServings
                })
            });
            const data = await res.json();
    
            const box = document.getElementById("nutrition-preview");
            if (!box) return;
    
            if (data.error) {
                box.innerHTML = `<p class="error">เกิดข้อผิดพลาด: ${data.error}</p>`;
            } else {
                box.innerHTML = `
                    <h3><i class="fas fa-utensils text-success"></i> พลังงานและสารอาหารต่อการแบ่งทาน ${userServings} หน่วยบริโภค</h3>
                    <ul id="nutrition-list">
                        <li><i class="fas fa-fire-alt text-danger"></i> <strong>แคลอรี่:</strong> ${data.calories} kcal</li>
                        <li><i class="fas fa-drumstick-bite text-primary"></i> <strong>โปรตีน:</strong> ${data.protein} g</li>
                        <li><i class="fas fa-bacon text-warning"></i> <strong>ไขมัน:</strong> ${data.fat} g</li>
                        <li><i class="fas fa-bread-slice text-info"></i> <strong>คาร์โบไฮเดรต:</strong> ${data.carbs} g</li>
                        <li><i class="fas fa-candy-cane text-pink"></i> <strong>น้ำตาล:</strong> ${data.sugar} g</li>
                        <li><i class="fas fa-prescription-bottle-alt text-secondary"></i> <strong>โซเดียม:</strong> ${data.sodium} mg</li>
                    </ul>
                `;
            }
        } catch (err) {
            console.error("Nutrition preview error:", err);
        }
    }

    saveInitialData();
    loadIngredients();
    updateNutritionPreview();
});
