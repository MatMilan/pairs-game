/* ============================================================
   Онлайн-рейтинг · Supabase REST API
   ============================================================ */
(function () {
    const CONFIG = {
        url: 'https://fkxvyebvfajkrnpqcoaq.supabase.co',      // https://XXXXXXXX.supabase.co
        key: 'sb_publishable_8F__rJmJ3VdpvhSX9AB0hA_Pjtg7H1z',      // anon public key (НЕ service_role!)
        table: 'pairs_scores',
        topLimit: 50, // показываем топ-50 (больше требуемых 20)
        nameKey: 'pairsGamePlayer',
    };

    const enabled = Boolean(CONFIG.url && CONFIG.key);
    const $ = (id) => document.getElementById(id);

    let mode = 'classic';
    let kind = 'time';
    let ticket = 0;   // защита от устаревших ответов при быстром переключении табов

    function getPlayer() {
        try { return (localStorage.getItem(CONFIG.nameKey) || '').trim(); }
        catch { return ''; }
    }

    function setPlayer(name) {
        try { localStorage.setItem(CONFIG.nameKey, name); } catch {}
    }

    function setStatus(text, isError = false) {
        const el = $('rating-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', isError);
    }

    async function request(path, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
            const res = await fetch(CONFIG.url + '/rest/v1/' + path, {
                ...options,
                signal: controller.signal,
                headers: {
                    apikey: CONFIG.key,
                    Authorization: 'Bearer ' + CONFIG.key,
                    'Content-Type': 'application/json',
                    ...(options.headers || {}),
                },
            });

            const text = await res.text();
            if (!res.ok) {
                let detail = text;
                try { detail = JSON.parse(text).message || text; } catch {}
                throw new Error(String(detail).slice(0, 160));
            }
            return text ? JSON.parse(text) : [];
        } catch (e) {
            if (e.name === 'AbortError') throw new Error('тайм-аут сети');
            throw e;
        } finally {
            clearTimeout(timeout);
        }
    }

    async function getTop(m, k) {
        const params = new URLSearchParams({
            select: 'player,value,created_at',
            mode: 'eq.' + m,
            kind: 'eq.' + k,
            order: 'value.asc,created_at.asc',
            limit: String(CONFIG.topLimit),
        });
        return request(CONFIG.table + '?' + params.toString());
    }

    async function submitRun(m, seconds, pairs, name) {
        const player = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
        if (!player) throw new Error('введите имя');
        if (!Number.isInteger(seconds) || seconds < 1 || seconds > 7200)
            throw new Error('некорректное время');
        if (!Number.isInteger(pairs) || pairs < 1 || pairs > 300)
            throw new Error('некорректное число пар');

        return request(CONFIG.table, {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify([
                { player, mode: m, kind: 'time',  value: seconds },
                { player, mode: m, kind: 'pairs', value: pairs },
            ]),
        });
    }

    function paintTabs() {
        document.querySelectorAll('#rating-tabs button').forEach(b =>
            b.classList.toggle('active', b.dataset.mode === mode));
        document.querySelectorAll('#rating-kinds button').forEach(b =>
            b.classList.toggle('active', b.dataset.kind === kind));
    }

    function render(rows) {
        const list = $('rating-list');
        if (!list) return;
        list.innerHTML = '';

        const me = getPlayer().toLowerCase();

        if (!rows.length) {
            const li = document.createElement('li');
            li.className = 'empty';
            li.textContent = 'Пока пусто. Станьте первым!';
            list.appendChild(li);
            return;
        }

        rows.forEach(r => {
            const li = document.createElement('li');
            if (me && r.player.toLowerCase() === me) li.classList.add('is-me');

            const who = document.createElement('div');
            who.className = 'rating-who';

            const name = document.createElement('span');
            name.className = 'rating-name';
            name.textContent = r.player;   // textContent — никакой инъекции HTML
            name.title = r.player;

            const date = document.createElement('span');
            date.className = 'rating-date';
            date.textContent = new Date(r.created_at).toLocaleDateString('ru-RU');

            who.append(name, date);

            const value = document.createElement('span');
            value.className = 'rating-value';
            value.textContent = kind === 'time'
                ? `${String(Math.floor(r.value / 60)).padStart(2, '0')}:${String(r.value % 60).padStart(2, '0')}`
                : `${r.value} пар`;

            li.append(who, value);
            list.appendChild(li);
        });
    }

    async function refresh(silent = false) {
        const list = $('rating-list');
        if (!list) return;

        if (!enabled) {
            list.innerHTML = '';
            const li = document.createElement('li');
            li.className = 'empty';
            li.textContent = 'Рейтинг не подключён';
            list.appendChild(li);
            setStatus('Заполните CONFIG в rating.js', true);
            return;
        }

        const myTicket = ++ticket;
        if (!silent) setStatus('Загрузка…');

        try {
            const rows = await getTop(mode, kind);
            if (myTicket !== ticket) return;
            render(rows);
            if (!silent) {
                const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                setStatus(`Топ-${rows.length} · обновлено в ${time}`);
            }
        } catch (e) {
            if (myTicket !== ticket) return;
            list.innerHTML = '';
            setStatus('⚠️ ' + e.message, true);
        }
    }

    function setMode(m, silent = false) {
        if (!m) return Promise.resolve();
        mode = m;
        paintTabs();
        return refresh(silent);
    }

    function init() {
        const input = $('player-name');
        if (input) {
            input.value = getPlayer();
            input.addEventListener('input', () => setPlayer(input.value.trim()));
        }

        document.querySelectorAll('#rating-tabs button').forEach(b =>
            b.addEventListener('click', () => setMode(b.dataset.mode)));

        document.querySelectorAll('#rating-kinds button').forEach(b =>
            b.addEventListener('click', () => {
                kind = b.dataset.kind;
                paintTabs();
                refresh();
            }));

        const btn = $('btn-rating-refresh');
        if (btn) btn.addEventListener('click', () => refresh());

        paintTabs();
        if (!enabled) setStatus('Рейтинг не подключён: заполните CONFIG', true);
    }

    window.Rating = {
        enabled, getPlayer, setPlayer, setStatus,
        submitRun, getTop, refresh, setMode,
    };

    init();
})();
