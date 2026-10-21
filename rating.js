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
    let dailyPeriod = 'today'; // 'today' | 'yesterday' | 'all'   
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
    async function requestTable(tableName, paramsObj) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const params = new URLSearchParams(paramsObj);

        try {
            const res = await fetch(CONFIG.url + '/rest/v1/' + tableName + '?' + params.toString(), {
                signal: controller.signal,
                headers: {
                    apikey: CONFIG.key,
                    Authorization: 'Bearer ' + CONFIG.key,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
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
        if (m === 'daily') {
            // Специальный запрос для Daily
            const today = new Date().toISOString().split('T')[0];
            let dateFilter = {};
            if (dailyPeriod === 'today') {
                dateFilter = { date: `eq.${today}` };
            } else if (dailyPeriod === 'yesterday') {
                const d = new Date(); d.setDate(d.getDate() - 1);
                dateFilter = { date: `eq.${d.toISOString().split('T')[0]}` };
            }

            const params = {
                select: 'player_name,date,time,pairs,created_at',
                order: `${k}.asc,created_at.asc`,
                limit: String(CONFIG.topLimit),
                ...dateFilter
            };
            return requestTable('daily_results', params);
        } else {
            // Обычный запрос для Classic, Easy, Medium, Hard
            const params = {
                select: 'player,value,created_at',
                mode: `eq.${m}`,
                kind: `eq.${k}`,
                order: 'value.asc,created_at.asc',
                limit: String(CONFIG.topLimit),
            };
            return requestTable(CONFIG.table, params);
        }
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

    function render(rows, isDaily = false) {
        const list = $('rating-list');
        if (!list) return;
        list.innerHTML = '';
        const me = getPlayer().toLowerCase();

        if (!rows.length) {
            const li = document.createElement('li');
            li.className = 'empty';
            li.textContent = isDaily ? 'В этот период пока нет побед' : 'Пока пусто. Станьте первым!';
            list.appendChild(li);
            return;
        }

        rows.forEach(r => {
            const li = document.createElement('li');
            const playerName = isDaily ? (r.player_name || 'Игрок') : r.player;
            if (me && playerName.toLowerCase() === me) li.classList.add('is-me');

            const who = document.createElement('div');
            who.className = 'rating-who';

            const name = document.createElement('span');
            name.className = 'rating-name';
            name.textContent = playerName;
            name.title = playerName;

            const date = document.createElement('span');
            date.className = 'rating-date';
            const displayDate = isDaily ? r.date : r.created_at;
            date.textContent = new Date(displayDate).toLocaleDateString('ru-RU');

            who.append(name, date);

            const value = document.createElement('span');
            value.className = 'rating-value';
            
            // Для Daily используем r.time и r.pairs, для остальных — r.value
            if (isDaily) {
                value.textContent = kind === 'time'
                    ? `${String(Math.floor(r.time / 60)).padStart(2, '0')}:${String(r.time % 60).padStart(2, '0')}`
                    : `${r.pairs} пар`;
            } else {
                value.textContent = kind === 'time'
                    ? `${String(Math.floor(r.value / 60)).padStart(2, '0')}:${String(r.value % 60).padStart(2, '0')}`
                    : `${r.value} пар`;
            }

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
            render(rows, mode === 'daily');
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

    async function checkDailyPlayed(date) {
        if (!supabaseClient) return false;
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return false;

        try {
            const { data, error } = await supabaseClient
                .from('daily_results')
                .select('id')
                .eq('user_id', session.user.id)
                .eq('date', date)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                console.warn('Ошибка проверки Daily:', error);
                return false;
            }

            return data !== null;
        } catch (e) {
            console.warn('Ошибка проверки Daily:', e);
            return false;
        }
    }
   
    // ===== Google Auth =====
    async function signInWithGoogle() {
        if (!supabaseClient) return setStatus('Supabase не инициализирован', true);
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + window.location.pathname },
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
        // Скрыть подтабы Daily при загрузке (они покажутся только если выбран Daily)
        const dailySubtabs = $('daily-subtabs');
        if (dailySubtabs) {
            dailySubtabs.style.display = 'none';
        }
       // 1. Поле ввода имени
        const input = $('player-name');
        if (input) {
            input.value = getPlayer();
            input.addEventListener('input', () => setPlayer(input.value.trim()));
        }

        // 2. Основные вкладки режимов (Classic, Easy, Medium, Hard, Daily)
        document.querySelectorAll('#rating-tabs button').forEach(b => {
            b.addEventListener('click', () => setMode(b.dataset.mode));
        });

        // 3. Вкладки типа результата (Время / Пары)
        document.querySelectorAll('#rating-kinds button').forEach(b => {
            b.addEventListener('click', () => {
                kind = b.dataset.kind;
                paintTabs();
                refresh();
            });
        });

        // 4. Кнопка обновления рейтинга
        const btn = $('btn-rating-refresh');
        if (btn) btn.addEventListener('click', () => refresh());

        // 5. НОВЫЕ: Подтабы для Daily (Сегодня / Вчера / За всё время)
        document.querySelectorAll('.daily-subtab').forEach(b => {
            b.addEventListener('click', () => {
                dailyPeriod = b.dataset.period;
                // Снимаем активный класс со всех подтабов и ставим на нажатый
                document.querySelectorAll('.daily-subtab').forEach(btn => btn.classList.remove('active'));
                b.classList.add('active');
                refresh();
            });
        });

        // 6. Начальная отрисовка
        paintTabs();
        if (!enabled) {
            setStatus('Рейтинг не подключён: заполните CONFIG', true);
        }
        
        // 7. Проверка авторизации
        checkAuth();
    }

    window.Rating = {
        enabled, getPlayer, setPlayer, setStatus,
        submitRun, getTop, refresh, setMode,
        signInWithGoogle, signOut, checkAuth,
        checkDailyPlayed,
    };

    init();
})();
