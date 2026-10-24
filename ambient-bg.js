/* ============================================================
   Единый модуль анимированных фоновых эффектов
   Эффекты: matrix, stars, snow, aurora, bubbles
   ============================================================ */
(function () {
    let canvas = null;
    let ctx = null;
    let animationId = null;
    let currentEffect = null;
    let W = 0;
    let H = 0;

    // Данные эффектов
    let matrixCols = [];
    let stars = [];
    let flakes = [];
    let bubbles = [];

    const MATRIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}<>?/\\|~01';
    const MATRIX_FONT = 16;

    function ensureCanvas() {
        if (canvas) return;
        canvas = document.getElementById('ambient-bg');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        window.addEventListener('resize', resize);
    }

    function resize() {
        if (!canvas) return;
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        if (currentEffect) initEffect(currentEffect);
    }

    function initEffect(effect) {
        if (effect === 'matrix') initMatrix();
        else if (effect === 'stars') initStars();
        else if (effect === 'snow') initSnow();
        else if (effect === 'bubbles') initBubbles();
    }

    // ===== Инициализация данных =====
    function initMatrix() {
        const colCount = Math.floor(W / MATRIX_FONT);
        matrixCols = new Array(colCount).fill(0)
            .map(() => Math.random() * (H / MATRIX_FONT));
    }

    function initStars() {
        stars = [];
        const count = Math.floor((W * H) / 6000);
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: 0.3 + Math.random() * 1.4,
                phase: Math.random() * Math.PI * 2,
                speed: 0.5 + Math.random() * 1.5,
                hue: Math.random() > 0.8 ? 200 : 55
            });
        }
    }

    function initSnow() {
        flakes = [];
        const count = Math.floor((W * H) / 8000);
        for (let i = 0; i < count; i++) {
            flakes.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: 1 + Math.random() * 3,
                vy: 0.3 + Math.random() * 1.2,
                drift: Math.random() * Math.PI * 2,
                driftSpeed: 0.2 + Math.random() * 0.8
            });
        }
    }

    function initBubbles() {
        bubbles = [];
        const count = Math.floor((W * H) / 12000);
        for (let i = 0; i < count; i++) {
            bubbles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: 2 + Math.random() * 6,
                vy: 0.5 + Math.random() * 1.2,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: 0.5 + Math.random() * 1.5
            });
        }
    }

    // ===== Отрисовка эффектов =====
    function drawMatrix() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = MATRIX_FONT + 'px monospace';
        for (let i = 0; i < matrixCols.length; i++) {
            const ch = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
            const x = i * MATRIX_FONT;
            const y = matrixCols[i] * MATRIX_FONT;
            ctx.fillStyle = Math.random() > 0.975 ? '#b9f6ca' : '#00ff41';
            ctx.fillText(ch, x, y);
            if (y > H && Math.random() > 0.975) matrixCols[i] = 0;
            matrixCols[i]++;
        }
    }

    function drawStars(t) {
        ctx.fillStyle = '#02020a';
        ctx.fillRect(0, 0, W, H);
        for (const s of stars) {
            const tw = Math.abs(Math.sin(t * 0.001 * s.speed + s.phase));
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${s.hue}, 60%, ${70 + tw * 25}%, ${0.25 + tw * 0.75})`;
            ctx.fill();
        }
    }

    function drawSnow(t) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0b1a2e');
        g.addColorStop(1, '#16324f');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const f of flakes) {
            f.y += f.vy;
            f.x += Math.sin(t * 0.001 * f.driftSpeed + f.drift) * 0.5;
            if (f.y > H + 5) { f.y = -5; f.x = Math.random() * W; }
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawAurora(t) {
        ctx.fillStyle = '#030312';
        ctx.fillRect(0, 0, W, H);
        const bands = [
            { hue: 150, base: H * 0.25, amp: 50, speed: 0.00035, alpha: 0.22 },
            { hue: 180, base: H * 0.32, amp: 70, speed: 0.00028, alpha: 0.18 },
            { hue: 270, base: H * 0.38, amp: 60, speed: 0.00042, alpha: 0.16 }
        ];
        for (const b of bands) {
            ctx.beginPath();
            ctx.moveTo(0, H);
            for (let x = 0; x <= W; x += 8) {
                const y = b.base +
                    Math.sin(x * 0.004 + t * b.speed) * b.amp +
                    Math.sin(x * 0.009 + t * b.speed * 1.8) * b.amp * 0.35;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(W, H);
            ctx.closePath();
            const g = ctx.createLinearGradient(0, b.base - b.amp, 0, b.base + H * 0.4);
            g.addColorStop(0, `hsla(${b.hue}, 80%, 60%, ${b.alpha})`);
            g.addColorStop(1, `hsla(${b.hue}, 80%, 40%, 0)`);
            ctx.fillStyle = g;
            ctx.fill();
        }
    }

    function drawBubbles(t) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#003049');
        g.addColorStop(1, '#001428');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (const b of bubbles) {
            b.y -= b.vy;
            b.x += Math.sin(t * 0.001 * b.wobbleSpeed + b.wobble) * 0.4;
            if (b.y < -10) { b.y = H + 10; b.x = Math.random() * W; }
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(150,220,255,0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fill();
        }
    }

    // ===== Главный цикл =====
    function loop(t) {
        if (!currentEffect || !ctx) return;
        if (currentEffect === 'matrix') drawMatrix();
        else if (currentEffect === 'stars') drawStars(t);
        else if (currentEffect === 'snow') drawSnow(t);
        else if (currentEffect === 'aurora') drawAurora(t);
        else if (currentEffect === 'bubbles') drawBubbles(t);
        animationId = requestAnimationFrame(loop);
    }

    // ===== Публичные функции =====
    window.startAmbient = function (effect) {
        ensureCanvas();
        if (!canvas) return;
        if (currentEffect === effect && animationId) return;
        if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
        if (ctx) ctx.clearRect(0, 0, W, H);
        currentEffect = effect;
        resize();
        initEffect(effect);
        canvas.style.display = 'block';
        animationId = requestAnimationFrame(loop);
    };

    window.stopAmbient = function () {
        if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
        currentEffect = null;
        if (ctx && canvas) {
            ctx.clearRect(0, 0, W, H);
            canvas.style.display = 'none';
        }
    };

    // Экономия ресурсов: пауза при скрытой вкладке
    document.addEventListener('visibilitychange', () => {
        if (!currentEffect) return;
        if (document.hidden) {
            if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
        } else {
            if (!animationId) animationId = requestAnimationFrame(loop);
        }
    });
})();