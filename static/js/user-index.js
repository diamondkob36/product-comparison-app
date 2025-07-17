document.addEventListener("DOMContentLoaded", async function () {
    const editUserForm = document.getElementById("edit-user-form");
    const editButton = document.getElementById("edit-button");
    const editFormContainer = document.getElementById("edit-form-container");
    const closeEditForm = document.getElementById("close-edit-form");

    let chartInstance = null;

    // ✅ ฟังก์ชันเปิดฟอร์มแก้ไขข้อมูล
    editButton.addEventListener("click", function () {
        editFormContainer.style.display = "flex";
    });

    // ✅ ฟังก์ชันปิดฟอร์มแก้ไขข้อมูล
    closeEditForm.addEventListener("click", function () {
        editFormContainer.style.display = "none";
    });

    // ✅ ปิดฟอร์มเมื่อคลิกนอกตัวฟอร์ม
    editFormContainer.addEventListener("click", function (event) {
        if (event.target === editFormContainer) {
            editFormContainer.style.display = "none";
        }
    });

    $(document).ready(function() {
        $('#subgoal').select2({
            placeholder: $('#subgoal').data('placeholder'),
            allowClear: true,
            width: '100%'
        });
    });
    
    // ฟังก์ชันโหลดข้อมูลผู้ใช้
    async function loadUserInfo() {
        try {
            const response = await fetch("/users/get_user_info");
            const data = await response.json();

            if (data.error) {
                console.error("Error loading user info:", data.error);
                return;
            }

            // อัปเดตข้อมูลในหน้าเว็บ
            document.getElementById("display-name").textContent = data.name || "-";
            document.getElementById("display-weight").textContent = data.weight || "-";
            document.getElementById("display-height").textContent = data.height || "-";
            document.getElementById("display-age").textContent = data.age || "-";
            document.getElementById("display-gender").textContent = data.gender || "-";
            document.getElementById("display-activity-level").textContent = data.activity_level || "-";
            document.getElementById("display-goal").textContent = data.goal || "ยังไม่ได้ตั้งเป้าหมาย";
            document.getElementById("display-subgoal").textContent = data.subgoal || "ไม่มี";

            // ✅ แสดงข้อความ "ไม่มี" หากไม่มีเป้าหมายรอง
            if (!data.subgoal || data.subgoal.trim() === "") {
                document.getElementById("display-subgoal").textContent = "ไม่มี";
            } else {
                document.getElementById("display-subgoal").textContent = data.subgoal;
            }

            // เติมข้อมูลในฟอร์ม
            document.getElementById("name").value = data.name || "";
            document.getElementById("weight").value = data.weight || "";
            document.getElementById("height").value = data.height || "";
            document.getElementById("age").value = data.age || "";
            document.getElementById("gender").value = data.gender || "";
            document.getElementById("activity-level").value = data.activity_level || "";
            document.getElementById("goal").value = data.goal || "";
            document.getElementById("subgoal").value = data.subgoal || "";

        // ✅ กรณีเลือกหลายเป้าหมายรอง: แยกด้วยคอมมาแล้ว set ค่า
        const subgoalSelect = $('#subgoal');
        const selectedSubgoals = data.subgoal ? data.subgoal.split(",") : [];

        subgoalSelect.val(selectedSubgoals).trigger("change");

        } catch (error) {
            console.error("Error loading user info:", error);
        }
    }

    async function loadBMI() {
        try {
            const response = await fetch("/users/get_bmi");
            const data = await response.json();
    
            if (data.error) {
                console.warn("ไม่สามารถคำนวณ BMI ได้:", data.error);
                document.getElementById("bmi-value").textContent = "-";
                document.getElementById("bmi-level").textContent = "-";
                document.getElementById("bmi-advice").textContent = data.error;
                return;
            }
    
            document.getElementById("bmi-value").textContent = data.bmi;
            document.getElementById("bmi-level").innerHTML = `${data.icon} ${data.level}`;
            document.getElementById("bmi-advice").innerHTML = data.advice;
    
        } catch (error) {
            console.error("Error loading BMI:", error);
        }
    }

    // ฟังก์ชันแสดงกราฟพลังงานที่ควรได้รับต่อวัน
    async function renderBarChart() {
        try {
            const [adjustedRes, defaultRes] = await Promise.all([
                fetch("/users/calculate_bmr_tdee"),
                fetch("/users/default_intake")
            ]);
    
            const adjustedData = await adjustedRes.json();
            const defaultData = await defaultRes.json();
    
            if (adjustedData.error || defaultData.error) {
                console.error("Error loading intake data:", adjustedData.error || defaultData.error);
                return;
            }
    
            const dailyIntake = adjustedData.daily_intake;
            const maxValues = adjustedData.max_values;
            const defaultIntake = defaultData;
    
            const units = ["แคลอรี่", "กรัม", "กรัม", "กรัม", "กรัม", "มิลลิกรัม"];
            const nutrientLabels = ['🔥 พลังงาน', '🍗 โปรตีน', '🥓 ไขมัน', '🍞 คาร์โบไฮเดรต', '🍬 น้ำตาล', '🧂 โซเดียม'];
            const nutrientKeys = ["tdee", "protein", "fat", "carb", "sugar", "sodium"];
    
            const actualValuesAdjusted = nutrientKeys.map(key => dailyIntake[key]);
            const actualValuesDefault = nutrientKeys.map(key => defaultIntake[key]);
    
            const chartDataValuesAdjusted = nutrientKeys.map(key => (dailyIntake[key] / defaultIntake[key]) * 100);
            const chartDataValuesDefault = nutrientKeys.map(() => 100);
    
            if (window.chartInstance) {
                window.chartInstance.destroy();
            }
    
            const chartData = {
                labels: nutrientLabels,
                datasets: [
                    {
                        label: "ค่าตามเป้าหมายของคุณ",
                        data: chartDataValuesAdjusted,
                        backgroundColor: "rgba(76, 175, 80, 0.7)",     // ✅ สีเขียวอ่อน
                        borderColor: "rgba(76, 175, 80, 1)",            // ✅ สีเขียวเข้ม
                        borderWidth: 2
                    },
                    {
                        label: "ค่าที่ควรได้รับต่อวัน (ทั่วไป)",
                        data: chartDataValuesDefault,
                        backgroundColor: "rgba(33, 150, 243, 0.7)",     // ✅ สีฟ้าอ่อน
                        borderColor: "rgba(33, 150, 243, 1)",            // ✅ สีฟ้าเข้ม
                        borderWidth: 2
                    }
                ]
            };
    
            const ctx = document.getElementById("dailyIntakeChart").getContext("2d");
    
            const config = {
                type: "bar",
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: "bottom",
                            labels: { font: { size: 14 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const index = context.dataIndex;
                                    const datasetIndex = context.datasetIndex;
                                    const unit = units[index];
                                    const actualValue = datasetIndex === 0
                                        ? actualValuesAdjusted[index]
                                        : actualValuesDefault[index];
                                    return `${actualValue.toFixed(1)} ${unit}`;
                                }
                            }
                        },
                         // ✅ เพิ่มเส้นแดงที่ 100%
                        annotation: {
                            annotations: {
                                line100: {
                                    type: "line",
                                    yMin: 100,
                                    yMax: 100,
                                    borderColor: "red",
                                    borderWidth: 2
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            // ✅ ไม่ระบุ max เพื่อให้ auto
                            title: {
                                display: true,
                                text: "เปอร์เซ็นต์ (%)"
                            }
                        }
                    }
                },
            };
    
            window.chartInstance = new Chart(ctx, config);
    
        } catch (err) {
            console.error("Error rendering comparison chart:", err);
        }
    }    
    
    editUserForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        // ✅ ดึงค่าจาก input
        const weight = parseFloat(document.getElementById("weight").value) || 0;
        const height = parseFloat(document.getElementById("height").value) || 0;
        const age = parseInt(document.getElementById("age").value) || 0;

        // ✅ ตรวจสอบค่าก่อนส่ง
        if (weight <= 0 || height <= 0 || age <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'ข้อมูลไม่ถูกต้อง',
                text: 'กรุณากรอกน้ำหนัก ส่วนสูง และอายุที่มากกว่า 0',
            scrollbarPadding: false,
            heightAuto: false,
            timer: 1500,
            timerProgressBar: true,
            showConfirmButton: false
            });
            return;
        }

        const formData = new FormData(editUserForm);
        const payload = Object.fromEntries(formData);

        // ✅ ดึงค่าเป้าหมายรองแบบหลายตัวเลือก
        const subgoals = $('#subgoal').val();
        payload.subgoal = subgoals;

        try {
            const response = await fetch("/users/update_user_info", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (data.error) {
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: data.error,
                scrollbarPadding: false,
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
                text: 'อัปเดตข้อมูลสำเร็จ',
            scrollbarPadding: false,
            heightAuto: false,
            timer: 1000,
            showConfirmButton: false,
            timerProgressBar: true
            });

            await loadUserInfo();
            await renderBarChart();
            window.loadBmrTdee();
            await loadNutritionChart();
            await loadBMI();
            window.loadNutritionData();
            editFormContainer.style.display = "none";
        } catch (error) {
            console.error("Error updating user info:", error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถอัปเดตข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
            scrollbarPadding: false,
            heightAuto: false,
            timer: 1000,
            showConfirmButton: false,
            timerProgressBar: true
            });
        }
    });

    window.loadNutritionChart = async function loadNutritionChart() {
        try {
            // ดึงค่าที่ควรได้รับต่อวันจาก API /calculate_bmr_tdee
            const tdeeResponse = await fetch('/users/calculate_bmr_tdee');
            const tdeeData = await tdeeResponse.json();
            const ChartAnnotation = window['chartjs-plugin-annotation'];
    
            if (tdeeData.error) {
                console.error("Error fetching max values:", tdeeData.error);
                return;
            }
    
            const maxValues = tdeeData.max_values; // ค่าสูงสุดจาก API
    
            // ดึงข้อมูลสารอาหารของเมนูที่เลือกในวันนี้
            const response = await fetch('/users/nutrition_chart');
            const data = await response.json();
    
            if (data.error) {
                console.error("Error fetching nutrition data:", data.error);
                return;
            }
    
            const ctx = document.getElementById('nutritionChart').getContext('2d');
    
            // ข้อมูลหน่วยที่ต้องการแสดง
            const units = ["แคลอรี่", "กรัม", "กรัม", "กรัม", "กรัม", "มิลลิกรัม"];
    
            // ลำดับของข้อมูล
            const nutrientLabels = ['🔥 พลังงาน','🍗 โปรตีน','🥓 ไขมัน', '🍞 คาร์โบไฮเดรต','🍬 น้ำตาล','🧂 โซเดียม'];
            const nutrientKeys = ["tdee", "protein", "fat", "carbohydrate", "sugar", "sodium"];
    
            // ตรวจสอบว่ามีข้อมูลหรือไม่ หากไม่มีให้กำหนดค่าเริ่มต้นเป็น 0
            const actualValues = nutrientKeys.map(key => (data[key] !== undefined ? data[key] : 0));
            const maxValuesArr = nutrientKeys.map(key => maxValues[key] || 1); // ป้องกันการหารด้วย 0
    
            // คำนวณเป็นเปอร์เซ็นต์
            const chartDataValues = nutrientKeys.map(key =>
                maxValues[key] > 0 ? (data[key] / maxValues[key]) * 100 : 0
            );
    
            // ตรวจสอบว่ามีค่ามากกว่าศูนย์หรือไม่ เพื่อกำหนดค่า max ของ Y
            const maxY = Math.max(100, Math.max(...chartDataValues) + 20);
    
            // ลบกราฟเก่า
            if (window.nutritionChartInstance) {
                window.nutritionChartInstance.destroy();
            }

            const backgroundColors = chartDataValues.map(value => {
                if (value > 150) return "rgba(244, 67, 54, 0.7)";         // 🔴 แดง
                if (value > 100) return "rgba(255, 193, 7, 0.7)";          // 🟡 เหลือง
                return "rgba(76, 175, 80, 0.7)";                           // 🟢 เขียว
            });
            
            const borderColors = chartDataValues.map(value => {
                if (value > 150) return "rgba(244, 67, 54, 1)";            // 🔴 แดง
                if (value > 100) return "rgba(255, 193, 7, 1)";            // 🟡 เหลือง
                return "rgba(76, 175, 80, 1)";                             // 🟢 เขียว
            });
    
            // ข้อมูลกราฟ
            const chartData = {
                labels: nutrientLabels,
                datasets: [{
                label: "สารอาหารของเมนูทั้งหมดที่คุณเลือกในวันนี้ (%)",  // ✅ ใช้ของเดิม
                data: chartDataValues,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2
                }]
            };
    
            const config = {
                type: "bar",
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    layout: { padding: { top: 50 } },
                    plugins: {
                        legend: {
                            display: true,
                            position: "bottom",
                            labels: { font: { size: 14 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const index = context.dataIndex;
                                    const value = context.raw || 0;
                                    const actualValue = actualValues[index]?.toFixed(2) || "0.00";
                                    const maxValue = maxValuesArr[index]?.toFixed(2) || "0.00";
                                    const unit = units[index] || "";
                                    const percentage = value.toFixed(2);
                        
                                    return `${actualValue} ${unit} (${percentage}%) จากค่าสูงสุด ${maxValue} ${unit}`;
                                }
                            }
                        },
                        datalabels: {
                            anchor: "end",
                            align: "end",
                            formatter: (value, context) => {
                                const screenWidth = window.innerWidth;
                                const index = context.dataIndex;
                                const rawValue = actualValues[index] || 0;
                                const actualValue = rawValue.toFixed(2); // ✅ ปัดทศนิยมที่นี่
                                const unit = units[index] || "";
                                const percentage = value.toFixed(2);     // ปัด % ด้วย
                        
                                if (screenWidth <= 425) return "";
                                if (screenWidth <= 768) return `${actualValue} ${unit}`;
                                return `${actualValue} ${unit}\n(${percentage}%)`;
                            },
                            color: "#000",
                            font: {
                                size: window.innerWidth <= 768 ? 10 : 12,
                                weight: "bold"
                            }
                        },
                        // ✅ เพิ่มเส้นแดงที่ 100%
                        annotation: {
                            annotations: {
                                targetLine: {
                                    type: 'line',
                                    yMin: 100,
                                    yMax: 100,
                                    borderColor: 'red',
                                    borderWidth: 2
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            suggestedMax: maxY,
                            grid: { display: true },
                            title: {
                                display: window.innerWidth > 768,
                                text: "เปอร์เซ็นต์ (%)",
                            },
                            ticks: { display: true }
                        }
                    }
                },
                plugins: [ChartDataLabels, ChartAnnotation]
            };
            
            // ฟังก์ชันปรับเปลี่ยนตามขนาดหน้าจอ
            window.addEventListener("resize", function () {
                const isSmallScreen = window.innerWidth <= 768;
                nutritionChartInstance.options.scales.y.title.display = !isSmallScreen; // ซ่อนเฉพาะ title บนแกน Y
                nutritionChartInstance.update();
            });
            // สร้างกราฟใหม่
            window.nutritionChartInstance = new Chart(ctx, config);
    
        } catch (error) {
            console.error("Error loading nutrition chart:", error);
        }
    };

    // โหลดข้อมูลผู้ใช้และกราฟเมื่อหน้าเว็บโหลดเสร็จ
    await loadUserInfo();
    await renderBarChart();
    await loadNutritionChart();
    await loadBMI();
});
