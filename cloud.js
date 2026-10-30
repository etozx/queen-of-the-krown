'use strict';
// Online accounts (Supabase): log in / sign up, client booking requests, and syncing the owner's data between devices.
const SUPABASE_URL = 'https://ndmegraadplnvurcawqt.supabase.co';
// Publishable key: meant to be public. The database's row level security rules decide who can see what (supabase/schema.sql).
const SUPABASE_KEY = 'sb_publishable_RKiCilXFSTq219_gFjyg8g_Jn4IZB1h';
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const SITE_URL = location.origin + location.pathname;
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
const showOnly = id => ['#app', '#auth', '#portal', '#lock'].forEach(s => { $(s).hidden = s !== id; });

// ---------- log in / sign up ----------
function showAuth(mode = 'login', msg = '', good = false) {
  showOnly('#auth');
  const signup = mode === 'signup', forgot = mode === 'forgot', reset = mode === 'reset';
  $('#auth').innerHTML = `<div class="auth-card">
    <div class="auth-brand"><span class="crown">${icon('crown')}</span><h1>Queen of the Krown</h1>
      <p>${reset ? 'Choose a new password.' : forgot ? "We'll email you a link to reset your password." : signup ? 'Create your account to book appointments.' : 'Welcome back! Log in to continue.'}</p></div>
    ${forgot || reset ? '' : `<div class="tabs auth-tabs"><button type="button" class="${signup ? '' : 'on'}" data-auth="login">Log in</button><button type="button" class="${signup ? 'on' : ''}" data-auth="signup">Sign up</button></div>`}
    <form class="form" id="authForm" novalidate>
      ${signup ? `<label class="field"><span>Full name</span><input class="input" name="name" autocomplete="name" maxlength="100" required></label>
        <label class="field"><span>Phone number</span><input class="input" name="phone" type="tel" autocomplete="tel" maxlength="30" required><small>Used for appointment reminders.</small></label>` : ''}
      ${reset ? '' : `<label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="email" required></label>`}
      ${forgot ? '' : `<label class="field"><span>${reset ? 'New password' : 'Password'}</span><input class="input" name="password" type="password" autocomplete="${signup || reset ? 'new-password' : 'current-password'}" minlength="8" required>${signup || reset ? '<small>At least 8 characters.</small>' : ''}</label>`}
      <p class="${good ? 'hint' : 'err'}" role="alert" ${msg ? '' : 'hidden'}>${esc(msg)}</p>
      <button class="btn dark block">${reset ? 'Save new password' : forgot ? 'Send reset link' : signup ? 'Create account' : 'Log in'}</button>
      ${mode === 'login' ? '<button type="button" class="btn ghost block" data-auth="forgot">Forgot password?</button>' : ''}
      ${forgot ? '<button type="button" class="btn ghost block" data-auth="login">Back to log in</button>' : ''}
    </form>
    <p class="tiny muted center">We only keep your name, phone and email to manage your appointments.</p></div>`;
  $$('[data-auth]').forEach(b => b.addEventListener('click', () => showAuth(b.dataset.auth)));
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
    const { data, error } = await sb.rpc('is_owner');
    if (error) throw error;
    role = data ? 'owner' : 'client'; store.set(roleKey(session.user.id), role);
  } catch { /* offline: use the role remembered on this device */ }
  if (role === 'owner') { Cloud.enabled = true; Cloud.user = session.user; showOnly(''); return boot(); }
  if (!role) return showAuth('login', "Can't reach the internet right now. Check your connection and try again.");
  showPortal(session.user);
}

