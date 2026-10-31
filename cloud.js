'use strict';
// Online accounts (Supabase): log in / sign up, client booking requests, and syncing the owner's data between devices.
const SUPABASE_URL = 'https://ndmegraadplnvurcawqt.supabase.co';
// Publishable key: meant to be public. The database's row level security rules decide who can see what (supabase/schema.sql).
const SUPABASE_KEY = 'sb_publishable_RKiCilXFSTq219_gFjyg8g_Jn4IZB1h';
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const SITE_URL = location.origin + location.pathname;
const OWNER_EMAIL = 'kherissharp@gmail.com'; // also enforced in the database (owner_email() in schema.sql)
const OWNER_PHONE = '+17046143287', OWNER_PHONE_SHOWN = '(704) 614-3287'; // owner_phone() in schema.sql
const roleKey = id => 'qotk-role:' + id;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

function friendly(e) {
  const m = String(e?.message || e || '');
  if (/invalid login/i.test(m)) return 'That email or password is wrong.';
  if (/already registered|already exists/i.test(m)) return 'That email already has an account. Log in instead.';
  if (/not confirmed/i.test(m)) return 'Please confirm your email first (check your inbox), then log in.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Please wait a few minutes and try again.';
  if (/fetch|network/i.test(m)) return "Can't reach the internet right now. Try again in a moment.";
  return m || 'Something went wrong. Please try again.';
}
let googleOn = false, pubInfo = null; // the Google button only shows once Google sign-in is switched on in Supabase
const checkGoogle = () => Promise.all([
  fetch(SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: SUPABASE_KEY } }).then(r => r.json()).then(s => { googleOn = !!s.external?.google; }).catch(() => {}),
  sb.from('public_info').select('info').eq('id', 1).maybeSingle().then(r => { pubInfo = r.data?.info || null; }, () => {}),
]);
const byCat = list => Object.entries(list.reduce((o, s) => ((o[s.cat || 'Services'] ||= []).push(s), o), {}));
const hrs = m => { m ||= 120; const h = Math.floor(m / 60), r = m % 60; return (h ? h + ' hr' : '') + (r ? ' ' + r + ' min' : ''); };
const showOnly = id => ['#app', '#auth', '#portal', '#lock'].forEach(s => { $(s).hidden = s !== id; });

