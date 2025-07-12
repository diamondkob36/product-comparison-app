document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.getElementById("snow-canvas");
    const ctx = canvas.getContext("2d");

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const snowImage = new Image();
    snowImage.src = "/static/images/snow.png"; // ✅ ใส่ path รูปหิมะ

    const numFlakes = 100;
    const flakes = [];

    function Flake(x, y, r, d) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.d = d;
        this.tilt = Math.random() * 5;

        this.update = function () {
            this.y += Math.cos(this.d) + 0.3 + this.r / 3;
            this.x += Math.sin(this.d);
            if (this.y > height) {
                this.y = 0;
                this.x = Math.random() * width;
            }
        };

        this.draw = function () {
            ctx.drawImage(snowImage, this.x, this.y, this.r * 5, this.r * 5);
        };
    }

    for (let i = 0; i < numFlakes; i++) {
        flakes.push(new Flake(
            Math.random() * width,
            Math.random() * height,
            Math.random() * 3 + 2,
            Math.random() * Math.PI * 2
        ));
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < flakes.length; i++) {
            flakes[i].update();
            flakes[i].draw();
        }
        requestAnimationFrame(draw);
    }

    snowImage.onload = draw;

    window.addEventListener("resize", () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    });
});
