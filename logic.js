// Pure business logic, shared by the app and test.js.
// Money is always whole cents (integers) so totals never drift. Dates are local 'YYYY-MM-DD' strings.
(function (root) {
  const L = {};
  const pad = n => String(n).padStart(2, '0');

  // ---------- money ----------
  L.toCents = s => {
    const t = String(s ?? '').replace(/[$,\s]/g, '');
    if (t === '' || !/^-?\d*\.?\d*$/.test(t)) return NaN;
    return Math.round(Number(t) * 100);
  };
  L.money = c => {
    const a = Math.abs(c) / 100;
    const s = a.toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
    return (c < 0 ? '-$' : '$') + s;
  };

  // ---------- dates ----------
  L.iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  L.parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  L.addDays = (s, n) => { const d = L.parse(s); d.setDate(d.getDate() + n); return L.iso(d); };
  L.addMonths = (s, n) => { const d = L.parse(s.slice(0, 8) + '01'); d.setMonth(d.getMonth() + n); return L.iso(d); };
  L.weekStart = s => { const d = L.parse(s); d.setDate(d.getDate() - d.getDay()); return L.iso(d); }; // weeks start Sunday
  L.monthStart = s => s.slice(0, 8) + '01';
  L.monthEnd = s => { const d = L.parse(L.monthStart(s)); return L.iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
  L.yearStart = s => s.slice(0, 4) + '-01-01';
  L.ranges = today => ({
    today: [today, today],
    week: [L.weekStart(today), L.addDays(L.weekStart(today), 6)],
    month: [L.monthStart(today), L.monthEnd(today)],
    year: [L.yearStart(today), today.slice(0, 4) + '-12-31'],
  });

  // ---------- totals ----------
  L.inRange = (x, from, to) => x.date >= from && x.date <= to;
  L.sum = (list, from, to) => list.reduce((t, x) => t + (L.inRange(x, from, to) ? x.amount : 0), 0);
  L.groupBy = (list, key, from, to) => {
    const m = new Map();
    for (const x of list) if (L.inRange(x, from, to)) m.set(key(x), (m.get(key(x)) || 0) + x.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  // Chart buckets ending at `today`: daily = 14 days, weekly = 12 weeks, monthly = 12 months, yearly = 5 years.
  L.buckets = (view, today) => {
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const out = [];
    if (view === 'daily') for (let i = 13; i >= 0; i--) {
      const d = L.addDays(today, -i);
      out.push({ label: MON[+d.slice(5, 7) - 1] + ' ' + +d.slice(8), from: d, to: d });
    }
    if (view === 'weekly') for (let i = 11; i >= 0; i--) {
      const f = L.addDays(L.weekStart(today), -7 * i);
      out.push({ label: MON[+f.slice(5, 7) - 1] + ' ' + +f.slice(8), from: f, to: L.addDays(f, 6) });
    }
    if (view === 'monthly') for (let i = 11; i >= 0; i--) {
      const f = L.addMonths(today, -i);
      out.push({ label: MON[+f.slice(5, 7) - 1] + " '" + f.slice(2, 4), from: f, to: L.monthEnd(f) });
    }
    if (view === 'yearly') for (let i = 4; i >= 0; i--) {
      const y = +today.slice(0, 4) - i;
      out.push({ label: String(y), from: y + '-01-01', to: y + '-12-31' });
    }
    return out;
  };
  L.series = (list, buckets) => buckets.map(b => L.sum(list, b.from, b.to));

  // ---------- appointment payments ----------
  // Every payment record is money actually received, so a deposit is counted once and the balance only adds what's left.
  L.paidFor = (payments, apptId) => payments.reduce((t, p) => t + (p.apptId === apptId ? p.amount : 0), 0);
  L.balance = (appt, payments) => Math.max(0, appt.price - L.paidFor(payments, appt.id));
  L.payStatus = (appt, payments) => {
    const mine = payments.filter(p => p.apptId === appt.id);
    const paid = mine.reduce((t, p) => t + p.amount, 0);
    if (paid <= 0) return 'unpaid';
    if (paid >= appt.price) return 'paid';
    return mine.every(p => p.deposit) ? 'deposit' : 'partial';
  };

  // ---------- imports ----------
  L.parseCSV = text => {
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); rows.push(row); row = []; f = '';
      } else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ''));
  };

  L.normDate = s => {
    s = String(s ?? '').trim(); let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${pad(m[1])}-${pad(m[2])}`; }
    const d = new Date(s);
    return s && !isNaN(d) ? L.iso(d) : '';
  };
  L.normTime = s => {
    const m = String(s ?? '').match(/(\d{1,2}):(\d{2})\s*([ap])?\.?m?/i);
    if (!m) return '';
    let h = +m[1]; const ap = m[3] && m[3].toLowerCase();
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    return pad(h) + ':' + m[2];
  };

  // Guess columns from the header row, since Booksy export column names aren't documented.
  L.mapCSV = rows => {
    if (rows.length < 2) return [];
    const head = rows[0].map(h => h.toLowerCase().trim());
    const col = re => head.findIndex(h => re.test(h));
    const name = col(/client|customer|^name|full name/), date = col(/date|day|start/), time = col(/time|hour/),
      service = col(/service|style|treatment/), price = col(/price|amount|total|value|cost/), notes = col(/note|comment/);
    const get = (r, i) => (i >= 0 ? (r[i] || '').trim() : '');
    return rows.slice(1).map(r => ({
      name: get(r, name), date: L.normDate(get(r, date)),
      time: L.normTime(get(r, time)) || L.normTime(get(r, date)),
      service: get(r, service), price: L.toCents(get(r, price)) || 0, notes: get(r, notes),
    })).filter(x => x.name && x.date);
  };

  L.parseICS = text => {
    const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/); // unfold folded lines
    const evs = []; let ev = null;
    for (const ln of lines) {
      if (ln === 'BEGIN:VEVENT') ev = {};
      else if (ln === 'END:VEVENT') { if (ev && ev.start) evs.push(ev); ev = null; }
      else if (ev) {
        const i = ln.indexOf(':'); if (i < 0) continue;
        const key = ln.slice(0, i).split(';')[0];
        const val = ln.slice(i + 1).replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
        if (key === 'DTSTART') ev.start = val;
        else if (key === 'SUMMARY') ev.summary = val;
        else if (key === 'DESCRIPTION') ev.desc = val;
      }
    }
    return evs.map(e => {
      const m = e.start.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{0,2}(Z)?)?/);
      if (!m) return null;
      let d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
      if (m[6]) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])); // UTC -> local
      return { name: e.summary || 'Booksy client', date: L.iso(d), time: m[4] ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : '',
        service: e.summary || '', price: 0, notes: e.desc || '' };
    }).filter(Boolean);
  };

  L.time12 = t => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}${m ? ':' + pad(m) : ''} ${h < 12 ? 'AM' : 'PM'}`;
  };

  if (typeof module !== 'undefined') module.exports = L; else root.Logic = L;
})(this);