// ---------- log in / sign up ----------
function showAuth(mode = 'login', msg = '', good = false) {
  showOnly('#auth');
  const signup = mode === 'signup', forgot = mode === 'forgot', reset = mode === 'reset';
  const info = pubInfo || { services: defaultServices(), policies: DEFAULT_POLICIES }, hours = info.hours || DEFAULT_HOURS;
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  $('#auth').innerHTML = `<div class="auth-wrap"><section class="auth-hero">
    <div class="brand"><span class="crown">${icon('crown')}</span><span class="brand-name">${esc(info?.name || 'Queen of the Krown')}</span></div>
    <h2>Hair done right.<br><em>Booked in a minute.</em></h2>
    <p>Braids, locs, twists and bobs in Charlotte, NC. Pick your style, choose a time that works, and get a confirmation right here.</p>
    <a class="btn gold" href="styles.html" style="margin:-8px 0 24px">See all hairstyles & book</a>
    <div class="hero-grid">
      <div class="hero-box"><h3>How booking works</h3><ol><li>Create your free account</li><li>Choose a service, day and time</li><li>She confirms, and you get reminders</li></ol></div>
      <div class="hero-box"><h3>Hours</h3><p>${hours.days.map(d => DAYS[d]).join(', ')}<br>${L.time12(hours.start)} – ${L.time12(hours.end)}</p></div>
    </div>
    ${info.services?.length ? `<div class="hero-box"><h3>Services & Prices</h3>${byCat(info.services).map(([cat, list], i) => `<details class="hero-cat" ${i ? '' : 'open'}><summary>${esc(cat)} <span>${list.length}</span></summary>
      <ul class="hero-svcs">${list.map(s => `<li title="${esc(s.desc || '')}"><span>${esc(s.name)}<small>${hrs(s.duration)}</small></span><b>${money(s.price)}</b></li>`).join('')}</ul></details>`).join('')}</div>` : ''}
    ${info.policies ? `<details class="hero-box hero-pol"><summary><h3>Please read before booking</h3></summary><div class="policy">${esc(info.policies)}</div></details>` : ''}
  </section>
  <div class="auth-card">
    <div class="auth-brand"><span class="crown">${icon('crown')}</span><h1>Queen of the Krown</h1>
      <p>${reset ? 'Choose a new password.' : forgot ? "We'll email you a link to reset your password." : signup ? 'Create your account to book appointments.' : 'Welcome back! Log in to continue.'}</p></div>
    ${forgot || reset ? '' : `<button type="button" class="btn ghost block google" id="googleBtn"><svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>Continue with Google</button>
      <p class="tiny muted center" style="margin:8px 0">or use your email</p>
      <div class="tabs auth-tabs"><button type="button" class="${signup ? '' : 'on'}" data-auth="login">Log in</button><button type="button" class="${signup ? 'on' : ''}" data-auth="signup">Sign up</button></div>`}
    <form class="form" id="authForm" novalidate>
      ${signup ? `<label class="field"><span>Full name</span><input class="input" name="name" autocomplete="name" maxlength="100" required></label>
        <label class="field"><span>Phone number</span><input class="input" name="phone" type="tel" autocomplete="tel" maxlength="30" required><small>Used for appointment reminders.</small></label>` : ''}
      ${reset ? '' : `<label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="email" required></label>`}
      ${forgot ? '' : `<label class="field"><span>${reset ? 'New password' : 'Password'}</span><input class="input" name="password" type="password" autocomplete="${signup || reset ? 'new-password' : 'current-password'}" minlength="8" required>${signup || reset ? '<small>At least 8 characters.</small>' : ''}</label>`}
      <p class="${good ? 'hint' : 'err'}" role="alert" ${msg ? '' : 'hidden'}>${esc(msg)}</p>
      <button class="btn dark block">${reset ? 'Save new password' : forgot ? 'Send reset link' : signup ? 'Create account' : 'Log in'}</button>
      ${mode === 'login' ? '<button type="button" class="btn ghost block" data-auth="forgot">Forgot password?</button><button type="button" class="btn ghost block" id="previewBtn">Just look around (this device only)</button>' : ''}
      ${forgot ? '<button type="button" class="btn ghost block" data-auth="login">Back to log in</button>' : ''}
      ${mode === 'login' ? '<button type="button" class="btn ghost block" id="ownerBtn">Owner? Log in with a text code</button>' : ''}
    </form>
    <p class="tiny muted center">We only keep your name, phone and email to manage your appointments.</p></div></div>`;
  $$('[data-auth]').forEach(b => b.addEventListener('click', () => showAuth(b.dataset.auth)));
  // Google checks the email is real, so these accounts are verified without us sending any email.
  // shortcut: opens the app offline with sample data and nothing from the cloud; remove once the owner account exists
  $('#previewBtn')?.addEventListener('click', () => { showOnly(''); boot(); });
  $('#ownerBtn')?.addEventListener('click', () => showPhone('needs_code'));
  const g = $('#googleBtn');
  if (g) {
    g.hidden = !googleOn; g.nextElementSibling.hidden = !googleOn;
    g.addEventListener('click', async () => {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: SITE_URL } });
      if (error) showAuth(mode, friendly(error));
    });
  }
  const f = $('#authForm');
  f.addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    const err = $('[role=alert]', f), btn = $('button.dark', f);
    const fail = m => { err.className = 'err'; err.hidden = false; err.textContent = m; };
    const email = f.email?.value.trim(), password = f.password?.value;
    if (!reset && !/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email address.');
    if (!forgot && password.length < 8) return fail('Your password needs at least 8 characters.');
    btn.disabled = true;
    try {
      if (signup) {
        const name = f.name.value.trim(), phone = f.phone.value.trim();
        if (!name) return fail('Enter your name.');
        if (phone.replace(/\D/g, '').length < 7) return fail('Enter a phone number we can text.');
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name, phone }, emailRedirectTo: SITE_URL } });
        if (error) throw error;
        if (!data.session) return showAuth('login', 'Almost done! Check your email and tap the link to confirm, then log in.', true);
        return enter(data.session);
      }
      if (forgot) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
        if (error) throw error;
        return showAuth('login', 'If that email has an account, a reset link is on its way.', true);
      }
      if (reset) {
        const { data, error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        return enter((await sb.auth.getSession()).data.session || { user: data.user });
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      enter(data.session);
    } catch (e2) { fail(friendly(e2)); } finally { btn.disabled = false; }
  });
}

