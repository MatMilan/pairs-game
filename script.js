const ROWS = 30;
const COLS = 9;

// Состояние игры
let board = [];
let selected = null;
let history = [];
let isGameActive = false;
let canUndo = true;
let isPaused = false;
let pendingRun = null; // победная партия, готовая к отправке в рейтинг

// ===== Уровни сложности =====
const LEVEL_CONFIG = {
    classic: { rows: 3, groups: null, label: 'Classic' },
    level1:  { rows: 2, groups: [[1,9],[2,8],[3,7]], label: 'Easy' },
    level2:  { rows: 3, groups: [[1,9],[2,8],[3,7],[4,6]], label: 'Medium' },
    level3:  { rows: 3, groups: [[1,9],[2,8],[3,7],[4,6],[5]], label: 'Hard' },
};
const MODES = ['classic','level1','level2','level3'];
const DIFF_KEY = 'pairsGameDifficulty';
let currentMode = 'classic';  // выбранный режим (UI + рекорды)
let activeMode  = 'classic';  // режим текущей партии

// Счётчики
let pairsRemoved = 0;
let hintsRemaining = 3;
const MAX_HINTS = 3;

// Отслеживание одинаковых пар для бонуса
let lastPairSig = null;
let consecutiveSame = 0;

// Таймер (с поддержкой паузы)
let timerInterval = null;
let runStartMs = null;
let accumulatedMs = 0;

// Звук
let soundEnabled = true;
let audioCtx = null;

// DOM
const table = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const pairsCounterEl = document.getElementById('pairs-counter');
const timerEl = document.getElementById('timer');
const hintsIndicatorEl = document.getElementById('hints-indicator');
const recordsTimeEl = document.getElementById('records-time');
const recordsPairsEl = document.getElementById('records-pairs');
const boardWrapper = document.getElementById('board-wrapper');
const pauseOverlay = document.getElementById('pause-overlay');
const btnSound = document.getElementById('btn-sound');
const btnPause = document.getElementById('btn-pause');
const recordsTitleEl = document.getElementById('records-title');
const difficultySelect = document.getElementById('difficulty-select');

// ===== Группы парных цифр: {1,9} {2,8} {3,7} {4,6} {5} =====
function digitGroupClass(v) {
    if (v === 1 || v === 9) return 'dg-19';
    if (v === 2 || v === 8) return 'dg-28';
    if (v === 3 || v === 7) return 'dg-37';
    if (v === 4 || v === 6) return 'dg-46';
    if (v === 5) return 'dg-5';
    return '';
}

// ===== Звук =====
function initAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { console.warn('Web Audio API не поддерживается'); }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!soundEnabled || !audioCtx) return;
    const now = audioCtx.currentTime;
    const tones = {
        select: [{ f: 600, d: 0.08, v: 0.15 }],
        pair: [
            { f: 523, d: 0.1, v: 0.2, t: 0 },
            { f: 659, d: 0.1, v: 0.2, t: 0.08 },
            { f: 784, d: 0.15, v: 0.2, t: 0.16 }
        ],
        error: [
            { f: 220, d: 0.15, v: 0.2, t: 0 },
            { f: 180, d: 0.2, v: 0.2, t: 0.1 }
        ],
        hint: [
            { f: 880, d: 0.1, v: 0.15, t: 0 },
            { f: 1100, d: 0.1, v: 0.15, t: 0.1 }
        ],
        bonus: [
            { f: 659, d: 0.1, v: 0.2, t: 0 },
            { f: 880, d: 0.1, v: 0.2, t: 0.08 },
            { f: 1109, d: 0.15, v: 0.2, t: 0.16 },
            { f: 1319, d: 0.2, v: 0.2, t: 0.24 }
        ],
    win: [
        // восходящая фанфара
        { f: 523.25, d: 0.15, v: 0.22, t: 0 },     // C5
        { f: 659.25, d: 0.15, v: 0.22, t: 0.15 },  // E5
        { f: 783.99, d: 0.15, v: 0.22, t: 0.30 },  // G5
        { f: 1046.5, d: 0.35, v: 0.26, t: 0.45 },  // C6
        // торжественный аккорд до-мажор с басом
        { f: 261.63, d: 1.10, v: 0.14, t: 0.85 },  // C4 (бас)
        { f: 1046.5, d: 1.00, v: 0.15, t: 0.85 },  // C6
        { f: 1318.5, d: 1.00, v: 0.13, t: 0.85 },  // E6
        { f: 1568.0, d: 1.00, v: 0.13, t: 0.85 },  // G6
        { f: 2093.0, d: 0.70, v: 0.09, t: 1.15 }   // C7 (искра)
    ],
    lose: [
        // нисходящая трагическая фраза
        { f: 440.00, d: 0.26, v: 0.20, t: 0 },     // A4
        { f: 415.30, d: 0.26, v: 0.20, t: 0.27 },  // G#4
        { f: 392.00, d: 0.26, v: 0.20, t: 0.54 },  // G4
        { f: 369.99, d: 0.42, v: 0.22, t: 0.81 },  // F#4
        // протяжный минорный аккорд (ля-минор) с глубоким басом
        { f: 110.00, d: 1.60, v: 0.16, t: 1.30 },  // A2 (глубокий дрон)
        { f: 220.00, d: 1.40, v: 0.16, t: 1.30 },  // A3
        { f: 261.63, d: 1.40, v: 0.13, t: 1.30 },  // C4
        { f: 329.63, d: 1.40, v: 0.13, t: 1.30 }   // E4
    ]
    };
    const seq = tones[type];
    if (!seq) return;
    seq.forEach(n => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = n.f;
        const start = now + (n.t || 0);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(n.v, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + n.d);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + n.d + 0.05);
    });
}

btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnSound.textContent = soundEnabled ? '🔔' : '🔕';
    btnSound.classList.toggle('muted', !soundEnabled);
});

// ===== Таймер с паузой =====
function startTimer() {
    stopTimer();
    runStartMs = Date.now();
    timerInterval = setInterval(updateTimer, 250);
}
function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}
function freezeTimer() {
    if (timerInterval && runStartMs !== null) {
        accumulatedMs += Date.now() - runStartMs;
        runStartMs = null;
    }
    stopTimer();
    updateTimer();
}
function getElapsedSeconds() {
    let ms = accumulatedMs;
    if (runStartMs !== null) ms += Date.now() - runStartMs;
    return Math.floor(ms / 1000);
}
function updateTimer() {
    timerEl.textContent = formatTime(getElapsedSeconds());
}

// ===== Лампочки подсказок =====
function renderHintsLamps() {
    const lamps = hintsIndicatorEl.querySelectorAll('.hint-lamp');
    lamps.forEach((lamp, i) => {
        lamp.classList.remove('active', 'used');
        lamp.classList.add(i < hintsRemaining ? 'active' : 'used');
    });
}
function resetHints() {
    hintsRemaining = MAX_HINTS;
    renderHintsLamps();
}
function renderComboBar(pulse) {
    const segs = document.querySelectorAll('#combo-bar .combo-seg');
    segs.forEach((seg, i) => seg.classList.toggle('filled', i < consecutiveSame));
    const bar = document.getElementById('combo-bar');
    if (bar) {
        bar.classList.remove('pulse');
        if (pulse) { void bar.offsetWidth; bar.classList.add('pulse'); }
    }
}
// ===== Сброс статистики =====
function resetStats() {
    pairsRemoved = 0;
    pairsCounterEl.textContent = '0';
    resetHints();
    lastPairSig = null;
    consecutiveSame = 0;
    renderComboBar(false);
    accumulatedMs = 0;
    runStartMs = null;
    timerEl.textContent = '00:00';
    stopTimer();
}

// ===== Игровые функции =====
function initBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) row.push(null);
        board.push(row);
    }
    renderBoard();
}

function startGame() {
    initAudio();
    initBoard();
    history = [];
    isGameActive = true;
    canUndo = true;
    activeMode = currentMode;
    resetStats();
    fillStartRows();
    startTimer();
    updateStatus('Игра началась! Режим: ' + LEVEL_CONFIG[activeMode].label);
}

function fillStartRows() {
    if (activeMode === 'classic') fillClassicRows();
    else fillRandomRows(activeMode);
    renderBoard();
}

