'use strict';
// Queen of the Krown — business manager. All data lives on this device (IndexedDB), optionally encrypted with a PIN.
const L = window.Logic;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => L.iso(new Date());
const money = L.money;
const dollars = c => (c / 100).toFixed(2).replace(/\.00$/, '');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDate = d => { const x = L.parse(d); return `${DOW[x.getDay()]}, ${MON[x.getMonth()]} ${x.getDate()}`; };
const relDay = d => {
  const t = today();
  if (d === t) return 'Today';
  if (d === L.addDays(t, 1)) return 'Tomorrow';
  if (d === L.addDays(t, -1)) return 'Yesterday';
  return fmtDate(d);
};
const firstName = n => String(n || '').trim().split(/\s+/)[0];
const initials = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

// ---------- icons ----------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M16 3v3M8 3v3M3 10h18"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2"/>',
  wallet: '<rect x="2.5" y="6" width="19" height="13" rx="2.5"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 9.5v6M18 9.5v6"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/><path d="M5 19h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17.5v.5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
function hydrate(root) {
  $$('[data-icon]', root).forEach(s => { if (s.className) { s.innerHTML = icon(s.dataset.icon); s.removeAttribute('data-icon'); } else s.outerHTML = icon(s.dataset.icon); });
}

// ---------- defaults ----------
const DEFAULT_CATEGORIES = ['Hair & Bundles', 'Wigs', 'Lace', 'Braiding Hair', 'Hair Products', 'Supplies', 'Equipment', 'Advertising', 'Business', 'Other'];
const DEFAULT_METHODS = ['Cash', 'Cash App', 'Zelle', 'Card', 'Other'];
const sup = (name, d) => ({ name, cost: d * 100 });
const defaultServices = () => [
  { id: 'svc-knotless', name: 'Knotless Braids', price: 18000, supplies: [sup('Pre-stretched braiding hair', 25), sup('Hair mousse', 10), sup('Edge control', 8)] },
  { id: 'svc-bussdown', name: '26" Buss Down', price: 25000, supplies: [sup('26-inch bundles', 150), sup('Lace frontal', 60), sup('Hair products', 15)] },
  { id: 'svc-quickweave', name: 'Quick Weave', price: 12000, supplies: [sup('Bundles', 70), sup('Bonding glue', 8), sup('Wig cap', 3)] },
  { id: 'svc-sewin', name: 'Sew-In', price: 20000, supplies: [sup('Bundles', 120), sup('Weaving thread', 5)] },
  { id: 'svc-wig', name: 'Frontal Wig Install', price: 15000, supplies: [sup('Lace glue', 15), sup('Elastic band', 6), sup('Edge control', 8)] },
  { id: 'svc-silkpress', name: 'Silk Press', price: 8500, supplies: [sup('Heat protectant', 12)] },
];
const freshState = () => ({
  v: 1, settings: { name: 'Queen of the Krown' }, services: defaultServices(),
  categories: [...DEFAULT_CATEGORIES], methods: [...DEFAULT_METHODS],
  clients: [], appts: [], payments: [], expenses: [], stock: [],
});
const migrate = s => { const f = freshState(); for (const k in f) if (s[k] === undefined) s[k] = f[k]; return s; };

let S = null;
let charts = [];
let SH = {}; // state for the open sheet
const ui = { apptView: 'upcoming', day: null, month: null, incomeView: 'weekly', period: 'monthly', prepDays: 14, clientFilter: 'all', q: {}, payMethod: '', expCat: '' };

// ---------- lookups ----------
const findClient = id => S.clients.find(c => c.id === id);
const clientByName = n => S.clients.find(c => c.name.trim().toLowerCase() === String(n).trim().toLowerCase());
const findAppt = id => S.appts.find(a => a.id === id);
const findSvc = id => S.services.find(s => s.id === id);
const cName = id => findClient(id)?.name || 'Deleted client';
const paid = a => L.paidFor(S.payments, a.id);
const bal = a => L.balance(a, S.payments);
const payStatus = a => L.payStatus(a, S.payments);
const PAY_LABEL = { paid: 'Paid', unpaid: 'Unpaid', deposit: 'Deposit paid', partial: 'Partly paid' };
const APPT_LABEL = { booked: 'Booked', done: 'Done', cancelled: 'Cancelled', noshow: 'No-show' };
const live = a => a.status !== 'cancelled' && a.status !== 'noshow';
const sortAppt = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);
const upcoming = days => {
  const t = today(), end = L.addDays(t, days);
  return S.appts.filter(a => a.status === 'booked' && a.date >= t && a.date <= end).sort(sortAppt);
};
// Owes = finished (or past) appointments not fully paid. Today's not-yet-done bookings don't count yet.
const owing = () => S.appts.filter(a => live(a) && (a.status === 'done' || a.date < today()) && bal(a) > 0).sort(sortAppt).reverse();

function getOrCreateClient(name) {
  let c = clientByName(name);
  if (!c) { c = { id: uid(), name: name.trim(), phone: '', email: '', notes: '', prefs: '', photos: [], created: today() }; S.clients.push(c); }
  return c;
}
function mkAppt(c, s, date, time) {
  return {
    id: uid(), clientId: c.id, serviceId: s?.id || '', serviceName: s?.name || 'Service', date, time: time || '',
    price: s?.price || 0, status: 'booked', notes: '', source: 'manual',
    supplies: (s?.supplies || []).map(x => ({ id: uid(), name: x.name, cost: x.cost, state: 'need' })),
  };
}
const mkPay = (a, amount, method, date, deposit) => ({
  id: uid(), apptId: a.id, clientId: a.clientId, clientName: cName(a.clientId), serviceName: a.serviceName,
  amount, method, date, deposit: !!deposit, note: '',
});

// ---------- storage ----------
const DB = 'qotk', STORE = 'kv', KEY = 'state';
function idb(mode, fn) {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onerror = () => rej(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction(STORE, mode); const q = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { r.result.close(); res(q.result); };
      tx.onerror = () => rej(tx.error);
    };
  });
}
const idbGet = () => idb('readonly', s => s.get(KEY));
const idbSet = v => idb('readwrite', s => s.put(v, KEY));

let cryptoKey = null, cryptoSalt = null;
async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function persist() {
  const json = JSON.stringify(S), name = S.settings.name;
  if (!cryptoKey) return idbSet({ name, plain: json });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(json));
  return idbSet({ name, salt: cryptoSalt, iv, ct });
}
let saving = Promise.resolve();
function save() {
  saving = saving.then(persist).catch(e => toast('Could not save: ' + e.message, 'error'));
  return saving;
}