async function enter(session) {
  let role = store.get(roleKey(session.user.id));
  try {
    // owner_gate (schema.sql) answers: owner, claim, needs_phone (confirm her number once), needs_code (log in with a text code), or no.
    let { data: gate, error } = await sb.rpc('owner_gate');
    if (error) throw error;
    if (gate === 'claim') { await sb.rpc('claim_owner'); ({ data: gate } = await sb.rpc('owner_gate')); }
    if (gate === 'needs_phone' || gate === 'needs_code') return showPhone(gate);
    role = gate === 'owner' ? 'owner' : 'client'; store.set(roleKey(session.user.id), role);
  } catch { /* offline: use the role remembered on this device */ }
  if (role === 'owner') { Cloud.enabled = true; Cloud.user = session.user; showOnly(''); return boot(); }
  if (!role) return showAuth('login', "Can't reach the internet right now. Check your connection and try again.");
  showPortal(session.user);
}

// ---------- owner text code: only her phone can open the dashboard ----------
// needs_phone: logged in with email + password, phone never confirmed -> text a code to attach her number (once).
// needs_code / login: text a code to her number and log in with it.
function showPhone(mode, msg = '') {
  showOnly('#auth');
  let sent = false;
  const attach = mode === 'needs_phone';
  const draw = () => {
    $('#auth').innerHTML = `<div class="auth-card">
      <div class="auth-brand"><span class="crown">${icon('crown')}</span><h1>Owner login</h1>
        <p>${attach ? 'One-time setup: confirm the business phone.' : 'For your security, the dashboard only opens with a code texted to the business phone.'}</p></div>
      <form class="form" id="codeForm" novalidate>
        <div class="hint">We'll text a 6-digit code to <b style="white-space:nowrap">${OWNER_PHONE_SHOWN}</b>.</div>
        ${sent ? '<label class="field"><span>Code</span><input class="input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required></label>' : ''}
        <p class="err" role="alert" ${msg ? '' : 'hidden'}>${esc(msg)}</p>
        <button class="btn dark block">${sent ? 'Open my dashboard' : 'Text me a code'}</button>
        ${sent ? '<button type="button" class="btn ghost block" id="resend">Send a new code</button>' : ''}
        <button type="button" class="btn ghost block" id="back">Back</button>
      </form></div>`;
    $('#back').addEventListener('click', async () => { await sb.auth.signOut(); showAuth('login'); });
    $('#resend')?.addEventListener('click', () => { sent = false; msg = ''; draw(); });
    const f = $('#codeForm');
    if (sent) f.code.focus();
    f.addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation();
      const btn = $('button.dark', f); btn.disabled = true;
      try {
        if (!sent) {
          const { error } = attach ? await sb.auth.updateUser({ phone: OWNER_PHONE }) : await sb.auth.signInWithOtp({ phone: OWNER_PHONE, options: { shouldCreateUser: false } });
          if (error) throw error;
          sent = true; msg = ''; return draw();
        }
        const token = f.code.value.replace(/\D/g, '');
        if (token.length < 6) throw new Error('Enter the 6-digit code from the text.');
        const { data, error } = await sb.auth.verifyOtp({ phone: OWNER_PHONE, token, type: attach ? 'phone_change' : 'sms' });
        if (error) throw error;
        enter(data.session || (await sb.auth.getSession()).data.session);
      } catch (e2) {
        const m = String(e2?.message || '');
        msg = /provider|sms|twilio/i.test(m) ? "Text codes aren't switched on yet. Try again later." : /expired|invalid/i.test(m) ? 'That code is wrong or expired. Send a new code.' : /signups not allowed|not found/i.test(m) ? 'Log in with your email and password first to connect this phone.' : friendly(e2);
        draw();
      } finally { btn.disabled = false; }
    });
  };
  draw();
}

// =====================================================================
// CLIENT PORTAL — book appointments and see your own
// =====================================================================
const DEFAULT_HOURS = { start: '09:00', end: '19:00', days: [2, 3, 4, 5, 6] };
const PT = { user: null, info: null, taken: [], mine: [], profile: {}, ownerExists: true, svc: null, adds: new Set(), date: null, time: null, error: '' };
function bookTotal() { // chosen service + add-ons
  const list = (PT.svc?.addons || []).filter(a => PT.adds.has(a.id));
  return { list, price: (PT.svc?.price || 0) + list.reduce((n, a) => n + a.price, 0), duration: (PT.svc?.duration || 120) + list.reduce((n, a) => n + (a.duration || 0), 0) };
}
const BOOK_LABEL = { requested: 'Waiting for her to confirm', confirmed: 'Confirmed', declined: 'Not available — please pick another time', cancelled: 'Cancelled' };
const BOOK_CHIP = { requested: 'booked', confirmed: 'paid', declined: 'unpaid', cancelled: 'cancelled' };