function fillClassicRows() {
    const pattern = [1,2,3,4,5,6,7,8,9,1,1,1,2,1,3,1,4,1,5,1,6,1,7,1,8,1,9];
    let idx = 0;
    for (let r = 0; r < 3 && idx < pattern.length; r++) {
        for (let c = 0; c < COLS && idx < pattern.length; c++) {
            board[r][c] = pattern[idx++];
        }
    }
}

function fillRandomRows(mode) {
    const config = LEVEL_CONFIG[mode];
    const groups = config.groups;
    const totalCells = config.rows * COLS;
    const pairCount = Math.floor(totalCells / 2);
    const digits = [];
    // генерируем парами, чтобы каждую цифру можно было убрать
    for (let i = 0; i < pairCount; i++) {
        const group = groups[i % groups.length];
        const d1 = group[Math.floor(Math.random() * group.length)];
        const d2 = group[Math.floor(Math.random() * group.length)];
        digits.push(d1, d2);
    }
    shuffleArray(digits);
    let idx = 0;
    for (let r = 0; r < config.rows && idx < digits.length; r++) {
        for (let c = 0; c < COLS && idx < digits.length; c++) {
            board[r][c] = digits[idx++];
        }
    }
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function renderBoard() {
    table.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < COLS; c++) {
            const td = document.createElement('td');
            const val = board[r][c];

            if (val === null) {
                td.className = 'empty';
                td.textContent = '';
                td.style.color = 'transparent';
            } else if (val === '*') {
                td.className = 'starred';
                td.textContent = '*';
            } else {
                td.textContent = val;
                td.classList.add(digitGroupClass(val));
            }

            if (selected && selected.r === r && selected.c === c) {
                td.classList.add('selected');
            }

            td.addEventListener('click', () => handleCellClick(r, c));
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
}

function handleCellClick(r, c) {
    if (!isGameActive || isPaused) return;

    const val = board[r][c];
    if (val === null || val === '*') return;

    if (selected) {
        const first = selected;
        const second = { r, c };

        if (first.r === second.r && first.c === second.c) {
            selected = null;
            renderBoard();
            return;
        }

        if (isPair(first, second)) {
            const va = board[first.r][first.c];
            const vb = board[second.r][second.c];
            const snapshot = JSON.parse(JSON.stringify(board));

            removePair(first, second);
            history.push(snapshot);
            canUndo = true;

            pairsRemoved++;
            pairsCounterEl.textContent = pairsRemoved;

            trackPairBonus(va, vb);
            checkWin();
            selected = null;
            renderBoard();
        } else {
            playSound('error');
            updateStatus('Это не пара');
            selected = null;
            renderBoard();
        }
    } else {
        initAudio();
        selected = { r, c };
        playSound('select');
        renderBoard();
    }
}

function isPair(a, b) {
    const va = board[a.r][a.c];
    const vb = board[b.r][b.c];
    if (typeof va !== 'number' || typeof vb !== 'number') return false;
    const same = va === vb;
    const sum10 = va + vb === 10;
    if (!same && !sum10) return false;
    return areNeighbors(a, b);
}

function areNeighbors(a, b) {
    if (a.r === b.r) {
        const minC = Math.min(a.c, b.c);
        const maxC = Math.max(a.c, b.c);
        for (let c = minC + 1; c < maxC; c++) {
            if (typeof board[a.r][c] === 'number') return false;
        }
        return true;
    }
    if (a.c === b.c) {
        const minR = Math.min(a.r, b.r);
        const maxR = Math.max(a.r, b.r);
        for (let r = minR + 1; r < maxR; r++) {
            if (typeof board[r][a.c] === 'number') return false;
        }
        return true;
    }
    const r1 = Math.min(a.r, b.r);
    const r2 = Math.max(a.r, b.r);
    const c1 = (a.r === r1) ? a.c : b.c;
    const c2 = (a.r === r2) ? a.c : b.c;
    for (let r = r1 + 1; r < r2; r++) {
        let hasDigit = false;
        for (let c = 0; c < COLS; c++) {
            if (typeof board[r][c] === 'number') { hasDigit = true; break; }
        }
        if (hasDigit) return false;
    }
    for (let c = c1 + 1; c < COLS; c++) {
        if (typeof board[r1][c] === 'number') return false;
    }
    for (let c = 0; c < c2; c++) {
        if (typeof board[r2][c] === 'number') return false;
    }
    return true;
}

function removePair(a, b) {
    playSound('pair');
    const tds = Array.from(table.querySelectorAll('td'));
    const idx1 = a.r * COLS + a.c;
    const idx2 = b.r * COLS + b.c;
    if (tds[idx1]) createParticles(tds[idx1], getComputedStyle(tds[idx1]).color);
    if (tds[idx2]) createParticles(tds[idx2], getComputedStyle(tds[idx2]).color);

    board[a.r][a.c] = '*';
    board[b.r][b.c] = '*';
    shiftRowsUpIfFullStarRow();
}

function shiftRowsUpIfFullStarRow() {
    let changed = true;
    while (changed) {
        changed = false;
        for (let r = 0; r < ROWS - 1; r++) {
            const isFullStar = board[r].every(v => v === '*');
            if (isFullStar) {
                for (let rr = r; rr < ROWS - 1; rr++) {
                    for (let c = 0; c < COLS; c++) board[rr][c] = board[rr + 1][c];
                }
                for (let c = 0; c < COLS; c++) board[ROWS - 1][c] = null;
                changed = true;
                break;
            }
        }
    }
}

function createParticles(tdEl, color) {
    const rect = tdEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 14;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = `${cx}px`;
        p.style.top = `${cy}px`;
        p.style.background = color;
        p.style.boxShadow = `0 0 8px ${color}`;
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const distance = 60 + Math.random() * 50;
        p.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
        p.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 950);
    }
}

