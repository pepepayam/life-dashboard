/* صفحات اصلی: داشبورد، تراکنش‌ها، حساب‌ها، چک، وام و طلب، اشخاص، اطلاعات، یادآورها */
'use strict';
LD.pages = LD.router.pages;
(() => {
  const h = LD.h, ui = LD.ui, F = LD.fin, J = LD.J;
  const clean = (o) => { const r = {}; for (const k in o) if (o[k] !== undefined && o[k] !== null) r[k] = o[k]; return r; };

  /* واحد انتخاب‌شده سراسری */
  LD.unit = () => localStorage.getItem('ld.unit') || 'all';
  LD.setUnit = (u) => { localStorage.setItem('ld.unit', u); LD.router.refresh(); };

  const units = () => LD.db.list('units').map((u) => [u.id, u.name]);
  const amountCell = (x) => h('span.amt.' + (x.type === 'income' ? 'pos' : x.type === 'expense' ? 'neg' : 'neu'), (x.type === 'income' ? '+' : x.type === 'expense' ? '−' : '') + LD.money(x.amount));
  const unitBadge = (id) => h('span.ubadge', h('i.dot', { style: { background: ui.unitColor(id) } }), F.unitName(id));

  /* بازه زمانی استاندارد */
  LD.periods = () => {
    const t = J.toJalali(LD.todayISO());
    const pm = t.jm === 1 ? [t.jy - 1, 12] : [t.jy, t.jm - 1];
    const q = Math.ceil(t.jm / 3);
    return [
      ['month', 'این ماه', J.monthRange(t.jy, t.jm)],
      ['prev', 'ماه قبل', J.monthRange(pm[0], pm[1])],
      ['quarter', 'این فصل', J.quarterRange(t.jy, q)],
      ['year', 'امسال', J.yearRange(t.jy)],
      ['lastyear', 'سال قبل', J.yearRange(t.jy - 1)],
      ['30', '۳۰ روز اخیر', [LD.addDays(LD.todayISO(), -29), LD.todayISO()]],
      ['all', 'همه', ['', '']],
    ];
  };
  LD.periodSelect = (value, onchange) => h('select.period', { onchange: (e) => onchange(e.target.value) }, LD.periods().map(([k, l]) => h('option', { value: k, selected: k === value }, l)));
  LD.periodRange = (k) => (LD.periods().find((p) => p[0] === k) || LD.periods()[0])[2];

  /* ---------- کارخانه صفحات CRUD ---------- */
  LD.crud = (o) => {
    const page = {
      title: o.title,
      edit(rec = {}) {
        rec = clean(rec);
        const isNew = !rec.id || !LD.db.get(o.col, rec.id);
        ui.form({
          title: (isNew ? 'افزودن ' : 'ویرایش ') + o.single, fields: o.fields(), wide: o.wide,
          value: Object.assign({}, o.defaults ? o.defaults() : {}, rec),
          onSave: (v) => {
            if (o.validate) { const e = o.validate(v); if (e) { LD.toast(e, 'warn'); return false; } }
            LD.db.put(o.col, v); o.afterSave && o.afterSave(v, isNew);
            LD.toast('ذخیره شد'); LD.router.refresh();
          },
          onDelete: isNew ? null : (v) => { LD.db.remove(o.col, v.id); LD.router.refresh(); },
          extra: o.extra,
        });
      },
      render(el, params) {
        if (o.render) return o.render(el, params, page);
        const q = h('input.search', { type: 'search', placeholder: 'جستجو…' });
        const listBox = h('div');
        const draw = () => {
          let rows = LD.db.list(o.col);
          if (o.unitField && LD.unit() !== 'all') rows = rows.filter((r) => r[o.unitField] === LD.unit());
          if (q.value) { const s = LD.normalize(q.value); rows = rows.filter((r) => LD.normalize(JSON.stringify(r)).includes(s)); }
          if (o.sort) rows = rows.slice().sort(o.sort);
          listBox.innerHTML = '';
          if (o.summary) listBox.append(o.summary(rows));
          listBox.append(ui.table({ cols: o.cols, rows, onRow: (r) => page.edit(r), empty: o.empty }));
        };
        q.addEventListener('input', LD.debounce(draw, 200));
        el.append(h('div.toolbar', o.unitField ? ui.unitSel(LD.unit(), LD.setUnit) : null, q, h('span.spacer'), o.tools ? o.tools() : null, h('button.btn.primary', { onclick: () => page.edit() }, ui.icon('plus', 16), ' ' + o.single)), o.intro ? h('p.muted.small', o.intro) : null, listBox);
        draw();
      },
    };
    return page;
  };

  /* ---------- داشبورد ---------- */
  LD.pages.dashboard = {
    title: 'داشبورد',
    render(el) {
      const unit = LD.unit();
      const t = J.toJalali(LD.todayISO());
      const [mf, mt] = J.monthRange(t.jy, t.jm);
      const pm = t.jm === 1 ? J.monthRange(t.jy - 1, 12) : J.monthRange(t.jy, t.jm - 1);
      const cur = F.pnl({ from: mf, to: mt, unitId: unit }), prev = F.pnl({ from: pm[0], to: pm[1], unitId: unit });
      const delta = (a, b) => b ? ((a - b) / Math.abs(b)) : null;
      const dl = (a, b, goodUp = true) => { const d = delta(a, b); if (d === null) return 'ماه قبل: ' + LD.money(b, true); return (d >= 0 ? '▲ ' : '▼ ') + LD.pct(Math.abs(d)) + ' نسبت به ماه قبل'; };
      const bs = unit === 'all' ? F.balanceSheet() : null;

      el.append(
        h('div.toolbar', ui.unitSel(unit, LD.setUnit), h('span.spacer'),
          h('button.btn', { onclick: () => LD.voice.quickVoice() }, ui.icon('mic', 16), ' ثبت صوتی'),
          h('button.btn.primary', { onclick: () => LD.pages.transactions.edit({ unitId: unit === 'all' ? 'personal' : unit }) }, ui.icon('plus', 16), ' تراکنش')),
        h('div.kpis',
          ui.kpi('موجودی نقد و حساب‌ها', LD.money(F.accountsTotal(unit), true), 'تومان'),
          ui.kpi('درآمد ' + J.MONTHS[t.jm - 1], LD.money(cur.income, true), dl(cur.income, prev.income)),
          ui.kpi('هزینه ' + J.MONTHS[t.jm - 1], LD.money(cur.expense, true), dl(cur.expense, prev.expense)),
          ui.kpi('سود خالص ماه', LD.money(cur.net, true), dl(cur.net, prev.net), cur.net >= 0 ? 'good' : 'bad'),
          bs ? ui.kpi('ارزش خالص (دارایی − بدهی)', LD.money(bs.net, true), 'دارایی ' + LD.money(bs.totalA, true) + ' / بدهی ' + LD.money(bs.totalL, true)) : null));

      const grid = h('div.grid2');
      el.append(grid);
      const trend = h('div');
      grid.append(ui.card('روند ۱۲ ماه اخیر', trend));
      const up = F.upcoming(30).filter((x) => unit === 'all' || true);
      grid.append(ui.card('سررسیدها و یادآورهای ۳۰ روز آینده', up.length ? h('ul.agenda', up.slice(0, 12).map((x) => h('li' + (x.overdue ? '.overdue' : ''), { onclick: () => LD.router.go(x.link) },
        h('span.ag-date', J.fmt(x.date)), ui.badge(x.kind, x.overdue ? 'bad' : ''), h('span.ag-title', x.title), x.amount ? h('span.amt.' + (x.sign > 0 ? 'pos' : x.sign < 0 ? 'neg' : 'neu'), LD.money(x.amount, true)) : null))) : h('p.muted', 'موردی در ۳۰ روز آینده نیست 👌')));

      if (unit === 'all') {
        const uc = h('div.unit-cards');
        for (const u of LD.db.list('units')) {
          const p = F.pnl({ from: mf, to: mt, unitId: u.id });
          const m6 = F.monthly({ unitId: u.id }, J.lastMonths(6));
          uc.append(h('div.unit-card', { onclick: () => LD.setUnit(u.id), style: { borderTopColor: ui.unitColor(u.id) } },
            h('b', u.name), h('span.muted.small', 'سود این ماه'), h('span.amt.big.' + (p.net >= 0 ? 'pos' : 'neg'), LD.money(p.net, true)),
            h('span.small', 'درآمد ' + LD.money(p.income, true) + ' · هزینه ' + LD.money(p.expense, true)),
            LD.chart.spark(m6.map((x) => x.net), ui.unitColor(u.id))));
        }
        el.append(ui.card('وضعیت واحدها (این ماه)', uc));
      }
      const g2 = h('div.grid2'); el.append(g2);
      const cat = h('div');
      g2.append(ui.card('ریز هزینه‌های این ماه', cat));
      const projs = LD.db.list('projects').filter((p) => p.status !== 'done' && p.status !== 'dropped' && (unit === 'all' || p.unitId === unit));
      g2.append(ui.card('پروژه‌های فعال', projs.length ? h('div.mini-projects', projs.slice(0, 6).map((p) => { const s = F.projectStats(p); return h('div.mini-proj', { onclick: () => LD.router.go('projects/' + p.id) }, h('div.mp-top', h('b', p.name), h('span.small', LD.pct(s.progress))), h('div.progress', h('span', { style: { width: (s.progress * 100) + '%' } })), h('span.small.muted', 'سرمایه ' + LD.money(s.invested, true) + ' · بازگشت ' + LD.money(s.returned, true))); })) : h('p.muted', 'پروژهٔ فعالی ثبت نشده'), h('a.link', { href: '#/projects' }, 'همه پروژه‌ها ←')));

      requestAnimationFrame(() => {
        const m = F.monthly({ unitId: unit });
        LD.chart.bars(trend, { labels: m.map((x) => x.label), series: [{ name: 'درآمد', values: m.map((x) => x.income), color: 'var(--s1)' }, { name: 'هزینه', values: m.map((x) => x.expense), color: 'var(--s2)' }] });
        const byCat = LD.groupBy(cur.exp, (x) => x.categoryId || '');
        LD.chart.hbars(cat, { items: Object.entries(byCat).map(([k, arr]) => ({ label: F.catName(k), value: LD.sum(arr, (x) => x.amount) })), color: 'var(--s2)' });
      });
    },
  };

  /* ---------- تراکنش‌ها ---------- */
  const txFields = () => [
    { k: 'type', label: 'نوع', type: 'select', required: true, options: [['expense', 'هزینه / پرداخت'], ['income', 'درآمد / دریافت'], ['transfer', 'انتقال بین حساب‌ها']], half: true },
    { k: 'amount', label: 'مبلغ (تومان)', type: 'money', required: true, half: true },
    { k: 'date', label: 'تاریخ', type: 'date', required: true, def: LD.todayISO, half: true },
    { k: 'unitId', label: 'واحد', type: 'select', required: true, options: units, half: true },
    { k: 'categoryId', label: 'دسته', type: 'ref', ref: 'categories', filter: (c, v) => c.unitId === v.unitId && c.type === v.type, deps: ['unitId', 'type'], show: (v) => v.type !== 'transfer', half: true, empty: 'بدون دسته' },
    { k: 'accountId', label: 'حساب', type: 'ref', ref: 'accounts', filter: (a) => !a.archived, half: true, empty: 'نامشخص' },
    { k: 'toAccountId', label: 'به حساب', type: 'ref', ref: 'accounts', filter: (a) => !a.archived, show: (v) => v.type === 'transfer', half: true },
    { k: 'projectId', label: 'پروژه (اختیاری)', type: 'ref', ref: 'projects', half: true, empty: '—' },
    { k: 'personId', label: 'شخص / مشتری (اختیاری)', type: 'ref', ref: 'people', half: true, empty: '—' },
    { k: 'desc', label: 'شرح', type: 'text' },
    { k: 'tags', label: 'برچسب‌ها', type: 'tags' },
  ];
  const txPage = LD.crud({ col: 'transactions', title: 'تراکنش‌ها', single: 'تراکنش', fields: txFields, defaults: () => ({ type: 'expense', date: LD.todayISO(), unitId: LD.unit() === 'all' ? 'personal' : LD.unit() }) });
  txPage.render = (el) => {
    const st = JSON.parse(sessionStorage.getItem('ld.txf') || '{"period":"month","type":"","q":""}');
    const save = () => sessionStorage.setItem('ld.txf', JSON.stringify(st));
    const listBox = h('div');
    const q = h('input.search', { type: 'search', placeholder: 'جستجو در شرح و برچسب…', value: st.q });
    const draw = () => {
      const [from, to] = LD.periodRange(st.period);
      const rows = F.filter(F.flows(), { from, to, unitId: LD.unit(), type: st.type, q: st.q }).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
      const inc = LD.sum(rows.filter((x) => x.type === 'income'), (x) => x.amount), exp = LD.sum(rows.filter((x) => x.type === 'expense'), (x) => x.amount);
      listBox.innerHTML = '';
      listBox.append(h('div.kpis.sm', ui.kpi('درآمد', LD.money(inc, true)), ui.kpi('هزینه', LD.money(exp, true)), ui.kpi('خالص', LD.money(inc - exp, true), null, inc - exp >= 0 ? 'good' : 'bad'), ui.kpi('تعداد', LD.fmt(rows.length))));
      listBox.append(ui.table({
        rows: rows.slice(0, 500),
        cols: [
          { label: 'تاریخ', get: (x) => J.fmt(x.date) },
          { label: 'شرح', get: (x) => h('span', x.desc || F.catName(x.categoryId), x.src !== 'tx' ? ui.badge(x.src === 'cafe' ? 'فروش کافه' : 'چک') : null, x.projectId ? ui.badge(F.projectName(x.projectId)) : null) },
          { label: 'دسته', get: (x) => x.type === 'transfer' ? 'انتقال → ' + F.accountName(x.toAccountId) : F.catName(x.categoryId) },
          { label: 'واحد', get: (x) => unitBadge(x.unitId) },
          { label: 'حساب', get: (x) => F.accountName(x.accountId) },
          { label: 'مبلغ', num: true, get: amountCell },
        ],
        onRow: (x) => x.src === 'cafe' ? LD.pages.cafe.editSale(LD.db.get('cafeSales', x.id)) : x.src === 'cheque' ? LD.pages.cheques.edit(LD.db.get('cheques', x.id)) : txPage.edit(LD.db.get('transactions', x.id)),
      }));
      if (rows.length > 500) listBox.append(h('p.muted.small', '۵۰۰ مورد اول نمایش داده شد؛ برای بقیه فیلتر کنید.'));
    };
    q.addEventListener('input', LD.debounce(() => { st.q = q.value; save(); draw(); }, 250));
    el.append(h('div.toolbar', ui.unitSel(LD.unit(), LD.setUnit)),
      h('div.toolbar', LD.periodSelect(st.period, (v) => { st.period = v; save(); draw(); }),
        h('select', { onchange: (e) => { st.type = e.target.value; save(); draw(); } }, [['', 'همه انواع'], ['income', 'درآمد'], ['expense', 'هزینه'], ['transfer', 'انتقال']].map(([k, l]) => h('option', { value: k, selected: st.type === k }, l))),
        q, h('span.spacer'),
        h('button.btn', { onclick: () => LD.voice.quickVoice() }, ui.icon('mic', 16), ' صوتی'),
        h('button.btn.primary', { onclick: () => txPage.edit() }, ui.icon('plus', 16), ' تراکنش')),
      listBox);
    draw();
  };
  LD.pages.transactions = txPage;

  /* ---------- حساب‌ها و دارایی‌ها ---------- */
  const accPage = LD.crud({
    col: 'accounts', title: 'حساب‌ها و دارایی‌ها', single: 'حساب',
    defaults: () => ({ kind: 'bank', currency: 'IRT', unitId: LD.unit() === 'all' ? 'personal' : LD.unit() }),
    fields: () => [
      { k: 'name', label: 'نام حساب', required: true, half: true, placeholder: 'مثلاً کارت ملت کافه' },
      { k: 'kind', label: 'نوع', type: 'select', options: [['bank', 'حساب بانکی'], ['card', 'کارت'], ['cash', 'صندوق نقدی'], ['wallet', 'کیف پول دیجیتال'], ['fx', 'ارز'], ['gold', 'طلا']], half: true },
      { k: 'unitId', label: 'واحد', type: 'select', options: units, required: true, half: true },
      { k: 'currency', label: 'واحد پول', type: 'select', options: [['IRT', 'تومان'], ['USD', 'دلار'], ['EUR', 'یورو'], ['GOLD', 'طلا (گرم)']], half: true },
      { k: 'opening', label: 'موجودی اولیه', type: 'number', half: true },
      { k: 'bank', label: 'بانک', half: true },
      { k: 'number', label: 'شماره کارت / حساب / شبا', voice: false },
      { k: 'aliases', label: 'نام‌های دیگر (برای ورود صوتی)', placeholder: 'مثلاً: ملت، کارت کافه' },
      { k: 'archived', label: 'بایگانی', type: 'bool', text: 'این حساب بسته شده' },
    ],
  });
  const assetPage = LD.crud({
    col: 'assets', title: 'دارایی‌ها', single: 'دارایی',
    defaults: () => ({ kind: 'equipment', qty: 1, unitId: 'personal' }),
    fields: () => [
      { k: 'name', label: 'نام دارایی', required: true, half: true },
      { k: 'kind', label: 'نوع', type: 'select', options: [['property', 'ملک'], ['vehicle', 'خودرو'], ['equipment', 'تجهیزات'], ['gold', 'طلا و سکه'], ['stock', 'سهام و صندوق'], ['fx', 'ارز'], ['crypto', 'رمزارز'], ['other', 'سایر']], half: true },
      { k: 'unitId', label: 'واحد', type: 'select', options: units, half: true },
      { k: 'qty', label: 'تعداد / مقدار', type: 'number', half: true },
      { k: 'value', label: 'ارزش فعلی هر واحد', type: 'number', required: true, half: true },
      { k: 'currency', label: 'واحد ارزش', type: 'select', options: [['', 'تومان'], ['USD', 'دلار'], ['EUR', 'یورو'], ['GOLD', 'گرم طلا']], half: true },
      { k: 'buyDate', label: 'تاریخ خرید', type: 'date', half: true },
      { k: 'buyPrice', label: 'قیمت خرید کل (تومان)', type: 'money', half: true },
      { k: 'note', label: 'توضیحات', type: 'textarea' },
      { k: 'sold', label: 'فروخته شده', type: 'bool', text: 'دیگر جزو دارایی‌ها نیست' },
    ],
  });
  const assetValue = (a) => (Number(a.value) || 0) * (a.currency ? F.rate(a.currency) : 1) * (Number(a.qty) || 1);
  accPage.render = (el) => {
    const unit = LD.unit();
    const accs = LD.db.list('accounts').filter((a) => unit === 'all' || a.unitId === unit).sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0));
    const assets = LD.db.list('assets').filter((a) => unit === 'all' || a.unitId === unit);
    const tot = LD.sum(accs.filter((a) => !a.archived), (a) => F.accountBalance(a) * F.rate(a.currency));
    const totA = LD.sum(assets.filter((a) => !a.sold), assetValue);
    el.append(h('div.toolbar', ui.unitSel(unit, LD.setUnit), h('span.spacer'),
      h('button.btn', { onclick: () => txPage.edit({ type: 'transfer' }) }, 'انتقال وجه'),
      h('button.btn.primary', { onclick: () => accPage.edit() }, ui.icon('plus', 16), ' حساب'),
      h('button.btn.primary', { onclick: () => assetPage.edit() }, ui.icon('plus', 16), ' دارایی')),
      h('div.kpis.sm', ui.kpi('جمع حساب‌ها', LD.money(tot, true)), ui.kpi('جمع دارایی‌ها', LD.money(totA, true)), ui.kpi('جمع کل', LD.money(tot + totA, true))),
      ui.card('حساب‌ها', ui.table({ rows: accs, onRow: (a) => accPage.edit(a), cols: [
        { label: 'نام', get: (a) => h('span', a.name, a.archived ? ui.badge('بایگانی') : null) },
        { label: 'واحد', get: (a) => unitBadge(a.unitId) },
        { label: 'بانک/شماره', get: (a) => [a.bank, a.number].filter(Boolean).join(' · ') || '—' },
        { label: 'موجودی', num: true, get: (a) => { const b = F.accountBalance(a); return h('span.amt.' + (b >= 0 ? 'neu' : 'neg'), LD.money(b) + (a.currency && a.currency !== 'IRT' ? ' ' + { USD: 'دلار', EUR: 'یورو', GOLD: 'گرم' }[a.currency] : '')); } },
      ] })),
      ui.card('دارایی‌ها', ui.table({ rows: assets, onRow: (a) => assetPage.edit(a), empty: 'دارایی‌ای ثبت نشده (ملک، خودرو، تجهیزات سردخانه، طلا…)', cols: [
        { label: 'نام', get: (a) => h('span', a.name, a.sold ? ui.badge('فروخته شد') : null) },
        { label: 'واحد', get: (a) => unitBadge(a.unitId) },
        { label: 'مقدار', num: true, get: (a) => LD.fmt(a.qty || 1, 3) },
        { label: 'ارزش', num: true, get: (a) => LD.money(assetValue(a)) },
        { label: 'سود/زیان از خرید', num: true, get: (a) => a.buyPrice ? h('span.amt.' + (assetValue(a) >= a.buyPrice ? 'pos' : 'neg'), LD.pct((assetValue(a) - a.buyPrice) / a.buyPrice)) : '—' },
      ] })));
  };
  LD.pages.accounts = accPage; LD.pages.assets = assetPage;

  /* ---------- چک‌ها ---------- */
  const STATUS = { pending: ['در انتظار', ''], cleared: ['پاس / وصول شد', 'good'], bounced: ['برگشتی', 'bad'], cancelled: ['باطل', ''] };
  const chqPage = LD.crud({
    col: 'cheques', title: 'چک‌ها', single: 'چک', unitField: 'unitId',
    defaults: () => ({ direction: 'out', status: 'pending', unitId: LD.unit() === 'all' ? 'personal' : LD.unit() }),
    fields: () => [
      { k: 'direction', label: 'نوع', type: 'select', options: [['out', 'چک پرداختی (صادره)'], ['in', 'چک دریافتی']], half: true },
      { k: 'amount', label: 'مبلغ', type: 'money', required: true, half: true },
      { k: 'dueDate', label: 'تاریخ سررسید', type: 'date', required: true, half: true },
      { k: 'personId', label: 'طرف حساب', type: 'ref', ref: 'people', half: true, empty: '—' },
      { k: 'number', label: 'شماره چک / صیادی', half: true, voice: false },
      { k: 'bank', label: 'بانک', half: true },
      { k: 'unitId', label: 'واحد', type: 'select', options: units, half: true },
      { k: 'categoryId', label: 'دسته (برای سود و زیان)', type: 'ref', ref: 'categories', filter: (c, v) => c.unitId === v.unitId && c.type === (v.direction === 'in' ? 'income' : 'expense'), deps: ['unitId', 'direction'], half: true, empty: 'بدون دسته' },
      { k: 'accountId', label: 'حساب', type: 'ref', ref: 'accounts', half: true, empty: '—' },
      { k: 'projectId', label: 'پروژه', type: 'ref', ref: 'projects', half: true, empty: '—' },
      { k: 'status', label: 'وضعیت', type: 'select', options: Object.entries(STATUS).map(([k, v]) => [k, v[0]]), half: true },
      { k: 'clearedDate', label: 'تاریخ وصول/پاس', type: 'date', show: (v) => v.status === 'cleared', half: true },
      { k: 'desc', label: 'شرح' },
    ],
    intro: 'چک‌هایی که وضعیت «پاس/وصول شد» بگیرند خودکار در موجودی حساب و سود و زیان حساب می‌شوند؛ برای آن‌ها تراکنش جداگانه ثبت نکنید.',
    sort: (a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (a.dueDate || '').localeCompare(b.dueDate || ''),
    summary: (rows) => { const p = rows.filter((c) => c.status === 'pending'); return h('div.kpis.sm', ui.kpi('چک‌های دریافتی در انتظار', LD.money(LD.sum(p.filter((c) => c.direction === 'in'), (c) => c.amount), true)), ui.kpi('چک‌های پرداختی در انتظار', LD.money(LD.sum(p.filter((c) => c.direction === 'out'), (c) => c.amount), true)), ui.kpi('سررسید ۷ روز آینده', LD.fmt(p.filter((c) => c.dueDate <= LD.addDays(LD.todayISO(), 7)).length) + ' فقره')); },
    cols: [
      { label: 'سررسید', get: (c) => h('span' + (c.status === 'pending' && c.dueDate < LD.todayISO() ? '.overdue-t' : ''), J.fmt(c.dueDate)) },
      { label: 'نوع', get: (c) => c.direction === 'in' ? ui.badge('دریافتی', 'good') : ui.badge('پرداختی') },
      { label: 'طرف حساب', get: (c) => F.personName(c.personId) },
      { label: 'شماره', get: (c) => c.number || '—' },
      { label: 'واحد', get: (c) => unitBadge(c.unitId) },
      { label: 'وضعیت', get: (c) => ui.badge(STATUS[c.status][0], STATUS[c.status][1]) },
      { label: 'مبلغ', num: true, get: (c) => LD.money(c.amount) },
    ],
  });
  LD.pages.cheques = chqPage;

  /* ---------- وام‌ها و طلب/بدهی ---------- */
  const loanPage = LD.crud({
    col: 'loans', title: 'وام‌ها', single: 'وام',
    defaults: () => ({ paidCount: 0, unitId: 'personal' }),
    fields: () => [
      { k: 'title', label: 'عنوان وام', required: true, half: true },
      { k: 'lender', label: 'وام‌دهنده', half: true },
      { k: 'principal', label: 'مبلغ وام', type: 'money', half: true },
      { k: 'installment', label: 'مبلغ هر قسط', type: 'money', required: true, half: true },
      { k: 'count', label: 'تعداد کل اقساط', type: 'number', required: true, half: true },
      { k: 'paidCount', label: 'اقساط پرداخت‌شده', type: 'number', half: true },
      { k: 'firstDue', label: 'سررسید قسط اول', type: 'date', required: true, half: true },
      { k: 'unitId', label: 'واحد', type: 'select', options: units, half: true },
      { k: 'accountId', label: 'حساب پرداخت', type: 'ref', ref: 'accounts', empty: '—', half: true },
      { k: 'closed', label: 'تسویه شد', type: 'bool', text: 'وام بسته شده', half: true },
      { k: 'note', label: 'توضیحات', type: 'textarea' },
    ],
  });
  loanPage.payInstallment = (l) => {
    const cat = LD.db.list('categories').find((c) => c.unitId === l.unitId && c.type === 'expense' && /قسط|وام/.test(c.name));
    LD.pages.transactions.edit({ type: 'expense', amount: l.installment, unitId: l.unitId, accountId: l.accountId, categoryId: cat && cat.id, desc: 'قسط ' + (Number(l.paidCount || 0) + 1) + ' از ' + l.count + ' — ' + l.title, date: LD.todayISO() });
    LD.db.put('loans', { id: l.id, paidCount: Number(l.paidCount || 0) + 1, closed: Number(l.paidCount || 0) + 1 >= Number(l.count) });
  };
  const debtPage = LD.crud({
    col: 'debts', title: 'طلب و بدهی اشخاص', single: 'طلب/بدهی',
    defaults: () => ({ direction: 'receivable', date: LD.todayISO(), unitId: LD.unit() === 'all' ? 'personal' : LD.unit() }),
    fields: () => [
      { k: 'direction', label: 'نوع', type: 'select', options: [['receivable', 'طلب من از دیگری'], ['payable', 'بدهی من به دیگری']], half: true },
      { k: 'personId', label: 'شخص', type: 'ref', ref: 'people', required: true, half: true },
      { k: 'amount', label: 'مبلغ', type: 'money', required: true, half: true },
      { k: 'date', label: 'تاریخ', type: 'date', half: true },
      { k: 'dueDate', label: 'موعد تسویه', type: 'date', half: true },
      { k: 'unitId', label: 'واحد', type: 'select', options: units, half: true },
      { k: 'desc', label: 'شرح' },
      { k: 'settled', label: 'تسویه شد', type: 'bool', text: 'تسویه شده' },
    ],
  });
  LD.pages.debts = {
    title: 'وام، طلب و بدهی',
    render(el) {
      const loans = LD.db.list('loans'), debts = LD.db.list('debts');
      const open = debts.filter((d) => !d.settled);
      el.append(h('div.toolbar', h('span.spacer'), h('button.btn.primary', { onclick: () => debtPage.edit() }, ui.icon('plus', 16), ' طلب/بدهی'), h('button.btn.primary', { onclick: () => loanPage.edit() }, ui.icon('plus', 16), ' وام')),
        h('div.kpis.sm', ui.kpi('جمع طلب‌ها', LD.money(LD.sum(open.filter((d) => d.direction === 'receivable'), (d) => d.amount), true), null, 'good'),
          ui.kpi('جمع بدهی به اشخاص', LD.money(LD.sum(open.filter((d) => d.direction === 'payable'), (d) => d.amount), true), null, 'bad'),
          ui.kpi('مانده وام‌ها', LD.money(LD.sum(loans.filter((l) => !l.closed), (l) => F.loanInfo(l).remaining), true))),
        ui.card('وام‌ها و اقساط', ui.table({ rows: loans.sort((a, b) => (a.closed ? 1 : 0) - (b.closed ? 1 : 0)), onRow: (l) => loanPage.edit(l), empty: 'وامی ثبت نشده', cols: [
          { label: 'عنوان', get: (l) => h('span', l.title, l.closed ? ui.badge('تسویه', 'good') : null) },
          { label: 'پیشرفت', get: (l) => h('div.progress.sm', { title: l.paidCount + '/' + l.count }, h('span', { style: { width: ((l.paidCount || 0) / (l.count || 1) * 100) + '%' } })) },
          { label: 'اقساط', get: (l) => LD.faNum((l.paidCount || 0) + ' از ' + l.count) },
          { label: 'قسط بعدی', get: (l) => { const i = F.loanInfo(l); return i.next ? J.fmt(i.next) : '—'; } },
          { label: 'مانده', num: true, get: (l) => LD.money(F.loanInfo(l).remaining) },
          { label: '', get: (l) => l.closed ? '' : h('button.btn.sm', { onclick: (e) => { e.stopPropagation(); loanPage.payInstallment(l); } }, 'پرداخت قسط') },
        ] })),
        ui.card('طلب و بدهی اشخاص', ui.table({ rows: debts.sort((a, b) => (a.settled ? 1 : 0) - (b.settled ? 1 : 0) || (a.dueDate || 'z').localeCompare(b.dueDate || 'z')), onRow: (d) => debtPage.edit(d), empty: 'موردی ثبت نشده', cols: [
          { label: 'شخص', get: (d) => F.personName(d.personId) },
          { label: 'نوع', get: (d) => d.direction === 'receivable' ? ui.badge('طلب', 'good') : ui.badge('بدهی', 'bad') },
          { label: 'شرح', get: (d) => d.desc || '—' },
          { label: 'موعد', get: (d) => J.fmt(d.dueDate) },
          { label: 'وضعیت', get: (d) => d.settled ? ui.badge('تسویه', 'good') : ui.badge('باز') },
          { label: 'مبلغ', num: true, get: (d) => LD.money(d.amount) },
        ] })));
    },
  };
  LD.pages.loans = loanPage; LD.pages.debtItems = debtPage;

  /* ---------- اشخاص ---------- */
  const ROLES = [['customer', 'مشتری سردخانه'], ['supplier', 'تأمین‌کننده'], ['staff', 'پرسنل'], ['partner', 'شریک'], ['family', 'خانواده و دوستان'], ['service', 'خدمات و فنی'], ['other', 'سایر']];
  LD.ROLES = ROLES;
  LD.pages.people = LD.crud({
    col: 'people', title: 'اشخاص و مخاطبین', single: 'شخص',
    defaults: () => ({ role: 'customer' }),
    fields: () => [
      { k: 'name', label: 'نام', required: true, half: true },
      { k: 'role', label: 'نقش', type: 'select', options: ROLES, half: true },
      { k: 'code', label: 'کد مشتری سردخانه', half: true, voice: false, placeholder: 'کدی که روی همه بارهایش نوشته می‌شود' },
      { k: 'phone', label: 'تلفن همراه', inputType: 'tel', half: true, voice: false },
      { k: 'phone2', label: 'تلفن دیگر', inputType: 'tel', half: true, voice: false },
      { k: 'bankInfo', label: 'شماره کارت / شبا', voice: false },
      { k: 'address', label: 'آدرس', type: 'textarea', rows: 2 },
      { k: 'aliases', label: 'نام‌های دیگر (برای ورود صوتی)', placeholder: 'مثلاً: آقای رضایی، حاج علی' },
      { k: 'note', label: 'یادداشت', type: 'textarea' },
    ],
    sort: (a, b) => a.name.localeCompare(b.name, 'fa'),
    extra: (v) => v.id && v.role === 'customer' ? h('button.btn.sm', { type: 'button', onclick: () => LD.pages.coldstore.statement(v.id) }, 'صورت‌حساب سردخانه') : null,
    cols: [
      { label: 'نام', get: (p) => p.name },
      { label: 'کد', get: (p) => p.code || '—' },
      { label: 'نقش', get: (p) => ui.badge((ROLES.find((r) => r[0] === p.role) || ['', '—'])[1]) },
      { label: 'تلفن', get: (p) => p.phone ? h('a', { href: 'tel:' + p.phone, onclick: (e) => e.stopPropagation() }, LD.faNum(p.phone)) : '—' },
      { label: 'یادداشت', get: (p) => (p.note || '').slice(0, 50) || '—' },
    ],
  });

  /* ---------- اطلاعات کاربردی ---------- */
  const VK = [['document', 'مدرک و سند'], ['contract', 'قرارداد'], ['insurance', 'بیمه'], ['subscription', 'اشتراک و قبض'], ['account', 'اطلاعات حساب/سایت'], ['secret', 'رمز و کد محرمانه'], ['vehicle', 'خودرو'], ['health', 'سلامت'], ['note', 'یادداشت']];
  LD.pages.vault = LD.crud({
    col: 'vault', title: 'اطلاعات کاربردی', single: 'مورد', unitField: 'unitId',
    defaults: () => ({ kind: 'note', unitId: LD.unit() === 'all' ? 'personal' : LD.unit() }),
    fields: () => [
      { k: 'title', label: 'عنوان', required: true, half: true },
      { k: 'kind', label: 'نوع', type: 'select', options: VK, half: true },
      { k: 'unitId', label: 'واحد', type: 'select', options: units, half: true },
      { k: 'provider', label: 'طرف/ارائه‌دهنده', half: true },
      { k: 'number', label: 'شماره / کد', half: true, voice: false },
      { k: 'expiry', label: 'تاریخ انقضا / تمدید', type: 'date', half: true },
      { k: 'amount', label: 'مبلغ (اختیاری)', type: 'money', half: true },
      { k: 'content', label: 'متن / جزئیات', type: 'textarea', rows: 5 },
      { k: 'tags', label: 'برچسب‌ها', type: 'tags' },
    ],
    intro: 'همه این اطلاعات داخل فایل رمزگذاری‌شده نگه داشته می‌شود. موارد دارای تاریخ انقضا در سررسیدهای داشبورد نمایش داده می‌شوند.',
    sort: (a, b) => (a.expiry || 'z').localeCompare(b.expiry || 'z'),
    cols: [
      { label: 'عنوان', get: (v) => v.title },
      { label: 'نوع', get: (v) => ui.badge((VK.find((x) => x[0] === v.kind) || ['', '—'])[1]) },
      { label: 'واحد', get: (v) => unitBadge(v.unitId) },
      { label: 'جزئیات', get: (v) => v.kind === 'secret' ? '••••••' : ((v.number ? LD.faNum(v.number) + ' · ' : '') + (v.content || '').slice(0, 60)) || '—' },
      { label: 'انقضا', get: (v) => v.expiry ? h('span' + (v.expiry < LD.addDays(LD.todayISO(), 30) ? '.overdue-t' : ''), J.fmt(v.expiry)) : '—' },
    ],
  });

  /* ---------- یادآورها ---------- */
  const REP = [['none', 'یک‌بار'], ['weekly', 'هفتگی'], ['monthly', 'ماهانه'], ['yearly', 'سالانه']];
  const remPage = LD.crud({
    col: 'reminders', title: 'یادآورها', single: 'یادآور', unitField: 'unitId',
    defaults: () => ({ repeat: 'none', date: LD.todayISO(), unitId: 'personal' }),
    fields: () => [
      { k: 'title', label: 'عنوان', required: true },
      { k: 'date', label: 'تاریخ', type: 'date', required: true, half: true },
      { k: 'repeat', label: 'تکرار', type: 'select', options: REP, half: true },
      { k: 'amount', label: 'مبلغ (اختیاری)', type: 'money', half: true },
      { k: 'unitId', label: 'واحد', type: 'select', options: units, half: true },
      { k: 'note', label: 'یادداشت', type: 'textarea' },
      { k: 'done', label: 'انجام شد', type: 'bool', text: 'انجام شده' },
    ],
    sort: (a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (F.nextReminder(a) || '').localeCompare(F.nextReminder(b) || ''),
    cols: [
      { label: 'تاریخ', get: (r) => h('span' + (!r.done && F.nextReminder(r) < LD.todayISO() ? '.overdue-t' : ''), J.fmt(F.nextReminder(r))) },
      { label: 'عنوان', get: (r) => h('span' + (r.done ? '.done-t' : ''), r.title) },
      { label: 'تکرار', get: (r) => (REP.find((x) => x[0] === r.repeat) || REP[0])[1] },
      { label: 'مبلغ', num: true, get: (r) => r.amount ? LD.money(r.amount) : '—' },
      { label: '', get: (r) => r.done ? '' : h('button.btn.sm', { onclick: (e) => { e.stopPropagation(); remPage.complete(r); } }, '✓ انجام شد') },
    ],
  });
  remPage.complete = (r) => {
    if (!r.repeat || r.repeat === 'none') LD.db.put('reminders', { id: r.id, done: true });
    else { const n = F.nextReminder(r); LD.db.put('reminders', { id: r.id, date: r.repeat === 'yearly' ? J.addMonths(n, 12) : r.repeat === 'weekly' ? LD.addDays(n, 7) : J.addMonths(n, 1) }); }
    LD.router.refresh();
  };
  LD.pages.reminders = remPage;
})();