async function showPortal(user) {
  PT.user = user; showOnly('#portal');
  $('#portal').innerHTML = `<div class="portal">${empty('Loading…')}</div>`;
  await loadPortal(); renderPortal();
}
async function loadPortal() {
  const [info, taken, mine, prof, owner] = await Promise.all([
    sb.from('public_info').select('info').eq('id', 1).maybeSingle(),
    sb.rpc('taken_slots'),
    sb.from('bookings').select('*').eq('client_id', PT.user.id).order('date', { ascending: false }),
    sb.from('profiles').select('full_name, phone').eq('id', PT.user.id).maybeSingle(),
    sb.rpc('owner_exists'),
  ]);
  PT.info = info.data?.info || null; PT.taken = taken.data || []; PT.mine = mine.data || [];
  PT.profile = prof.data || {}; PT.ownerExists = owner.data !== false;
  PT.error = [info, taken, mine].find(r => r.error) ? "Couldn't load everything. Check your internet and refresh." : '';
}
function renderPortal() {
  const t = today(), info = PT.info, hours = info?.hours || DEFAULT_HOURS, name = info?.name || 'Queen of the Krown';
  const busy = [...(info?.busy || []), ...PT.taken.map(x => ({ date: x.date, time: x.time, duration: x.duration }))];
  const now = new Date(), nowMins = now.getHours() * 60 + now.getMinutes() + 60; // need at least an hour's notice
  const tot = bookTotal();
  const slotsFor = d => (PT.svc ? L.freeSlots({ date: d, duration: tot.duration, hours, busy, nowMins: d === t ? nowMins : -1 }) : []);
  const dates = PT.svc ? L.openDates(t, 45, hours.days).filter(d => slotsFor(d).length) : [];
  if (PT.date && !dates.includes(PT.date)) PT.date = PT.time = null; // add-ons made the appointment too long for that day
  const times = PT.date ? slotsFor(PT.date) : [];
  if (PT.time && !times.includes(PT.time)) PT.time = null;
  const addons = PT.svc?.addons || [];
  const mineNext = PT.mine.filter(b => b.date >= t && b.status !== 'cancelled').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const minePast = PT.mine.filter(b => !mineNext.includes(b)).slice(0, 5);
  const bookingRow = b => `<div class="item"><div class="when"><span>${DOW[L.parse(b.date).getDay()]}</span><b>${+b.date.slice(8)}</b><span>${MON[+b.date.slice(5, 7) - 1]}</span></div>
    <div class="grow"><div class="title">${esc(b.service_name)}</div><div class="meta">${relDay(b.date)} at ${L.time12(b.time)}</div><div style="margin-top:4px">${chip(BOOK_CHIP[b.status], BOOK_LABEL[b.status])}</div></div>
    ${b.date >= t && ['requested', 'confirmed'].includes(b.status) ? `<button class="btn sm ghost" data-act="pCancel" data-id="${b.id}">Cancel</button>` : ''}</div>`;
  $('#portal').innerHTML = `<div class="portal">
    <header class="portal-head"><div class="brand"><span class="crown">${icon('crown')}</span><span class="brand-name">${esc(name)}</span></div>
      <button class="btn sm ghost" data-act="logout">Log out</button></header>
    ${PT.error ? `<p class="err">${PT.error}</p>` : ''}
    <h1 class="page-title" style="margin:18px 0 4px">Hi ${esc(firstName(PT.profile.full_name) || 'there')}!</h1>
    <p class="muted" style="margin:0 0 18px">Book your next appointment or check on the ones you have.</p>
    ${PT.ownerExists || PT.user.email?.toLowerCase() !== OWNER_EMAIL ? '' : `<div class="banner"><div class="grow"><b>Setting up?</b> If you own ${esc(name)}, make this your owner account. This only works once.</div><button class="btn sm dark" data-act="pClaim">I'm the owner</button></div>`}
    ${PT.profile.phone ? '' : `<div class="card"><h2>Add your phone number</h2><form class="form mt" data-form="pPhone">
      <label class="field"><span>Phone number</span><input class="input" name="phone" type="tel" autocomplete="tel" maxlength="30" required><small>So she can text you appointment reminders.</small></label>
      <p class="err" role="alert"></p><button class="btn dark block">Save</button></form></div>`}
    ${mineNext.length ? `<div class="card"><h2>My Appointments</h2><div class="list mt">${mineNext.map(bookingRow).join('')}</div></div>` : ''}
    <div class="card mt"><h2>Book an Appointment</h2>
      ${!info ? empty('Online booking opens soon.') : `
      <div class="step">1. Pick a service</div>
      ${byCat(info.services).map(([cat, list]) => `<div class="svc-cat">${esc(cat)}</div><div class="svc-grid">${list.map(s => `<button class="svc ${PT.svc?.id === s.id ? 'on' : ''}" data-act="pSvc" data-id="${esc(s.id)}"><b>${esc(s.name)}</b><span>${money(s.price)} · ${hrs(s.duration)}</span></button>`).join('')}</div>`).join('')}
      ${PT.svc?.desc ? `<div class="hint mt">${esc(PT.svc.desc)}</div>` : ''}
      ${addons.length ? `<div class="step">2. Add-ons <span class="muted small">(optional — thick hair must be added or there's an extra charge)</span></div>
        <div class="addons">${addons.map(a => `<label class="check ${PT.adds.has(a.id) ? 'on' : ''}"><input type="checkbox" data-act="pAdd" data-id="${esc(a.id)}" ${PT.adds.has(a.id) ? 'checked' : ''}><span>${esc(a.name)}</span><b>${a.price ? '+' + money(a.price) : 'Free'}</b></label>`).join('')}</div>
        <div class="hint mt">Total: <b>${money(tot.price)}</b> · about ${hrs(tot.duration)}</div>` : ''}
      ${PT.svc ? `<div class="step">${addons.length ? 3 : 2}. Pick a day</div>
        ${dates.length ? `<div class="slots">${dates.map(d => `<button class="${PT.date === d ? 'on' : ''}" data-act="pDate" data-d="${d}">${relDay(d)}</button>`).join('')}</div>` : '<p class="muted small">No open times in the next 6 weeks. Please check back soon.</p>'}` : ''}
      ${PT.date ? `<div class="step">${addons.length ? 4 : 3}. Pick a time</div><div class="slots">${times.map(x => `<button class="${PT.time === x ? 'on' : ''}" data-act="pTime" data-t="${x}">${L.time12(x)}</button>`).join('')}</div>` : ''}
      ${PT.time ? `<form class="form mt" data-form="pBook"><label class="field"><span>Anything she should know? (optional)</span><textarea class="input" name="notes" maxlength="300" placeholder="e.g. color 1B, length, inspo"></textarea></label>
        <div class="hint">${esc(PT.svc.name)}${tot.list.length ? ' + ' + esc(tot.list.map(a => a.name).join(', ')) : ''} · <b>${relDay(PT.date)} at ${L.time12(PT.time)}</b> · ${money(tot.price)}<br>This is a request. You'll see “Confirmed” here once she accepts.</div>
        ${info.policies ? `<details class="mt"><summary><b>Booking policies</b> (deposits, late fees, hair prep)</summary><div class="policy small">${esc(info.policies)}</div></details>
        <label class="check"><input type="checkbox" name="agree" required> I've read and agree to the booking policies</label>` : ''}
        <p class="err" role="alert"></p><button class="btn gold block">Request this appointment</button></form>` : ''}`}
    </div>
    ${minePast.length ? `<div class="card mt"><h2>Past & Cancelled</h2><div class="list mt">${minePast.map(bookingRow).join('')}</div></div>` : ''}
    <p class="tiny muted center mt">Logged in as ${esc(PT.user.email)}</p></div>`;
}
FORMS.pBook = async f => {
  if (f.agree && !f.agree.checked) return formErr(f, 'Please read and agree to the booking policies first.');
  const btn = $('button.gold', f); btn.disabled = true;
  const tot = bookTotal(), extras = tot.list.map(a => a.name + (a.price ? ` (+${money(a.price)})` : '')).join(', ');
  const { error } = await sb.from('bookings').insert({
    client_name: PT.profile.full_name || PT.user.email, phone: PT.profile.phone || null, service_id: PT.svc.id, service_name: PT.svc.name,
    price: tot.price, duration: Math.min(tot.duration, 720), date: PT.date, time: PT.time, // the bookings table allows 12 hours max
    notes: [extras && 'Add-ons: ' + extras, f.notes.value.trim()].filter(Boolean).join('\n').slice(0, 500),
  });
  if (error) { btn.disabled = false; return formErr(f, friendly(error)); }
  PT.svc = PT.date = PT.time = null; PT.adds.clear();
  await loadPortal(); renderPortal(); scrollTo(0, 0); toast("Request sent! You'll see it confirmed here.");
};
FORMS.pPhone = async f => { // Google accounts arrive without a phone number
  const phone = f.phone.value.trim();
  if (phone.replace(/\D/g, '').length < 7) return formErr(f, 'Enter a phone number we can text.');
  const { error } = await sb.from('profiles').update({ phone }).eq('id', PT.user.id);
  if (error) return formErr(f, friendly(error));
  PT.profile.phone = phone; renderPortal(); toast('Phone number saved');
};
Object.assign(ACT, {
  pSvc: d => { PT.svc = PT.info.services.find(s => s.id === d.id); PT.date = PT.time = null; PT.adds.clear(); renderPortal(); },
  pAdd: d => { PT.adds.has(d.id) ? PT.adds.delete(d.id) : PT.adds.add(d.id); const y = scrollY; renderPortal(); scrollTo(0, y); },
  pDate: d => { PT.date = d.d; PT.time = null; renderPortal(); },
  pTime: d => { PT.time = d.t; renderPortal(); $('#portal [data-form=pBook]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  pCancel: async d => {
    if (!confirm('Cancel this appointment?')) return;
    const { error } = await sb.rpc('cancel_booking', { b: d.id });
    if (error) return toast(friendly(error), 'error');
    await loadPortal(); renderPortal(); toast('Appointment cancelled');
  },
  pClaim: async () => {
    const { data, error } = await sb.rpc('claim_owner');
    if (error || !data) return toast(error ? friendly(error) : 'This business already has an owner.', 'error');
    store.set(roleKey(PT.user.id), 'owner'); location.reload();
  },
  logout: async () => { await saving; await sb.auth.signOut(); location.hash = ''; location.reload(); },
  copyLink: async () => { try { await navigator.clipboard.writeText(SITE_URL); toast('Booking link copied'); } catch { toast('Press and hold the link to copy it', 'error'); } },
  acceptBooking: d => acceptBooking(d.id),
  declineBooking: async d => {
    if (!confirm('Decline this request? The client will see it as not available.')) return;
    const { error } = await sb.from('bookings').update({ status: 'declined' }).eq('id', d.id);
    if (error) return toast(friendly(error), 'error');
    Cloud.bookings.find(b => b.id === d.id).status = 'declined'; refresh(); toast('Request declined');
  },
});

// =====================================================================
// OWNER SYNC — one copy of her business online, cached on each device
// =====================================================================
function setSync(text) { Cloud.status = text; $$('#syncStatus, #syncText').forEach(el => { el.textContent = text; }); }
function schedulePush() { clearTimeout(Cloud.timer); Cloud.timer = setTimeout(cloudPush, 800); }
let pushing = false, pushAgain = false;
async function cloudPush() {
  if (!Cloud.enabled) return;
  if (pushing) { pushAgain = true; return; }
  pushing = true;
  try {
    const next = Cloud.version + 1;
    const res = Cloud.version === 0
      ? await sb.from('owner_data').insert({ id: 1, data: S, version: next }).select('version')
      : await sb.from('owner_data').update({ data: S, version: next, updated_at: new Date().toISOString() }).eq('id', 1).eq('version', Cloud.version).select('version');
    if (res.error?.code === '23505' || (!res.error && !res.data.length)) { pushing = false; return cloudSync(); } // another device saved first
    if (res.error) throw res.error;
    Cloud.version = next; Cloud.dirty = false; saveLocalOnly(); setSync('Synced ✓');
    publishInfo();
  } catch { setSync('Offline — saved on this device'); } finally {
    pushing = false;
    if (pushAgain) { pushAgain = false; schedulePush(); }
  }
}
async function cloudSync() {
  if (!Cloud.enabled) return;
  const { data, error } = await sb.from('owner_data').select('data, version').eq('id', 1).maybeSingle();
  if (error) return setSync('Offline — saved on this device');
  if (!data) await cloudPush(); // first time: upload what's on this device
  else if (data.version > Cloud.version) {
    // This device has its own records that were never uploaded: never replace them without asking.
    if (Cloud.version === 0 && ['clients', 'appts', 'payments', 'expenses'].some(k => S[k].some(x => !x.demo))) {
      const keepLocal = confirm("This device has business records that aren't online yet.\n\nOK = keep THIS device's records (they replace what's online)\nCancel = use the online records (this device's records are downloaded as a backup first)");
      if (keepLocal) { Cloud.version = data.version; Cloud.dirty = true; await cloudPush(); await loadBookings(); return; }
      download(`queen-of-the-krown-this-device-${today()}.json`, JSON.stringify(S), 'application/json');
    }
    if (Cloud.dirty && Cloud.version > 0) toast('Loaded newer changes from your other device. Check your last change here.', 'error');
    S = migrate(data.data); Cloud.version = data.version; Cloud.dirty = false; saveLocalOnly();
    $('#brandName').textContent = S.settings.name; setSync('Synced ✓'); refresh();
  } else if (Cloud.dirty) await cloudPush();
  else setSync('Synced ✓');
  await loadBookings();
  publishInfo();
}
// What clients can see: name, hours, services and busy times (no client names).
async function publishInfo() {
  const t = today();
  const info = {
    name: S.settings.name, hours: S.settings.hours, policies: S.settings.policies,
    services: S.services.map(s => ({ id: s.id, cat: s.cat || '', name: s.name, price: s.price, duration: s.duration || 120, desc: s.desc || '', addons: s.addons || [] })),
    busy: S.appts.filter(a => !a.demo && live(a) && a.date >= t && a.time).map(a => ({ date: a.date, time: a.time, duration: a.duration || 120 })),
  };
  const json = JSON.stringify(info);
  if (json === Cloud.lastInfo) return;
  const { error } = await sb.from('public_info').upsert({ id: 1, info, updated_at: new Date().toISOString() });
  if (!error) Cloud.lastInfo = json;
}
async function loadBookings() {
  const { data, error } = await sb.from('bookings').select('*').gte('date', L.addDays(today(), -7)).order('date');
  if (error) return;
  Cloud.bookings = data;
  let changed = false;
  for (const b of data) { // a client cancelled a confirmed booking: cancel it in her calendar too
    const a = b.status === 'cancelled' && b.appt_id && findAppt(b.appt_id);
    if (a && a.status === 'booked') { a.status = 'cancelled'; a.notes = (a.notes ? a.notes + ' · ' : '') + 'Cancelled online by client'; changed = true; }
  }
  if (changed) save();
  refresh();
}
async function acceptBooking(id) {
  const b = Cloud.bookings.find(x => x.id === id); if (!b) return;
  let c = S.clients.find(x => x.userId === b.client_id) || clientByName(b.client_name);
  const isNew = !c;
  if (!c) c = getOrCreateClient(b.client_name);
  c.userId = b.client_id; if (!c.phone && b.phone) c.phone = b.phone;
  const s = findSvc(b.service_id), a = mkAppt(c, s, b.date, b.time);
  // shortcut: the add-on total comes from the client's request (never below her base price); she can edit it on the appointment
  Object.assign(a, { serviceName: b.service_name, price: Math.max(s ? s.price : 0, b.price || 0), duration: b.duration, notes: b.notes, source: 'online' });
  S.appts.push(a);
  const { error } = await sb.from('bookings').update({ status: 'confirmed', appt_id: a.id }).eq('id', b.id);
  if (error) { S.appts.pop(); if (isNew) S.clients.pop(); return toast(friendly(error), 'error'); }
  b.status = 'confirmed'; b.appt_id = a.id; save(); refresh();
  toast(`Booked ${firstName(b.client_name)} — ${relDay(b.date)} at ${L.time12(b.time)}`);
}

// ---------- start ----------
async function main() {
  if (!sb) return boot(); // booking service unreachable (e.g. blocked script): run on this device only
  let recovering = /type=recovery/.test(location.hash);
  sb.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') { recovering = true; showAuth('reset'); } });
  const { data: { session } } = await sb.auth.getSession();
  if (recovering) return showAuth('reset');
  if (!session) { await checkGoogle(); return showAuth('login'); }
  enter(session);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (Cloud.enabled && S) cloudSync(); else if (PT.user) loadPortal().then(renderPortal); } });
setInterval(() => { if (Cloud.enabled && S && document.visibilityState === 'visible') cloudSync(); }, 120000);
main();