// ---------- ui helpers ----------
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.innerHTML = (type ? icon('alert') : icon('check')) + `<span>${esc(msg)}</span>`;
  $('#toasts').append(t); setTimeout(() => t.remove(), 3200);
}
function openSheet(title, body, wide) {
  SH = {};
  const w = $('#sheet');
  w.innerHTML = `<div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-act="closeSheet" aria-label="Close">${icon('x')}</button></div>${body}</div>`;
  w.hidden = false;
  const f = $('[autofocus]', w) || $('input:not([type=hidden]):not([type=file]), select, textarea', w);
  if (f && matchMedia('(pointer: fine)').matches) setTimeout(() => f.focus(), 60);
  return w.firstElementChild;
}
function closeSheet() { const w = $('#sheet'); w.hidden = true; w.innerHTML = ''; SH = {}; }
const formErr = (f, msg) => { const e = $('.err', f); e.textContent = msg; e.scrollIntoView({ block: 'nearest' }); return false; };
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const readText = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file); });
// shortcut: photos are shrunk to ~900px JPEGs and kept in the device database; move to file storage if she adds hundreds.
function shrinkImage(file, max = 900) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file is not a photo')); };
    img.src = url;
  });
}
const clientsDatalist = () => `<datalist id="clientsDL">${S.clients.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>`;
const serviceOptions = sel => `<option value="">Other / custom</option>` + S.services.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)} — ${money(s.price)}</option>`).join('');
const radios = (name, list, sel) => list.map(v => `<label><input type="radio" name="${name}" value="${esc(v)}" ${v === sel ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('');
const stat = (label, value, sub, ic, cls = '') => `<div class="card stat ${cls}"><div class="label">${icon(ic)}${esc(label)}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
const empty = msg => `<div class="empty">${msg}</div>`;
const chip = (cls, text) => `<span class="chip ${cls}">${esc(text)}</span>`;
const demoChip = x => (x.demo ? chip('demo', 'Sample') : '');

// ---------- charts ----------
const GOLD = '#b8913a';
const PALETTE = ['#b8913a', '#141414', '#d9bf7f', '#6b5b3e', '#8c7a5b', '#e3cf9c', '#3d3d3d', '#a37b2c', '#c9b99a', '#5e5e5e', '#efe2c0'];
const cash$ = v => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
function mkChart(id, type, labels, datasets, extra = {}) {
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  const round = type === 'doughnut', horiz = extra.indexAxis === 'y';
  const value = ctx => (round ? ctx.parsed : horiz ? ctx.parsed.x : ctx.parsed.y);
  const axis = { beginAtZero: true, ticks: { callback: cash$ }, grid: { color: '#f0e9dc' }, border: { display: false } };
  charts.push(new Chart(el, {
    type, data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      plugins: {
        legend: { display: round || datasets.length > 1, position: round ? 'bottom' : 'top', labels: { boxWidth: 10, usePointStyle: true, padding: 14 } },
        tooltip: { backgroundColor: '#141414', padding: 10, callbacks: { label: ctx => ` ${round ? ctx.label : ctx.dataset.label}: ${cash$(value(ctx))}` } },
      },
      scales: round ? {} : horiz ? { x: axis, y: { grid: { display: false } } } : { y: axis, x: { grid: { display: false } } },
      cutout: round ? '66%' : undefined,
      ...extra,
    },
  }));
}
const line = (label, data, color = GOLD) => ({ label, data, borderColor: color, backgroundColor: color + '22', fill: true, tension: .35, pointRadius: 3, pointBackgroundColor: color, borderWidth: 2.5 });
const bars = (label, data, color = GOLD) => ({ label, data, backgroundColor: color, borderRadius: 8, maxBarThickness: 38 });
const toD = arr => arr.map(c => c / 100);
const donutData = entries => [{ data: entries.map(e => e[1] / 100), backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }];
const chartBox = (id, has, sm) => (has ? `<div class="chart-box ${sm ? 'sm' : ''}"><canvas id="${id}"></canvas></div>` : empty('Nothing to show yet for this time.'));

// ---------- shared bits ----------
function demoBanner() {
  if (!['clients', 'appts', 'payments', 'expenses', 'stock'].some(k => S[k].some(x => x.demo))) return '';
  return `<div class="banner">${icon('sparkle')}<div class="grow"><b>You're looking at sample data.</b> It's here so you can see how everything works. Items marked “Sample” aren't real.</div>
    <button class="btn sm dark" data-act="removeDemo">Remove sample data</button></div>`;
}
function reminders() {
  const out = [], t = today();
  for (const a of upcoming(1)) out.push({ ic: 'clock', text: `<b>${esc(cName(a.clientId))}</b> is coming ${a.date === t ? 'today' : 'tomorrow'}${a.time ? ' at ' + L.time12(a.time) : ''} — ${esc(a.serviceName)}`, href: '#/appointments' });
  for (const a of upcoming(7)) {
    const n = a.supplies.filter(s => s.state === 'need').length;
    if (n) out.push({ ic: 'scissors', text: `Get ${n} item${n > 1 ? 's' : ''} for <b>${esc(firstName(cName(a.clientId)))}</b> (${relDay(a.date)})`, href: '#/supplies' });
  }
  for (const a of owing().slice(0, 4)) out.push({ ic: 'wallet', text: `<b>${esc(cName(a.clientId))}</b> still owes ${money(bal(a))} (${esc(a.serviceName)})`, act: `data-act="logPayment" data-appt="${a.id}"` });
  for (const s of S.stock.filter(s => s.qty <= s.low)) out.push({ ic: 'box', text: `Running low on <b>${esc(s.name)}</b> (${s.qty} left)`, href: '#/supplies' });
  return out;
}
function reminderList(max = 6) {
  const r = reminders();
  if (!r.length) return empty('All caught up. Nothing needs your attention.');
  return `<div class="list reminders">${r.slice(0, max).map(x => `<${x.href ? `a href="${x.href}"` : `div ${x.act}`} class="item click" style="text-decoration:none">${icon(x.ic)}<div class="grow small">${x.text}</div>${icon('right')}</${x.href ? 'a' : 'div'}>`).join('')}
    ${r.length > max ? `<div class="tiny muted mt">+ ${r.length - max} more</div>` : ''}</div>`;
}
function apptRow(a, opts = {}) {
  const x = L.parse(a.date), st = payStatus(a), b = bal(a), need = a.supplies.filter(s => s.state === 'need').length;
  return `<div class="appt">
    <div class="when"><span>${DOW[x.getDay()]}</span><b>${x.getDate()}</b><span>${MON[x.getMonth()]}</span></div>
    <div class="grow">
      <div class="spread"><a href="#/client/${a.clientId}" class="title" style="font-weight:600;text-decoration:none">${esc(cName(a.clientId))}</a><span class="amt num">${money(a.price)}</span></div>
      <div class="meta small muted">${a.time ? L.time12(a.time) + ' · ' : ''}${esc(a.serviceName)}${a.notes ? ' · ' + esc(a.notes) : ''}</div>
      <div class="row mt" style="margin-top:6px">${a.status !== 'booked' ? chip(a.status, APPT_LABEL[a.status]) : ''}${live(a) ? chip(st, PAY_LABEL[st] + (st !== 'paid' && st !== 'unpaid' ? ` · ${money(b)} left` : '')) : ''}
        ${a.status === 'booked' && need ? chip('need', `${need} to buy`) : ''}${demoChip(a)}</div>
      ${opts.noActions ? '' : `<div class="actions">
        ${live(a) && b > 0 ? `<button class="btn sm gold" data-act="logPayment" data-appt="${a.id}">${icon('wallet')}Log payment</button>` : ''}
        ${a.status === 'booked' && a.date <= today() ? `<button class="btn sm ghost" data-act="markDone" data-id="${a.id}">${icon('check')}Done</button>` : ''}
        ${a.status === 'booked' && a.supplies.length ? `<a class="btn sm ghost" href="#/supplies">${icon('scissors')}Hair needed</a>` : ''}
        <button class="btn sm ghost" data-act="editAppt" data-id="${a.id}">${icon('edit')}Edit</button></div>`}
    </div></div>`;
}
const payRow = p => `<div class="item"><div class="avatar">${icon('wallet')}</div><div class="grow"><div class="title">${esc(p.clientName || cName(p.clientId))}</div>
  <div class="meta">${relDay(p.date)} · ${esc(p.method)}${p.deposit ? ' · Deposit' : ''} · ${esc(p.serviceName || '')} ${demoChip(p)}</div></div>
  <span class="amt num" style="color:var(--green)">+${money(p.amount)}</span></div>`;
const expRow = e => `<div class="item">${e.receipt ? `<img class="receipt-thumb" src="${e.receipt}" alt="Receipt" data-act="viewPhoto" data-src="${e.receipt}">` : `<div class="avatar">${icon('receipt')}</div>`}
  <div class="grow"><div class="title">${esc(e.desc || e.category)}</div><div class="meta">${relDay(e.date)} · ${esc(e.category)} ${demoChip(e)}</div></div>
  <span class="amt num">-${money(e.amount)}</span></div>`;

// =====================================================================
// PAGES
// =====================================================================
const PAGES = {};

// ---------- dashboard ----------
PAGES.dashboard = {
  title: () => 'Dashboard',
  render() {
    const t = today(), R = L.ranges(t);
    const made = r => L.sum(S.payments, ...r), spent = r => L.sum(S.expenses, ...r);
    const left = made(R.month) - spent(R.month);
    const next = upcoming(60)[0];
    const h = new Date().getHours();
    const B = L.buckets(ui.incomeView, t);
    const income = L.series(S.payments, B);
    const cats = L.groupBy(S.expenses, e => e.category, ...R.month);
    const unpaid = owing();
    return `${demoBanner()}
    <p class="muted" style="margin:0 0 14px">${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}. Here's how ${esc(S.settings.name)} is doing — ${fmtDate(t)}.</p>
    <div class="quick">
      <button class="btn gold" data-act="logPayment">${icon('wallet')}Log Payment</button>
      <button class="btn dark" data-act="addExpense">${icon('receipt')}Add Expense</button>
      <a class="btn ghost" href="#/appointments">${icon('calendar')}Appointments</a>
      <button class="btn ghost" data-act="addClient">${icon('users')}Add Client</button>
    </div>
    <div class="grid cards-6 mt">
      ${stat('Money Made Today', money(made(R.today)), '', 'wallet', 'dark')}
      ${stat('This Week', money(made(R.week)), 'Money made', 'trend')}
      ${stat('This Month', money(made(R.month)), 'Money made', 'trend')}
      ${stat('Money Spent', money(spent(R.month)), 'This month', 'receipt')}
      ${stat("What's Left", money(left), 'This month, after spending', 'crown', left >= 0 ? 'good' : 'bad')}
      ${stat('Clients Coming Up', upcoming(7).length, 'Next 7 days', 'calendar')}
    </div>
    <div class="grid cols-2-even mt">
      <div class="card next-up">
        ${next ? `<div class="tiny muted" style="text-transform:uppercase;letter-spacing:.12em">Next client</div>
          <h2 style="margin:4px 0 2px">${esc(cName(next.clientId))}</h2>
          <div>${relDay(next.date)}${next.time ? ' at ' + L.time12(next.time) : ''} · ${esc(next.serviceName)} · ${money(next.price)}</div>
          <div class="muted small" style="margin-top:6px">${paid(next) ? `${money(paid(next))} already paid · ${money(bal(next))} left` : 'Nothing paid yet'}</div>
          ${next.supplies.length ? `<div class="small" style="margin-top:12px"><b style="color:var(--gold-2)">What hair do I need?</b><br>${next.supplies.map(s => `${s.state === 'need' ? '○' : '✓'} ${esc(s.name)}`).join('<br>')}</div>` : ''}
          <div class="row" style="margin-top:14px"><a class="btn sm gold" href="#/appointments">See schedule</a><a class="btn sm ghost" href="#/supplies">Prep hair</a></div>`
          : `<h2>No clients booked yet</h2><p class="muted">Add an appointment or import from Booksy.</p><button class="btn sm gold" data-act="addAppt">Add appointment</button>`}
      </div>
      <div class="card"><div class="card-head"><h2>Reminders</h2>${icon('bell')}</div>${reminderList()}</div>
    </div>
    <div class="grid cols-2 mt">
      <div class="card">
        <div class="card-head"><h2>Money Made</h2>
          <div class="tabs">${['daily', 'weekly', 'monthly', 'yearly'].map(v => `<button class="${ui.incomeView === v ? 'on' : ''}" data-act="incomeView" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>
        ${chartBox('incomeChart', income.some(Boolean))}
      </div>
      <div class="card"><div class="card-head"><h2>Where My Money Goes</h2><span class="muted small">This month</span></div>${chartBox('spendChart', cats.length, true)}</div>
    </div>
    <div class="grid cols-2-even mt">
      <div class="card"><div class="card-head"><h2>Clients Coming Up</h2><a class="small" href="#/appointments">See all</a></div>
        ${upcoming(14).slice(0, 5).map(a => apptRow(a, { noActions: true })).join('') || empty('No upcoming appointments.')}</div>
      <div class="card"><div class="card-head"><h2>Who Still Owes Me</h2><span class="muted small">${money(unpaid.reduce((t, a) => t + bal(a), 0))} total</span></div>
        ${unpaid.length ? `<div class="list">${unpaid.slice(0, 5).map(a => `<div class="item"><div class="avatar">${initials(cName(a.clientId))}</div><div class="grow"><div class="title">${esc(cName(a.clientId))}</div><div class="meta">${relDay(a.date)} · ${esc(a.serviceName)} · ${PAY_LABEL[payStatus(a)]}</div></div><span class="amt num" style="color:var(--red)">${money(bal(a))}</span><button class="btn sm gold" data-act="logPayment" data-appt="${a.id}">Paid</button></div>`).join('')}</div>` : empty('Nobody owes you anything. 👑')}</div>
    </div>
    <div class="grid cols-2-even mt">
      <div class="card"><div class="card-head"><h2>Recent Payments</h2><a class="small" href="#/payments">See all</a></div>
        <div class="list">${[...S.payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(payRow).join('') || empty('No payments logged yet.')}</div></div>
      <div class="card"><div class="card-head"><h2>Recent Expenses</h2><a class="small" href="#/expenses">See all</a></div>
        <div class="list">${[...S.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(expRow).join('') || empty('No expenses logged yet.')}</div></div>
    </div>`;
  },
  mount() {
    const t = today(), B = L.buckets(ui.incomeView, t);
    mkChart('incomeChart', 'bar', B.map(b => b.label), [bars('Money made', toD(L.series(S.payments, B)))]);
    const cats = L.groupBy(S.expenses, e => e.category, ...L.ranges(t).month);
    mkChart('spendChart', 'doughnut', cats.map(c => c[0]), donutData(cats));
  },
};

// ---------- appointments ----------
PAGES.appointments = {
  title: () => 'Appointments',
  render() {
    const t = today(), v = ui.apptView;
    const tabs = [['upcoming', 'Coming up'], ['day', 'Day'], ['month', 'Calendar'], ['past', 'Past']];
    let body = '';
    if (v === 'upcoming') {
      const list = S.appts.filter(a => a.date >= t && a.status === 'booked').sort(sortAppt);
      let last = '';
      body = list.map(a => { const h = a.date !== last ? `<div class="date-head">${relDay(a.date)}</div>` : ''; last = a.date; return h + apptRow(a); }).join('') || empty('No upcoming appointments. Tap “Add appointment” or import from Booksy.');
    }
    if (v === 'past') {
      const list = S.appts.filter(a => a.date < t || a.status !== 'booked').filter(a => a.date >= L.addDays(t, -60)).sort(sortAppt).reverse();
      body = list.map(a => apptRow(a)).join('') || empty('No past appointments in the last 60 days.');
    }
    if (v === 'day') {
      const d = ui.day || t;
      const list = S.appts.filter(a => a.date === d).sort(sortAppt);
      body = `<div class="spread" style="margin-bottom:8px"><button class="icon-btn" data-act="dayNav" data-n="-1" aria-label="Previous day">${icon('left')}</button>
        <div class="section-title">${relDay(d)}${d === t || d === L.addDays(t, 1) || d === L.addDays(t, -1) ? ` <span class="muted small" style="font-family:var(--sans)">${fmtDate(d)}</span>` : ''}</div>
        <button class="icon-btn" data-act="dayNav" data-n="1" aria-label="Next day">${icon('right')}</button></div>
        ${list.map(a => apptRow(a)).join('') || empty('Nothing booked this day.')}
        <div class="center mt"><button class="btn ghost sm" data-act="addAppt" data-date="${d}">${icon('plus')}Add appointment on this day</button></div>`;
    }
    if (v === 'month') {
      const m = ui.month || L.monthStart(t);
      const start = L.weekStart(m); const mi = +m.slice(5, 7);
      let cells = DOW.map(d => `<div class="dow">${d}</div>`).join('');
      for (let i = 0; i < 42; i++) {
        const d = L.addDays(start, i);
        if (i === 35 && +d.slice(5, 7) !== mi) break;
        const list = S.appts.filter(a => a.date === d && live(a)).sort(sortAppt);
        cells += `<div class="day ${+d.slice(5, 7) !== mi ? 'other' : ''} ${d === t ? 'today' : ''}" data-act="openDay" data-d="${d}" role="button" tabindex="0" aria-label="${fmtDate(d)}, ${list.length} appointments">
          <span class="d">${+d.slice(8)}</span>${list.slice(0, 2).map(a => `<span class="ev">${a.time ? L.time12(a.time).replace(' ', '') + ' ' : ''}${esc(firstName(cName(a.clientId)))}</span>`).join('')}
          ${list.length > 2 ? `<span class="more">+${list.length - 2}</span>` : ''}</div>`;
      }
      const x = L.parse(m);
      body = `<div class="spread" style="margin-bottom:10px"><button class="icon-btn" data-act="monthNav" data-n="-1" aria-label="Previous month">${icon('left')}</button>
        <div class="section-title">${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][x.getMonth()]} ${x.getFullYear()}</div>
        <button class="icon-btn" data-act="monthNav" data-n="1" aria-label="Next month">${icon('right')}</button></div><div class="cal">${cells}</div>
        <p class="tiny muted">Tap a day to see its schedule.</p>`;
    }
    return `<div class="spread" style="margin-bottom:14px"><div class="tabs">${tabs.map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-act="apptView" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="row"><button class="btn ghost" data-act="importBooksy">${icon('upload')}Import from Booksy</button><button class="btn dark" data-act="addAppt">${icon('plus')}Add appointment</button></div></div>
      <div class="card">${body}</div>`;
  },
};

// ---------- clients ----------
const clientStats = c => {
  const appts = S.appts.filter(a => a.clientId === c.id);
  const pays = S.payments.filter(p => p.clientId === c.id);
  const done = appts.filter(a => live(a) && (a.status === 'done' || a.date < today()));
  return {
    appts, pays, visits: done.length, spent: pays.reduce((t, p) => t + p.amount, 0),
    owes: done.reduce((t, a) => t + bal(a), 0),
    last: done.map(a => a.date).sort().pop() || '', next: appts.filter(a => a.status === 'booked' && a.date >= today()).sort(sortAppt)[0],
  };
};
function clientList() {
  const q = (ui.q.clients || '').toLowerCase();
  const rows = S.clients.map(c => ({ c, s: clientStats(c) }))
    .filter(({ c, s }) => (!q || [c.name, c.phone, c.email, c.notes].join(' ').toLowerCase().includes(q))
      && (ui.clientFilter === 'all' || (ui.clientFilter === 'returning' && s.visits >= 2) || (ui.clientFilter === 'new' && s.visits < 2) || (ui.clientFilter === 'owes' && s.owes > 0)))
    .sort((a, b) => (b.s.last || b.c.created || '').localeCompare(a.s.last || a.c.created || ''));
  return rows.map(({ c, s }) => `<a class="item click" href="#/client/${c.id}" style="text-decoration:none">
      <div class="avatar">${c.photos?.[0] ? `<img src="${c.photos[0]}" alt="">` : initials(c.name)}</div>
      <div class="grow"><div class="title">${esc(c.name)} ${s.visits >= 2 ? chip('booked', 'Returning') : ''} ${demoChip(c)}</div>
        <div class="meta">${s.visits} visit${s.visits === 1 ? '' : 's'}${s.last ? ' · last ' + relDay(s.last) : ''}${s.next ? ' · next ' + relDay(s.next.date) : ''}${c.phone ? ' · ' + esc(c.phone) : ''}</div></div>
      <div style="text-align:right"><div class="amt num">${money(s.spent)}</div>${s.owes ? `<div class="tiny" style="color:var(--red)">owes ${money(s.owes)}</div>` : ''}</div></a>`).join('') || empty(S.clients.length ? 'No clients match.' : 'No clients yet. Add your first client.');
}
PAGES.clients = {
  title: () => 'Clients',
  render: () => `<div class="row" style="margin-bottom:14px">
      <div class="search">${icon('search')}<input class="input" type="search" placeholder="Search by name, phone or notes" data-search="clients" value="${esc(ui.q.clients || '')}" aria-label="Search clients"></div>
      <button class="btn dark" data-act="addClient">${icon('plus')}Add client</button></div>
    <div class="tabs" style="margin-bottom:14px">${[['all', 'All'], ['returning', 'Returning'], ['new', 'New'], ['owes', 'Owes money']].map(([k, l]) => `<button class="${ui.clientFilter === k ? 'on' : ''}" data-act="clientFilter" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="card"><div class="list" id="clientsList">${clientList()}</div></div>
    <p class="tiny muted mt">${icon('lock')} Client details are stored only on this device. Only keep what you need to do her hair.</p>`,
};
PAGES.client = {
  title: id => findClient(id)?.name || 'Client',
  render(id) {
    const c = findClient(id);
    if (!c) return empty('This client was deleted. <a href="#/clients">Back to clients</a>');
    const s = clientStats(c);
    const styles = [...new Set(s.appts.filter(live).map(a => a.serviceName))];
    return `<a href="#/clients" class="small muted" style="text-decoration:none">${icon('left')} All clients</a>
    <div class="card mt"><div class="spread"><div class="row"><div class="avatar" style="width:64px;height:64px;font-size:22px">${c.photos?.[0] ? `<img src="${c.photos[0]}" alt="">` : initials(c.name)}</div>
      <div><div class="section-title">${esc(c.name)} ${demoChip(c)}</div><div class="muted small">${[c.phone, c.email].filter(Boolean).map(esc).join(' · ') || 'No contact info'}</div></div></div>
      <div class="row"><button class="btn gold sm" data-act="logPayment" data-client="${c.id}">${icon('wallet')}Log payment</button>
        <button class="btn ghost sm" data-act="addAppt" data-client="${c.id}">${icon('calendar')}Book</button>
        <button class="btn ghost sm" data-act="editClient" data-id="${c.id}">${icon('edit')}Edit</button></div></div>
      ${c.prefs || c.notes ? `<div class="grid cols-2-even mt">${c.prefs ? `<div class="hint"><b>Likes:</b> ${esc(c.prefs)}</div>` : ''}${c.notes ? `<div class="hint"><b>Notes:</b> ${esc(c.notes)}</div>` : ''}</div>` : ''}
    </div>
    <div class="grid cards-6 mt">${stat('Visits', s.visits, '', 'calendar')}${stat('Total Paid', money(s.spent), '', 'wallet')}${stat('Still Owes', money(s.owes), '', 'alert', s.owes ? 'bad' : '')}
      ${stat('Next Visit', s.next ? relDay(s.next.date) : '—', s.next ? esc(s.next.serviceName) : '', 'clock')}</div>
    <div class="card mt"><div class="card-head"><h2>Hairstyles She's Booked</h2></div><div class="row">${styles.map(x => chip('booked', x)).join('') || '<span class="muted">None yet</span>'}</div></div>
    <div class="grid cols-2-even mt">
      <div class="card"><div class="card-head"><h2>Appointments</h2></div>${s.appts.sort(sortAppt).reverse().map(a => apptRow(a)).join('') || empty('No appointments yet.')}</div>
      <div class="card"><div class="card-head"><h2>Payments</h2></div><div class="list">${s.pays.sort((a, b) => b.date.localeCompare(a.date)).map(payRow).join('') || empty('No payments yet.')}</div></div>
    </div>
    <div class="card mt"><div class="card-head"><h2>Reference Photos</h2>
      <label class="btn ghost sm">${icon('camera')}Add photo<input type="file" accept="image/*" hidden data-change="clientPhoto" data-id="${c.id}"></label></div>
      ${c.photos?.length ? `<div class="photos">${c.photos.map((p, i) => `<figure><img src="${p}" alt="Reference photo ${i + 1}" data-act="viewPhoto" data-src="${p}"><button data-act="delClientPhoto" data-id="${c.id}" data-i="${i}" aria-label="Remove photo">×</button></figure>`).join('')}</div>` : '<p class="muted small">Save inspo or past styles here.</p>'}
    </div>`;
  },
};

// ---------- payments ----------
function paymentsList() {
  const q = (ui.q.payments || '').toLowerCase();
  const list = S.payments.filter(p => (!ui.payMethod || p.method === ui.payMethod) && (!q || [p.clientName, p.serviceName, p.method, p.note, p.date].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date));
  return list.slice(0, 300).map(p => `<div class="item"><div class="avatar">${initials(p.clientName)}</div>
    <div class="grow"><div class="title">${esc(p.clientName || cName(p.clientId))} ${demoChip(p)}</div>
      <div class="meta">${fmtDate(p.date)} · ${esc(p.method)}${p.deposit ? ' · Deposit' : ''} · ${esc(p.serviceName || '')}${p.note ? ' · ' + esc(p.note) : ''}</div></div>
    <span class="amt num" style="color:var(--green)">+${money(p.amount)}</span>
    <button class="icon-btn" data-act="editPayment" data-id="${p.id}" aria-label="Edit payment">${icon('edit')}</button></div>`).join('')
    + (list.length > 300 ? `<p class="tiny muted">Showing newest 300 of ${list.length}. Search to find older ones.</p>` : '') || empty('No payments found.');
}
PAGES.payments = {
  title: () => 'Payments',
  render() {
    const R = L.ranges(today()), owe = owing();
    return `<div class="grid cards-6">${stat('Today', money(L.sum(S.payments, ...R.today)), '', 'wallet', 'dark')}${stat('This Week', money(L.sum(S.payments, ...R.week)), '', 'trend')}
      ${stat('This Month', money(L.sum(S.payments, ...R.month)), '', 'trend')}${stat('Cash This Month', money(L.sum(S.payments.filter(p => p.method === 'Cash'), ...R.month)), '', 'wallet')}
      ${stat('Still Owed To Me', money(owe.reduce((t, a) => t + bal(a), 0)), `${owe.length} appointment${owe.length === 1 ? '' : 's'}`, 'alert', owe.length ? 'bad' : '')}</div>
    ${owe.length ? `<div class="card mt"><div class="card-head"><h2>Unpaid & Part-Paid</h2></div><div class="list">${owe.map(a => `<div class="item"><div class="avatar">${initials(cName(a.clientId))}</div><div class="grow"><div class="title">${esc(cName(a.clientId))}</div><div class="meta">${relDay(a.date)} · ${esc(a.serviceName)} · ${money(paid(a))} of ${money(a.price)} paid</div></div><span class="amt num" style="color:var(--red)">${money(bal(a))}</span><button class="btn sm gold" data-act="logPayment" data-appt="${a.id}">Log</button></div>`).join('')}</div></div>` : ''}
    <div class="row mt" style="margin-bottom:12px">
      <div class="search">${icon('search')}<input class="input" type="search" placeholder="Search payments" data-search="payments" value="${esc(ui.q.payments || '')}" aria-label="Search payments"></div>
      <select class="input" style="width:auto" data-change="payMethod" aria-label="Filter by payment method"><option value="">All methods</option>${S.methods.map(m => `<option ${ui.payMethod === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
      <button class="btn gold" data-act="logPayment">${icon('plus')}Log Payment</button></div>
    <div class="card"><div class="list" id="paymentsList">${paymentsList()}</div></div>`;
  },
};

// ---------- expenses ----------
function expensesList() {
  const q = (ui.q.expenses || '').toLowerCase();
  const list = S.expenses.filter(e => (!ui.expCat || e.category === ui.expCat) && (!q || [e.desc, e.category, e.date].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date));
  return list.slice(0, 300).map(e => expRow(e).replace(/<\/div>$/, `<button class="icon-btn" data-act="editExpense" data-id="${e.id}" aria-label="Edit expense">${icon('edit')}</button></div>`)).join('') || empty('No expenses found.');
}
PAGES.expenses = {
  title: () => 'Expenses',
  render() {
    const R = L.ranges(today());
    const cats = L.groupBy(S.expenses, e => e.category, ...R.month);
    return `<div class="grid cards-6">${stat('Spent Today', money(L.sum(S.expenses, ...R.today)), '', 'receipt', 'dark')}${stat('This Week', money(L.sum(S.expenses, ...R.week)), '', 'receipt')}
      ${stat('This Month', money(L.sum(S.expenses, ...R.month)), '', 'receipt')}${stat('Biggest Cost', cats[0] ? esc(cats[0][0]) : '—', cats[0] ? money(cats[0][1]) + ' this month' : '', 'alert')}</div>
    <div class="grid cols-2 mt">
      <div class="card"><div class="card-head"><h2>Where My Money Goes</h2><span class="muted small">This month</span></div>${chartBox('expDonut', cats.length)}</div>
      <div class="card"><div class="card-head"><h2>By Category</h2><span class="muted small">This month</span></div>
        <div class="list">${cats.map(([k, v]) => `<div class="item"><div class="grow">${esc(k)}</div><span class="amt num">${money(v)}</span></div>`).join('') || empty('Nothing spent this month.')}</div></div>
    </div>
    <div class="row mt" style="margin-bottom:12px">
      <div class="search">${icon('search')}<input class="input" type="search" placeholder="Search expenses" data-search="expenses" value="${esc(ui.q.expenses || '')}" aria-label="Search expenses"></div>
      <select class="input" style="width:auto" data-change="expCat" aria-label="Filter by category"><option value="">All categories</option>${S.categories.map(c => `<option ${ui.expCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <button class="btn dark" data-act="addExpense">${icon('plus')}Add Expense</button></div>
    <div class="card"><div class="list" id="expensesList">${expensesList()}</div></div>`;
  },
  mount() {
    const cats = L.groupBy(S.expenses, e => e.category, ...L.ranges(today()).month);
    mkChart('expDonut', 'doughnut', cats.map(c => c[0]), donutData(cats));
  },
};

// ---------- hair & supplies (preparation center) ----------
PAGES.supplies = {
  title: () => 'Hair & Supplies',
  render() {
    const list = upcoming(ui.prepDays);
    const items = list.flatMap(a => a.supplies.map(s => ({ ...s, a })));
    const need = items.filter(s => s.state === 'need');
    const shop = new Map();
    for (const s of need) { const k = s.name.trim().toLowerCase(); const e = shop.get(k) || { name: s.name, n: 0, cost: 0, who: [] }; e.n++; e.cost += s.cost; e.who.push(firstName(cName(s.a.clientId))); shop.set(k, e); }
    const seg = (a, s) => `<div class="seg" role="group" aria-label="${esc(s.name)} status">${[['need', 'Need'], ['have', 'Have it'], ['bought', 'Bought']].map(([k, l]) => `<button class="${s.state === k ? 'on ' + k : ''}" data-act="setSupply" data-appt="${a.id}" data-id="${s.id}" data-v="${k}">${l}</button>`).join('')}</div>`;
    return `<div class="spread" style="margin-bottom:14px"><div class="section-title">What Hair Do I Need?</div>
      <div class="tabs">${[7, 14, 30].map(n => `<button class="${ui.prepDays === n ? 'on' : ''}" data-act="prepDays" data-v="${n}">Next ${n} days</button>`).join('')}</div></div>
    <div class="grid cards-6">${stat('Clients Coming Up', list.length, `Next ${ui.prepDays} days`, 'calendar', 'dark')}${stat('Still Need To Buy', need.length, 'items', 'alert', need.length ? 'bad' : 'good')}
      ${stat('Cost To Buy', money(need.reduce((t, s) => t + s.cost, 0)), 'Estimated', 'wallet')}${stat('Ready', items.length - need.length, 'items you have', 'check', 'good')}</div>
    <div class="grid cols-2 mt">
      <div class="stack">
        ${list.map(a => `<div class="card"><div class="spread"><div><h3 style="font-size:17px">${esc(cName(a.clientId))} ${demoChip(a)}</h3><div class="muted small">${relDay(a.date)}${a.time ? ' at ' + L.time12(a.time) : ''} · ${esc(a.serviceName)}</div></div>
            <span class="chip ${a.supplies.some(s => s.state === 'need') ? 'need' : 'have'}">${a.supplies.some(s => s.state === 'need') ? money(a.supplies.filter(s => s.state === 'need').reduce((t, s) => t + s.cost, 0)) + ' to buy' : 'Ready'}</span></div>
          <div class="mt">${a.supplies.map(s => `<div class="check"><div class="grow">${esc(s.name)} <span class="muted small num">${s.cost ? money(s.cost) : ''}</span></div>${seg(a, s)}<button class="icon-btn" data-act="delSupply" data-appt="${a.id}" data-id="${s.id}" aria-label="Remove ${esc(s.name)}">${icon('x')}</button></div>`).join('') || '<p class="muted small">No hair or supplies listed for this one.</p>'}</div>
          <form class="row mt" data-form="addSupply" data-appt="${a.id}"><input class="input" name="name" placeholder="Add item (e.g. 30-inch bundles)" style="flex:2;min-width:150px" aria-label="Item name"><input class="input" name="cost" placeholder="$ cost" inputmode="decimal" style="flex:1;min-width:80px" aria-label="Cost"><button class="btn ghost sm">${icon('plus')}Add</button></form>
        </div>`).join('') || `<div class="card">${empty(`No clients booked in the next ${ui.prepDays} days.`)}</div>`}
      </div>
      <div class="stack">
        <div class="card"><div class="card-head"><h2>Shopping List</h2></div>
          ${shop.size ? `<div class="list">${[...shop.values()].map(e => `<div class="item"><div class="grow"><div class="title">${esc(e.name)}${e.n > 1 ? ` <span class="muted">×${e.n}</span>` : ''}</div><div class="meta">For ${esc([...new Set(e.who)].join(', '))}</div></div><span class="amt num">${money(e.cost)}</span>
            <button class="btn sm ghost" data-act="boughtAll" data-name="${esc(e.name)}">${icon('check')}Bought</button></div>`).join('')}</div>
            <p class="tiny muted mt">Tip: after shopping, add it under Expenses so it counts in “Money Spent”.</p>` : empty('Nothing to buy. You’re all set. 👑')}</div>
        <div class="card"><div class="card-head"><h2>My Stock</h2></div>
          <div class="list">${S.stock.map(s => `<div class="item"><div class="grow"><div class="title ${s.qty <= s.low ? 'low' : ''}">${esc(s.name)} ${demoChip(s)}</div><div class="meta">${s.qty <= s.low ? 'Running low — ' : ''}remind me at ${s.low}</div></div>
            <div class="qty"><button class="icon-btn" data-act="stockQty" data-id="${s.id}" data-n="-1" aria-label="One less">−</button><b class="num">${s.qty}</b><button class="icon-btn" data-act="stockQty" data-id="${s.id}" data-n="1" aria-label="One more">+</button></div>
            <button class="icon-btn" data-act="delStock" data-id="${s.id}" aria-label="Remove ${esc(s.name)}">${icon('trash')}</button></div>`).join('') || '<p class="muted small">Track products you keep on hand, like edge control or mousse.</p>'}</div>
          <form class="row mt" data-form="addStock"><input class="input" name="name" placeholder="Product" style="flex:2;min-width:130px" aria-label="Product name" required>
            <input class="input" name="qty" type="number" min="0" placeholder="How many" style="flex:1;min-width:80px" aria-label="How many you have" required>
            <input class="input" name="low" type="number" min="0" placeholder="Remind at" style="flex:1;min-width:80px" aria-label="Remind me when this many are left" required>
            <button class="btn ghost sm">${icon('plus')}Add</button></form></div>
        <div class="card"><h2>Hair lists for each service</h2><p class="muted small">Each service has its own checklist. New appointments copy it, then you can change it for that client.</p><a class="btn ghost sm" href="#/settings">Edit service lists</a></div>
      </div>
    </div>`;
  },
};

// ---------- analytics ----------
PAGES.analytics = {
  title: () => 'Analytics',
  render() {
    const B = L.buckets(ui.period, today()), from = B[0].from, to = B[B.length - 1].to;
    const rev = L.sum(S.payments, from, to), exp = L.sum(S.expenses, from, to);
    const apptPays = L.groupBy(S.payments.filter(p => p.apptId), p => p.apptId, from, to);
    const done = S.appts.filter(a => a.status === 'done' && a.date >= from && a.date <= to).length;
    const svc = L.groupBy(S.payments, p => p.serviceName || 'Other', from, to);
    const span = { weekly: 'Last 12 weeks', monthly: 'Last 12 months', yearly: 'Last 5 years' }[ui.period];
    const count = name => S.appts.filter(a => a.serviceName === name && a.date >= from && a.date <= to && live(a)).length;
    return `<div class="spread" style="margin-bottom:14px"><div class="section-title">My Business Performance</div>
      <div class="tabs">${['weekly', 'monthly', 'yearly'].map(v => `<button class="${ui.period === v ? 'on' : ''}" data-act="period" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>
    <p class="muted small" style="margin-top:-6px">${span}. Only money you actually received counts — unpaid bookings don't.</p>
    <div class="grid cards-6">${stat('Money Made', money(rev), span, 'wallet', 'dark')}${stat('Money Spent', money(exp), span, 'receipt')}${stat("What's Left", money(rev - exp), 'Made minus spent', 'crown', rev - exp >= 0 ? 'good' : 'bad')}
      ${stat('Average Per Client', apptPays.length ? money(Math.round(apptPays.reduce((t, x) => t + x[1], 0) / apptPays.length)) : '—', 'Per appointment', 'users')}
      ${stat('Appointments Done', done, span, 'check')}${stat('Best Service', svc[0] ? esc(svc[0][0]) : '—', svc[0] ? money(svc[0][1]) : '', 'sparkle')}</div>
    <div class="grid cols-2-even mt">
      <div class="card"><div class="card-head"><h2>Money Made</h2></div>${chartBox('aRev', rev)}</div>
      <div class="card"><div class="card-head"><h2>Money Spent</h2></div>${chartBox('aExp', exp)}</div>
      <div class="card"><div class="card-head"><h2>What's Left Over Time</h2></div>${chartBox('aProfit', rev || exp)}</div>
      <div class="card"><div class="card-head"><h2>Income by Hairstyle</h2></div>${chartBox('aSvc', svc.length)}</div>
      <div class="card"><div class="card-head"><h2>How Clients Pay</h2></div>${chartBox('aMethod', rev)}</div>
      <div class="card"><div class="card-head"><h2>Spending by Category</h2></div>${chartBox('aCat', exp)}</div>
    </div>
    <div class="card mt"><div class="card-head"><h2>Best-Performing Services</h2></div>
      <div class="list">${svc.slice(0, 8).map(([k, v], i) => `<div class="item"><div class="avatar">${i + 1}</div><div class="grow"><div class="title">${esc(k)}</div><div class="meta">${count(k)} booking${count(k) === 1 ? '' : 's'}</div></div><span class="amt num">${money(v)}</span></div>`).join('') || empty('No payments yet.')}</div></div>`;
  },
  mount() {
    const B = L.buckets(ui.period, today()), from = B[0].from, to = B[B.length - 1].to, lab = B.map(b => b.label);
    const r = L.series(S.payments, B), e = L.series(S.expenses, B);
    mkChart('aRev', 'line', lab, [line('Money made', toD(r))]);
    mkChart('aExp', 'bar', lab, [bars('Money spent', toD(e), '#141414')]);
    mkChart('aProfit', 'line', lab, [line("What's left", toD(r.map((x, i) => x - e[i])), '#2f7a4f')]);
    const svc = L.groupBy(S.payments, p => p.serviceName || 'Other', from, to).slice(0, 8);
    mkChart('aSvc', 'bar', svc.map(x => x[0]), [bars('Income', toD(svc.map(x => x[1])))], { indexAxis: 'y' });
    const m = L.groupBy(S.payments, p => p.method, from, to);
    mkChart('aMethod', 'doughnut', m.map(x => x[0]), donutData(m));
    const c = L.groupBy(S.expenses, x => x.category, from, to);
    mkChart('aCat', 'doughnut', c.map(x => x[0]), donutData(c));
  },
};

// ---------- settings ----------
PAGES.settings = {
  title: () => 'Settings',
  render() {
    const hasDemo = ['clients', 'appts', 'payments', 'expenses', 'stock'].some(k => S[k].some(x => x.demo));
    const tagList = (key, label) => `<div class="row">${S[key].map((c, i) => `<span class="chip" style="padding:6px 8px 6px 12px;font-size:14px">${esc(c)}${key === 'methods' && c === 'Cash' ? '' : `<button class="icon-btn" style="min-width:26px;min-height:26px;padding:2px" data-act="delTag" data-key="${key}" data-i="${i}" aria-label="Remove ${esc(c)}">${icon('x')}</button>`}</span>`).join('')}</div>
      <form class="row mt" data-form="addTag" data-key="${key}"><input class="input" name="name" placeholder="New ${label}" style="max-width:260px" aria-label="New ${label}" required><button class="btn ghost sm">${icon('plus')}Add</button></form>`;
    return `<div class="stack">
    <div class="card"><h2>Business</h2><form class="row mt" data-form="bizName"><input class="input" name="name" value="${esc(S.settings.name)}" style="max-width:340px" aria-label="Business name" required><button class="btn dark sm">Save name</button></form></div>
    <div class="card" id="services"><div class="card-head"><h2>Services, Prices & Hair Lists</h2><button class="btn dark sm" data-act="editService">${icon('plus')}Add service</button></div>
      <div class="list">${S.services.map(s => `<div class="item"><div class="grow"><div class="title">${esc(s.name)}</div><div class="meta">${s.supplies.map(x => esc(x.name)).join(', ') || 'No hair list'}</div></div><span class="amt num">${money(s.price)}</span><button class="btn sm ghost" data-act="editService" data-id="${s.id}">${icon('edit')}Edit</button></div>`).join('') || empty('No services yet.')}</div></div>
    <div class="card"><h2>Booksy & Importing Appointments</h2>
      <p class="small">Booksy doesn't offer a public connection (API) that lets other apps read a stylist's appointments, so this app <b>can't pull your Booksy bookings in automatically</b> — and it will never ask for your Booksy password.</p>
      <p class="small">What works today:</p>
      <ul class="small"><li><b>Add appointments by hand</b> — about 20 seconds each.</li>
        <li><b>Import a file</b> — if you can download appointments from Booksy (or another calendar) as a <b>CSV spreadsheet</b> or a <b>calendar file (.ics)</b>, import it here. You can check every row before it's added, and repeats are skipped.</li>
        <li><b>Ask Booksy support</b> if API access is available for your account. If they give you one, this app can be extended to use it.</li></ul>
      <button class="btn dark sm" data-act="importBooksy">${icon('upload')}Import appointments file</button></div>
    <div class="grid cols-2-even">
      <div class="card"><h2>Expense Categories</h2><div class="mt">${tagList('categories', 'category')}</div></div>
      <div class="card"><h2>Payment Methods</h2><div class="mt">${tagList('methods', 'method')}</div></div>
    </div>
    <div class="card"><h2>PIN Lock</h2>
      <p class="small muted">${cryptoKey ? 'Your data is locked with a PIN and encrypted on this device.' : 'Add a PIN so nobody else who picks up your phone can open your business info. Your data gets encrypted with it.'}</p>
      <div class="row">${cryptoKey ? `<button class="btn dark sm" data-act="lockNow">${icon('lock')}Lock now</button><button class="btn ghost sm" data-act="setPin">Change PIN</button><button class="btn danger sm" data-act="removePin">Remove PIN</button>` : `<button class="btn dark sm" data-act="setPin">${icon('lock')}Set a PIN</button>`}</div></div>
    <div class="card"><h2>Backup & Export</h2>
      <p class="small muted">Your info is saved on this device only. <b>Download a backup now and then</b> (and keep it somewhere safe, like your email or Google Drive) so you never lose it if your phone breaks.</p>
      <div class="row"><button class="btn dark sm" data-act="backup">${icon('download')}Download backup</button>
        <label class="btn ghost sm">${icon('upload')}Restore backup<input type="file" accept=".json,application/json" hidden data-change="restore"></label>
        <button class="btn ghost sm" data-act="csv" data-v="payments">${icon('download')}Payments (spreadsheet)</button>
        <button class="btn ghost sm" data-act="csv" data-v="expenses">${icon('download')}Expenses (spreadsheet)</button></div></div>
    <div class="card"><h2>Sample Data</h2><p class="small muted">${hasDemo ? 'Sample clients, payments and expenses are showing so you can explore. Remove them before you start for real.' : 'Want to see how the app looks with data? Add sample data (you can remove it anytime).'}</p>
      ${hasDemo ? `<button class="btn dark sm" data-act="removeDemo">Remove sample data</button>` : `<button class="btn ghost sm" data-act="loadDemo">Add sample data</button>`}</div>
    <div class="card"><h2 style="color:var(--red)">Start Over</h2><p class="small muted">Deletes everything on this device. Download a backup first.</p><button class="btn danger sm" data-act="eraseAll">${icon('trash')}Erase everything</button></div>
    </div>`;
  },
};

// =====================================================================
// SHEETS (forms)
// =====================================================================
function paymentSheet({ apptId, clientId, id } = {}) {
  const p = id ? S.payments.find(x => x.id === id) : null;
  const a0 = findAppt(p?.apptId || apptId);
  const cid = p?.clientId || a0?.clientId || clientId;
  openSheet(p ? 'Edit Payment' : 'Log Payment', `<form class="form" data-form="payment" data-id="${p?.id || ''}" autocomplete="off">
    <label class="field"><span>Who paid?</span><input class="input" name="client" list="clientsDL" value="${esc(cid ? cName(cid) : '')}" placeholder="Client name" ${cid ? '' : 'autofocus'} required>${clientsDatalist()}</label>
    <label class="field"><span>For which appointment?</span><select class="input" name="appt"></select></label>
    <div class="field-row">
      <label class="field"><span>Service</span><select class="input" name="service">${serviceOptions(a0?.serviceId)}</select></label>
      <label class="field"><span>Total price</span><input class="input" name="total" inputmode="decimal" placeholder="$0"></label></div>
    <div class="summary-box" id="paySum"></div>
    <label class="field"><span>How much did you get now?</span><input class="input big num" name="amount" inputmode="decimal" placeholder="$0" value="${p ? dollars(p.amount) : ''}" ${cid ? 'autofocus' : ''} required></label>
    <div class="field"><span>Paid with</span><div class="pills first-big">${radios('method', S.methods, p?.method || 'Cash')}</div></div>
    <div class="field"><span>This is</span><div class="pills">${radios('kind', ['A payment', 'A deposit'], p?.deposit ? 'A deposit' : 'A payment')}</div></div>
    <div class="field-row"><label class="field"><span>Date</span><input class="input" type="date" name="date" value="${p?.date || today()}" required></label>
      <label class="field"><span>Note (optional)</span><input class="input" name="note" value="${esc(p?.note || '')}" placeholder="e.g. tip included"></label></div>
    <p class="err" role="alert"></p>
    <div class="form-actions">${p ? `<button type="button" class="btn danger" data-act="delPayment" data-id="${p.id}">${icon('trash')}Delete</button>` : ''}
      <button type="button" class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn dark">${icon('check')}Save Payment</button></div>
  </form>`);
  const f = $('#sheet form');
  const others = a => (a ? S.payments.filter(x => x.apptId === a.id && x.id !== p?.id).reduce((t, x) => t + x.amount, 0) : 0);
  let touched = !!p;
  const sum = () => {
    const a = findAppt(f.appt.value), total = L.toCents(f.total.value) || 0, before = others(a), left = Math.max(0, total - before);
    $('#paySum').innerHTML = `<div><b>${money(total)}</b><span>Total</span></div><div><b>${money(before)}</b><span>Already paid${a && S.payments.some(x => x.apptId === a.id && x.deposit && x.id !== p?.id) ? ' (deposit)' : ''}</span></div><div><b style="color:${left ? 'var(--red)' : 'var(--green)'}">${money(left)}</b><span>Left to pay</span></div>`;
    if (!touched) f.amount.value = left ? dollars(left) : '';
  };
  const onAppt = () => {
    const a = findAppt(f.appt.value);
    if (a) { f.service.value = a.serviceId || ''; f.total.value = dollars(a.price); }
    else if (findSvc(f.service.value) && !f.total.value) f.total.value = dollars(findSvc(f.service.value).price);
    sum();
  };
  const fillAppts = () => {
    const c = clientByName(f.client.value);
    const list = c ? S.appts.filter(a => a.clientId === c.id && live(a)).sort((x, y) => (bal(y) > 0) - (bal(x) > 0) || Math.abs(L.parse(x.date) - L.parse(today())) - Math.abs(L.parse(y.date) - L.parse(today()))) : [];
    const prev = f.appt.value, keep = list.find(a => a.id === (prev || a0?.id));
    f.appt.innerHTML = list.map(a => `<option value="${a.id}">${relDay(a.date)} · ${esc(a.serviceName)} · ${bal(a) ? money(bal(a)) + ' left' : 'paid'}</option>`).join('') + `<option value="">New / no appointment</option>`;
    f.appt.value = keep ? keep.id : list[0] && bal(list[0]) > 0 ? list[0].id : '';
    if (!f.appt.value && prev) { f.total.value = ''; f.service.value = ''; } // switched away from a booked appointment
    onAppt();
  };
  f.client.addEventListener('input', fillAppts);
  f.appt.addEventListener('change', onAppt);
  f.service.addEventListener('change', () => { const s = findSvc(f.service.value); if (!findAppt(f.appt.value) && s) { f.total.value = dollars(s.price); } sum(); });
  f.total.addEventListener('input', sum);
  f.amount.addEventListener('input', () => { touched = true; });
  fillAppts();
  if (p) f.amount.value = dollars(p.amount);
}
const FORMS = {};
FORMS.payment = f => {
  const name = f.client.value.trim(), amount = L.toCents(f.amount.value), total = f.total.value.trim() ? L.toCents(f.total.value) : NaN;
  if (!name) return formErr(f, "Type the client's name.");
  if (!(amount > 0)) return formErr(f, 'Type how much money you received, like 120 or 85.50.');
  if (f.total.value.trim() && !(total >= 0)) return formErr(f, 'The total price should be a number, like 180.');
  if (!f.date.value) return formErr(f, 'Pick the date you were paid.');
  const c = getOrCreateClient(name), svc = findSvc(f.service.value);
  let a = findAppt(f.appt.value);
  if (!a) {
    // No booking yet: make a same-day appointment so her history and "owes" stay correct.
    a = mkAppt(c, svc, f.date.value, '');
    a.price = total > 0 ? total : amount;
    a.supplies.forEach(s => { s.state = 'have'; });
    a.status = 'done';
    S.appts.push(a);
  } else {
    if (total >= 0) a.price = total;
    if (svc && svc.id !== a.serviceId) { a.serviceId = svc.id; a.serviceName = svc.name; }
  }
  const fields = { apptId: a.id, clientId: c.id, clientName: c.name, serviceName: a.serviceName, amount, method: f.method.value, date: f.date.value, deposit: f.kind.value === 'A deposit', note: f.note.value.trim() };
  const p = S.payments.find(x => x.id === f.dataset.id);
  if (p) Object.assign(p, fields); else S.payments.push({ id: uid(), ...fields });
  if (L.payStatus(a, S.payments) === 'paid' && a.status === 'booked' && a.date <= today()) a.status = 'done';
  save(); closeSheet(); refresh();
  const left = bal(a);
  toast(`Saved ${money(amount)} ${fields.method} from ${firstName(c.name)}${left ? ` · ${money(left)} still owed` : ' · paid in full'}`);
};

function expenseSheet(id) {
  const e = id ? S.expenses.find(x => x.id === id) : null;
  openSheet(e ? 'Edit Expense' : 'Add Expense', `<form class="form" data-form="expense" data-id="${e?.id || ''}">
    <label class="field"><span>How much did you spend?</span><input class="input big num" name="amount" inputmode="decimal" placeholder="$0" value="${e ? dollars(e.amount) : ''}" autofocus required></label>
    <div class="field"><span>What was it for?</span><div class="pills">${radios('category', S.categories, e?.category || ui.lastCat || S.categories[0])}</div></div>
    <div class="field-row"><label class="field"><span>What did you buy? (optional)</span><input class="input" name="desc" value="${esc(e?.desc || '')}" placeholder="e.g. 3 bundles from beauty supply"></label>
      <label class="field"><span>Date</span><input class="input" type="date" name="date" value="${e?.date || today()}" required></label></div>
    <div class="field"><span>Receipt photo (optional)</span><div class="row"><label class="btn ghost sm">${icon('camera')}Add photo<input type="file" accept="image/*" hidden data-change="receipt"></label><div id="receiptPrev">${e?.receipt ? `<img class="receipt-thumb" src="${e.receipt}" alt="Receipt">` : ''}</div></div></div>
    <p class="err" role="alert"></p>
    <div class="form-actions">${e ? `<button type="button" class="btn danger" data-act="delExpense" data-id="${e.id}">${icon('trash')}Delete</button>` : ''}
      <button type="button" class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn dark">${icon('check')}Save Expense</button></div></form>`);
  SH.receipt = e?.receipt || '';
}
FORMS.expense = f => {
  const amount = L.toCents(f.amount.value);
  if (!(amount > 0)) return formErr(f, 'Type how much you spent, like 45 or 12.99.');
  if (!f.category.value) return formErr(f, 'Pick what it was for.');
  if (!f.date.value) return formErr(f, 'Pick a date.');
  const fields = { amount, category: f.category.value, desc: f.desc.value.trim(), date: f.date.value, receipt: SH.receipt || '' };
  const e = S.expenses.find(x => x.id === f.dataset.id);
  if (e) Object.assign(e, fields); else S.expenses.push({ id: uid(), ...fields });
  ui.lastCat = fields.category;
  save(); closeSheet(); refresh(); toast(`Saved ${money(amount)} for ${fields.category}`);
};

const supplyRows = () => SH.supplies.map((s, i) => `<tr><td><input class="input" data-sup="name" data-i="${i}" value="${esc(s.name)}" aria-label="Item"></td>
  <td style="width:110px"><input class="input" data-sup="cost" data-i="${i}" value="${s.cost ? dollars(s.cost) : ''}" inputmode="decimal" placeholder="$" aria-label="Cost"></td>
  <td style="width:44px"><button type="button" class="icon-btn" data-act="supRemove" data-i="${i}" aria-label="Remove">${icon('x')}</button></td></tr>`).join('');
const supplyEditor = () => `<div class="field"><span>What hair & supplies are needed?</span>
  <div class="scroll-x"><table class="simple"><thead><tr><th>Item</th><th>Cost</th><th></th></tr></thead><tbody id="supRows"></tbody></table></div>
  <button type="button" class="btn ghost sm" style="align-self:flex-start" data-act="supAdd">${icon('plus')}Add item</button></div>`;
function syncSupplies() {
  $$('#supRows [data-sup]').forEach(inp => { const s = SH.supplies[inp.dataset.i]; if (inp.dataset.sup === 'name') s.name = inp.value; else s.cost = L.toCents(inp.value) || 0; });
}
const redrawSupplies = () => { $('#supRows').innerHTML = supplyRows(); };

function apptSheet({ id, clientId, date } = {}) {
  const a = id ? findAppt(id) : null;
  openSheet(a ? 'Edit Appointment' : 'Add Appointment', `<form class="form" data-form="appt" data-id="${a?.id || ''}" autocomplete="off">
    <label class="field"><span>Client</span><input class="input" name="client" list="clientsDL" value="${esc(a ? cName(a.clientId) : clientId ? cName(clientId) : '')}" placeholder="Client name" autofocus required>${clientsDatalist()}</label>
    <div class="field-row"><label class="field"><span>Hairstyle / service</span><select class="input" name="service">${serviceOptions(a?.serviceId)}</select></label>
      <label class="field"><span>Price</span><input class="input" name="price" inputmode="decimal" value="${a ? dollars(a.price) : ''}" placeholder="$0"></label></div>
    <div class="field-row"><label class="field"><span>Date</span><input class="input" type="date" name="date" value="${a?.date || date || today()}" required></label>
      <label class="field"><span>Time</span><input class="input" type="time" name="time" value="${a?.time || ''}"></label></div>
    ${a ? `<label class="field"><span>Status</span><select class="input" name="status">${Object.entries(APPT_LABEL).map(([k, l]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
    <label class="field"><span>Notes (optional)</span><input class="input" name="notes" value="${esc(a?.notes || '')}" placeholder="e.g. wants curly ends, color 1B"></label>
    ${supplyEditor()}
    <p class="err" role="alert"></p>
    <div class="form-actions">${a ? `<button type="button" class="btn danger" data-act="delAppt" data-id="${a.id}">${icon('trash')}Delete</button>` : ''}
      <button type="button" class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn dark">${icon('check')}Save</button></div></form>`);
  SH.supplies = a ? a.supplies.map(s => ({ ...s })) : [];
  redrawSupplies();
  const f = $('#sheet form');
  f.service.addEventListener('change', () => {
    const s = findSvc(f.service.value); if (!s) return;
    f.price.value = dollars(s.price);
    SH.supplies = s.supplies.map(x => ({ id: uid(), name: x.name, cost: x.cost, state: 'need' })); redrawSupplies();
  });
}
FORMS.appt = f => {
  syncSupplies();
  const name = f.client.value.trim(), price = f.price.value.trim() ? L.toCents(f.price.value) : (findSvc(f.service.value)?.price || 0);
  if (!name) return formErr(f, "Type the client's name.");
  if (!(price >= 0)) return formErr(f, 'Price should be a number, like 180.');
  if (!f.date.value) return formErr(f, 'Pick a date.');
  const c = getOrCreateClient(name), s = findSvc(f.service.value);
  let a = findAppt(f.dataset.id);
  if (!a) { a = mkAppt(c, s, f.date.value, f.time.value); S.appts.push(a); }
  Object.assign(a, {
    clientId: c.id, serviceId: s?.id || '', serviceName: s?.name || a.serviceName || 'Service', date: f.date.value, time: f.time.value, price,
    notes: f.notes.value.trim(), status: f.status ? f.status.value : a.status,
    supplies: SH.supplies.filter(x => x.name.trim()).map(x => ({ id: x.id || uid(), name: x.name.trim(), cost: x.cost || 0, state: x.state || 'need' })),
  });
  save(); closeSheet(); refresh(); toast(`Saved ${firstName(c.name)} — ${relDay(a.date)}${a.time ? ' at ' + L.time12(a.time) : ''}`);
};

function clientSheet(id) {
  const c = id ? findClient(id) : null;
  openSheet(c ? 'Edit Client' : 'Add Client', `<form class="form" data-form="client" data-id="${c?.id || ''}">
    <label class="field"><span>Name</span><input class="input" name="name" value="${esc(c?.name || '')}" autofocus required></label>
    <div class="field-row"><label class="field"><span>Phone (optional)</span><input class="input" name="phone" type="tel" value="${esc(c?.phone || '')}"></label>
      <label class="field"><span>Email or Instagram (optional)</span><input class="input" name="email" value="${esc(c?.email || '')}"></label></div>
    <label class="field"><span>What she likes (optional)</span><input class="input" name="prefs" value="${esc(c?.prefs || '')}" placeholder="e.g. middle part, 1B, light edges"></label>
    <label class="field"><span>Notes (optional)</span><textarea class="input" name="notes" placeholder="Anything to remember">${esc(c?.notes || '')}</textarea></label>
    <p class="tiny muted">Only save what you need to do her hair. This stays on your device.</p>
    <p class="err" role="alert"></p>
    <div class="form-actions">${c ? `<button type="button" class="btn danger" data-act="delClient" data-id="${c.id}">${icon('trash')}Delete</button>` : ''}
      <button type="button" class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn dark">${icon('check')}Save Client</button></div></form>`);
}
FORMS.client = f => {
  const name = f.name.value.trim();
  if (!name) return formErr(f, 'Type a name.');
  const dupe = clientByName(name);
  if (dupe && dupe.id !== f.dataset.id) return formErr(f, `You already have a client named ${dupe.name}.`);
  let c = findClient(f.dataset.id);
  if (!c) { c = getOrCreateClient(name); }
  Object.assign(c, { name, phone: f.phone.value.trim(), email: f.email.value.trim(), prefs: f.prefs.value.trim(), notes: f.notes.value.trim() });
  S.payments.forEach(p => { if (p.clientId === c.id) p.clientName = name; });
  save(); closeSheet();
  location.hash = '#/client/' + c.id; refresh(); toast(`Saved ${name}`);
};

function serviceSheet(id) {
  const s = id ? findSvc(id) : null;
  openSheet(s ? 'Edit Service' : 'Add Service', `<form class="form" data-form="service" data-id="${s?.id || ''}">
    <div class="field-row"><label class="field"><span>Service name</span><input class="input" name="name" value="${esc(s?.name || '')}" placeholder="e.g. Goddess Locs" required></label>
      <label class="field"><span>Price</span><input class="input" name="price" inputmode="decimal" value="${s ? dollars(s.price) : ''}" placeholder="$0" required></label></div>
    ${supplyEditor()}
    <p class="tiny muted">Changes apply to new appointments. Existing appointments keep their own list.</p>
    <p class="err" role="alert"></p>
    <div class="form-actions">${s ? `<button type="button" class="btn danger" data-act="delService" data-id="${s.id}">${icon('trash')}Delete</button>` : ''}
      <button type="button" class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn dark">${icon('check')}Save Service</button></div></form>`);
  SH.supplies = s ? s.supplies.map(x => ({ ...x })) : [];
  redrawSupplies();
}
FORMS.service = f => {
  syncSupplies();
  const name = f.name.value.trim(), price = L.toCents(f.price.value);
  if (!name) return formErr(f, 'Type a service name.');
  if (!(price >= 0)) return formErr(f, 'Price should be a number, like 180.');
  let s = findSvc(f.dataset.id);
  if (!s) { s = { id: uid() }; S.services.push(s); }
  Object.assign(s, { name, price, supplies: SH.supplies.filter(x => x.name.trim()).map(x => ({ name: x.name.trim(), cost: x.cost || 0 })) });
  save(); closeSheet(); refresh(); toast(`Saved ${name}`);
};

function importSheet() {
  openSheet('Import from Booksy', `<div class="form">
    <div class="hint">Booksy has no public connection for other apps, so import works with a file instead. Download your appointments from Booksy (or your calendar) as a <b>CSV</b> or <b>.ics</b> file, then choose it below. Nothing is added until you press Import.</div>
    <label class="btn dark" style="align-self:flex-start">${icon('upload')}Choose file<input type="file" accept=".csv,.ics,text/csv,text/calendar" hidden data-change="importFile"></label>
    <div id="importPrev"></div></div>`, true);
}
function importPreview(rows) {
  const key = (n, d, t) => `${n.trim().toLowerCase()}|${d}|${t}`;
  const have = new Set(S.appts.map(a => key(cName(a.clientId), a.date, a.time)));
  const match = text => S.services.find(s => text.toLowerCase().includes(s.name.toLowerCase()))?.id || '';
  SH.rows = rows;
  $('#importPrev').innerHTML = rows.length ? `<p class="small"><b>${rows.length}</b> appointment${rows.length > 1 ? 's' : ''} found. Check the names and services, untick any you don't want.</p>
    <div class="scroll-x"><table class="simple"><thead><tr><th></th><th>Client</th><th>Date</th><th>Time</th><th>Service</th><th>Price</th></tr></thead><tbody>
    ${rows.map((r, i) => { const dup = have.has(key(r.name, r.date, r.time)); return `<tr data-row="${i}"><td><input type="checkbox" ${dup ? '' : 'checked'} aria-label="Import row ${i + 1}"></td>
      <td><input class="input" data-k="name" value="${esc(r.name)}" aria-label="Client"></td><td><input class="input" type="date" data-k="date" value="${r.date}" aria-label="Date"></td>
      <td><input class="input" type="time" data-k="time" value="${r.time}" aria-label="Time"></td><td><select class="input" data-k="service" aria-label="Service">${serviceOptions(match(r.service + ' ' + r.name))}</select>${dup ? '<div class="tiny muted">Already added</div>' : ''}</td>
      <td><input class="input" data-k="price" value="${r.price ? dollars(r.price) : ''}" placeholder="auto" style="width:80px" aria-label="Price"></td></tr>`; }).join('')}
    </tbody></table></div><p class="err" role="alert"></p><div class="form-actions"><button class="btn dark" data-act="doImport">${icon('check')}Import selected</button></div>`
    : `<p class="err">No appointments found in that file. A CSV needs at least a client name column and a date column.</p>`;
}

function pinSheet() {
  openSheet(cryptoKey ? 'Change PIN' : 'Set a PIN', `<form class="form" data-form="pin">
    <label class="field"><span>New PIN (4–12 numbers)</span><input class="input" name="pin" type="password" inputmode="numeric" autocomplete="new-password" required></label>
    <label class="field"><span>Type it again</span><input class="input" name="pin2" type="password" inputmode="numeric" autocomplete="new-password" required></label>
    <div class="hint"><b>Important:</b> if you forget your PIN, nobody can unlock your data — not even with help. Download a backup after setting it.</div>
    <p class="err" role="alert"></p>
    <div class="form-actions"><button type="button" class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn dark">${icon('lock')}Save PIN</button></div></form>`);
}
FORMS.pin = async f => {
  const pin = f.pin.value;
  if (!/^\d{4,12}$/.test(pin)) return formErr(f, 'Use 4 to 12 numbers.');
  if (pin !== f.pin2.value) return formErr(f, "The two PINs don't match.");
  cryptoSalt = crypto.getRandomValues(new Uint8Array(16));
  cryptoKey = await deriveKey(pin, cryptoSalt);
  await save(); closeSheet(); refresh(); toast('PIN set. Your data is now encrypted.');
};

// ---------- small forms ----------
FORMS.addSupply = f => {
  const a = findAppt(f.dataset.appt), name = f.name.value.trim();
  if (!a || !name) return;
  a.supplies.push({ id: uid(), name, cost: L.toCents(f.cost.value) || 0, state: 'need' });
  save(); refresh();
};
FORMS.addStock = f => {
  const name = f.name.value.trim(), qty = parseInt(f.qty.value, 10), low = parseInt(f.low.value, 10);
  if (!name || !(qty >= 0) || !(low >= 0)) return toast('Fill in the product, how many, and when to remind you.', 'error');
  S.stock.push({ id: uid(), name, qty, low }); save(); refresh();
};
FORMS.addTag = f => {
  const k = f.dataset.key, v = f.name.value.trim();
  if (!v || S[k].some(x => x.toLowerCase() === v.toLowerCase())) return toast('That one is already there.', 'error');
  S[k].push(v); save(); refresh();
};
FORMS.bizName = f => {
  const v = f.name.value.trim(); if (!v) return;
  S.settings.name = v; $('#brandName').textContent = v; save(); toast('Business name saved');
};

// =====================================================================
// ACTIONS
// =====================================================================
const ACT = {
  closeSheet,
  openMenu: () => document.body.classList.add('menu-open'),
  closeMenu: () => document.body.classList.remove('menu-open'),
  logPayment: d => paymentSheet({ apptId: d.appt, clientId: d.client }),
  editPayment: d => paymentSheet({ id: d.id }),
  addExpense: () => expenseSheet(),
  editExpense: d => expenseSheet(d.id),
  addAppt: d => apptSheet({ clientId: d.client, date: d.date }),
  editAppt: d => apptSheet({ id: d.id }),
  addClient: () => clientSheet(),
  editClient: d => clientSheet(d.id),
  editService: d => serviceSheet(d.id),
  importBooksy: () => importSheet(),
  setPin: () => pinSheet(),
  incomeView: d => { ui.incomeView = d.v; refresh(); },
  period: d => { ui.period = d.v; refresh(); },
  apptView: d => { ui.apptView = d.v; refresh(); },
  prepDays: d => { ui.prepDays = +d.v; refresh(); },
  clientFilter: d => { ui.clientFilter = d.v; refresh(); },
  dayNav: d => { ui.day = L.addDays(ui.day || today(), +d.n); refresh(); },
  monthNav: d => { ui.month = L.addMonths(ui.month || L.monthStart(today()), +d.n); refresh(); },
  openDay: d => { ui.day = d.d; ui.apptView = 'day'; refresh(); },
  markDone: d => { const a = findAppt(d.id); a.status = 'done'; save(); refresh(); toast(bal(a) ? `Marked done · ${money(bal(a))} still owed` : 'Marked done'); },
  setSupply: d => { const s = findAppt(d.appt).supplies.find(x => x.id === d.id); s.state = d.v; save(); refresh(); },
  delSupply: d => { const a = findAppt(d.appt); a.supplies = a.supplies.filter(x => x.id !== d.id); save(); refresh(); },
  boughtAll: d => {
    const n = d.name.trim().toLowerCase();
    upcoming(ui.prepDays).forEach(a => a.supplies.forEach(s => { if (s.state === 'need' && s.name.trim().toLowerCase() === n) s.state = 'bought'; }));
    save(); refresh(); toast(`Marked ${d.name} as bought`);
  },
  stockQty: d => { const s = S.stock.find(x => x.id === d.id); s.qty = Math.max(0, s.qty + +d.n); save(); refresh(); },
  delStock: d => { S.stock = S.stock.filter(x => x.id !== d.id); save(); refresh(); },
  supAdd: () => { syncSupplies(); SH.supplies.push({ id: uid(), name: '', cost: 0, state: 'need' }); redrawSupplies(); $$('#supRows [data-sup=name]').pop().focus(); },
  supRemove: d => { syncSupplies(); SH.supplies.splice(+d.i, 1); redrawSupplies(); },
  delPayment: d => {
    if (!confirm('Delete this payment? It will no longer count in your money made.')) return;
    S.payments = S.payments.filter(p => p.id !== d.id); save(); closeSheet(); refresh(); toast('Payment deleted');
  },
  delExpense: d => {
    if (!confirm('Delete this expense?')) return;
    S.expenses = S.expenses.filter(e => e.id !== d.id); save(); closeSheet(); refresh(); toast('Expense deleted');
  },
  delAppt: d => {
    if (!confirm('Delete this appointment? Any payments for it stay in your records.')) return;
    S.appts = S.appts.filter(a => a.id !== d.id); save(); closeSheet(); refresh(); toast('Appointment deleted');
  },
  delClient: d => {
    const c = findClient(d.id);
    if (!confirm(`Delete ${c.name} and their appointments? Their payments stay in your money records.`)) return;
    S.clients = S.clients.filter(x => x.id !== d.id); S.appts = S.appts.filter(a => a.clientId !== d.id);
    save(); closeSheet(); location.hash = '#/clients'; toast('Client deleted');
  },
  delService: d => {
    if (!confirm('Delete this service? Past appointments keep their info.')) return;
    S.services = S.services.filter(s => s.id !== d.id); save(); closeSheet(); refresh();
  },
  delTag: d => {
    if (S[d.key].length <= 1) return toast('Keep at least one.', 'error');
    S[d.key].splice(+d.i, 1); save(); refresh();
  },
  delClientPhoto: d => { findClient(d.id).photos.splice(+d.i, 1); save(); refresh(); },
  viewPhoto: d => openSheet('Photo', `<img src="${d.src}" alt="" style="width:100%;border-radius:14px">`),
  doImport: () => {
    const f = $('#importPrev'); let n = 0;
    $$('tr[data-row]', f).forEach(tr => {
      if (!$('input[type=checkbox]', tr).checked) return;
      const v = k => $(`[data-k=${k}]`, tr).value.trim();
      if (!v('name') || !v('date')) return;
      const s = findSvc(v('service')), c = getOrCreateClient(v('name'));
      const a = mkAppt(c, s, v('date'), v('time'));
      const r = SH.rows[tr.dataset.row];
      if (!s) a.serviceName = r.service || 'Booksy appointment';
      if (v('price')) a.price = L.toCents(v('price')) || a.price;
      a.notes = r.notes || ''; a.source = 'import';
      if (a.date < today()) a.status = 'done';
      S.appts.push(a); n++;
    });
    if (!n) return formErr(f, 'Tick at least one appointment with a name and date.');
    save(); closeSheet(); refresh(); toast(`Imported ${n} appointment${n > 1 ? 's' : ''}`);
  },
  backup: () => { download(`queen-of-the-krown-backup-${today()}.json`, JSON.stringify(S), 'application/json'); toast('Backup downloaded — keep it somewhere safe'); },
  csv: d => {
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = d.v === 'payments'
      ? [['Date', 'Client', 'Service', 'Amount', 'Method', 'Deposit', 'Note'], ...S.payments.map(p => [p.date, p.clientName, p.serviceName, dollars(p.amount), p.method, p.deposit ? 'yes' : 'no', p.note])]
      : [['Date', 'Category', 'Description', 'Amount'], ...S.expenses.map(e => [e.date, e.category, e.desc, dollars(e.amount)])];
    download(`${d.v}-${today()}.csv`, rows.map(r => r.map(cell).join(',')).join('\r\n'), 'text/csv');
  },
  removeDemo: () => {
    for (const k of ['clients', 'appts', 'payments', 'expenses', 'stock']) S[k] = S[k].filter(x => !x.demo);
    save(); refresh(); toast('Sample data removed. Everything now is yours.');
  },
  loadDemo: () => { addDemo(); save(); refresh(); toast('Sample data added'); },
  eraseAll: async () => {
    if (!confirm('Erase EVERYTHING on this device? This cannot be undone.')) return;
    if (!confirm('Last check: did you download a backup? Press OK to erase.')) return;
    cryptoKey = null; S = freshState(); await save(); location.hash = '#/dashboard'; location.reload();
  },
  removePin: async () => {
    if (!confirm('Remove your PIN? Anyone with your phone could open the app.')) return;
    cryptoKey = null; await save(); refresh(); toast('PIN removed');
  },
  lockNow: async () => { await saving; location.reload(); },
};

const CHG = {
  payMethod: el => { ui.payMethod = el.value; $('#paymentsList').innerHTML = paymentsList(); },
  expCat: el => { ui.expCat = el.value; $('#expensesList').innerHTML = expensesList(); },
  receipt: async el => {
    if (!el.files[0]) return;
    try { SH.receipt = await shrinkImage(el.files[0]); $('#receiptPrev').innerHTML = `<img class="receipt-thumb" src="${SH.receipt}" alt="Receipt">`; } catch (e) { toast(e.message, 'error'); }
  },
  clientPhoto: async el => {
    if (!el.files[0]) return;
    try { const c = findClient(el.dataset.id); (c.photos ||= []).push(await shrinkImage(el.files[0])); save(); refresh(); } catch (e) { toast(e.message, 'error'); }
  },
  importFile: async el => {
    const file = el.files[0]; if (!file) return;
    try {
      const text = await readText(file);
      importPreview(/BEGIN:VCALENDAR/.test(text) ? L.parseICS(text) : L.mapCSV(L.parseCSV(text)));
    } catch (e) { toast('Could not read that file: ' + e.message, 'error'); }
  },
  restore: async el => {
    const file = el.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await readText(file));
      if (!data || !Array.isArray(data.payments) || !Array.isArray(data.clients)) throw new Error('This is not a Queen of the Krown backup.');
      if (!confirm('Replace everything on this device with this backup?')) return;
      S = migrate(data); await save(); refresh(); toast('Backup restored');
    } catch (e) { toast(e.message, 'error'); }
  },
};

// =====================================================================
// ROUTER & BOOT
// =====================================================================
const NAV = [['dashboard', 'Dashboard', 'home'], ['appointments', 'Appointments', 'calendar'], ['clients', 'Clients', 'users'], ['payments', 'Payments', 'wallet'],
  ['expenses', 'Expenses', 'receipt'], ['supplies', 'Hair & Supplies', 'scissors'], ['analytics', 'Analytics', 'chart'], ['settings', 'Settings', 'settings']];

function route() {
  const [page = 'dashboard', arg] = location.hash.replace(/^#\/?/, '').split('/');
  const P = PAGES[page] ? page : 'dashboard';
  charts.forEach(c => c.destroy()); charts = [];
  document.body.classList.remove('menu-open');
  const navKey = P === 'client' ? 'clients' : P;
  $$('[data-page]').forEach(a => a.classList.toggle('active', a.dataset.page === navKey));
  const title = PAGES[P].title(arg);
  $('#pageTitle').textContent = title;
  document.title = `${title} · ${S.settings.name}`;
  $('#view').innerHTML = PAGES[P].render(arg);
  PAGES[P].mount?.(arg);
}
function refresh() { const y = scrollY; route(); scrollTo(0, y); }

function start() {
  $('#nav').innerHTML = NAV.map(([k, l, i]) => `<a href="#/${k}" data-page="${k}">${icon(i)}${l}</a>`).join('');
  $('#brandName').textContent = S.settings.name;
  hydrate(document);
  if (window.Chart) { Chart.defaults.color = '#7a7266'; Chart.defaults.font.family = 'Jost, system-ui, sans-serif'; Chart.defaults.font.size = 12.5; }
  $('#app').hidden = false; $('#lock').hidden = true;
  addEventListener('hashchange', () => { route(); scrollTo(0, 0); $('#view').focus({ preventScroll: true }); });
  route();
}

document.addEventListener('click', e => {
  if (e.target.id === 'sheet') return closeSheet();
  const b = e.target.closest('[data-act]');
  if (b) { e.preventDefault(); ACT[b.dataset.act]?.(b.dataset, b); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault(); const err = $('.err', f); if (err) err.textContent = '';
  FORMS[f.dataset.form]?.(f);
});
document.addEventListener('change', e => { const k = e.target.dataset.change; if (k) CHG[k](e.target); });
document.addEventListener('input', e => {
  const k = e.target.dataset.search; if (!k) return;
  ui.q[k] = e.target.value;
  $('#' + k + 'List').innerHTML = { clients: clientList, payments: paymentsList, expenses: expensesList }[k]();
});

function showLock(rec) {
  const l = $('#lock'); l.hidden = false;
  l.innerHTML = `<form class="lock-card"><span class="crown">${icon('crown')}</span><h1>${esc(rec.name || 'Queen of the Krown')}</h1>
    <p style="color:#a89f90">Enter your PIN</p><input class="input" name="pin" type="password" inputmode="numeric" autocomplete="current-password" aria-label="PIN" autofocus>
    <p class="err" role="alert" style="color:#f3a99e"></p><button class="btn gold block">Unlock</button>
    <p class="tiny" style="color:#7d7568;margin-top:22px">Forgot your PIN? Your data can only come back from a backup file.<br><button type="button" class="btn sm" style="margin-top:8px;background:#222;color:#bbb" id="forgot">Start over on this device</button></p></form>`;
  const f = $('form', l); f.pin.focus();
  f.addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation();
    try {
      const key = await deriveKey(f.pin.value, rec.salt);
      const json = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, key, rec.ct));
      cryptoKey = key; cryptoSalt = rec.salt; S = migrate(JSON.parse(json)); start();
    } catch { $('.err', f).textContent = 'Wrong PIN. Try again.'; f.pin.value = ''; f.pin.focus(); }
  });
  $('#forgot', l).addEventListener('click', async () => {
    if (!confirm('Erase all data on this device and start fresh? You can restore a backup file after.')) return;
    S = freshState(); await save(); location.reload();
  });
}

async function boot() {
  navigator.storage?.persist?.();
  let rec;
  try { rec = await idbGet(); } catch (e) {
    document.body.innerHTML = `<p style="padding:24px">This browser can't save data (${esc(e.message)}). Try Safari or Chrome, and not in private mode.</p>`; return;
  }
  if (rec?.ct) return showLock(rec);
  S = rec?.plain ? migrate(JSON.parse(rec.plain)) : freshState();
  if (!rec) { addDemo(); save(); }
  start();
}

// ---------- sample data (marked demo: true so it can be removed in one tap) ----------
function addDemo() {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const t = today();
  const names = ['Sarah Johnson', 'Jasmine Carter', 'Aaliyah Brooks', 'Mia Thompson', 'Kayla Robinson', 'Destiny Moore', 'Imani Davis', 'Tiana Wright', 'Nia Harris', 'Brianna Lewis'];
  const clients = names.map(n => ({ id: uid(), name: n, phone: `(555) 01${Math.floor(10 + rnd() * 89)}`, email: '', notes: '', prefs: '', photos: [], created: L.addDays(t, -160), demo: true }));
  clients[0].prefs = 'Middle part, 26", natural black'; clients[1].notes = 'Tender-headed, go easy on edges';
  S.clients.push(...clients);
  const times = ['09:00', '10:30', '11:00', '13:00', '14:00', '15:30'];
  const svcs = S.services.length ? S.services : defaultServices();
  for (let i = 150; i >= -12; i--) {
    const d = L.addDays(t, -i);
    if (L.parse(d).getDay() === 1) continue; // closed Mondays
    const n = rnd() < .35 ? 0 : rnd() < .65 ? 1 : 2;
    for (let k = 0; k < n || (i === -1 && k < 1) || (i === -2 && k < 1); k++) {
      const a = mkAppt(pick(clients), pick(svcs), d, times[(k * 3 + Math.floor(rnd() * 3)) % times.length]);
      a.demo = true; S.appts.push(a);
      const pay = (amt, m, day, dep) => { const p = mkPay(a, amt, m, day, dep); p.demo = true; S.payments.push(p); };
      const dep = Math.round(a.price * .25 / 500) * 500;
      if (i <= 0) { // upcoming
        a.supplies.forEach(s => { s.state = rnd() < .4 ? 'have' : 'need'; });
        if (rnd() < .5) pay(dep, pick(['Cash App', 'Zelle']), L.addDays(t, -2), true);
        continue;
      }
      a.supplies.forEach(s => { s.state = 'bought'; });
      if (rnd() < .05) { a.status = 'noshow'; continue; }
      a.status = 'done';
      const m = rnd() < .7 ? 'Cash' : pick(['Cash App', 'Zelle', 'Card']);
      if (i < 6 && rnd() < .5) { pay(dep, 'Cash App', L.addDays(d, -3), true); continue; } // a few still owe
      if (rnd() < .4) { pay(dep, 'Cash App', L.addDays(d, -3), true); pay(a.price - dep, m, d, false); } else pay(a.price, m, d, false);
    }
  }
  const exp = [['Hair & Bundles', 'Bundles from beauty supply', 90, 220, 4], ['Braiding Hair', 'Pre-stretched packs', 20, 60, 4], ['Hair Products', 'Mousse, edge control, gel', 15, 45, 4],
    ['Supplies', 'Gloves, caps, clips', 10, 35, 3], ['Lace', 'HD lace frontal', 50, 90, 2], ['Advertising', 'Instagram promo', 20, 40, 1], ['Equipment', 'New flat iron', 80, 140, .3], ['Business', 'Booksy subscription', 30, 30, .6]];
  const bag = exp.flatMap(e => Array(Math.ceil(e[4] * 2)).fill(e));
  for (let i = 150; i >= 0; i -= 1 + Math.floor(rnd() * 4)) {
    const e = pick(bag);
    S.expenses.push({ id: uid(), amount: Math.round(e[2] + rnd() * (e[3] - e[2])) * 100, category: e[0], date: L.addDays(t, -i), desc: e[1], receipt: '', demo: true });
  }
  S.stock.push(...[['Edge control', 3, 2], ['Hair mousse', 1, 2], ['Braiding hair packs', 6, 8], ['Lace glue', 2, 1]].map(([name, qty, low]) => ({ id: uid(), name, qty, low, demo: true })));
}

boot();
