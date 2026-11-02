'use strict';
// Online backup & sync through the Queen of the Krown API (FastAPI + PostgreSQL, see backend/).
// Optional: with no API address or no login, everything stays on this device.
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: k => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};
// The API address lives in index.html (<meta name="api-url">). 'qotk-api' in localStorage overrides it for local testing.
const API_URL = (store.get('qotk-api') || $('meta[name=api-url]')?.content || '').replace(/\/$/, '');
const TOKEN = 'qotk-token', EMAIL = 'qotk-email';
const showOnly = id => ['#app', '#auth', '#lock'].forEach(s => { $(s).hidden = s !== id; });

async function api(path, { method = 'GET', body } = {}) {
  const token = store.get(TOKEN);
  let res;
  try {
    res = await fetch(API_URL + path, { method, body: body && JSON.stringify(body),
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
  } catch { throw Object.assign(new Error("Can't reach the internet right now. Try again in a moment."), { offline: true }); }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return data;
  const d = data?.detail, msg = typeof d === 'string' ? d : d?.message || (Array.isArray(d) ? 'Check the details and try again.' : 'Something went wrong. Please try again.');
  throw Object.assign(new Error(msg), { status: res.status, data: d });
}

// ---------- owner login ----------
async function showAuth(msg = '') {
  showOnly('#auth');
  $('#auth').innerHTML = `<div class="auth-card">${UI.skeleton('list')}</div>`;
  let open = false;
  try { open = (await api('/api/auth/status')).registration_open; } catch (e) { msg ||= e.message; }
  let mode = open ? 'register' : 'login';
  const draw = () => {
    const reg = mode === 'register';
    $('#auth').innerHTML = `<div class="auth-card">
      <div class="auth-brand"><span class="crown">${icon('crown')}</span><h1>Queen of the Krown</h1>
        <p>${reg ? 'Create the owner account (one time only).' : 'Owner login — keeps a copy of your business online and on all your devices.'}</p></div>
      ${open ? `<div class="tabs auth-tabs"><button type="button" class="${reg ? '' : 'on'}" data-mode="login">Log in</button><button type="button" class="${reg ? 'on' : ''}" data-mode="register">Create account</button></div>` : ''}
      <form class="form" id="authForm" novalidate>
        <label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="email" value="${esc(store.get(EMAIL) || '')}" required></label>
        <label class="field"><span>Password</span><input class="input" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="10" required>${reg ? '<small>At least 10 characters.</small>' : ''}</label>
        ${reg ? '<label class="field"><span>Setup code</span><input class="input" name="code" autocomplete="off" required><small>The code from whoever set up the server.</small></label>' : ''}
        <p class="err" role="alert" ${msg ? '' : 'hidden'}>${esc(msg)}</p>
        <button class="btn dark block">${reg ? 'Create account' : 'Log in'}</button>
        <button type="button" class="btn ghost block" id="backBtn">Back to my money tracker</button>
      </form>
      <p class="tiny muted center"><a href="styles.html">See the client hairstyles page</a></p></div>`;
    $$('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; msg = ''; draw(); }));
    $('#backBtn').addEventListener('click', () => (S ? (showOnly('#app'), refresh()) : boot()));
    const f = $('#authForm');
    f.addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation();
      const fail = m => { const el = $('[role=alert]', f); el.hidden = false; el.textContent = m; };
      const email = f.email.value.trim().toLowerCase(), password = f.password.value;
      if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email address.');
      if (password.length < 10) return fail('Your password needs at least 10 characters.');
      const btn = $('button.dark', f); btn.disabled = true;
      try {
        const { token } = reg ? await api('/api/auth/register', { method: 'POST', body: { email, password, setup_code: f.code.value.trim() } })
          : await api('/api/auth/login', { method: 'POST', body: { email, password } });
        store.set(TOKEN, token); store.set(EMAIL, email);
        Cloud.enabled = true; Cloud.user = { email };
        if (S) { showOnly('#app'); refresh(); setSync('Syncing…'); cloudSync(); } else boot();
      } catch (e2) { fail(e2.message); } finally { btn.disabled = false; }
    });
  };
  draw();
}

// ---------- sync: this device's copy <-> the server ----------
function setSync(text) { Cloud.status = text; $$('#syncStatus, #syncText').forEach(el => { el.textContent = text; }); }
function schedulePush() { clearTimeout(Cloud.timer); Cloud.timer = setTimeout(cloudPush, 800); }
function loggedOut() {
  store.del(TOKEN); Cloud.enabled = false; setSync('');
  toast('You were logged out. Your records are still on this device.', 'error'); refresh();
}
const offline = e => (e.status === 401 ? loggedOut() : setSync('Offline — saved on this device'));
let pushing = false, pushAgain = false;
async function cloudPush() {
  if (!Cloud.enabled) return;
  if (pushing) { pushAgain = true; return; }
  pushing = true;
  try {
    Cloud.version = (await api('/api/state', { method: 'PUT', body: { version: Cloud.version, state: S } })).version;
    Cloud.dirty = false; saveLocalOnly(); setSync('Synced ✓');
  } catch (e) {
    if (e.status === 409) { pushing = false; return cloudSync(); } // another device saved first
    offline(e);
  } finally {
    pushing = false;
    if (pushAgain) { pushAgain = false; schedulePush(); }
  }
}
async function cloudSync() {
  if (!Cloud.enabled) return;
  let server;
  try { server = await api('/api/state'); } catch (e) { return offline(e); }
  if (!server.state) { Cloud.version = 0; return cloudPush(); } // first time: upload what's on this device
  if (server.version > Cloud.version) {
    // This device has its own records that were never uploaded: never replace them without asking.
    if (Cloud.version === 0 && ['clients', 'appts', 'payments', 'expenses'].some(k => S[k].some(x => !x.demo))) {
      const keepLocal = confirm("This device has business records that aren't online yet.\n\nOK = keep THIS device's records (they replace what's online)\nCancel = use the online records (this device's records are downloaded as a backup first)");
      if (keepLocal) { Cloud.version = server.version; Cloud.dirty = true; return cloudPush(); }
      download(`queen-of-the-krown-this-device-${today()}.json`, JSON.stringify(S), 'application/json');
    }
    if (Cloud.dirty && Cloud.version > 0) toast('Loaded newer changes from your other device. Check your last change here.', 'error');
    S = migrate(server.state); Cloud.version = server.version; Cloud.dirty = false; saveLocalOnly();
    $('#brandName').textContent = S.settings.name; setSync('Synced ✓'); refresh();
  } else if (Cloud.dirty) await cloudPush();
  else setSync('Synced ✓');
}

Object.assign(ACT, {
  openLogin: async () => { await saving; showAuth(); },
  logout: async () => {
    await saving;
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* already logged out or offline */ }
    store.del(TOKEN); location.hash = ''; location.reload();
  },
});

// ---------- start ----------
if (API_URL && store.get(TOKEN)) { Cloud.enabled = true; Cloud.user = { email: store.get(EMAIL) || '' }; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Cloud.enabled && S) cloudSync(); });
setInterval(() => { if (Cloud.enabled && S && document.visibilityState === 'visible') cloudSync(); }, 120000);
boot();
