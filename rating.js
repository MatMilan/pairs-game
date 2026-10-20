/* ============================================================
   Онлайн-рейтинг + Google Auth + Античит (топ-20)
   ============================================================ */
(function () {
    const CONFIG = {
        url: 'https://fkxvyebvfajkrnpqcoaq.supabase.co',          // https://ВАШ-PROJECT-REF.supabase.co
        key: 'sb_publishable_8F__rJmJ3VdpvhSX9AB0hA_Pjtg7H1z',          // anon public key
        functionUrl: 'https://fkxvyebvfajkrnpqcoaq.supabase.co/functions/v1/validate-game',  // https://ВАШ-PROJECT-REF.supabase.co/functions/v1/validate-game
        table: 'pairs_scores',
        topLimit: 50,     // топ-50
        nameKey: 'pairsGamePlayer',
    };

    const enabled = Boolean(CONFIG.url && CONFIG.key && CONFIG.functionUrl);
    const $ = (id) => document.getElementById(id);

    let mode = 'classic';
    let kind = 'time';
    let ticket = 0;
    let currentUser = null;
    let supabaseClient = null;

    if (window.supabase && CONFIG.url && CONFIG.key) {
        supabaseClient = window.supabase.createClient(CONFIG.url, CONFIG.key);
    }

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

    // Отправка через Edge Function (античит)
    async function submitRun(payload) {
        if (!supabaseClient) throw new Error('Supabase не инициализирован');
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) throw new Error('войдите через Google');

        const res = await fetch(CONFIG.functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + session.access_token,
            },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'валидация не пройдена');
        return data;
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
            name.textContent = r.player;
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
                const t = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                setStatus(`Топ-${rows.length} · обновлено в ${t}`);
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

    // ===== Google Auth =====
    async function signInWithGoogle() {
        if (!supabaseClient) return setStatus('Supabase не инициализирован', true);
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
        });
        if (error) setStatus('Ошибка входа: ' + error.message, true);
    }

    async function signOut() {
        if (!supabaseClient) return;
        await supabaseClient.auth.signOut();
    }

    function updateAuthUI(user) {
        const btn = $('btn-google-auth');
        const statusEl = $('auth-status');
        if (!btn) return;

        if (user) {
            currentUser = user;
            const name = user.user_metadata?.full_name || user.email || '';
            btn.textContent = '🚪 Выйти';
            btn.onclick = signOut;
            if (statusEl) statusEl.textContent = '👤 ' + name;
            if (name) {
                setPlayer(name);
                const input = $('player-name');
                if (input) input.value = name;
            }
        } else {
            currentUser = null;
            btn.textContent = '🔐 Войти через Google';
            btn.onclick = signInWithGoogle;
            if (statusEl) statusEl.textContent = '';
        }
    }

    async function checkAuth() {
        if (!supabaseClient) return;
        const { data: { session } } = await supabaseClient.auth.getSession();
        updateAuthUI(session?.user || null);
        supabaseClient.auth.onAuthStateChange((_event, session) => {
            updateAuthUI(session?.user || null);
        });
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
        checkAuth();
    }

    window.Rating = {
        enabled, getPlayer, setPlayer, setStatus,
        submitRun, getTop, refresh, setMode,
        signInWithGoogle, signOut, checkAuth,
    };

    init();
})();
