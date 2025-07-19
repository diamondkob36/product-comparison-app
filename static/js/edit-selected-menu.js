document.addEventListener("DOMContentLoaded", function () {
    const primaryList = document.getElementById("primary-ingredients-list");
    const secondaryList = document.getElementById("secondary-ingredients-list");

    const primaryDropdown = $("#primary-ingredient-dropdown");
    const secondaryDropdown = $("#secondary-ingredient-dropdown");

    const primaryInput = document.getElementById("primary-ingredient-amount");
    const secondaryInput = document.getElementById("secondary-ingredient-amount");

    const addPrimaryBtn = document.getElementById("add-primary-ingredient");
    const addSecondaryBtn = document.getElementById("add-secondary-ingredient");

    const resetButton = document.getElementById("reset-form");
    const form = document.getElementById("save-menu-form");

    let initialPrimary = [];
    let initialSecondary = [];
    let initialUserServings = document.getElementById("user-servings")?.value || 1;

    function saveInitialState() {
        initialPrimary = [...primaryList.children].map(li => li.outerHTML);
        initialSecondary = [...secondaryList.children].map(li => li.outerHTML);
    }

    function checkEmptyLists() {
        if (primaryList.children.length === 0) {
            primaryList.innerHTML = '<p id="no-primary-ingredients">ไม่มีวัตถุดิบหลัก</p>';
        }
        if (secondaryList.children.length === 0) {
            secondaryList.innerHTML = '<p id="no-secondary-ingredients">ไม่มีวัตถุดิบรอง</p>';
        }
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
            });

            const withStock = [];
            const withoutStock = [];

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
                    withStock.push(item);
                } else {
                    withoutStock.push(item);
                }
            });

            withStock.sort((a, b) => b.amount - a.amount);
            withoutStock.sort((a, b) => a.name.localeCompare(b.name));
            const fullList = [...withStock, ...withoutStock];

            const renderOptions = (dropdown) => {
                dropdown.empty();
                dropdown.append('<option value="" disabled selected>เลือกวัตถุดิบ</option>');
                fullList.forEach(i => {
                    const icon = i.hasStock ? '✅' : '❌';
                    const optionText = `${icon} ${i.name} ${i.amount} (${i.unit})`;
                    const opt = $(`<option></option>`)
                        .val(i.name)
                        .text(optionText)
                        .attr("data-unit", i.unit);
                    dropdown.append(opt);
                });

                dropdown.select2({
                    templateResult: state => state.text,
                    templateSelection: state => state.text
                });
            };

            renderOptions($("#primary-ingredient-dropdown"));
            renderOptions($("#secondary-ingredient-dropdown"));
        } catch (err) {
            console.error("เกิดข้อผิดพลาดในการโหลดวัตถุดิบ:", err);
        }
    }

    async function addIngredient(list, dropdown, input) {
        const name = dropdown.val();
        const amount = parseFloat(input.value);
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

        const existingItem = [...list.children].find(li => li.dataset.name === name);
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

            const converted = await fetchConvertedDisplay(name, newAmount, unit);
            existingItem.innerHTML = `<strong>${name} ${converted}</strong> <i class="fas fa-trash remove-ingredient" data-name="${name}"></i>`;
            input.value = "";
            return;
        }

        const isPrimary = list.id === "primary-ingredients-list";
        const otherList = isPrimary ? secondaryList : primaryList;

        if ([...otherList.children].some(li => li.dataset.name === name)) {
            await Swal.fire({
                icon: 'error',
                title: 'ไม่สามารถเพิ่มได้',
                text: 'วัตถุดิบนี้ถูกเพิ่มในวัตถุดิบหลักแล้ว กรุณาเลือกวัตถุดิบอื่น',
                heightAuto: false
            });
            return;
        }

        const converted = await fetchConvertedDisplay(name, amount, unit);

        const li = document.createElement("li");
        li.classList.add("ingredient-box");
        li.dataset.name = name;
        li.dataset.amount = amount;
        li.dataset.unit = unit;
        li.innerHTML = `<strong>${name} ${converted}</strong> <i class="fas fa-trash remove-ingredient" data-name="${name}"></i>`;
        list.appendChild(li);
        input.value = "";

        const placeholder = list.id === "primary-ingredients-list"
            ? document.getElementById("no-primary-ingredients")
            : document.getElementById("no-secondary-ingredients");
        placeholder?.remove();
    }

    if (addPrimaryBtn) {
        addPrimaryBtn.addEventListener("click", () => addIngredient(primaryList, primaryDropdown, primaryInput));
    }

    if (addSecondaryBtn) {
        addSecondaryBtn.addEventListener("click", async () => {
            await addIngredient(secondaryList, secondaryDropdown, secondaryInput);
            await updateNutritionPreview();  // ✅ รอให้วัตถุดิบเพิ่มเสร็จก่อน
        });
    }

    document.addEventListener("click", e => {
        if (e.target.classList.contains("remove-ingredient")) {
            const li = e.target.closest("li");
            const isPrimary = primaryList.contains(li);
            if (isPrimary) {
                currentEditItem = li;
                popupName.textContent = li.dataset.name;
                popupAmount.value = li.dataset.amount;
                popup.classList.remove("hidden");
                return;
            }
            li.remove();
            checkEmptyLists();
            updateNutritionPreview();
        }
    });

    if (resetButton) {
        resetButton.addEventListener("click", () => {
            primaryList.innerHTML = initialPrimary.join("");
            secondaryList.innerHTML = initialSecondary.join("");
            document.getElementById("user-servings").value = initialUserServings;
            checkEmptyLists();
            updateNutritionPreview();
        });
    }

    const servingsInput = document.getElementById("user-servings");
    const maxServings = parseInt(servingsInput?.getAttribute("max"));
    servingsInput?.addEventListener("input", async () => {
        const val = parseInt(servingsInput.value);
        if (val > maxServings) {
            await Swal.fire({
                icon: 'warning',
                title: 'จำนวนเกินกำหนด',
                text: `สามารถเลือกได้ไม่เกิน ${maxServings} หน่วย`,
                scrollbarPadding: true,
                heightAuto: false
            });
            servingsInput.value = maxServings;
        }
        updateNutritionPreview();
    });

    servingsInput?.addEventListener("blur", () => {
        const val = parseInt(servingsInput.value);
        if (isNaN(val) || val <= 0) {
            servingsInput.value = 1; // ✅ บังคับกลับเป็น 1
            updateNutritionPreview();
        }
    });

    if (form) {
        form.addEventListener("submit", async e => {
            e.preventDefault();

            const primary = [...primaryList.querySelectorAll(".ingredient-box")].map(li => ({
                name: li.dataset.name,
                amount: parseFloat(li.dataset.amount),
                unit: li.dataset.unit || ""
            }));

            const secondary = [...secondaryList.querySelectorAll(".ingredient-box")].map(li => ({
                name: li.dataset.name,
                amount: parseFloat(li.dataset.amount),
                unit: li.dataset.unit || ""
            }));

            if (primary.length === 0) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'ข้อมูลไม่ถูกต้อง',
                    text: 'กรุณาเพิ่มวัตถุดิบหลักอย่างน้อย 1 รายการ',
                    heightAuto: false
                });
                return;
            }

            if (!primary.some(ing => ing.amount > 0)) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'ข้อมูลไม่ถูกต้อง',
                    text: 'วัตถุดิบหลักต้องมีปริมาณมากกว่า 0',
                    heightAuto: false
                });
                return;
            }

            const confirmResult = await Swal.fire({
                title: 'ยืนยันการบันทึก',
                text: 'คุณต้องการบันทึกการแก้ไขหรือไม่?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'บันทึก',
                cancelButtonText: 'ยกเลิก',
                heightAuto: false
            });
            if (!confirmResult.isConfirmed) return;

            const formData = new FormData(form);
            formData.append("primary_ingredients", JSON.stringify(primary));
            formData.append("secondary_ingredients", JSON.stringify(secondary));

            try {
                const res = await fetch(form.action, {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    await Swal.fire({
                        icon: 'success',
                        title: 'สำเร็จ!',
                        text: 'บันทึกการแก้ไขสำเร็จ',
                        timer: 1500,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        heightAuto: false
                    });
                    location.href = `/users/selected-menu-detail/${form.action.split('/').pop()}`;
                } else {
                    await Swal.fire({
                        icon: 'error',
                        title: 'เกิดข้อผิดพลาด',
                        text: "เกิดข้อผิดพลาดในการบันทึก: " + (data.error || "ไม่ทราบสาเหตุ"),
                        heightAuto: false
                    });
                }
            } catch (error) {
                console.error("Error:", error);
                await Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
                    heightAuto: false
                });
            }
        });
    }
 
    async function updateNutritionPreview() {
        const primaryIngredients = [...document.querySelectorAll("#primary-ingredients-list .ingredient-box")].map(item => ({
            name: item.dataset.name,
            amount: parseFloat(item.dataset.amount),
            unit: item.dataset.unit
        }));
    
        const secondaryIngredients = [...document.querySelectorAll("#secondary-ingredients-list .ingredient-box")].map(item => ({
            name: item.dataset.name,
            amount: parseFloat(item.dataset.amount),
            unit: item.dataset.unit
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
    
            if (data.error || !box) {
                box.innerHTML = `<p class="text-danger">เกิดข้อผิดพลาดในการคำนวณ</p>`;
                return;
            }
    
            box.innerHTML = `
                <h3><i class="fas fa-utensils text-success"></i> พลังงานและสารอาหารต่อ ${userServings} หน่วยบริโภค</h3>
                <ul>
                    <li><i class="fas fa-fire-alt text-danger"></i> <strong>แคลอรี่:</strong> ${data.calories} kcal</li>
                    <li><i class="fas fa-drumstick-bite text-primary"></i> <strong>โปรตีน:</strong> ${data.protein} g</li>
                    <li><i class="fas fa-bacon text-warning"></i> <strong>ไขมัน:</strong> ${data.fat} g</li>
                    <li><i class="fas fa-bread-slice text-info"></i> <strong>คาร์โบไฮเดรต:</strong> ${data.carbs} g</li>
                    <li><i class="fas fa-candy-cane text-pink"></i> <strong>น้ำตาล:</strong> ${data.sugar} g</li>
                    <li><i class="fas fa-prescription-bottle-alt text-secondary"></i> <strong>โซเดียม:</strong> ${data.sodium} mg</li>
                </ul>
            `;
        } catch (err) {
            console.error("Error fetching nutrition preview:", err);
        }
    }

    // ✅ popup logic สำหรับแก้ไขวัตถุดิบหลัก
    const popup = document.getElementById("edit-popup");
    const popupName = document.getElementById("popup-ingredient-name");
    const popupAmount = document.getElementById("popup-ingredient-amount");
    const popupSave = document.getElementById("popup-save");
    const popupCancel = document.getElementById("popup-cancel");
    let currentEditItem = null;

    if (popup && popupSave && popupCancel && popupAmount && popupName) {
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

            const name = currentEditItem.dataset.name;
            const unit = currentEditItem.dataset.unit;

            // ✅ เรียกฟังก์ชันเพื่อแปลงหน่วย
            const converted = await fetchConvertedDisplay(name, newAmount, unit);

            // ✅ อัปเดตข้อมูล
            currentEditItem.dataset.amount = newAmount;
            currentEditItem.innerHTML = `
                <strong>${name} ${converted}</strong>
                <i class="fas fa-pen-to-square remove-ingredient" data-name="${name}" title="แก้ไขวัตถุดิบ"></i>
            `;

            updateNutritionPreview();
            popup.classList.add("hidden");

            await Swal.fire({
                icon: 'success',
                title: 'สำเร็จ!',
                text: 'แก้ไขปริมาณวัตถุดิบสำเร็จ!',
                timer: 1500,
                timerProgressBar: true,
                showConfirmButton: false,
                heightAuto: false
            });
        });

        popup.addEventListener("click", (e) => {
            if (e.target === popup) {
                popup.classList.add("hidden");
                currentEditItem = null;
            }
        });
    }

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

    saveInitialState();
    loadIngredients();
    updateNutritionPreview();
});