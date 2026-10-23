/* ===== Матричный дождь из символов ===== */
(function () {
    let canvas = null;
    let ctx = null;
    let animationId = null;
    let columns = [];
    const fontSize = 16;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}<>?/\\|~01';

    function resize() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const colCount = Math.floor(canvas.width / fontSize);
        columns = new Array(colCount).fill(0).map(() => Math.random() * (canvas.height / fontSize));
    }

    function draw() {
        if (!ctx) return;
        // Полупрозрачный чёрный — эффект «затухания» хвостов
        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < columns.length; i++) {
            const char = chars[Math.floor(Math.random() * chars.length)];
            const x = i * fontSize;
            const y = columns[i] * fontSize;
            ctx.fillStyle = Math.random() > 0.975 ? '#b9f6ca' : '#00ff41';
            ctx.fillText(char, x, y);
            if (y > canvas.height && Math.random() > 0.975) columns[i] = 0;
            columns[i]++;
        }
        animationId = requestAnimationFrame(draw);
    }

    window.startMatrix = function () {
        if (animationId) return;
        if (!canvas) {
            canvas = document.getElementById('matrix-bg');
            if (!canvas) return;
            ctx = canvas.getContext('2d');
            window.addEventListener('resize', resize);
        }
        resize();
        draw();
    };

    window.stopMatrix = function () {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // Экономия ресурсов: останавливаем, когда вкладка скрыта
    document.addEventListener('visibilitychange', () => {
        if (document.body.getAttribute('data-theme') !== 'matrix' &&
            document.documentElement.getAttribute('data-theme') !== 'matrix') return;
        if (document.hidden) window.stopMatrix();
        else window.startMatrix();
    });
})();