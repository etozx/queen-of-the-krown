// Run with: node test.js
const assert = require('assert');
const L = require('./logic.js');

// money
assert.strictEqual(L.toCents('120'), 12000);
assert.strictEqual(L.toCents('$1,240.50'), 124050);
assert.strictEqual(L.toCents('0.1') + L.toCents('0.2'), 30);
assert.ok(Number.isNaN(L.toCents('abc')));
assert.ok(Number.isNaN(L.toCents('')));
assert.strictEqual(L.money(124050), '$1,240.50');
assert.strictEqual(L.money(12000), '$120');
assert.strictEqual(L.money(-500), '-$5');

// deposits are never counted twice
const appt = { id: 'a1', price: 25000 };
let pays = [];
assert.strictEqual(L.payStatus(appt, pays), 'unpaid');
pays.push({ apptId: 'a1', amount: 5000, deposit: true, date: '2026-10-01' });
assert.strictEqual(L.payStatus(appt, pays), 'deposit');
assert.strictEqual(L.balance(appt, pays), 20000);
pays.push({ apptId: 'a1', amount: 10000, date: '2026-10-05' });
assert.strictEqual(L.payStatus(appt, pays), 'partial');
pays.push({ apptId: 'a1', amount: L.balance(appt, pays), date: '2026-10-05' });
assert.strictEqual(L.payStatus(appt, pays), 'paid');
assert.strictEqual(L.sum(pays, '2026-01-01', '2026-12-31'), 25000); // income = price, not price + deposit
assert.strictEqual(L.sum(pays, '2026-10-05', '2026-10-05'), 20000);

// periods (2026-10-30 is a Friday)
const r = L.ranges('2026-10-30');
assert.deepStrictEqual(r.week, ['2026-10-25', '2026-10-31']);
assert.deepStrictEqual(r.month, ['2026-10-01', '2026-10-31']);
assert.strictEqual(L.monthEnd('2028-02-10'), '2028-02-29');
assert.strictEqual(L.addMonths('2026-01-31', 1), '2026-02-01');
const wk = L.buckets('weekly', '2026-10-30');
assert.strictEqual(wk.length, 12);
assert.strictEqual(wk[11].from, '2026-10-25');
assert.strictEqual(L.buckets('monthly', '2026-10-30')[0].from, '2025-11-01');
assert.deepStrictEqual(L.series([{ date: '2026-10-26', amount: 100 }, { date: '2026-10-01', amount: 7 }], wk.slice(-1)), [100]);
assert.deepStrictEqual(L.groupBy([{ c: 'a', amount: 1, date: '2026-01-01' }, { c: 'b', amount: 5, date: '2026-01-01' }, { c: 'a', amount: 2, date: '2026-01-01' }], x => x.c, '2026-01-01', '2026-01-01'), [['b', 5], ['a', 3]]);

// CSV import
const csv = 'Client Name,Date,Time,Service,Price,Notes\r\n"Doe, Jane",11/02/2026,2:30 PM,Knotless braids,$180,"Wants ""boho"" ends"\nBob,2026-11-03,10:00,Silk press,85,\n,,,,,\n';
const rows = L.mapCSV(L.parseCSV(csv));
assert.strictEqual(rows.length, 2);
assert.deepStrictEqual(rows[0], { name: 'Doe, Jane', date: '2026-11-02', time: '14:30', service: 'Knotless braids', price: 18000, notes: 'Wants "boho" ends' });
assert.strictEqual(rows[1].time, '10:00');
assert.strictEqual(L.normTime('12:15 am'), '00:15');
assert.strictEqual(L.normTime('12:00 PM'), '12:00');

// ICS import (floating local time, with a folded line)
const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20261106T140000\r\nSUMMARY:Sarah - 26 inch\r\n  buss down\r\nDESCRIPTION:Bring frontal\\, glue\r\nEND:VEVENT\r\nEND:VCALENDAR';
const ev = L.parseICS(ics);
assert.strictEqual(ev.length, 1);
assert.strictEqual(ev[0].date, '2026-11-06');
assert.strictEqual(ev[0].time, '14:00');
assert.strictEqual(ev[0].name, 'Sarah - 26 inch buss down');
assert.strictEqual(ev[0].notes, 'Bring frontal, glue');
assert.strictEqual(L.time12('14:30'), '2:30 PM');
assert.strictEqual(L.time12('09:00'), '9 AM');

console.log('All tests passed');
