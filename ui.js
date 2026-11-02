'use strict';
// Reusable UI pieces: searchable dropdown, time wheel, skeletons and page motion.
// The pickers upgrade a native <select> / <input type="time"> in place. The native element stays the
// source of truth (form values, existing listeners, programmatic `.value = x`), so no page code changes.

const UI = (() => {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
  let openPop = null; // only one popover at a time

  // Keep the custom button in sync when code sets `el.value = ...` directly.
  function watchValue(el, proto, sync) {
    const d = Object.getOwnPropertyDescriptor(proto, 'value');
    Object.defineProperty(el, 'value', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); sync(); } });
  }
  const commit = (el, v, setter) => { setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };

  function close() {
    if (!openPop) return;
    const { pop, btn, onClose } = openPop; openPop = null;
    pop.remove(); btn.setAttribute('aria-expanded', 'false'); onClose?.();
  }
  // Popovers live on <body> (fixed) so sheets with overflow can't clip them.
  function place(pop, btn) {
    const r = btn.getBoundingClientRect(), below = innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < 260 && above > below, room = Math.max(160, up ? above : below);
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - Math.max(r.width, 260) - 8)) + 'px';
    pop.style.width = Math.max(r.width, 260) + 'px';
    pop.style.maxHeight = Math.min(room, 380) + 'px';
    pop.style.top = up ? '' : r.bottom + 6 + 'px';
    pop.style.bottom = up ? innerHeight - r.top + 6 + 'px' : '';
  }
  function show(btn, pop, onClose) {
    close();
    document.body.append(pop); place(pop, btn);
    btn.setAttribute('aria-expanded', 'true');
    openPop = { pop, btn, onClose };
  }
  document.addEventListener('pointerdown', e => { if (openPop && !openPop.pop.contains(e.target) && !openPop.btn.contains(e.target)) close(); }, true);
  addEventListener('resize', close);
  document.addEventListener('scroll', e => { if (openPop && !openPop.pop.contains(e.target)) place(openPop.pop, openPop.btn); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openPop) { e.stopPropagation(); const b = openPop.btn; close(); b.focus(); } }, true);

  // ---------- searchable dropdown ----------
  const SEL_VALUE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  function Select(sel) {
    const wrap = document.createElement('div'), btn = document.createElement('button');
    wrap.className = 'dd'; btn.type = 'button'; btn.className = 'input dd-btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    const label = sel.getAttribute('aria-label') || sel.closest('label')?.querySelector(':scope > span')?.textContent;
    if (label) btn.setAttribute('aria-label', label);
    if (sel.style.width) wrap.style.width = sel.style.width;
    sel.before(wrap); wrap.append(btn, sel);
    sel.classList.add('ui-native'); sel.tabIndex = -1; sel.dataset.ui = '1';
    const text = o => o?.textContent.trim() || '';
    const sync = () => { const o = sel.selectedOptions[0]; btn.innerHTML = `<span class="dd-val ${o && o.value ? '' : 'dd-ph'}">${esc(text(o) || 'Choose…')}</span>${icon('down')}`; };
    watchValue(sel, HTMLSelectElement.prototype, sync);
    sel.addEventListener('change', sync);
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true }); // options rebuilt by page code
    sync();

    btn.addEventListener('click', () => (openPop?.btn === btn ? close() : open()));
    btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });

    function open() {
      const opts = [...sel.options], searchable = opts.length > 7;
      const pop = document.createElement('div');
      pop.className = 'pop dd-pop';
      pop.innerHTML = `${searchable ? `<label class="dd-search">${icon('search')}<input type="search" placeholder="Search…" aria-label="Search options" autocomplete="off"></label>` : ''}<div class="dd-list" role="listbox"></div>`;
      const list = pop.querySelector('.dd-list'), q = pop.querySelector('input');
      let active = -1, shown = [];
      const draw = () => {
        const term = (q?.value || '').trim().toLowerCase();
        let html = '', lastGroup = null;
        shown = opts.filter(o => !term || text(o).toLowerCase().includes(term) || (o.parentElement.label || '').toLowerCase().includes(term));
        shown.forEach((o, i) => {
          const g = o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : '';
          if (g !== lastGroup) { if (g) html += `<div class="dd-group">${esc(g)}</div>`; lastGroup = g; }
          const [name, aside] = text(o).split(' — ');
          const mark = s => (term ? esc(s).replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), m => `<mark>${m}</mark>`) : esc(s));
          html += `<div class="dd-opt ${o.selected ? 'on' : ''}" role="option" aria-selected="${o.selected}" data-i="${i}"><span>${mark(name)}</span>${aside ? `<small>${esc(aside)}</small>` : ''}${o.selected ? icon('check') : ''}</div>`;
        });
        list.innerHTML = html || `<div class="empty sm">${icon('search')}<p class="empty-title">No matches</p><p class="empty-hint">Try a shorter word.</p></div>`;
        active = Math.max(0, shown.findIndex(o => o.selected)); hi();
      };
      const hi = (scroll = true) => { list.querySelectorAll('.dd-opt').forEach(el => el.classList.toggle('hi', +el.dataset.i === active)); if (scroll) list.querySelector('.dd-opt.hi')?.scrollIntoView({ block: 'nearest' }); };
      const pick = i => { const o = shown[i]; if (!o) return; close(); if (!o.selected) commit(sel, o.value, SEL_VALUE); btn.focus(); };
      list.addEventListener('click', e => { const el = e.target.closest('.dd-opt'); if (el) pick(+el.dataset.i); });
      list.addEventListener('pointermove', e => { const el = e.target.closest('.dd-opt'); if (el && +el.dataset.i !== active) { active = +el.dataset.i; hi(false); } });
      pop.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, Math.min(shown.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1))); hi(); }
        if (e.key === 'Enter') { e.preventDefault(); pick(active); }
        if (e.key === 'Tab') close();
      });
      q?.addEventListener('input', draw);
      draw();
      show(btn, pop);
      (q || list).focus?.({ preventScroll: true });
      if (!q) { list.tabIndex = -1; list.focus(); }
    }
  }

  // ---------- time wheel ----------
  const TIME_VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const ROW = 40; // px per wheel row (matches CSS --tw-row)
  function TimeWheel(inp) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'input dd-btn tw-btn'; btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
    const label = inp.getAttribute('aria-label') || inp.closest('label')?.querySelector(':scope > span')?.textContent;
    if (label) btn.setAttribute('aria-label', label);
    inp.after(btn); inp.classList.add('ui-native'); inp.tabIndex = -1; inp.dataset.ui = '1';
    inp.dataset.required = inp.required ? '1' : ''; inp.required = false; // the native box is hidden, so the page validates it
    const sync = () => { btn.innerHTML = `${icon('clock')}<span class="dd-val ${inp.value ? '' : 'dd-ph'}">${inp.value ? L.time12(inp.value) : 'Pick a time'}</span>${icon('down')}`; };
    watchValue(inp, HTMLInputElement.prototype, sync); inp.addEventListener('change', sync); sync();
    btn.addEventListener('click', () => (openPop?.btn === btn ? close() : open()));

    function open() {
      const [h24, m] = (inp.value || '10:00').split(':').map(Number);
      const mins = [...Array(12)].map((_, i) => i * 5); if (!mins.includes(m)) mins.push(m), mins.sort((a, b) => a - b);
      const cols = [
        { key: 'h', items: [...Array(12)].map((_, i) => i + 1), sel: h24 % 12 || 12, fmt: v => v },
        { key: 'm', items: mins, sel: m, fmt: v => String(v).padStart(2, '0') },
        { key: 'ap', items: ['AM', 'PM'], sel: h24 < 12 ? 'AM' : 'PM', fmt: v => v },
      ];
      const pop = document.createElement('div');
      pop.className = 'pop tw-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Pick a time');
      const colHtml = cols.map(c => `<div class="tw-col" data-k="${c.key}" tabindex="0" role="listbox" aria-label="${c.key === 'h' ? 'Hour' : c.key === 'm' ? 'Minutes' : 'AM or PM'}">${c.items.map(v => `<div class="tw-item" role="option">${c.fmt(v)}</div>`).join('')}</div>`);
      pop.innerHTML = `<div class="tw">${colHtml[0]}<span class="tw-colon">:</span>${colHtml[1]}${colHtml[2]}
        <div class="tw-band" aria-hidden="true"></div><div class="tw-blur top" aria-hidden="true"></div><div class="tw-blur bottom" aria-hidden="true"></div></div>
        <div class="tw-actions">${inp.dataset.required ? '' : '<button type="button" class="btn sm ghost" data-tw="clear">Clear</button>'}<button type="button" class="btn sm dark" data-tw="done">Done</button></div>`;
      const colEls = [...pop.querySelectorAll('.tw-col')];
      const idx = col => Math.max(0, Math.min(col.children.length - 1, Math.round(col.scrollTop / ROW)));
      const mark = col => [...col.children].forEach((el, i) => { const on = i === idx(col); el.classList.toggle('on', on); el.setAttribute('aria-selected', on); });
      const value = () => {
        const [hc, mc, ac] = colEls, h = cols[0].items[idx(hc)], mm = cols[1].items[idx(mc)], pm = cols[2].items[idx(ac)] === 'PM';
        return String((h % 12) + (pm ? 12 : 0)).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      };
      const save = () => { const v = value(); if (v !== inp.value) commit(inp, v, TIME_VALUE); };
      show(btn, pop);
      colEls.forEach((col, ci) => {
        col.scrollTop = cols[ci].items.indexOf(cols[ci].sel) * ROW; mark(col);
        let t;
        col.addEventListener('scroll', () => { mark(col); clearTimeout(t); t = setTimeout(save, 120); }, { passive: true });
        col.addEventListener('click', e => { const el = e.target.closest('.tw-item'); if (el) col.scrollTo({ top: [...col.children].indexOf(el) * ROW, behavior: REDUCED.matches ? 'auto' : 'smooth' }); });
        col.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); col.scrollTo({ top: (idx(col) + (e.key === 'ArrowDown' ? 1 : -1)) * ROW }); } });
      });
      pop.addEventListener('click', e => {
        const a = e.target.closest('[data-tw]')?.dataset.tw; if (!a) return;
        if (a === 'clear') commit(inp, '', TIME_VALUE); else save();
        close(); btn.focus();
      });
      colEls[0].focus({ preventScroll: true });
    }
  }

  // Upgrade every picker inside `root` (cheap: only untouched elements match).
  function enhance(root = document) {
    root.querySelectorAll?.('select.input:not([data-ui])').forEach(Select);
    root.querySelectorAll?.('input.input[type=time]:not([data-ui])').forEach(TimeWheel);
  }
  new MutationObserver(muts => { if (muts.some(m => m.addedNodes.length)) enhance(); }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------- skeletons + motion ----------
  const bar = (w, h = 14) => `<div class="sk" style="width:${w};height:${h}px"></div>`;
  const skCard = (lines = 3, h) => `<div class="card sk-card">${bar('38%', 20)}${h ? `<div class="sk" style="height:${h}px;margin-top:16px"></div>` : [...Array(lines)].map((_, i) => `<div class="sk-row"><div class="sk sk-dot"></div><div style="flex:1">${bar(70 - i * 9 + '%')}${bar(40 + i * 7 + '%', 11)}</div></div>`).join('')}</div>`;
  const SKELETON = {
    stats: () => `<div class="grid cards-6">${[...Array(6)].map(() => `<div class="card sk-card">${bar('55%', 12)}${bar('45%', 28)}${bar('35%', 11)}</div>`).join('')}</div>
      <div class="grid cols-2 mt">${skCard(0, 230)}${skCard(0, 230)}</div><div class="grid cols-2-even mt">${skCard()}${skCard()}</div>`,
    calendar: () => `<div class="row" style="margin-bottom:14px">${bar('320px', 40)}</div><div class="card sk-card">${bar('30%', 22)}<div class="sk" style="height:360px;margin-top:16px"></div></div>`,
    list: () => `<div class="row" style="margin-bottom:14px">${bar('260px', 40)}${bar('140px', 40)}</div>${skCard(5)}`,
  };
  const skeleton = kind => `<div class="skeleton" aria-busy="true" aria-label="Loading">${(SKELETON[kind] || SKELETON.list)()}</div>`;

  // Rise the page's top-level blocks in one after another.
  function cascade(view, skip) {
    if (REDUCED.matches) return;
    const blocks = [];
    for (const el of view.children) {
      if (el.matches('.grid, .stack')) blocks.push(...el.children); else blocks.push(el);
    }
    blocks.filter(el => !(skip && el.contains(skip))).forEach((el, i) => {
      el.style.setProperty('--i', Math.min(i, 10)); el.classList.add('rise');
      el.addEventListener('animationend', () => { el.classList.remove('rise'); el.style.removeProperty('--i'); }, { once: true });
    });
  }

  // Sliding pill for tabs: animate the active pill from where the old one was (FLIP).
  function slideTab(from, tabs) {
    const to = tabs?.querySelector('button.on');
    if (!from || !to || REDUCED.matches) return;
    const r = to.getBoundingClientRect();
    to.animate([{ transform: `translate(${from.left - r.left}px, ${from.top - r.top}px)`, width: from.width + 'px' }, { transform: 'none', width: r.width + 'px' }],
      { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::before' });
  }

  return { enhance, skeleton, cascade, slideTab, close, REDUCED };
})();
