/* ابزارهای عمومی */
'use strict';
window.LD = window.LD || {};

/* append/prepend مقادیر null/false را نادیده بگیرد (به‌جای درج متن «null») */
['append', 'prepend'].forEach((fn) => {
  const orig = Element.prototype[fn];
  Element.prototype[fn] = function (...a) { return orig.apply(this, a.filter((x) => x !== null && x !== undefined && x !== false)); };
});
/* عدد منفی را در جهت چپ‌به‌راست ایزوله می‌کند تا علامت منفی جابه‌جا نشود */
LD.ltr = (s) => '⁦' + s + '⁩';

LD.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
LD.now = () => new Date().toISOString();
LD.todayISO = () => LD.isoOf(new Date());
LD.isoOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
LD.addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return LD.isoOf(d); };
LD.daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹', AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
LD.faNum = (s) => String(s).replace(/\d/g, (d) => FA_DIGITS[d]);
LD.enNum = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d)).replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d));
LD.normalize = (s) => LD.enNum(String(s ?? '')).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').replace(/\s+/g, ' ').trim();

/* عدد با جداکننده هزارگان */
LD.fmt = (n, dec = 0) => {
  if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
  return LD.faNum(Number(n).toLocaleString('en-US', { maximumFractionDigits: dec, minimumFractionDigits: 0 }));
};
/* مبلغ کوتاه: ۱٫۲ میلیون، ۳٫۴ میلیارد */
LD.money = (n, short = false) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const a = Math.abs(n), neg = n < 0;
  const sg = (s) => neg ? LD.ltr('−' + s) : s;
  if (short) {
    if (a >= 1e9) return sg(LD.fmt(a / 1e9, 2)) + ' میلیارد';
    if (a >= 1e6) return sg(LD.fmt(a / 1e6, 1)) + ' میلیون';
    if (a >= 1e3) return sg(LD.fmt(a / 1e3, 0)) + ' هزار';
  }
  return sg(LD.fmt(a));
};
LD.parseNum = (s) => { const v = parseFloat(LD.enNum(s).replace(/[,٬\s]/g, '')); return isNaN(v) ? 0 : v; };
LD.pct = (n) => (n === null || !isFinite(n)) ? '—' : (n < -0.005 ? LD.ltr('−' + LD.faNum(Math.abs(n * 100).toFixed(0)) + '٪') : LD.faNum(Math.abs(n * 100).toFixed(0)) + '٪');

LD.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ساخت سریع DOM: h('div.cls#id', {attrs}, ...children) */
LD.h = (sel, attrs, ...kids) => {
  const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m[1] || 'div');
  (m[2].match(/[.#][\w-]+/g) || []).forEach((p) => p[0] === '.' ? el.classList.add(p.slice(1)) : (el.id = p.slice(1)));
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list' && k !== 'type') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
};

LD.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
LD.groupBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); (m[k] = m[k] || []).push(x); return m; }, {});
LD.sum = (arr, fn = (x) => x) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);

LD.toast = (msg, kind = '') => {
  const t = LD.h('div.toast' + (kind ? '.' + kind : ''), msg);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3200);
};

/* IndexedDB کوچک برای کش و نگهداری handle پوشه */
LD.idb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('lifedashboard', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  async del(k) { const db = await this.open(); return new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); }); },
};

LD.downloadFile = (name, content, type = 'text/plain') => {
  const a = LD.h('a', { href: URL.createObjectURL(new Blob([content], { type })), download: name });
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};
