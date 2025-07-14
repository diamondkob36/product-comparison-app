document.addEventListener("DOMContentLoaded", function () {
    const ingredientDropdown = $('#ingredient'); // ใช้ jQuery สำหรับ Select2
    const ingredientAmount = document.getElementById("amount");
    const addIngredientForm = document.getElementById("add-ingredient-form");
    const userIngredientsTable = document.getElementById("user-ingredients-table").querySelector("tbody");

    let currentPage = 1;
    let rowsPerPage = 10;

    // ฟังก์ชันโหลดข้อมูลวัตถุดิบสำหรับ dropdown
    async function loadIngredients() {
        try {
            const response = await fetch('/api/get_ingredients');
            const data = await response.json();

            if (data.ingredients) {
                ingredientDropdown.empty();
                ingredientDropdown.append('<option value="" disabled selected>กรุณาเลือกวัตถุดิบ</option>');
                data.ingredients.forEach(ingredient => {
                    ingredientDropdown.append(
                        `<option value="${ingredient.id}">${ingredient.name} (${ingredient.unit})</option>`
                    );
                });

                ingredientDropdown.select2({
                    placeholder: "ค้นหาวัตถุดิบ",
                    allowClear: true,
                    width: '100%'
                });
            }
        } catch (error) {
            console.error("Error loading ingredients:", error);
        }
    }

    // ฟังก์ชันโหลดวัตถุดิบของผู้ใช้จาก API
    window.loadUserIngredients = async function loadUserIngredients() {
        try {
            const response = await fetch('/users/get_user_ingredients');
            const data = await response.json();

            if (data.ingredients && data.ingredients.length > 0) {
                // เรียงลำดับข้อมูลตามจำนวนวัตถุดิบ (amount) จากมากไปน้อย
                const sortedIngredients = data.ingredients.sort((a, b) => b.amount - a.amount);

                // แสดงข้อมูลในตาราง
                userIngredientsTable.innerHTML = ""; // ล้างข้อมูลเก่าในตาราง
                displayTable(sortedIngredients); // เรียกฟังก์ชันแสดงข้อมูล
            } else {
                // ถ้าไม่มีวัตถุดิบในระบบ
                userIngredientsTable.innerHTML = "<tr><td colspan='4'>ไม่มีวัตถุดิบในคลัง</td></tr>";
            }
        } catch (error) {
            console.error("Error loading user ingredients:", error);
        }
    };

    function displayTable(data) {
        const tableBody = document.querySelector("#user-ingredients-table tbody");
        tableBody.innerHTML = ""; // ล้างข้อมูลเก่าในตาราง

        const startIndex = (currentPage - 1) * rowsPerPage; // คำนวณเริ่มต้นแถวในหน้านั้น
        const endIndex = startIndex + rowsPerPage; // คำนวณแถวสุดท้ายในหน้านั้น
        const paginatedData = data.slice(startIndex, endIndex); // เลือกเฉพาะข้อมูลในหน้าปัจจุบัน

        paginatedData.forEach((ingredient) => {
            const row = document.createElement("tr"); // สร้างแถวใหม่ในตาราง
            row.innerHTML = `
                <td>${ingredient.name}</td>
                <td>${ingredient.amount}</td>
                <td>${ingredient.unit}</td>
                <td>
                    <button class="delete-ingredient" data-id="${ingredient.ingredient_id}" title="ลบวัตถุดิบ">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row); // เพิ่มแถวลงในตาราง
        });

        // เพิ่ม Event Listener ให้กับปุ่มลบ
        document.querySelectorAll(".delete-ingredient").forEach((button) => {
            button.addEventListener("click", async (event) => {
                const ingredientId = event.target.closest("button").getAttribute("data-id");

                if (confirm("คุณต้องการลบวัตถุดิบนี้ใช่หรือไม่?")) {
                    try {
                        const response = await fetch(`/users/delete_ingredient/${ingredientId}`, {
                            method: "DELETE",
                            headers: {
                                "Content-Type": "application/json",
                            },
                        });

                        if (response.ok) {
                            alert("ลบวัตถุดิบสำเร็จ!");
                            loadUserIngredients(); // โหลดตารางวัตถุดิบใหม่
                            loadUserIngredientsForRecommendation(); // อัปเดตการแนะนำเมนู
                        } else {
                            const errorData = await response.json();
                            alert(errorData.error || "เกิดข้อผิดพลาดในการลบวัตถุดิบ");
                        }
                    } catch (error) {
                        console.error("Error deleting ingredient:", error);
                    }
                }
            });
        });

        setupPagination(data);
    }

    function setupPagination(data) {
        const pagination = document.getElementById("ingredient-pagination");
        pagination.innerHTML = "";

        const totalPages = Math.ceil(data.length / rowsPerPage);

        for (let i = 1; i <= totalPages; i++) {
            const button = document.createElement("button");
            button.textContent = i;
            button.className = i === currentPage ? "active" : "";
            button.addEventListener("click", () => {
                currentPage = i;
                displayTable(data);
            });
            pagination.appendChild(button);
        }
    }

    // ตัวเลือกเปลี่ยนจำนวนแถวต่อหน้า
    document.getElementById("ingredient-rows-per-page").addEventListener("change", (event) => {
        rowsPerPage = parseInt(event.target.value, 10);
        currentPage = 1;
        loadUserIngredients();
    });

    // ฟังก์ชันเพิ่มวัตถุดิบใหม่
    addIngredientForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const ingredientId = ingredientDropdown.val();
        const amount = parseFloat(ingredientAmount.value);

        if (!ingredientId || isNaN(amount) || amount <= 0) {
            alert("กรุณาเลือกวัตถุดิบและระบุจำนวนให้ถูกต้อง");
            return;
        }

        try {
            const response = await fetch('/users/add_ingredient', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ingredient_id: ingredientId,
                    amount: amount
                })
            });

            const data = await response.json();
            if (response.ok) {
                alert(data.message || "เพิ่มวัตถุดิบสำเร็จ!");
                ingredientAmount.value = "";
                ingredientDropdown.val(null).trigger('change');
                loadUserIngredients(); // อัปเดตวัตถุดิบ
                loadUserIngredientsForRecommendation();
                recommendMenu(); // เรียกฟังก์ชันแนะนำเมนู
            } else {
                alert(data.error || "เกิดข้อผิดพลาดในการเพิ่มวัตถุดิบ");
            }
        } catch (error) {
            console.error("Error adding ingredient:", error);
        }
    });

    loadIngredients();
    loadUserIngredients();
});
