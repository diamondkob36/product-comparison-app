document.addEventListener("DOMContentLoaded", async function () {
    const editUserForm = document.getElementById("edit-user-form");
    const editButton = document.getElementById("edit-button");
    const editFormContainer = document.getElementById("edit-form-container");
    const closeEditForm = document.getElementById("close-edit-form");

    let chartInstance = null;

    // helper: โหลดข้อมูลล่าสุดจากเซิร์ฟเวอร์
    async function refreshFormFromServer() {
        await loadUserInfo();
    }

    // เปิดฟอร์ม → โหลดค่าล่าสุดเสมอ
    editButton.addEventListener("click", async function () {
        await refreshFormFromServer();
        editFormContainer.style.display = "flex";
    });

    // ปิดฟอร์ม (กดปุ่ม X) → รีค่ากลับเป็นข้อมูลเดิม
    closeEditForm.addEventListener("click", async function () {
        await refreshFormFromServer();
        editFormContainer.style.display = "none";
    });

    // ปิดฟอร์มเมื่อคลิกนอกตัวฟอร์ม → รีค่ากลับเป็นข้อมูลเดิม
    editFormContainer.addEventListener("click", async function (event) {
        if (event.target === editFormContainer) {
            await refreshFormFromServer();
            editFormContainer.style.display = "none";
        }
    });

    $(document).ready(function() {
        $('#subgoal').select2({
            placeholder: $('#subgoal').data('placeholder'),
            dropdownParent: $('#edit-form-container'),
            allowClear: true,
            width: '100%'
        });
    });
    
    // ปุ่มเลื่อนขึ้นด้านบน
    const scrollTopBtn = document.getElementById("scrollTopBtn");
    const recommendSection = document.querySelector(".recommend");

    window.addEventListener("scroll", function () {
        // หาตำแหน่งของ .recommend เมื่อเทียบกับ viewport
        const rect = recommendSection.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;

        // ถ้าด้านบนของ recommend เลื่อนขึ้นไปพ้นจอแล้ว → แสดงปุ่ม
        if (rect.top < 0) {
            scrollTopBtn.style.display = "block";
        } else {
            scrollTopBtn.style.display = "none";
        }
    });

    scrollTopBtn.addEventListener("click", function () {
        recommendSection.scrollIntoView({
            behavior: "smooth"
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

            const bmiValueEl = document.getElementById("bmi-value");
            const adviceBox = document.getElementById("bmi-advice");
            const bmiBox = document.querySelector(".box-info-2"); // ✅ ดึงกล่อง BMI

            if (data.error) {
                console.warn("ไม่สามารถคำนวณ BMI ได้:", data.error);
                document.getElementById("bmi-value").textContent = "-";
                document.getElementById("bmi-level").textContent = "-";
                adviceBox.textContent = data.error;
                adviceBox.className = "text-bmi"; // ล้างคลาสสีทั้งหมด
                return;
            }

            document.getElementById("bmi-value").textContent = data.bmi;
            document.getElementById("bmi-level").innerHTML = `${data.icon} ${data.level}`;
            adviceBox.innerHTML = data.advice;

            // ล้าง class สีเก่าออกก่อน
            adviceBox.className = "text-bmi";
            bmiValueEl.className = "bmi-value";
            if (bmiBox) bmiBox.className = "box-info-2";

            // เพิ่ม class ใหม่ตามระดับ BMI
            switch (data.level) {
                case "ผอม":
                    adviceBox.classList.add("bmi-underweight");
                    bmiValueEl.classList.add("bmi-val-underweight");
                    bmiBox.classList.add("bmi-box-underweight");
                    break;
                case "ปกติ":
                    adviceBox.classList.add("bmi-normal");
                    bmiValueEl.classList.add("bmi-val-normal");
                    bmiBox.classList.add("bmi-box-normal");
                    break;
                case "น้ำหนักเกิน":
                    adviceBox.classList.add("bmi-overweight");
                    bmiValueEl.classList.add("bmi-val-overweight");
                    bmiBox.classList.add("bmi-box-overweight");
                    break;
                case "อ้วนระดับ 1":
                    adviceBox.classList.add("bmi-obese1");
                    bmiValueEl.classList.add("bmi-val-obese1");
                    bmiBox.classList.add("bmi-box-obese1");
                    break;
                case "อ้วนระดับ 2":
                    adviceBox.classList.add("bmi-obese2");
                    bmiValueEl.classList.add("bmi-val-obese2");
                    bmiBox.classList.add("bmi-box-obese2");
                    break;
            }

        } catch (error) {
            console.error("Error loading BMI:", error);
        }
    }

    async function loadDefaultIntake() {
        try {
            const response = await fetch("/users/default_intake");
            const data = await response.json();

            if (data.error) {
                console.error("Error loading default intake:", data.error);
                return;
            }

            // ✅ แสดงในกล่องข้อมูลเดิมแทนกราฟ
            document.getElementById("total-energy-default").innerText = data.tdee || "-";
            document.getElementById("intake-protein-default").innerText = data.protein || "-";
            document.getElementById("intake-fat-default").innerText = data.fat || "-";
            document.getElementById("intake-carb-default").innerText = data.carb || "-";
            document.getElementById("intake-sugar-default").innerText = data.sugar || "-";
            document.getElementById("intake-sodium-default").innerText = data.sodium || "-";
        } catch (error) {
            console.error("Error loading default intake:", error);
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
            scrollbarPadding: true,
            heightAuto: false,
            timer: 1500,
            timerProgressBar: true,
            showConfirmButton: false
            });
            return;
        }

        const formData = new FormData(editUserForm);
        const payload = Object.fromEntries(formData.entries()); // ✅ .entries() เพื่อให้เข้ากันได้ทุก browser

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

            // ✅ Session timeout → popup แล้ว redirect
            if (response.status === 401 && data.redirect) {
                window.handleSessionExpired(data);
                return;
            }          

            if (data.error) {
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: data.error,
                    scrollbarPadding: true,
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
            scrollbarPadding: true,
            heightAuto: false,
            timer: 1000,
            showConfirmButton: false,
            timerProgressBar: true
            });

            await loadUserInfo();
            window.loadBmrTdee();
            await loadDefaultIntake();
            await loadNutritionBars();
            await loadBMI();
            editFormContainer.style.display = "none";
        } catch (error) {
            console.error("Error updating user info:", error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถอัปเดตข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
            scrollbarPadding: true,
            heightAuto: false,
            timer: 1000,
            showConfirmButton: false,
            timerProgressBar: true
            });
        }
    });

    window.loadNutritionBars = async function () {
        try {
            const maxRes = await fetch("/users/calculate_bmr_tdee");
            const intakeRes = await fetch("/users/nutrition_chart");

            const maxData = await maxRes.json();
            const intakeData = await intakeRes.json();

            if (maxData.error || intakeData.error) {
                console.error("Error loading data:", maxData.error || intakeData.error);
                return;
            }

            const nutrients = [
                { key: "tdee", label: "🔥 พลังงาน", unit: "กิโลแคลอรี", advice: "ควรลดปริมาณการรับประทานหรือเพิ่มการออกกำลังกาย" },
                { key: "protein", label: "🍗 โปรตีน", unit: "กรัม", advice: "แบ่งการทานโปรตีนให้สมดุลในแต่ละมื้อ" },
                { key: "fat", label: "🥓 ไขมัน", unit: "กรัม", advice: "ลดอาหารทอดและไขมันจากสัตว์" },
                { key: "carb", label: "🍞 คาร์โบไฮเดรต", unit: "กรัม", advice: "ลดอาหารแป้งขัดสี และเพิ่มผัก" },
                { key: "sugar", label: "🍬 น้ำตาล", unit: "กรัม", advice: "ลดการทานขนมหวานหรือเครื่องดื่มหวาน" },
                { key: "sodium", label: "🧂 โซเดียม", unit: "มก.", advice: "ลดการใช้เครื่องปรุงรสเค็มและอาหารแปรรูป" }
            ];

            const container = document.getElementById("nutrition-bars-container");
            container.innerHTML = "";

            let warnings = [];

            nutrients.forEach(nutri => {
                const actual = intakeData[nutri.key] || 0;
                const max = maxData.max_values[nutri.key] || 1;
                const percent = (actual / max) * 100;
                let colorClass = "green-bar";

                if (percent > 150) {
                    colorClass = "red-bar";
                    warnings.push(`${nutri.label} เกิน ${Math.round(percent)}% ⚠️ (${nutri.advice})`);
                } else if (percent > 100) {
                    colorClass = "yellow-bar";
                    warnings.push(`${nutri.label} เกิน ${Math.round(percent)}% (${nutri.advice})`);
                }

                const bar = document.createElement("div");
                bar.className = "nutrition-bar";
                bar.innerHTML = `
                    <div class="nutrition-bar-label">
                        <span>${nutri.label}</span>
                        <span>${actual.toFixed(0)} / ${max.toFixed(0)} ${nutri.unit}</span>
                    </div>
                    <div class="progress-bar-outer">
                        <div class="progress-bar-inner ${colorClass}" style="width: ${Math.min(percent, 100)}%;">
                            <span>${Math.round(percent)}%</span>
                        </div>
                    </div>
                `;
                container.appendChild(bar);
            });

            // ✅ อัปเดตคำแนะนำ
            const adviceContainer = document.querySelector(".total_nutrition-warning p");
            if (warnings.length > 0) {
                adviceContainer.innerHTML = `
                    หมายเหตุ: พบสารอาหารบางรายการเกินค่าที่แนะนำ<br>
                    - ${warnings.join("<br>- ")}
                `;
            } else {
                adviceContainer.textContent =
                    "หมายเหตุ: ข้อมูลพลังงานและสารอาหารที่แสดงถูกคำนวณจากวัตถุดิบดิบก่อนการปรุงอาหาร ซึ่งอาจแตกต่างจากปริมาณที่ได้รับจริงหลังปรุงอาหาร เช่น การสูญเสียน้ำมัน ไขมัน หรือน้ำตาล";
            }

        } catch (error) {
            console.error("Error building nutrition bars:", error);
        }
    };

    // ✅ helper: ตรวจ session หมดอายุแบบ global
    window.handleSessionExpired = async function (data){
        if (data.redirect) {
            Swal.fire({
                icon: "warning",
                title: "หมดเวลาการเข้าสู่ระบบ",
                text: data.error || "กรุณาเข้าสู่ระบบใหม่",
                confirmButtonText: "เข้าสู่ระบบ",
                heightAuto: false,
                scrollbarPadding: true
            }).then(() => {
                window.location.href = data.redirect;
            });
        }
    }

    // โหลดข้อมูลผู้ใช้และกราฟเมื่อหน้าเว็บโหลดเสร็จ
    await loadUserInfo();
    await loadDefaultIntake();
    await loadNutritionBars();
    await loadBMI();
});
