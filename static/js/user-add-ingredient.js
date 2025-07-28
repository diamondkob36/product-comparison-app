document.addEventListener("DOMContentLoaded", function () {
    const ingredientDropdown = $('#ingredient'); // ใช้ jQuery สำหรับ Select2
    const ingredientAmount = document.getElementById("amount");
    const addIngredientForm = document.getElementById("add-ingredient-form");
    const userIngredientsTable = document.getElementById("user-ingredients-table").querySelector("tbody");

    let currentPage = 1;
    let rowsPerPage = 5;

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
        tableBody.innerHTML = "";

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedData = data.slice(startIndex, endIndex);

        paginatedData.forEach((ingredient, index) => {
            const row = document.createElement("tr");
            const rowNumber = startIndex + index + 1;

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
            tableBody.appendChild(row);
        });

        // เชื่อม Event กับปุ่มลบ
        document.querySelectorAll(".delete-ingredient").forEach((button) => {
            button.addEventListener("click", async (event) => {
                const ingredientId = event.target.closest("button").getAttribute("data-id");

                const result = await Swal.fire({
                    title: 'คุณแน่ใจหรือไม่?',
                    text: "คุณต้องการลบวัตถุดิบนี้ใช่หรือไม่?",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'ลบ',
                    cancelButtonText: 'ยกเลิก',
                    scrollbarPadding: true,
                    heightAuto: false
                });

                if (result.isConfirmed) {
                    try {
                        const response = await fetch(`/users/delete_ingredient/${ingredientId}`, {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                        });

                        const data = await response.json();

                        if (response.ok) {
                            Swal.fire({
                                icon: 'success',
                                title: 'สำเร็จ!',
                                text: data.message || "ลบวัตถุดิบสำเร็จ!",
                                timer: 1000,
                                timerProgressBar: true,
                                showConfirmButton: false,
                                scrollbarPadding: true,
                                heightAuto: false
                            });

                            loadUserIngredients();
                            loadUserIngredientsForRecommendation();
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'เกิดข้อผิดพลาด',
                                text: data.error || "เกิดข้อผิดพลาดในการลบวัตถุดิบ",
                                scrollbarPadding: true,
                                heightAuto: false
                            });
                        }
                    } catch (error) {
                        console.error("Error deleting ingredient:", error);
                        Swal.fire({
                            icon: 'error',
                            title: 'เกิดข้อผิดพลาด',
                            text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
                            scrollbarPadding: true,
                            heightAuto: false
                        });
                    }
                }
            });
        });

        // อัปเดตการแบ่งหน้า
        setupPagination(data);
    }

    function setupPagination(data) {
        const pagination = document.getElementById("ingredient-pagination");
        pagination.innerHTML = "";

        const totalPages = Math.ceil(data.length / rowsPerPage);

        // ปุ่มก่อนหน้า
        if (currentPage > 1) {
            const prevBtn = document.createElement("button");
            prevBtn.textContent = "ก่อนหน้า";
            prevBtn.className = "page-btn";
            prevBtn.addEventListener("click", () => {
                currentPage--;
                displayTable(data);
                setupPagination(data);
            });
            pagination.appendChild(prevBtn);
        }

        // ปุ่มเลขหน้า
        for (let i = 1; i <= totalPages; i++) {
            const button = document.createElement("button");
            button.textContent = i;
            button.className = (i === currentPage) ? "page-btn active" : "page-btn";
            button.addEventListener("click", () => {
                currentPage = i;
                displayTable(data);
                setupPagination(data);
            });
            pagination.appendChild(button);
        }

        // ปุ่มถัดไป
        if (currentPage < totalPages) {
            const nextBtn = document.createElement("button");
            nextBtn.textContent = "ถัดไป";
            nextBtn.className = "page-btn";
            nextBtn.addEventListener("click", () => {
                currentPage++;
                displayTable(data);
                setupPagination(data);
            });
            pagination.appendChild(nextBtn);
        }
    }

    addIngredientForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const ingredientId = ingredientDropdown.val();
        const amount = parseFloat(ingredientAmount.value);

        if (!ingredientId || isNaN(amount) || amount <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'ข้อมูลไม่ถูกต้อง',
                text: 'กรุณาเลือกวัตถุดิบและระบุจำนวนให้ถูกต้อง',
                scrollbarPadding: true,
                heightAuto: false
            });
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
                Swal.fire({
                    icon: 'success',
                    title: 'สำเร็จ!',
                    text: data.message || "เพิ่มวัตถุดิบสำเร็จ!",
                    timer: 1000,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    scrollbarPadding: true,
                    heightAuto: false
                });

                ingredientAmount.value = "";
                ingredientDropdown.val(null).trigger('change');
                loadUserIngredients(); 
                loadUserIngredientsForRecommendation();
                recommendMenu();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: data.error || "เกิดข้อผิดพลาดในการเพิ่มวัตถุดิบ",
                    scrollbarPadding: true,
                    heightAuto: false
                });
            }
        } catch (error) {
            console.error("Error adding ingredient:", error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
                scrollbarPadding: true,
                heightAuto: false
            });
        }
    });

    loadIngredients();
    loadUserIngredients();
});
