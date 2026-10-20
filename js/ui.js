/* اجزای رابط کاربری: مودال، فرم‌ساز، جدول، تقویم شمسی، مسیریاب */
'use strict';
LD.ui = (() => {
  const h = LD.h;

  /* ---- آیکن‌ها (stroke) ---- */
  const ICONS = {
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    wallet: 'M3 7h18v13H3zM3 7l3-4h12l3 4M16 13h2',
    cheque: 'M3 6h18v12H3zM7 10h6M7 14h10',
    box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    cup: 'M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5zM17 10h2a2 2 0 010 4h-2M8 2v3M12 2v3',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    bulb: 'M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z',
    vault: 'M4 4h16v16H4zM12 9a3 3 0 100 6 3 3 0 000-6zM12 9V7M12 17v-2',
    report: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8',
    gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
    plus: 'M12 5v14M5 12h14',
    mic: 'M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v3',
    folder: 'M3 7h6l2 2h10v11H3z',
    users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
    asset: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z',
    bell: 'M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
    project: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
    sync: 'M21 12a9 9 0 01-15 6.7L3 16M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M3 21v-5h5',
    print: 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z',
    menu: 'M3 6h18M3 12h18M3 18h18',
    x: 'M18 6L6 18M6 6l12 12',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
    money: 'M2 6h20v12H2zM12 15a3 3 0 100-6 3 3 0 000 6zM6 12h.01M18 12h.01',
  };
  const icon = (name, size = 20) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('class', 'ic');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', ICONS[name] || ''); s.appendChild(p);
    return s;
  };

  /* ---- مودال ---- */
  const modalStack = [];
  function modal({ title, body, actions = [], wide = false, onClose }) {
    const box = h('div.modal' + (wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true' },
      h('div.modal-head', h('h3', title), h('button.icon-btn', { 'aria-label': 'بستن', onclick: () => close() }, icon('x'))),
      h('div.modal-body', body),
      actions.length ? h('div.modal-foot', actions) : null);
    const back = h('div.modal-back', box);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    document.body.appendChild(back);
    modalStack.push(back);
    setTimeout(() => { const f = box.querySelector('input:not([type=hidden]),select,textarea'); if (f && window.innerWidth > 700) f.focus(); }, 30);
    function close() { back.remove(); modalStack.splice(modalStack.indexOf(back), 1); LD.chart.hideTip(); onClose && onClose(); }
    return { close, box };
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].querySelector('.modal-head button').click(); });

  const confirm = (msg, okLabel = 'تأیید', danger = true) => new Promise((res) => {
    let m; const done = (v) => { m.close(); res(v); };
    m = modal({ title: 'تأیید', body: h('p', msg), actions: [h('button.btn', { onclick: () => done(false) }, 'انصراف'), h('button.btn' + (danger ? '.danger' : '.primary'), { onclick: () => done(true) }, okLabel)], onClose: () => res(false) });
  });

  const askPassword = (msg) => new Promise((res, rej) => {
    const inp = h('input', { type: 'password', autocomplete: 'current-password' });
    let m; const ok = () => { m.close(); res(inp.value); };
    inp.addEventListener('keydown', (e) => e.key === 'Enter' && ok());
    m = modal({ title: 'رمز عبور', body: [h('p', msg), inp], actions: [h('button.btn.primary', { onclick: ok }, 'تأیید')], onClose: () => rej(new Error('لغو شد')) });
  });

  /* ---- تقویم شمسی بازشو ---- */
  function datePicker(input, onPick) {
    const cur = LD.J.parse(input.value) || LD.todayISO();
    let { jy, jm } = LD.J.toJalali(cur);
    const pop = h('div.datepop');
    const draw = () => {
      pop.innerHTML = '';
      const first = LD.J.toISO(jy, jm, 1), wd = (new Date(first + 'T12:00:00').getDay() + 1) % 7; // شنبه = 0
      const today = LD.todayISO(), sel = LD.J.parse(input.value);
      pop.append(
        h('div.dp-head',
          h('button.icon-btn', { type: 'button', onclick: () => { jm++; if (jm > 12) { jm = 1; jy++; } draw(); } }, '›'),
          h('b', LD.J.MONTHS[jm - 1] + ' ' + LD.faNum(jy)),
          h('button.icon-btn', { type: 'button', onclick: () => { jm--; if (jm < 1) { jm = 12; jy--; } draw(); } }, '‹')),
        h('div.dp-grid', ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((d) => h('span.dp-wd', d)),
          Array.from({ length: wd }, () => h('span')),
          Array.from({ length: LD.J.monthLength(jy, jm) }, (_, i) => {
            const iso = LD.J.toISO(jy, jm, i + 1);
            return h('button.dp-day' + (iso === today ? '.today' : '') + (iso === sel ? '.sel' : ''), { type: 'button', onclick: () => { input.value = LD.J.fmt(iso).replace(/[۰-۹]/g, (x) => x); onPick(iso); close(); } }, LD.faNum(i + 1));
          })),
        h('div.dp-foot', h('button.btn.sm', { type: 'button', onclick: () => { input.value = LD.J.fmt(today); onPick(today); close(); } }, 'امروز'), h('button.btn.sm', { type: 'button', onclick: () => { input.value = ''; onPick(''); close(); } }, 'پاک کردن')));
    };
    const close = () => { pop.remove(); document.removeEventListener('mousedown', outside, true); };
    const outside = (e) => { if (!pop.contains(e.target) && e.target !== input) close(); };
    draw();
    input.parentElement.appendChild(pop);
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
  }

  /* ---- فرم‌ساز ---- */
  function resolveOptions(f, val) {
    let opts = typeof f.options === 'function' ? f.options(val) : f.options;
    if (f.ref) {
      let rows = LD.db.list(f.ref);
      if (f.filter) rows = rows.filter((r) => f.filter(r, val));
      opts = rows.map((r) => [r.id, r.name || r.title]);
    }
    return opts || [];
  }

  function buildField(f, val, onChange) {
    const v = val[f.k];
    const set = (x) => { val[f.k] = x; onChange(f.k); };
    let input;
    switch (f.type) {
      case 'textarea': input = h('textarea', { rows: f.rows || 3, value: v || '', oninput: (e) => set(e.target.value) }); break;
      case 'money': case 'number': {
        const hint = h('small.hint');
        const showHint = (n) => { hint.textContent = f.type === 'money' && n ? LD.money(n, true) + ' تومان' : ''; };
        input = h('input', { type: 'text', inputMode: 'decimal', value: v ? LD.fmt(v, 3) : '', placeholder: f.placeholder || '' });
        input.addEventListener('input', () => {
          const n = LD.parseNum(input.value); set(input.value.trim() === '' ? '' : n); showHint(n);
          if (f.type === 'money') { const pos = input.value.length - input.selectionStart; const raw = LD.enNum(input.value).replace(/[^\d.]/g, ''); if (raw && !raw.endsWith('.')) { input.value = LD.fmt(Number(raw), 3); input.selectionStart = input.selectionEnd = Math.max(0, input.value.length - pos); } }
        });
        showHint(v);
        return wrap(f, input, hint);
      }
      case 'date': {
        input = h('input.date-input', { type: 'text', inputMode: 'numeric', value: v ? LD.J.fmt(v) : '', placeholder: '۱۴۰۵/۰۱/۰۱', autocomplete: 'off' });
        input.addEventListener('input', () => { const iso = LD.J.parse(input.value); input.classList.toggle('invalid', !!input.value && !iso); set(iso || ''); });
        input.addEventListener('focus', () => datePicker(input, (iso) => set(iso)));
        break;
      }
      case 'select': case 'ref': {
        input = h('select', { onchange: (e) => set(e.target.value) });
        const fill = () => {
          const opts = resolveOptions(f, val); input.innerHTML = '';
          if (!f.required || f.empty) input.append(h('option', { value: '' }, f.empty || '—'));
          opts.forEach(([k, l]) => input.append(h('option', { value: k, selected: String(val[f.k] ?? '') === String(k) }, l)));
          if (f.required && !val[f.k] && opts.length && !f.empty) { val[f.k] = opts[0][0]; }
          if (val[f.k] && !opts.some(([k]) => String(k) === String(val[f.k])) && f.ref) { val[f.k] = f.required && opts[0] ? opts[0][0] : ''; input.value = val[f.k]; }
        };
        fill(); input._refill = fill;
        break;
      }
      case 'bool': input = h('label.switch', h('input', { type: 'checkbox', checked: !!v, onchange: (e) => set(e.target.checked) }), h('span', f.text || '')); break;
      case 'rating': {
        input = h('div.rating', Array.from({ length: 5 }, (_, i) => h('button' + ((v || 0) > i ? '.on' : ''), { type: 'button', 'aria-label': i + 1, onclick: (e) => { set(i + 1); [...e.target.parentElement.children].forEach((b, j) => b.classList.toggle('on', j <= i)); } }, LD.faNum(i + 1))));
        break;
      }
      case 'tags': input = h('input', { type: 'text', value: (v || []).join('، '), placeholder: 'با ویرگول جدا کنید', oninput: (e) => set(e.target.value.split(/[,،]/).map((s) => s.trim()).filter(Boolean)) }); break;
      case 'list': {
        const rows = (val[f.k] = (v || []).map((x) => Object.assign({}, x)));
        const box = h('div.sublist');
        const draw = () => {
          box.innerHTML = '';
          rows.forEach((r, i) => box.append(h('div.sub-row', f.fields.map((sf) => { const fe = buildField(Object.assign({}, sf, { compact: true }), r, () => onChange(f.k)); fe.classList.add('sub-f'); return fe; }),
            h('button.icon-btn', { type: 'button', 'aria-label': 'حذف', onclick: () => { rows.splice(i, 1); draw(); onChange(f.k); } }, icon('trash', 16)))));
          box.append(h('button.btn.sm', { type: 'button', onclick: () => { rows.push(Object.assign({ id: LD.uid() }, f.newRow ? f.newRow() : {})); draw(); } }, '+ ' + (f.addLabel || 'افزودن')));
        };
        draw();
        return wrap(f, box);
      }
      default: input = h('input', { type: f.inputType || 'text', value: v ?? '', placeholder: f.placeholder || '', autocomplete: f.autocomplete || 'off', oninput: (e) => set(e.target.value) });
        if (f.datalist) { const id = 'dl' + LD.uid(); input.setAttribute('list', id); input.after && setTimeout(() => input.parentElement.append(h('datalist', { id }, f.datalist().map((x) => h('option', { value: x })))), 0); }
    }
    return wrap(f, input);
  }
  function wrap(f, input, hint) {
    const mic = (f.voice !== false && ['text', undefined, 'textarea'].includes(f.type) && !f.compact) ? LD.voice.micButton(input) : null;
    const el = h('label.field' + (f.half ? '.half' : '') + (f.type === 'list' ? '.full' : ''), h('span.lbl', f.label + (f.required ? ' *' : '')), h('div.inp' + (mic ? '.has-mic' : ''), input, mic), hint || null);
    el.dataset.k = f.k; el._input = input;
    if (f.compact) el.querySelector('.lbl').classList.add('sr');
    return el;
  }

  /* form({title, fields, value, onSave(val), onDelete, extra}) */
  function form({ title, fields, value = {}, onSave, onDelete, extra, wide }) {
    const val = JSON.parse(JSON.stringify(value));
    fields.forEach((f) => { if (val[f.k] === undefined && f.def !== undefined) val[f.k] = typeof f.def === 'function' ? f.def(val) : f.def; });
    const box = h('div.form-grid');
    const els = {};
    const refresh = (changedKey) => {
      fields.forEach((f) => {
        const el = els[f.k];
        if (f.show) el.style.display = f.show(val) ? '' : 'none';
        if (changedKey && f.deps && f.deps.includes(changedKey) && el._input._refill) el._input._refill();
      });
    };
    fields.forEach((f) => { els[f.k] = buildField(f, val, (k) => refresh(k)); box.append(els[f.k]); });
    refresh();
    const err = h('p.err');
    let m;
    const save = async () => {
      for (const f of fields) {
        if (f.show && !f.show(val)) continue;
        if (f.required && (val[f.k] === undefined || val[f.k] === '' || val[f.k] === null)) { err.textContent = '«' + f.label + '» را وارد کنید'; els[f.k].scrollIntoView({ block: 'center' }); return; }
      }
      const r = await onSave(val);
      if (r !== false) m.close();
    };
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); });
    m = modal({
      title, wide, body: [box, extra ? extra(val) : null, err],
      actions: [
        onDelete ? h('button.btn.danger.ghost', { onclick: async () => { if (await confirm('این مورد حذف شود؟', 'حذف')) { onDelete(val); m.close(); } } }, 'حذف') : null,
        h('span.spacer'),
        h('button.btn', { onclick: () => m.close() }, 'انصراف'),
        h('button.btn.primary', { onclick: save }, 'ذخیره'),
      ],
    });
    return m;
  }

  /* ---- جدول پاسخ‌گو (روی موبایل کارت می‌شود) ---- */
  function table({ cols, rows, onRow, empty = 'هنوز موردی ثبت نشده', footer }) {
    if (!rows.length) return h('div.empty', empty);
    return h('div.table-wrap', h('table.tbl',
      h('thead', h('tr', cols.map((c) => h('th' + (c.num ? '.num' : ''), c.label)))),
      h('tbody', rows.map((r) => h('tr' + (onRow ? '.click' : ''), { onclick: onRow ? () => onRow(r) : null },
        cols.map((c) => { const v = c.get(r); return h('td' + (c.num ? '.num' : '') + (c.cls ? '.' + c.cls(r) : ''), { 'data-label': c.label }, v instanceof Node ? v : (v ?? '—')); })))),
      footer ? h('tfoot', h('tr', cols.map((c) => h('td' + (c.num ? '.num' : ''), footer[c.label] ?? '')))) : null));
  }

  const kpi = (label, value, sub, cls = '') => h('div.kpi' + (cls ? '.' + cls : ''), h('span.kpi-l', label), h('b.kpi-v', value), sub ? h('span.kpi-s', sub) : null);
  const card = (title, body, actions) => h('section.card', title ? h('div.card-head', h('h3', title), actions || null) : null, h('div.card-body', body));
  const badge = (text, kind = '') => h('span.badge' + (kind ? '.' + kind : ''), text);
  const unitColor = (id) => { const u = LD.db.get('units', id); return LD.chart.S(((u && u.color) || 1) - 1); };

  /* ---- مسیریاب ---- */
  const router = {
    pages: {},
    current: null,
    go(path) { location.hash = '#/' + path; },
    refresh() { this.render(); },
    render() {
      if (!LD.state.data) return;
      const [name, ...rest] = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
      const page = this.pages[name] || this.pages.dashboard;
      this.current = name;
      const main = document.getElementById('main');
      main.innerHTML = '';
      document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
      document.getElementById('page-title').textContent = page.title;
      document.title = page.title + ' — داشبورد زندگی';
      LD.chart.hideTip();
      try { page.render(main, rest.map(decodeURIComponent)); } catch (e) { console.error(e); main.append(h('div.empty.err', 'خطا در نمایش صفحه: ' + e.message)); }
      main.focus({ preventScroll: true });
      document.body.classList.remove('nav-open');
      window.scrollTo(0, 0);
    },
  };
  window.addEventListener('hashchange', () => router.render());
  LD.router = router;

  /* انتخابگر واحد (فیلتر سراسری) */
  const unitSel = (value, onchange, withAll = true) => h('div.seg', [withAll ? ['all', 'همه'] : null, ...LD.db.list('units').map((u) => [u.id, u.name])].filter(Boolean)
    .map(([id, n]) => h('button' + (value === id ? '.on' : ''), { type: 'button', onclick: () => onchange(id) }, id !== 'all' ? h('i.dot', { style: { background: unitColor(id) } }) : null, n)));

  return { icon, modal, confirm, askPassword, form, table, kpi, card, badge, unitColor, unitSel, datePicker };
})();
