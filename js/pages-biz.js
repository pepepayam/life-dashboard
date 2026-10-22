/* صفحات کسب‌وکار: سردخانه، کافه، پروژه‌ها، ایده‌ها */
'use strict';
(() => {
  const h = LD.h, ui = LD.ui, F = LD.fin, J = LD.J;
  const units = () => LD.db.list('units').map((u) => [u.id, u.name]);
  const PRODUCTS = ['سیب قرمز', 'سیب زرد', 'سیب گلاب', 'گلابی', 'پرتقال', 'نارنگی', 'کیوی', 'انار', 'به', 'خرمالو', 'انگور', 'هلو', 'شلیل', 'آلو', 'سیب‌زمینی', 'پیاز'];
  const rooms = () => LD.state.data.settings.coldRooms || [];

  /* ================= سردخانه ================= */
  const lotPage = LD.crud({
    col: 'csLots', title: 'محموله', single: 'محموله (ورود به سردخانه)',
    defaults: () => ({ inDate: LD.todayISO(), basis: 'kg', billing: 'monthly', rate: LD.state.data.settings.csDefaultRate || '' }),
    fields: () => [
      { k: 'personId', label: 'مشتری (کد — نام)', type: 'ref', ref: 'people', filter: (p) => p.role === 'customer', optLabel: (p) => (p.code ? p.code + ' — ' : '') + p.name, required: true, half: true },
      { k: 'product', label: 'محصول', required: true, half: true, datalist: () => PRODUCTS },
      { k: 'variety', label: 'رقم / درجه', half: true },
      { k: 'room', label: 'اتاق / سالن', type: rooms().length ? 'select' : 'text', options: () => rooms().map((r) => [r.name, r.name]), half: true },
      { k: 'cartons', label: 'تعداد کارتن/جعبه', type: 'number', half: true },
      { k: 'weightKg', label: 'وزن (کیلوگرم)', type: 'number', half: true },
      { k: 'inDate', label: 'تاریخ ورود', type: 'date', required: true, half: true },
      { k: 'outDate', label: 'تاریخ خروج', type: 'date', half: true },
      { k: 'basis', label: 'مبنای کرایه', type: 'select', options: [['kg', 'هر کیلوگرم در ماه'], ['carton', 'هر کارتن در ماه'], ['fixed', 'مبلغ ثابت ماهانه']], half: true },
      { k: 'rate', label: 'نرخ (تومان)', type: 'money', required: true, half: true },
      { k: 'billing', label: 'محاسبه ماه ناقص', type: 'select', options: [['monthly', 'ماه ناقص = یک ماه کامل'], ['daily', 'روزشمار']], half: true },
      { k: 'note', label: 'یادداشت' },
    ],
    extra: (v) => {
      const out = h('p.hint-box');
      const upd = () => { const f = F.lotFee(v); out.textContent = v.inDate ? `مدت: ${LD.faNum(f.days)} روز — کرایه تا ${v.outDate ? 'خروج' : 'امروز'}: ${LD.money(f.fee)} تومان` : ''; };
      upd(); setTimeout(() => out.closest('.modal').addEventListener('input', upd), 0); setTimeout(() => out.closest('.modal').addEventListener('click', () => setTimeout(upd, 50)), 0);
      return out;
    },
  });
  const exitLot = (lot) => {
    ui.form({
      title: 'خروج محموله — ' + (F.lotCode(lot) ? 'کد ' + F.lotCode(lot) + ' — ' : '') + lot.product + ' (' + F.personName(lot.personId) + ')',
      fields: [
        { k: 'outDate', label: 'تاریخ خروج', type: 'date', required: true, def: LD.todayISO, half: true },
        { k: 'cartons', label: 'تعداد کارتن خارج‌شده', type: 'number', half: true },
        { k: 'weightKg', label: 'وزن خارج‌شده (کیلوگرم)', type: 'number', half: true },
      ],
      value: { cartons: lot.cartons, weightKg: lot.weightKg },
      extra: () => h('p.muted.small', 'اگر کمتر از کل محموله را خارج کنید، محموله به دو قسمت تقسیم می‌شود.'),
      onSave: (v) => {
        const partial = (Number(v.cartons) || 0) < (Number(lot.cartons) || 0) || (Number(v.weightKg) || 0) < (Number(lot.weightKg) || 0);
        if (partial) {
          LD.db.put('csLots', Object.assign({}, lot, { id: undefined, createdAt: undefined, cartons: v.cartons, weightKg: v.weightKg, outDate: v.outDate, note: (lot.note || '') + ' (خروج بخشی)' }));
          LD.db.put('csLots', { id: lot.id, cartons: (Number(lot.cartons) || 0) - (Number(v.cartons) || 0), weightKg: (Number(lot.weightKg) || 0) - (Number(v.weightKg) || 0) });
        } else LD.db.put('csLots', { id: lot.id, outDate: v.outDate });
        LD.toast('خروج ثبت شد'); LD.router.refresh();
      },
    });
  };
  const receivePayment = (personId, amount) => {
    const cat = LD.db.list('categories').find((c) => c.unitId === 'coldstore' && c.name === 'کرایه نگهداری');
    LD.pages.transactions.edit({ type: 'income', unitId: 'coldstore', categoryId: cat && cat.id, personId, amount, desc: 'دریافت کرایه نگهداری — ' + F.personName(personId) });
  };

  LD.pages.coldstore = {
    title: 'سردخانه',
    edit: (r) => lotPage.edit(r),
    statement(personId) {
      const s = F.customerStatement(personId), p = LD.db.get('people', personId);
      const body = h('div.print-area',
        h('h2.print-only', 'صورت‌حساب سردخانه — ' + p.name),
        p.code ? h('p', 'کد مشتری: ', h('b', p.code)) : null,
        h('p.muted', 'تاریخ گزارش: ' + J.fmt(LD.todayISO(), true) + (p.phone ? ' — تلفن: ' + LD.faNum(p.phone) : '')),
        ui.table({ rows: s.lots.sort((a, b) => a.inDate.localeCompare(b.inDate)), cols: [
          { label: 'محصول', get: (l) => l.product + (l.variety ? ' (' + l.variety + ')' : '') },
          { label: 'ورود', get: (l) => J.fmt(l.inDate) }, { label: 'خروج', get: (l) => l.outDate ? J.fmt(l.outDate) : 'در انبار' },
          { label: 'مقدار', get: (l) => [l.cartons ? LD.fmt(l.cartons) + ' کارتن' : '', l.weightKg ? LD.fmt(l.weightKg) + ' کیلو' : ''].filter(Boolean).join(' / ') },
          { label: 'روز', num: true, get: (l) => LD.fmt(F.lotFee(l).days) },
          { label: 'کرایه', num: true, get: (l) => LD.money(F.lotFee(l).fee) },
        ] }),
        h('h4', 'پرداخت‌ها'),
        ui.table({ rows: s.pays, empty: 'پرداختی ثبت نشده', cols: [{ label: 'تاریخ', get: (x) => J.fmt(x.date) }, { label: 'شرح', get: (x) => x.desc || '—' }, { label: 'مبلغ', num: true, get: (x) => LD.money(x.amount) }] }),
        h('div.kpis.sm', ui.kpi('جمع کرایه', LD.money(s.fees)), ui.kpi('پرداخت‌شده', LD.money(s.paid)), ui.kpi('مانده بدهی مشتری', LD.money(s.balance), null, s.balance > 0 ? 'bad' : 'good')));
      const m = ui.modal({ title: 'صورت‌حساب ' + p.name, body, wide: true, actions: [
        h('button.btn', { onclick: () => LD.printNode(body, 'صورت‌حساب سردخانه — ' + p.name) }, ui.icon('print', 16), ' چاپ / PDF'),
        h('span.spacer'),
        h('button.btn.primary', { onclick: () => { m.close(); receivePayment(personId, s.balance > 0 ? s.balance : ''); } }, 'ثبت دریافت وجه'),
      ] });
    },
    render(el) {
      const tab = sessionStorage.getItem('ld.cstab') || 'stock';
      const lots = LD.db.list('csLots'), active = lots.filter((l) => !l.outDate || l.outDate > LD.todayISO());
      const recv = F.coldstoreReceivables();
      const t = J.toJalali(LD.todayISO()), [mf, mt] = J.monthRange(t.jy, t.jm);
      const p = F.pnl({ from: mf, to: mt, unitId: 'coldstore' });
      el.append(
        h('div.toolbar', h('div.seg', [['stock', 'موجودی فعلی'], ['all', 'همه محموله‌ها'], ['customers', 'مشتریان و مطالبات']].map(([k, l]) => h('button' + (tab === k ? '.on' : ''), { onclick: () => { sessionStorage.setItem('ld.cstab', k); LD.router.refresh(); } }, l))),
          h('span.spacer'), h('button.btn', { onclick: () => roomSettings() }, 'اتاق‌ها و نرخ پیش‌فرض'),
          h('button.btn', { onclick: () => LD.pages.people.edit({ role: 'customer' }) }, '+ مشتری'),
          h('button.btn.primary', { onclick: () => lotPage.edit() }, ui.icon('plus', 16), ' ورود محموله')),
        h('div.kpis.sm',
          ui.kpi('محموله‌های در انبار', LD.fmt(active.length)),
          ui.kpi('وزن موجود', LD.fmt(LD.sum(active, (l) => l.weightKg) / 1000, 1) + ' تن'),
          ui.kpi('کارتن موجود', LD.fmt(LD.sum(active, (l) => l.cartons))),
          ui.kpi('مطالبات از مشتریان', LD.money(LD.sum(recv, (r) => r.balance), true), null, 'bad'),
          ui.kpi('سود سردخانه این ماه', LD.money(p.net, true), 'درآمد ' + LD.money(p.income, true), p.net >= 0 ? 'good' : 'bad')));

      if (tab === 'stock') {
        const byRoom = LD.groupBy(active, (l) => l.room || 'بدون اتاق');
        const rs = rooms();
        const roomNames = [...new Set([...rs.map((r) => r.name), ...Object.keys(byRoom)])];
        el.append(ui.card('اشغال اتاق‌ها', roomNames.length ? h('div.rooms', roomNames.map((n) => {
          const L = byRoom[n] || [], cap = (rs.find((r) => r.name === n) || {}).capacityKg, kg = LD.sum(L, (l) => l.weightKg), use = cap ? kg / cap : null;
          return h('div.room', h('div.room-top', h('b', n), h('span.small', LD.fmt(kg / 1000, 1) + ' تن' + (cap ? ' از ' + LD.fmt(cap / 1000, 1) : ''))),
            h('div.progress' + (use > 0.9 ? '.warn' : ''), h('span', { style: { width: Math.min(100, (use || 0) * 100) + '%' } })),
            h('span.small.muted', (use !== null ? LD.pct(use) + ' پر — ' : '') + LD.fmt(L.length) + ' محموله، ' + LD.fmt(LD.sum(L, (l) => l.cartons)) + ' کارتن'));
        })) : h('p.muted', 'هنوز محموله‌ای در انبار نیست. اتاق‌ها را از «اتاق‌ها و نرخ پیش‌فرض» تعریف کنید.')));
        const prodBox = h('div');
        el.append(ui.card('موجودی به تفکیک محصول (کیلوگرم)', prodBox));
        requestAnimationFrame(() => LD.chart.hbars(prodBox, { items: Object.entries(LD.groupBy(active, (l) => l.product)).map(([k, a]) => ({ label: k, value: LD.sum(a, (l) => l.weightKg) })), color: 'var(--s3)' }));
        el.append(ui.card('محموله‌های در انبار', lotTable(active)));
      } else if (tab === 'all') {
        el.append(ui.card('همه محموله‌ها', lotTable(lots.slice().sort((a, b) => b.inDate.localeCompare(a.inDate)))));
      } else {
        const custs = LD.db.list('people').filter((x) => x.role === 'customer');
        el.append(ui.card('مشتریان', ui.table({ rows: custs.map((c) => Object.assign({ c }, F.customerStatement(c.id))).sort((a, b) => b.balance - a.balance), onRow: (r) => LD.pages.coldstore.statement(r.c.id), empty: 'مشتری‌ای ثبت نشده', cols: [
          { label: 'کد', get: (r) => r.c.code || '—' }, { label: 'مشتری', get: (r) => r.c.name }, { label: 'تلفن', get: (r) => r.c.phone ? LD.faNum(r.c.phone) : '—' },
          { label: 'محموله فعال', num: true, get: (r) => LD.fmt(r.lots.filter((l) => !l.outDate).length) },
          { label: 'جمع کرایه', num: true, get: (r) => LD.money(r.fees) }, { label: 'پرداختی', num: true, get: (r) => LD.money(r.paid) },
          { label: 'مانده', num: true, get: (r) => h('span.amt.' + (r.balance > 0 ? 'neg' : 'pos'), LD.money(r.balance)) },
        ] })));
      }
    },
  };
  const lotTable = (rows) => ui.table({ rows, onRow: (l) => lotPage.edit(l), empty: 'محموله‌ای نیست', cols: [
    { label: 'کد', get: (l) => F.lotCode(l) || '—' },
    { label: 'مشتری', get: (l) => F.personName(l.personId) },
    { label: 'محصول', get: (l) => l.product + (l.variety ? ' · ' + l.variety : '') },
    { label: 'اتاق', get: (l) => l.room || '—' },
    { label: 'مقدار', get: (l) => [l.cartons ? LD.fmt(l.cartons) + ' کارتن' : '', l.weightKg ? LD.fmt(l.weightKg) + ' kg' : ''].filter(Boolean).join(' / ') || '—' },
    { label: 'ورود', get: (l) => J.fmt(l.inDate) },
    { label: 'روز', num: true, get: (l) => LD.fmt(F.lotFee(l).days) },
    { label: 'کرایه', num: true, get: (l) => LD.money(F.lotFee(l).fee) },
    { label: '', get: (l) => l.outDate ? ui.badge('خارج شد ' + J.fmt(l.outDate)) : h('button.btn.sm', { onclick: (e) => { e.stopPropagation(); exitLot(l); } }, 'خروج') },
  ] });
  const roomSettings = () => ui.form({
    title: 'اتاق‌های سردخانه', value: { coldRooms: rooms(), csDefaultRate: LD.state.data.settings.csDefaultRate },
    fields: [
      { k: 'csDefaultRate', label: 'نرخ پیش‌فرض کرایه (تومان برای هر کیلو در ماه)', type: 'money' },
      { k: 'coldRooms', label: 'اتاق‌ها', type: 'list', addLabel: 'اتاق', fields: [{ k: 'name', label: 'نام اتاق', placeholder: 'نام اتاق' }, { k: 'capacityKg', label: 'ظرفیت (کیلوگرم)', type: 'number', placeholder: 'ظرفیت کیلوگرم' }] },
    ],
    onSave: (v) => { LD.db.setSettings({ coldRooms: v.coldRooms.filter((r) => r.name), csDefaultRate: v.csDefaultRate }); LD.router.refresh(); },
  });

  /* ================= کافه ================= */
  const salePage = LD.crud({
    col: 'cafeSales', title: 'فروش روزانه', single: 'فروش روزانه',
    defaults: () => ({ date: LD.todayISO(), accountId: LD.state.data.settings.cafeAccountId }),
    fields: () => [
      { k: 'date', label: 'تاریخ', type: 'date', required: true, half: true },
      { k: 'customers', label: 'تعداد مشتری/فاکتور', type: 'number', half: true },
      { k: 'cash', label: 'فروش نقدی', type: 'money', half: true },
      { k: 'card', label: 'فروش کارتخوان', type: 'money', half: true },
      { k: 'online', label: 'فروش آنلاین / اسنپ‌فود', type: 'money', half: true },
      { k: 'accountId', label: 'واریز به حساب', type: 'ref', ref: 'accounts', empty: '—', half: true },
      { k: 'note', label: 'یادداشت' },
    ],
    validate: (v) => !(Number(v.cash) || Number(v.card) || Number(v.online)) ? 'حداقل یک مبلغ فروش وارد کنید' : null,
  });
  const saleTotal = (s) => (Number(s.cash) || 0) + (Number(s.card) || 0) + (Number(s.online) || 0);
  LD.pages.cafe = {
    title: 'کافه',
    editSale: (r) => salePage.edit(r || {}),
    render(el) {
      const st = sessionStorage.getItem('ld.cafep') || 'month';
      const [from, to] = LD.periodRange(st);
      const sales = LD.db.list('cafeSales').filter((s) => (!from || s.date >= from) && (!to || s.date <= to)).sort((a, b) => b.date.localeCompare(a.date));
      const p = F.pnl({ from, to, unitId: 'cafe' });
      const total = LD.sum(sales, saleTotal);
      const food = LD.sum(p.exp.filter((x) => F.catName(x.categoryId) === 'مواد اولیه'), (x) => x.amount);
      const custs = LD.sum(sales, (s) => s.customers);
      const buyCat = LD.db.list('categories').find((c) => c.unitId === 'cafe' && c.name === 'مواد اولیه');
      el.append(h('div.toolbar', LD.periodSelect(st, (v) => { sessionStorage.setItem('ld.cafep', v); LD.router.refresh(); }), h('span.spacer'),
        h('button.btn', { onclick: () => LD.pages.transactions.edit({ type: 'expense', unitId: 'cafe', categoryId: buyCat && buyCat.id }) }, '+ خرید / هزینه'),
        h('button.btn.primary', { onclick: () => salePage.edit() }, ui.icon('plus', 16), ' فروش امروز')),
        h('div.kpis.sm',
          ui.kpi('فروش دوره', LD.money(total, true)),
          ui.kpi('میانگین فروش روزانه', LD.money(sales.length ? total / sales.length : 0, true), LD.fmt(sales.length) + ' روز ثبت‌شده'),
          ui.kpi('هزینه‌های کافه', LD.money(p.expense, true)),
          ui.kpi('سود خالص', LD.money(p.net, true), null, p.net >= 0 ? 'good' : 'bad'),
          ui.kpi('نسبت مواد اولیه به فروش', total ? LD.pct(food / total) : '—', 'هدف معمول: ۲۵ تا ۳۵٪', total && food / total > 0.38 ? 'bad' : ''),
          custs ? ui.kpi('میانگین هر فاکتور', LD.money(total / custs, true)) : null));
      const g = h('div.grid2'); el.append(g);
      const c1 = h('div'), c2 = h('div');
      g.append(ui.card('فروش روزانه', c1), ui.card('میانگین فروش بر حسب روز هفته', c2));
      el.append(ui.card('فهرست فروش', ui.table({ rows: sales, onRow: (s) => salePage.edit(s), cols: [
        { label: 'تاریخ', get: (s) => J.fmt(s.date) + ' ' + J.weekday(s.date) },
        { label: 'نقد', num: true, get: (s) => LD.money(s.cash || 0) }, { label: 'کارت', num: true, get: (s) => LD.money(s.card || 0) },
        { label: 'آنلاین', num: true, get: (s) => LD.money(s.online || 0) }, { label: 'جمع', num: true, get: (s) => h('b', LD.money(saleTotal(s))) },
      ] })));
      requestAnimationFrame(() => {
        const asc = sales.slice(0, 31).reverse();
        LD.chart.bars(c1, { labels: asc.map((s) => LD.faNum(J.toJalali(s.date).jd)), series: [{ name: 'فروش', values: asc.map(saleTotal), color: 'var(--s3)' }] });
        const order = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
        const byW = LD.groupBy(sales, (s) => J.weekday(s.date));
        LD.chart.bars(c2, { labels: order, series: [{ name: 'میانگین', values: order.map((d) => byW[d] ? LD.sum(byW[d], saleTotal) / byW[d].length : 0), color: 'var(--s3)' }] });
      });
    },
  };

  /* ================= پروژه‌ها ================= */
  const PST = { idea: ['ایده', ''], planning: ['برنامه‌ریزی', ''], active: ['فعال', 'good'], risk: ['در خطر', 'bad'], paused: ['متوقف', 'warn'], done: ['تمام‌شده', 'good'], dropped: ['کنار گذاشته', ''] };
  const projPage = LD.crud({
    col: 'projects', title: 'پروژه‌ها', single: 'پروژه', wide: true,
    defaults: () => ({ status: 'active', unitId: 'projects', startDate: LD.todayISO(), milestones: [], partners: [] }),
    fields: () => [
      { k: 'name', label: 'نام پروژه', required: true, half: true },
      { k: 'unitId', label: 'واحد', type: 'select', options: units, half: true },
      { k: 'status', label: 'وضعیت', type: 'select', options: Object.entries(PST).map(([k, v]) => [k, v[0]]), half: true },
      { k: 'budget', label: 'بودجه / سرمایه برنامه‌ریزی‌شده', type: 'money', half: true },
      { k: 'startDate', label: 'تاریخ شروع', type: 'date', half: true },
      { k: 'endDate', label: 'تاریخ پایان (برنامه)', type: 'date', half: true },
      { k: 'expectedReturn', label: 'بازگشت مورد انتظار', type: 'money', half: true },
      { k: 'myShare', label: 'سهم من (٪)', type: 'number', half: true },
      { k: 'desc', label: 'شرح پروژه', type: 'textarea' },
      { k: 'milestones', label: 'مراحل (برای درصد پیشرفت و تایم‌لاین)', type: 'list', addLabel: 'مرحله', fields: [{ k: 'title', label: 'عنوان مرحله', placeholder: 'عنوان مرحله' }, { k: 'date', label: 'تاریخ', type: 'date' }, { k: 'done', label: 'انجام', type: 'bool', text: 'انجام شد' }] },
      { k: 'partners', label: 'شرکا', type: 'list', addLabel: 'شریک', fields: [{ k: 'name', label: 'نام', placeholder: 'نام شریک' }, { k: 'share', label: 'سهم ٪', type: 'number', placeholder: 'سهم ٪' }, { k: 'capital', label: 'آورده', type: 'money', placeholder: 'آورده (تومان)' }] },
    ],
    afterSave: (v, isNew) => { if (isNew && v.ideaId) LD.db.put('ideas', { id: v.ideaId, status: 'project', projectId: v.id }); },
  });
  const projColor = (p, i) => LD.chart.S(i);
  const statusOf = (p) => PST[p.status] || PST.active;

  function projectCard(p, i) {
    const s = F.projectStats(p), m = F.monthly({ projectId: p.id }, J.lastMonths(12));
    return h('div.proj-card.st-' + p.status, { onclick: () => LD.router.go('projects/' + p.id) },
      h('div.pc-head', h('i.dot', { style: { background: projColor(p, i) } }), h('b', p.name), ui.badge(statusOf(p)[0], statusOf(p)[1])),
      h('div.pc-row', h('span.small.muted', 'پیشرفت'), h('span.small', LD.pct(s.progress))),
      h('div.progress', h('span', { style: { width: (s.progress * 100) + '%', background: projColor(p, i) } })),
      s.budget ? [h('div.pc-row', h('span.small.muted', 'مصرف بودجه'), h('span.small', LD.money(s.invested, true) + ' از ' + LD.money(s.budget, true))),
        h('div.progress.sm' + (s.budgetUse > 1 ? '.warn' : ''), h('span', { style: { width: Math.min(100, s.budgetUse * 100) + '%' } }))] : null,
      h('div.pc-stats',
        h('div', h('span.small.muted', 'سرمایه'), h('b', LD.money(s.invested, true))),
        h('div', h('span.small.muted', 'بازگشت'), h('b', LD.money(s.returned, true))),
        h('div', h('span.small.muted', 'سود'), h('b.amt.' + (s.profit >= 0 ? 'pos' : 'neg'), LD.money(s.profit, true))),
        h('div', h('span.small.muted', 'ROI'), h('b', s.roi === null ? '—' : LD.pct(s.roi)))),
      h('div.pc-spark', LD.chart.spark(m.map((x) => x.net), projColor(p, i), 240, 32), h('span.small.muted', 'سود ماهانه ۱۲ ماه')));
  }

  function projectDetail(el, p) {
    const s = F.projectStats(p), i = LD.db.list('projects').indexOf(p);
    const ideas = LD.db.list('ideas').filter((x) => x.projectId === p.id || x.id === p.ideaId);
    const body = h('div.print-area');
    body.append(
      h('div.toolbar.no-print', h('a.btn', { href: '#/projects' }, '→ همه پروژه‌ها'), h('span.spacer'),
        h('button.btn', { onclick: () => LD.pages.transactions.edit({ type: 'expense', projectId: p.id, unitId: p.unitId }) }, '+ هزینه/سرمایه'),
        h('button.btn', { onclick: () => LD.pages.transactions.edit({ type: 'income', projectId: p.id, unitId: p.unitId }) }, '+ درآمد/بازگشت'),
        h('button.btn', { onclick: () => LD.printNode(body, 'گزارش وضعیت پروژه — ' + p.name) }, ui.icon('print', 16), ' چاپ'),
        h('button.btn.primary', { onclick: () => projPage.edit(p) }, ui.icon('edit', 16), ' ویرایش')),
      h('div.proj-hero', h('h2', p.name), ui.badge(statusOf(p)[0], statusOf(p)[1]), h('span.muted', F.unitName(p.unitId) + (p.startDate ? ' — از ' + J.fmt(p.startDate) : '') + (p.endDate ? ' تا ' + J.fmt(p.endDate) : ''))),
      p.desc ? h('p', p.desc) : null,
      h('div.kpis.sm',
        ui.kpi('پیشرفت', LD.pct(s.progress)),
        ui.kpi('سرمایه‌گذاری‌شده', LD.money(s.invested, true), s.budget ? 'بودجه: ' + LD.money(s.budget, true) : null, s.budgetUse > 1 ? 'bad' : ''),
        ui.kpi('بازگشت', LD.money(s.returned, true), p.expectedReturn ? 'انتظار: ' + LD.money(p.expectedReturn, true) : null),
        ui.kpi('سود/زیان', LD.money(s.profit, true), null, s.profit >= 0 ? 'good' : 'bad'),
        ui.kpi('ROI', s.roi === null ? '—' : LD.pct(s.roi))));
    const gEl = h('div'), trEl = h('div');
    body.append(ui.card('تایم‌لاین', gEl));
    const ms = p.milestones || [];
    body.append(ui.card('مراحل', ms.length ? h('ul.checklist', ms.slice().sort((a, b) => (a.date || 'z').localeCompare(b.date || 'z')).map((m) => h('li' + (m.done ? '.done' : ''),
      h('label', h('input', { type: 'checkbox', checked: !!m.done, onchange: (e) => { const list = (p.milestones || []).map((x) => x.id === m.id ? Object.assign({}, x, { done: e.target.checked }) : x); LD.db.put('projects', { id: p.id, milestones: list }); LD.router.refresh(); } }), ' ', m.title),
      h('span.small.muted', m.date ? J.fmt(m.date) : '')))) : h('p.muted', 'مرحله‌ای تعریف نشده؛ از «ویرایش» مراحل را اضافه کنید.')));
    body.append(ui.card('روند ماهانه پروژه', trEl));
    if ((p.partners || []).length) body.append(ui.card('شرکا و سهم سود', ui.table({ rows: p.partners, cols: [
      { label: 'شریک', get: (x) => x.name }, { label: 'سهم', num: true, get: (x) => LD.faNum(x.share || 0) + '٪' },
      { label: 'آورده', num: true, get: (x) => LD.money(x.capital || 0) }, { label: 'سهم از سود فعلی', num: true, get: (x) => LD.money(s.profit * (Number(x.share) || 0) / 100) },
    ] })));
    body.append(ui.card('تراکنش‌های پروژه', ui.table({ rows: s.flows.sort((a, b) => b.date.localeCompare(a.date)), empty: 'تراکنشی با این پروژه ثبت نشده', onRow: (x) => x.src === 'tx' && LD.pages.transactions.edit(LD.db.get('transactions', x.id)), cols: [
      { label: 'تاریخ', get: (x) => J.fmt(x.date) }, { label: 'شرح', get: (x) => x.desc || F.catName(x.categoryId) },
      { label: 'مبلغ', num: true, get: (x) => h('span.amt.' + (x.type === 'income' ? 'pos' : 'neg'), (x.type === 'income' ? '+' : '−') + LD.money(x.amount)) },
    ] })));
    if (ideas.length) body.append(ui.card('ایده‌های مرتبط', h('ul', ideas.map((x) => h('li', h('a.link', { href: '#', onclick: (e) => { e.preventDefault(); LD.pages.ideas.edit(x); } }, x.title))))));
    el.append(body);
    requestAnimationFrame(() => {
      LD.chart.gantt(gEl, { rows: [{ label: p.name, start: p.startDate, end: p.endDate, progress: s.progress, milestones: ms, color: projColor(p, i) }] });
      const m = F.monthly({ projectId: p.id });
      LD.chart.bars(trEl, { labels: m.map((x) => x.label), series: [{ name: 'بازگشت', values: m.map((x) => x.income), color: 'var(--s1)' }, { name: 'سرمایه/هزینه', values: m.map((x) => x.expense), color: 'var(--s2)' }] });
    });
  }

  projPage.render = (el, params) => {
    if (params[0]) { const p = LD.db.get('projects', params[0]); if (p) return projectDetail(el, p); }
    const filt = sessionStorage.getItem('ld.pfilt') || 'open';
    const all = LD.db.list('projects');
    const list = all.filter((p) => filt === 'all' || (filt === 'open' ? !['done', 'dropped'].includes(p.status) : ['done', 'dropped'].includes(p.status)));
    const stats = list.map((p) => ({ p, s: F.projectStats(p), i: all.indexOf(p) }));
    const inv = LD.sum(stats, (x) => x.s.invested), ret = LD.sum(stats, (x) => x.s.returned);
    el.append(h('div.toolbar', h('div.seg', [['open', 'جاری'], ['closed', 'تمام/کنار گذاشته'], ['all', 'همه']].map(([k, l]) => h('button' + (filt === k ? '.on' : ''), { onclick: () => { sessionStorage.setItem('ld.pfilt', k); LD.router.refresh(); } }, l))),
      h('span.spacer'), h('button.btn.primary', { onclick: () => projPage.edit() }, ui.icon('plus', 16), ' پروژه')),
      h('div.kpis.sm', ui.kpi('تعداد پروژه', LD.fmt(list.length)), ui.kpi('کل سرمایه‌گذاری', LD.money(inv, true)), ui.kpi('کل بازگشت', LD.money(ret, true)),
        ui.kpi('سود کل', LD.money(ret - inv, true), null, ret - inv >= 0 ? 'good' : 'bad'), ui.kpi('ROI کل', inv ? LD.pct((ret - inv) / inv) : '—')));
    if (!list.length) { el.append(h('div.empty', 'پروژه‌ای ثبت نشده. پروژه‌های اقتصادی کوچک، توسعه سردخانه یا کافه را به‌صورت پروژه ثبت کنید و هزینه/درآمدشان را به پروژه نسبت دهید.')); return; }
    el.append(h('div.proj-grid', stats.map((x) => projectCard(x.p, x.i))));
    const g = h('div.grid2'); el.append(g);
    const b1 = h('div'), b2 = h('div'), b3 = h('div'), b4 = h('div');
    g.append(ui.card('مقایسه سرمایه و بازگشت', b1), ui.card('وزن پروژه‌ها: سرمایه × بازده (اندازه = سود)', b2), ui.card('سهم هر پروژه از سرمایه‌گذاری', b3));
    el.append(ui.card('تایم‌لاین پروژه‌ها', b4));
    requestAnimationFrame(() => {
      LD.chart.bars(b1, { labels: stats.map((x) => x.p.name.slice(0, 12)), series: [{ name: 'سرمایه', values: stats.map((x) => x.s.invested), color: 'var(--s2)' }, { name: 'بازگشت', values: stats.map((x) => x.s.returned), color: 'var(--s1)' }] });
      LD.chart.bubble(b2, { xLabel: 'سرمایه‌گذاری (تومان)', yLabel: 'بازده (ROI)', points: stats.filter((x) => x.s.invested).map((x) => ({ x: x.s.invested, y: x.s.roi || 0, r: Math.abs(x.s.profit) || 1, label: x.p.name, color: projColor(x.p, x.i), onclick: () => LD.router.go('projects/' + x.p.id), tip: `<b>${LD.esc(x.p.name)}</b><br>سرمایه: ${LD.money(x.s.invested)}<br>بازده: ${LD.pct(x.s.roi)}<br>سود: ${LD.money(x.s.profit)}` })) });
      LD.chart.donut(b3, { items: stats.map((x) => ({ label: x.p.name, value: x.s.invested, color: projColor(x.p, x.i) })), center: LD.money(inv, true) });
      LD.chart.gantt(b4, { rows: stats.map((x) => ({ label: x.p.name, start: x.p.startDate, end: x.p.endDate, progress: x.s.progress, milestones: x.p.milestones, color: projColor(x.p, x.i) })) });
    });
  };
  LD.pages.projects = projPage;

  /* ================= ایده‌ها ================= */
  const IST = [['raw', 'خام'], ['review', 'در حال بررسی'], ['ready', 'آماده اجرا'], ['project', 'تبدیل به پروژه'], ['dropped', 'کنار گذاشته']];
  const score = (x) => ((Number(x.impact) || 0) * 2 - (Number(x.effort) || 0) + (x.urgency === 'high' ? 2 : x.urgency === 'mid' ? 1 : 0));
  const toProject = (idea) => LD.pages.projects.edit({ name: idea.title, desc: idea.desc, budget: idea.estCost, expectedReturn: idea.estIncome, unitId: idea.unitId && idea.unitId !== 'personal' ? idea.unitId : 'projects', status: 'planning', ideaId: idea.id, startDate: LD.todayISO(), milestones: [], partners: [] });
  const ideaPage = LD.crud({
    col: 'ideas', title: 'ایده‌ها', single: 'ایده',
    defaults: () => ({ status: 'raw', impact: 3, effort: 3, urgency: 'mid', domain: sessionStorage.getItem('ld.idom') || LD.state.data.settings.domains[0], unitId: 'personal' }),
    fields: () => [
      { k: 'title', label: 'عنوان ایده', required: true },
      { k: 'desc', label: 'شرح', type: 'textarea', rows: 4 },
      { k: 'domain', label: 'حوزه', type: 'select', options: () => LD.state.data.settings.domains.map((d) => [d, d]), half: true },
      { k: 'status', label: 'وضعیت', type: 'select', options: IST, half: true },
      { k: 'impact', label: 'اثر / ارزش', type: 'rating', half: true },
      { k: 'effort', label: 'سختی / هزینه اجرا', type: 'rating', half: true },
      { k: 'urgency', label: 'فوریت', type: 'select', options: [['low', 'کم'], ['mid', 'متوسط'], ['high', 'زیاد']], half: true },
      { k: 'unitId', label: 'واحد مرتبط', type: 'select', options: units, half: true },
      { k: 'estCost', label: 'برآورد هزینه', type: 'money', half: true },
      { k: 'estIncome', label: 'برآورد درآمد/سود', type: 'money', half: true },
      { k: 'link', label: 'لینک / منبع', inputType: 'url', voice: false },
      { k: 'tags', label: 'برچسب‌ها', type: 'tags' },
    ],
    extra: (v) => v.id && LD.db.get('ideas', v.id) && !v.projectId ? h('button.btn.sm', { type: 'button', onclick: (e) => { e.target.closest('.modal-back').remove(); toProject(LD.db.get('ideas', v.id)); } }, '⇦ تبدیل این ایده به پروژه') : (v.projectId ? h('a.link', { href: '#/projects/' + v.projectId, onclick: () => document.querySelector('.modal-back').remove() }, 'مشاهده پروژه ←') : null),
  });

  function kanban(el, ideas) {
    const board = h('div.kanban');
    IST.forEach(([st, label]) => {
      const items = ideas.filter((x) => (x.status || 'raw') === st).sort((a, b) => score(b) - score(a));
      board.append(h('div.kcol', { 'data-st': st }, h('div.kcol-head', h('b', label), h('span.badge', LD.fmt(items.length))),
        h('div.kcol-body', items.map((x) => h('div.kcard', { 'data-id': x.id, onclick: () => ideaPage.edit(x) },
          h('span.grip', { title: 'جابجایی', 'aria-label': 'جابجایی', onclick: (e) => e.stopPropagation() }, '⋮⋮'),
          h('b', x.title), h('div.kmeta', ui.badge(x.domain || '—'), h('span.small', 'اثر ' + LD.faNum(x.impact || 0) + ' · سختی ' + LD.faNum(x.effort || 0)), x.estIncome ? h('span.small.muted', LD.money(x.estIncome, true)) : null)))),
        h('button.kadd', { onclick: () => ideaPage.edit({ status: st }) }, '+ افزودن')));
    });
    /* کشیدن و رها کردن با Pointer Events (روی موبایل و دسکتاپ) */
    let drag = null;
    board.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('.grip'); if (!grip) return;
      const card = grip.closest('.kcard'); e.preventDefault();
      const r = card.getBoundingClientRect();
      const ghost = card.cloneNode(true); ghost.classList.add('ghost'); ghost.style.width = r.width + 'px';
      document.body.appendChild(ghost);
      drag = { card, ghost, dx: e.clientX - r.left, dy: e.clientY - r.top };
      card.classList.add('dragging'); grip.setPointerCapture(e.pointerId);
      move(e);
    });
    const colAt = (x, y) => { const el2 = document.elementFromPoint(x, y); return el2 && el2.closest('.kcol'); };
    const move = (e) => {
      if (!drag) return;
      drag.ghost.style.left = (e.clientX - drag.dx) + 'px'; drag.ghost.style.top = (e.clientY - drag.dy) + 'px';
      board.querySelectorAll('.kcol').forEach((c) => c.classList.remove('over'));
      const c = colAt(e.clientX, e.clientY); if (c) c.classList.add('over');
      const bw = board.getBoundingClientRect();
      if (e.clientX < bw.left + 40) board.scrollLeft -= 12; else if (e.clientX > bw.right - 40) board.scrollLeft += 12;
    };
    board.addEventListener('pointermove', move);
    board.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const c = colAt(e.clientX, e.clientY), id = drag.card.dataset.id;
      drag.ghost.remove(); drag.card.classList.remove('dragging'); drag = null;
      board.querySelectorAll('.kcol').forEach((x) => x.classList.remove('over'));
      if (c) {
        const idea = LD.db.get('ideas', id);
        if (idea && idea.status !== c.dataset.st) {
          if (c.dataset.st === 'project' && !idea.projectId) { toProject(idea); return; }
          LD.db.put('ideas', { id, status: c.dataset.st }); LD.router.refresh();
        }
      }
    });
    board.addEventListener('pointercancel', () => { if (drag) { drag.ghost.remove(); drag.card.classList.remove('dragging'); drag = null; } });
    el.append(board);
  }

  ideaPage.render = (el) => {
    const view = sessionStorage.getItem('ld.iview') || 'kanban', dom = sessionStorage.getItem('ld.idom') || '';
    const q = sessionStorage.getItem('ld.iq') || '';
    const domains = LD.state.data.settings.domains;
    let ideas = LD.db.list('ideas').filter((x) => (!dom || x.domain === dom) && (!q || LD.normalize(x.title + ' ' + (x.desc || '') + ' ' + (x.tags || []).join(' ')).includes(LD.normalize(q))));
    const setS = (k, v) => { sessionStorage.setItem(k, v); LD.router.refresh(); };
    const search = h('input.search', { type: 'search', placeholder: 'جستجو در ایده‌ها…', value: q });
    search.addEventListener('change', () => setS('ld.iq', search.value));
    el.append(h('div.toolbar', h('div.seg', [['kanban', 'بُرد'], ['matrix', 'ماتریس اثر/سختی'], ['list', 'فهرست']].map(([k, l]) => h('button' + (view === k ? '.on' : ''), { onclick: () => setS('ld.iview', k) }, l))),
      search, h('span.spacer'),
      h('button.btn', { onclick: () => LD.voice.quickVoice() }, ui.icon('mic', 16), ' ایده صوتی'),
      h('button.btn.primary', { onclick: () => ideaPage.edit() }, ui.icon('plus', 16), ' ایده')),
      h('div.chips', h('button.chip' + (!dom ? '.on' : ''), { onclick: () => setS('ld.idom', '') }, 'همه حوزه‌ها (' + LD.faNum(LD.db.list('ideas').length) + ')'),
        domains.map((d) => h('button.chip' + (dom === d ? '.on' : ''), { onclick: () => setS('ld.idom', d) }, d + ' (' + LD.faNum(LD.db.list('ideas').filter((x) => x.domain === d).length) + ')')),
        h('button.chip.ghost', { onclick: () => domainEditor() }, '✎ حوزه‌ها')));
    if (view === 'kanban') kanban(el, ideas);
    else if (view === 'matrix') {
      const box = h('div'); el.append(ui.card('ماتریس اثر / سختی — ایده‌های گوشه بالا-راست را اول اجرا کنید', box));
      const live = ideas.filter((x) => !['dropped', 'project'].includes(x.status));
      requestAnimationFrame(() => LD.chart.bubble(box, {
        height: 380, xLabel: 'سختی اجرا ←', yLabel: 'اثر و ارزش', xDomain: [5.5, 0.5], yDomain: [0.5, 5.5], xTicks: [5, 4, 3, 2, 1], yTicks: [1, 2, 3, 4, 5],xFmt: (v) => LD.faNum(Math.round(v)), yFmt: (v) => LD.faNum(Math.round(v)),
        quadrants: [{ label: 'پروژه‌های بزرگ' }, { label: 'سریع و ارزشمند ★', hi: true }, { label: 'وقت‌گیر و کم‌اثر' }, { label: 'کارهای کوچک' }],
        points: live.map((x, i) => ({ x: (Number(x.effort) || 3) + ((i % 3) - 1) * 0.12, y: (Number(x.impact) || 3) + ((i % 2) ? 0.1 : -0.1), fixedR: 9, label: x.title, color: LD.chart.S(domains.indexOf(x.domain) >= 0 ? domains.indexOf(x.domain) % 3 : 0), onclick: () => ideaPage.edit(x), tip: `<b>${LD.esc(x.title)}</b><br>${LD.esc(x.domain || '')}<br>اثر ${x.impact} · سختی ${x.effort}` })),
      }));
    } else {
      el.append(ui.table({ rows: ideas.sort((a, b) => score(b) - score(a)), onRow: (x) => ideaPage.edit(x), cols: [
        { label: 'عنوان', get: (x) => x.title }, { label: 'حوزه', get: (x) => ui.badge(x.domain || '—') },
        { label: 'وضعیت', get: (x) => (IST.find((s) => s[0] === x.status) || IST[0])[1] },
        { label: 'اثر', num: true, get: (x) => LD.faNum(x.impact || 0) }, { label: 'سختی', num: true, get: (x) => LD.faNum(x.effort || 0) },
        { label: 'امتیاز', num: true, get: (x) => LD.faNum(score(x)) }, { label: 'برآورد سود', num: true, get: (x) => x.estIncome ? LD.money(x.estIncome, true) : '—' },
        { label: 'تاریخ', get: (x) => J.fmt(x.createdAt.slice(0, 10)) },
      ] }));
    }
  };
  const domainEditor = () => ui.form({
    title: 'حوزه‌های ایده', value: { list: LD.state.data.settings.domains.map((d) => ({ name: d })) },
    fields: [{ k: 'list', label: 'حوزه‌ها', type: 'list', addLabel: 'حوزه', fields: [{ k: 'name', label: 'نام حوزه', placeholder: 'نام حوزه' }] }],
    onSave: (v) => { LD.db.setSettings({ domains: v.list.map((x) => (x.name || '').trim()).filter(Boolean) }); LD.router.refresh(); },
  });
  LD.pages.ideas = ideaPage;
  LD.IDEA_STATUS = IST;
})();