// =====================================================================
// CLIENT PORTAL — book appointments and see your own
// =====================================================================
const DEFAULT_HOURS = { start: '09:00', end: '19:00', days: [2, 3, 4, 5, 6] };
const PT = { user: null, info: null, taken: [], mine: [], profile: {}, ownerExists: true, svc: null, date: null, time: null, error: '' };
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
  const slotsFor = d => (PT.svc ? L.freeSlots({ date: d, duration: PT.svc.duration || 120, hours, busy, nowMins: d === t ? nowMins : -1 }) : []);
  const dates = PT.svc ? L.openDates(t, 45, hours.days).filter(d => slotsFor(d).length) : [];
  const times = PT.date ? slotsFor(PT.date) : [];
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
    ${PT.ownerExists ? '' : `<div class="banner"><div class="grow"><b>Setting up?</b> If you own ${esc(name)}, make this your owner account. This only works once.</div><button class="btn sm dark" data-act="pClaim">I'm the owner</button></div>`}
    ${mineNext.length ? `<div class="card"><h2>My Appointments</h2><div class="list mt">${mineNext.map(bookingRow).join('')}</div></div>` : ''}
    <div class="card mt"><h2>Book an Appointment</h2>
      ${!info ? empty('Online booking opens soon.') : `
      <div class="step">1. Pick a service</div>
      <div class="svc-grid">${info.services.map(s => `<button class="svc ${PT.svc?.id === s.id ? 'on' : ''}" data-act="pSvc" data-id="${esc(s.id)}"><b>${esc(s.name)}</b><span>${money(s.price)} · ${(s.duration || 120) / 60} hr</span></button>`).join('')}</div>
      ${PT.svc ? `<div class="step">2. Pick a day</div>
        ${dates.length ? `<div class="slots">${dates.map(d => `<button class="${PT.date === d ? 'on' : ''}" data-act="pDate" data-d="${d}">${relDay(d)}</button>`).join('')}</div>` : '<p class="muted small">No open times in the next 6 weeks. Please check back soon.</p>'}` : ''}
      ${PT.date ? `<div class="step">3. Pick a time</div><div class="slots">${times.map(x => `<button class="${PT.time === x ? 'on' : ''}" data-act="pTime" data-t="${x}">${L.time12(x)}</button>`).join('')}</div>` : ''}
      ${PT.time ? `<form class="form mt" data-form="pBook"><label class="field"><span>Anything she should know? (optional)</span><textarea class="input" name="notes" maxlength="500" placeholder="e.g. color 1B, length, inspo"></textarea></label>
        <div class="hint">${esc(PT.svc.name)} · <b>${relDay(PT.date)} at ${L.time12(PT.time)}</b> · ${money(PT.svc.price)}<br>This is a request. You'll see “Confirmed” here once she accepts.</div>
        <p class="err" role="alert"></p><button class="btn gold block">Request this appointment</button></form>` : ''}`}
    </div>
    ${minePast.length ? `<div class="card mt"><h2>Past & Cancelled</h2><div class="list mt">${minePast.map(bookingRow).join('')}</div></div>` : ''}
    <p class="tiny muted center mt">Logged in as ${esc(PT.user.email)}</p></div>`;
}
FORMS.pBook = async f => {
  const btn = $('button.gold', f); btn.disabled = true;
  const { error } = await sb.from('bookings').insert({
    client_name: PT.profile.full_name || PT.user.email, phone: PT.profile.phone || null, service_id: PT.svc.id, service_name: PT.svc.name,
    price: PT.svc.price, duration: PT.svc.duration || 120, date: PT.date, time: PT.time, notes: f.notes.value.trim(),
  });
  if (error) { btn.disabled = false; return formErr(f, friendly(error)); }
  PT.svc = PT.date = PT.time = null;
  await loadPortal(); renderPortal(); scrollTo(0, 0); toast("Request sent! You'll see it confirmed here.");
};
Object.assign(ACT, {
  pSvc: d => { PT.svc = PT.info.services.find(s => s.id === d.id); PT.date = PT.time = null; renderPortal(); },
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
    name: S.settings.name, hours: S.settings.hours,
    services: S.services.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration || 120 })),
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
  Object.assign(a, { serviceName: b.service_name, price: s ? s.price : b.price || 0, duration: b.duration, notes: b.notes, source: 'online' });
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
  if (!session) return showAuth('login');
  enter(session);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (Cloud.enabled && S) cloudSync(); else if (PT.user) loadPortal().then(renderPortal); } });
setInterval(() => { if (Cloud.enabled && S && document.visibilityState === 'visible') cloudSync(); }, 120000);
main();