// ===== Бонус: 3 одинаковые пары подряд => +1 подсказка =====

function trackPairBonus(va, vb) {
    const sig = digitGroupClass(va); // цвет пары = группа цифр
    const grew = (sig === lastPairSig);
    if (grew) consecutiveSame++;
    else { lastPairSig = sig; consecutiveSame = 1; }

    if (consecutiveSame >= 3) {
        consecutiveSame = 0;
        renderComboBar(false);
        if (hintsRemaining < MAX_HINTS) {
            hintsRemaining++;
            renderHintsLamps();
            playSound('bonus');
            showBonusPopup('🎁 +1 подсказка!');
            updateStatus('Бонус: 3 пары одного цвета → +1 подсказка!');
        }
    } else {
        renderComboBar(grew);
    }
}
function showBonusPopup(text) {
    const el = document.createElement('div');
    el.className = 'bonus-popup';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

// ===== Пауза =====
function togglePause() {
    if (!isGameActive) return;
    if (isPaused) resumeGame();
    else pauseGame();
}
function pauseGame() {
    isPaused = true;
    freezeTimer();
    boardWrapper.classList.add('paused');
    pauseOverlay.classList.add('visible');
    btnPause.innerHTML = '▶️ Дальше';
    updateStatus('⏸️ Пауза');
    playSound('select');
}
function resumeGame() {
    isPaused = false;
    startTimer();
    boardWrapper.classList.remove('paused');
    pauseOverlay.classList.remove('visible');
    btnPause.innerHTML = '⏸️ Пауза';
    updateStatus('Игра продолжается');
    playSound('select');
}
function clearPauseVisuals() {
    isPaused = false;
    boardWrapper.classList.remove('paused');
    pauseOverlay.classList.remove('visible');
    btnPause.innerHTML = '⏸️ Пауза';
}

// ===== Конец игры: победа / поражение =====
function checkWin() {
    const hasAnyDigit = board.some(row => row.some(v => typeof v === 'number'));
    if (!hasAnyDigit) endGame(true);
}

function endGame(win) {
    isGameActive = false;
    clearPauseVisuals();
    freezeTimer();
    const elapsed = getElapsedSeconds();

    if (win) {
        playSound('win');
        spawnConfetti();
        const tRec = saveRecord(activeMode, 'time', elapsed);
        const pRec = saveRecord(activeMode, 'pairs', pairsRemoved);
        queueOnlineResult(elapsed); 
        let msg = `🎉 Победа! Пар: ${pairsRemoved} | Время: ${formatTime(elapsed)}`;
        if (tRec) msg += ' 🥇 Рекорд по времени!';
        if (pRec) msg += ' 🥇 Рекорд по парам!';
        updateStatus(msg);
    } else {
        playSound('lose');
        updateStatus('💥 Игра окончена');
    }
    showEndModal(win, elapsed);
}

function spawnConfetti() {
    const colors = ['#ff6b9d', '#ffd93d', '#4ade80', '#60a5fa', '#c084fc', '#ff9f43'];
    for (let i = 0; i < 80; i++) {
        setTimeout(() => {
            const p = document.createElement('div');
            p.className = 'confetti';
            p.style.left = Math.random() * 100 + 'vw';
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.animationDuration = (2 + Math.random() * 2) + 's';
            p.style.animationDelay = (Math.random() * 0.5) + 's';
            const size = 6 + Math.random() * 8;
            p.style.width = size + 'px';
            p.style.height = size + 'px';
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 4500);
        }, i * 20);
    }
}

function showEndModal(win, elapsed) {
    removeEndModal();
    const overlay = document.createElement('div');
    overlay.className = 'end-modal-overlay';
    const box = document.createElement('div');
    box.className = 'end-modal-box ' + (win ? 'win' : 'lose');
    box.innerHTML = win
        ? `<div class="end-emoji">🎉</div>
           <h2 class="end-title">Победа!</h2>
           <div class="end-stats">
             <div class="end-stat"><span class="end-stat-label">Пар убрано</span><span class="end-stat-value">${pairsRemoved}</span></div>
             <div class="end-stat"><span class="end-stat-label">Время</span><span class="end-stat-value">${formatTime(elapsed)}</span></div>
           </div>
           <button class="btn btn-primary end-btn" data-action="restart">Играть снова</button>`
        : `<div class="end-emoji">💥</div>
           <h2 class="end-title">Игра окончена</h2>
           <p class="end-sub">Не хватило места для всех цифр</p>
           <div class="end-stats">
             <div class="end-stat"><span class="end-stat-label">Пар убрано</span><span class="end-stat-value">${pairsRemoved}</span></div>
           </div>
           <button class="btn btn-primary end-btn" data-action="restart">Попробовать снова</button>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    overlay.querySelector('[data-action="restart"]').addEventListener('click', () => {
        removeEndModal();
        startGame();
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) removeEndModal(); });
}
function removeEndModal() {
    const m = document.querySelector('.end-modal-overlay');
    if (m) m.remove();
}

// ===== Рекорды (раздельно по режимам) =====
const RECORDS_KEY = 'pairsGameRecords_v3';
const OLD_RECORDS_KEY = 'pairsGameRecords_v2';
const MAX_RECORDS = 20;

function normalizeRecords(data) {
    const result = {};
    MODES.forEach(m => {
        result[m] = {
            time:  (data[m] && Array.isArray(data[m].time))  ? data[m].time  : [],
            pairs: (data[m] && Array.isArray(data[m].pairs)) ? data[m].pairs : [],
        };
    });
    return result;
}

function loadRecords() {
    let raw = null;
    try { raw = localStorage.getItem(RECORDS_KEY); } catch (e) {}
    if (raw) {
        try { return normalizeRecords(JSON.parse(raw)); } catch (e) { return normalizeRecords({}); }
    }
    // первый запуск v3: перенос рекордов Классики из v2
    let migrated = {};
    try {
        const oldRaw = localStorage.getItem(OLD_RECORDS_KEY);
        if (oldRaw) {
            const old = JSON.parse(oldRaw);
            migrated = { classic: { time: old.time || [], pairs: old.pairs || [] } };
        }
    } catch (e) {}
    return normalizeRecords(migrated);
}

function saveRecords(data) {
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify(data)); } catch (e) {}
}

function saveRecord(mode, type, value) {
    const records = loadRecords();
    const now = new Date().toLocaleDateString('ru-RU');
    records[mode][type].push({ value, date: now });
    records[mode][type].sort((a, b) => a.value - b.value);
    records[mode][type] = records[mode][type].slice(0, MAX_RECORDS);
    saveRecords(records);
    renderRecords(mode, type);
    return records[mode][type].some(r => r.value === value && r.date === now);
}

function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function renderRecords(mode, type) {
    const records = loadRecords();
    const list = type === 'time' ? recordsTimeEl : recordsPairsEl;
    const data = (records[mode] && records[mode][type]) || [];
    list.innerHTML = '';
    if (data.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'Ещё нет рекордов';
        list.appendChild(li);
        return;
    }
    data.forEach(r => {
        const li = document.createElement('li');
        const valueSpan = document.createElement('span');
        valueSpan.className = 'record-value';
        valueSpan.textContent = type === 'time' ? formatTime(r.value) : `${r.value} пар`;
        const dateSpan = document.createElement('span');
        dateSpan.className = 'record-date';
        dateSpan.textContent = r.date;
        li.appendChild(valueSpan);
        li.appendChild(dateSpan);
        list.appendChild(li);
    });
}

function updateRecordsTitle() {
    if (recordsTitleEl) recordsTitleEl.textContent = '🏆 ' + LEVEL_CONFIG[currentMode].label;
}

function renderAllRecords() {
    renderRecords(currentMode, 'time');
    renderRecords(currentMode, 'pairs');
    updateRecordsTitle();
}

// ===== Отмена / Сдвиг / Подсказка =====
function undoLast() {
    if (!isGameActive || isPaused) return;
    if (!canUndo || history.length === 0) { updateStatus('Нельзя отменить'); return; }
    const snapshot = history.pop();
    board = snapshot;
    selected = null;
    pairsRemoved = Math.max(0, pairsRemoved - 1);
    pairsCounterEl.textContent = pairsRemoved;
    lastPairSig = null;
    consecutiveSame = 0;
    renderComboBar(false);
    renderBoard();
    canUndo = false;
    playSound('error');
    updateStatus('Действие отменено');
}

function redrawGame() {
    if (!isGameActive || isPaused) return;

    const remainingDigits = [];
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
            const v = board[r][c];
            if (typeof v === 'number') remainingDigits.push(v);
        }

    if (remainingDigits.length === 0) { updateStatus('Цифр не осталось'); return; }

    let lastFilledIndex = -1;
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
            const v = board[r][c];
            if (v !== null) lastFilledIndex = r * COLS + c;
        }

    const newBoard = [];
    for (let r = 0; r < ROWS; r++) {
        newBoard[r] = [];
        for (let c = 0; c < COLS; c++) newBoard[r][c] = board[r][c];
    }

    let filledCount = 0;
    for (let idx = lastFilledIndex + 1; idx < ROWS * COLS; idx++) {
        if (filledCount >= remainingDigits.length) break;
        const r = Math.floor(idx / COLS);
        const c = idx % COLS;
        if (newBoard[r][c] !== null) continue;
        newBoard[r][c] = remainingDigits[filledCount++];
    }

    if (filledCount < remainingDigits.length) {
        endGame(false);
    } else {
        board = newBoard;
        canUndo = false;
        selected = null;
        renderBoard();
        playSound('select');
        updateStatus('Перерисовано: добавлены недостающие цифры');
    }
}

function giveHint() {
    if (!isGameActive || isPaused) return;
    if (hintsRemaining <= 0) {
        playSound('error');
        updateStatus('💡 Подсказки закончились!');
        return;
    }
    for (let r1 = 0; r1 < ROWS; r1++) {
        for (let c1 = 0; c1 < COLS; c1++) {
            const v1 = board[r1][c1];
            if (typeof v1 !== 'number') continue;
            for (let r2 = r1; r2 < ROWS; r2++) {
                for (let c2 = c1; c2 < COLS; c2++) {
                    if (r1 === r2 && c1 === c2) continue;
                    const v2 = board[r2][c2];
                    if (typeof v2 !== 'number') continue;
                    const a = { r: r1, c: c1 };
                    const b = { r: r2, c: c2 };
                    if (isPair(a, b)) {
                        const tds = Array.from(table.querySelectorAll('td'));
                        tds.forEach(td => td.classList.remove('hint'));
                        const idx1 = r1 * COLS + c1;
                        const idx2 = r2 * COLS + c2;
                        if (idx1 < tds.length) tds[idx1].classList.add('hint');
                        if (idx2 < tds.length) tds[idx2].classList.add('hint');
                        hintsRemaining--;
                        renderHintsLamps();
                        playSound('hint');
                        updateStatus(`💡 Подсказка! Осталось: ${hintsRemaining}`);
                        return;
                    }
                }
            }
        }
    }
    playSound('error');
    updateStatus('Пар нет — попробуйте сдвиг');
}

function updateStatus(msg) {
    statusEl.textContent = msg;
}

// ===== Темы =====
const THEME_KEY = 'pairsGameTheme';
function applyTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    try { localStorage.setItem(THEME_KEY, name); } catch (e) {}
    document.querySelectorAll('.theme-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === name);
    });
}
function initThemes() {
    let saved = 'cosmos';
    try { saved = localStorage.getItem(THEME_KEY) || 'cosmos'; } catch (e) {}
    applyTheme(saved);
    document.querySelectorAll('.theme-btn').forEach(b => {
        b.addEventListener('click', () => applyTheme(b.dataset.theme));
    });
}

// ===== Привязка кнопок =====
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-redraw').addEventListener('click', redrawGame);
document.getElementById('btn-undo').addEventListener('click', undoLast);
document.getElementById('btn-hint').addEventListener('click', giveHint);

// ===== Онлайн-рейтинг: подготовка и отправка =====
function queueOnlineResult(seconds) {
    pendingRun = { mode: activeMode, time: seconds, pairs: pairsRemoved, sent: false };

    const sendBtn = document.getElementById('btn-rating-send');
    if (sendBtn) sendBtn.disabled = false;

    if (window.Rating && window.Rating.enabled) {
        if (window.Rating.getPlayer()) {
            sendOnlineResult();
        } else {
            window.Rating.setStatus('🏅 Введите имя и нажмите «Отправить результат»');
        }
    }
}

async function sendOnlineResult() {
    if (!pendingRun || pendingRun.sent) return;
    if (!window.Rating || !window.Rating.enabled) return;

    const name = window.Rating.getPlayer();
    const status = (t, err) => window.Rating.setStatus(t, err);

    if (!name) {
        status('⚠️ Сначала введите имя в поле «Ваше имя»', true);
        const input = document.getElementById('player-name');
        if (input) input.focus();
        return;
    }

    const run = pendingRun;
    const btn = document.getElementById('btn-rating-send');
    if (btn) btn.disabled = true;
    status('Отправляем результат…');

    try {
        await window.Rating.submitRun(run.mode, run.time, run.pairs, name);
        run.sent = true;
        // silent = true, чтобы загрузка не затёрла сообщение об успехе
        await window.Rating.setMode(run.mode, true);
        status('✅ Результат отправлен! Ваша строка подсвечена.');
    } catch (e) {
        if (btn) btn.disabled = false;
        status('⚠️ Не отправлено: ' + e.message, true);
    }
}

// ===== Горячие клавиши =====
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.code) {
        case 'Space':
            e.preventDefault(); // не даём странице прокрутиться
            if (document.querySelector('.end-modal-overlay')) {
                removeEndModal();
                startGame();
            } else if (!isGameActive) {
                startGame();
            } else {
                togglePause();
            }
            break;
        case 'KeyZ': undoLast(); break;
        case 'KeyH': giveHint(); break;
        case 'KeyR': redrawGame(); break;
    }
});

// ===== Выбор сложности =====
difficultySelect.addEventListener('change', () => {
    currentMode = difficultySelect.value;
    try { localStorage.setItem(DIFF_KEY, currentMode); } catch (e) {}
    renderAllRecords();
    if (window.Rating) window.Rating.setMode(currentMode);
    if (isGameActive) updateStatus('Режим «' + LEVEL_CONFIG[currentMode].label + '» — со следующего старта');
    else updateStatus('Выбран режим: ' + LEVEL_CONFIG[currentMode].label);
});

function initDifficulty() {
    let saved = 'classic';
    try { saved = localStorage.getItem(DIFF_KEY) || 'classic'; } catch (e) {}
    if (!LEVEL_CONFIG[saved]) saved = 'classic';
    currentMode = saved;
    difficultySelect.value = saved;
}

// ===== Кнопка отправки в онлайн-рейтинг =====
const ratingSendBtn = document.getElementById('btn-rating-send');
if (ratingSendBtn) ratingSendBtn.addEventListener('click', sendOnlineResult);

if (window.Rating) window.Rating.setMode(currentMode);

// ===== Инициализация =====
initBoard();
initThemes();
initDifficulty();
renderAllRecords();
renderHintsLamps();