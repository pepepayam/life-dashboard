/* گزارش‌ها و تحلیل‌های قابل چاپ + گزارش‌ساز سفارشی */
'use strict';
(() => {
  const h = LD.h, ui = LD.ui, F = LD.fin, J = LD.J;

  /* چاپ یک بخش از صفحه (کپی در ریشه چاپ) */
  LD.printNode = (node, title) => {
    const root = document.getElementById('print-root');
    root.innerHTML = '';
    root.append(h('div.print-head', h('b', title || 'گزارش'), h('span', 'تاریخ تهیه: ' + J.fmt(LD.todayISO(), true))), node.cloneNode(true));
    root.querySelectorAll('.no-print, button, .mic').forEach((x) => x.remove());
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  };

  const sec = (title, ...body) => h('section.r-sec', h('h3', title), ...body);
  const chartBox = (fn) => { const b = h('div.r-chart'); requestAnimationFrame(() => fn(b)); return b; };
  const sumBy = (rows, key) => Object.entries(LD.groupBy(rows, key)).map(([k, a]) => ({ k, value: LD.sum(a, (x) => x.amount), n: a.length }));
  const unitList = (u) => u === 'all' ? LD.db.list('units') : [LD.db.get('units', u)];

  /* ---- تعریف گزارش‌ها: هر کدام (ctx) => Node ---- */
  const REPORTS = {
    pnl: {
      title: 'سود و زیان', desc: 'درآمد، هزینه و سود هر واحد و تجمیعی', period: true,
      run({ from, to, unit }) {
        const p = F.pnl({ from, to, unitId: unit });
        const rows = unitList(unit).map((u) => Object.assign({ u }, F.pnl({ from, to, unitId: u.id })));
        const inc = sumBy(p.inc, (x) => x.categoryId || '').sort((a, b) => b.value - a.value);
        const exp = sumBy(p.exp, (x) => x.categoryId || '').sort((a, b) => b.value - a.value);
        const months = monthsBetween(from, to);
        return h('div',
          h('div.kpis.sm', ui.kpi('درآمد', LD.money(p.income)), ui.kpi('هزینه', LD.money(p.expense)), ui.kpi('سود خالص', LD.money(p.net), null, p.net >= 0 ? 'good' : 'bad'), ui.kpi('حاشیه سود', p.income ? LD.pct(p.net / p.income) : '—')),
          unit === 'all' ? sec('به تفکیک واحد', ui.table({ rows, cols: [
            { label: 'واحد', get: (r) => r.u.name }, { label: 'درآمد', num: true, get: (r) => LD.money(r.income) }, { label: 'هزینه', num: true, get: (r) => LD.money(r.expense) },
            { label: 'سود', num: true, get: (r) => h('span.amt.' + (r.net >= 0 ? 'pos' : 'neg'), LD.money(r.net)) }, { label: 'سهم از درآمد کل', num: true, get: (r) => p.income ? LD.pct(r.income / p.income) : '—' },
          ], footer: { 'واحد': 'جمع', 'درآمد': LD.money(p.income), 'هزینه': LD.money(p.expense), 'سود': LD.money(p.net) } })) : null,
          months.length > 1 ? sec('روند ماهانه', chartBox((b) => { const m = F.monthly({ unitId: unit }, months); LD.chart.bars(b, { labels: m.map((x) => x.label), series: [{ name: 'درآمد', values: m.map((x) => x.income), color: 'var(--s1)' }, { name: 'هزینه', values: m.map((x) => x.expense), color: 'var(--s2)' }] }); })) : null,
          h('div.grid2',
            sec('درآمد به تفکیک دسته', catTable(inc, p.income)),
            sec('هزینه به تفکیک دسته', catTable(exp, p.expense))));
      },
    },
    cashflow: {
      title: 'جریان نقدی و پیش‌بینی', desc: 'ورود و خروج پول ۶ ماه گذشته و پیش‌بینی ۳ ماه آینده بر اساس چک‌ها و اقساط',
      run({ unit }) {
        const past = F.monthly({ unitId: unit }, J.lastMonths(6));
        const avgNet = LD.sum(past.slice(-3), (x) => x.net) / 3;
        const d = LD.state.data, today = LD.todayISO();
        const next = [1, 2, 3].map((i) => J.monthKey(J.addMonths(today, i - 1)));
        const fut = next.map((k) => {
          const [y, m] = k.split('-').map(Number), [a, b] = J.monthRange(y, m);
          const inUnit = (x) => unit === 'all' || x.unitId === unit;
          const chIn = LD.sum(d.cheques.filter((c) => inUnit(c) && c.status === 'pending' && c.direction === 'in' && c.dueDate >= a && c.dueDate <= b), (c) => c.amount);
          const chOut = LD.sum(d.cheques.filter((c) => inUnit(c) && c.status === 'pending' && c.direction === 'out' && c.dueDate >= a && c.dueDate <= b), (c) => c.amount);
          let loans = 0;
          for (const l of d.loans) if (!l.closed && inUnit(l)) { const info = F.loanInfo(l); for (let j = 0; j < info.left; j++) { const due = J.addMonths(l.firstDue, (Number(l.paidCount) || 0) + j); if (due >= a && due <= b) loans += Number(l.installment) || 0; } }
          return { label: J.monthLabel(k), chIn, chOut, loans, base: avgNet, net: avgNet + chIn - chOut - loans };
        });
        const cash = F.accountsTotal(unit);
        let run = cash;
        return h('div',
          h('div.kpis.sm', ui.kpi('موجودی فعلی حساب‌ها', LD.money(cash)), ui.kpi('میانگین خالص ماهانه (۳ ماه اخیر)', LD.money(avgNet), null, avgNet >= 0 ? 'good' : 'bad')),
          sec('۶ ماه گذشته', chartBox((b) => LD.chart.bars(b, { labels: past.map((x) => x.label), series: [{ name: 'خالص ماهانه', values: past.map((x) => x.net), color: 'var(--s1)' }] })),
            ui.table({ rows: past, cols: [{ label: 'ماه', get: (x) => x.label }, { label: 'ورودی', num: true, get: (x) => LD.money(x.income) }, { label: 'خروجی', num: true, get: (x) => LD.money(x.expense) }, { label: 'خالص', num: true, get: (x) => h('span.amt.' + (x.net >= 0 ? 'pos' : 'neg'), LD.money(x.net)) }] })),
          sec('پیش‌بینی ۳ ماه آینده', ui.table({ rows: fut, cols: [
            { label: 'ماه', get: (x) => x.label }, { label: 'روند عادی', num: true, get: (x) => LD.money(x.base) },
            { label: 'چک دریافتی', num: true, get: (x) => LD.money(x.chIn) }, { label: 'چک پرداختی', num: true, get: (x) => LD.money(-x.chOut) },
            { label: 'اقساط', num: true, get: (x) => LD.money(-x.loans) }, { label: 'خالص پیش‌بینی', num: true, get: (x) => h('b.amt.' + (x.net >= 0 ? 'pos' : 'neg'), LD.money(x.net)) },
            { label: 'موجودی پایان ماه', num: true, get: (x) => { run += x.net; return h('span.amt.' + (run >= 0 ? 'neu' : 'neg'), LD.money(run)); } },
          ] }), h('p.muted.small', 'روند عادی = میانگین سود خالص ۳ ماه اخیر. چک‌ها و اقساط ثبت‌شده به آن اضافه/کم شده‌اند.')));
      },
    },
    balance: {
      title: 'ترازنامه و ارزش خالص', desc: 'دارایی‌ها، طلب‌ها، بدهی‌ها و ارزش خالص',
      run() {
        const b = F.balanceSheet(), d = LD.state.data;
        const row = (l, v) => ({ l, v });
        return h('div',
          h('div.kpis.sm', ui.kpi('جمع دارایی‌ها', LD.money(b.totalA)), ui.kpi('جمع بدهی‌ها', LD.money(b.totalL)), ui.kpi('ارزش خالص', LD.money(b.net), null, b.net >= 0 ? 'good' : 'bad')),
          h('div.grid2',
            sec('دارایی‌ها', ui.table({ rows: [row('موجودی حساب‌ها و نقد', b.cash), row('دارایی‌های ثابت و سرمایه‌گذاری', b.assets), row('طلب از اشخاص', b.recvDebts), row('چک‌های دریافتی وصول‌نشده', b.recvCheques), row('مطالبات سردخانه', b.recvCold)], cols: [{ label: 'شرح', get: (r) => r.l }, { label: 'مبلغ', num: true, get: (r) => LD.money(r.v) }], footer: { 'شرح': 'جمع', 'مبلغ': LD.money(b.totalA) } })),
            sec('بدهی‌ها', ui.table({ rows: [row('بدهی به اشخاص', b.payDebts), row('چک‌های پرداختی در جریان', b.payCheques), row('مانده وام‌ها', b.loans)], cols: [{ label: 'شرح', get: (r) => r.l }, { label: 'مبلغ', num: true, get: (r) => LD.money(r.v) }], footer: { 'شرح': 'جمع', 'مبلغ': LD.money(b.totalL) } }))),
          sec('ترکیب دارایی‌ها', chartBox((x) => LD.chart.donut(x, { items: [{ label: 'نقد و حساب‌ها', value: b.cash }, { label: 'دارایی‌ها', value: b.assets }, { label: 'طلب‌ها', value: b.recvDebts + b.recvCheques + b.recvCold }], center: LD.money(b.totalA, true) }))),
          sec('حساب‌ها', ui.table({ rows: d.accounts.filter((a) => !a.archived), cols: [{ label: 'حساب', get: (a) => a.name }, { label: 'واحد', get: (a) => F.unitName(a.unitId) }, { label: 'موجودی (تومان)', num: true, get: (a) => LD.money(F.accountBalance(a) * F.rate(a.currency)) }] })),
          sec('دارایی‌ها', ui.table({ rows: d.assets.filter((a) => !a.sold), cols: [{ label: 'دارایی', get: (a) => a.name }, { label: 'واحد', get: (a) => F.unitName(a.unitId) }, { label: 'ارزش', num: true, get: (a) => LD.money((Number(a.value) || 0) * (a.currency ? F.rate(a.currency) : 1) * (Number(a.qty) || 1)) }] })));
      },
    },
    expenses: {
      title: 'تحلیل هزینه‌ها', desc: 'ریز هزینه بر اساس دسته و مقایسه با دوره قبل', period: true,
      run({ from, to, unit }) {
        if (!from) return h('p.muted', 'برای مقایسه، یک بازه زمانی مشخص انتخاب کنید.');
        const len = LD.daysBetween(from, to) + 1, pf = LD.addDays(from, -len), pt = LD.addDays(from, -1);
        const cur = F.pnl({ from, to, unitId: unit }), prev = F.pnl({ from: pf, to: pt, unitId: unit });
        const key = (x) => x.unitId + '|' + (x.categoryId || '');
        const c = LD.groupBy(cur.exp, key), p = LD.groupBy(prev.exp, key);
        const rows = [...new Set([...Object.keys(c), ...Object.keys(p)])].map((k) => ({ k, unit: k.split('|')[0], cat: k.split('|')[1], cur: LD.sum(c[k] || [], (x) => x.amount), prev: LD.sum(p[k] || [], (x) => x.amount) })).sort((a, b) => b.cur - a.cur);
        const top = cur.exp.slice().sort((a, b) => b.amount - a.amount).slice(0, 10);
        return h('div',
          h('div.kpis.sm', ui.kpi('هزینه این دوره', LD.money(cur.expense)), ui.kpi('دوره قبل (' + J.fmt(pf) + ' تا ' + J.fmt(pt) + ')', LD.money(prev.expense)), ui.kpi('تغییر', prev.expense ? LD.pct((cur.expense - prev.expense) / prev.expense) : '—', null, cur.expense > prev.expense ? 'bad' : 'good')),
          sec('سهم دسته‌ها', chartBox((b) => LD.chart.hbars(b, { items: rows.map((r) => ({ label: F.catName(r.cat) + (unit === 'all' ? ' (' + F.unitName(r.unit) + ')' : ''), value: r.cur })), color: 'var(--s2)', max: 12 }))),
          sec('مقایسه با دوره قبل', ui.table({ rows, cols: [
            { label: 'دسته', get: (r) => F.catName(r.cat) }, { label: 'واحد', get: (r) => F.unitName(r.unit) },
            { label: 'این دوره', num: true, get: (r) => LD.money(r.cur) }, { label: 'دوره قبل', num: true, get: (r) => LD.money(r.prev) },
            { label: 'تغییر', num: true, get: (r) => r.prev ? h('span.amt.' + (r.cur > r.prev ? 'neg' : 'pos'), (r.cur >= r.prev ? '▲ ' : '▼ ') + LD.pct(Math.abs(r.cur - r.prev) / r.prev)) : (r.cur ? 'جدید' : '—') },
          ] })),
          sec('۱۰ هزینه بزرگ', ui.table({ rows: top, cols: [{ label: 'تاریخ', get: (x) => J.fmt(x.date) }, { label: 'شرح', get: (x) => x.desc || F.catName(x.categoryId) }, { label: 'واحد', get: (x) => F.unitName(x.unitId) }, { label: 'مبلغ', num: true, get: (x) => LD.money(x.amount) }] })));
      },
    },
    coldstore: {
      title: 'گزارش سردخانه', desc: 'موجودی اتاق‌ها، محصولات، مطالبات و سود', period: true, noUnit: true,
      run({ from, to }) {
        const lots = LD.state.data.csLots, active = lots.filter((l) => !l.outDate || l.outDate > LD.todayISO());
        const recv = F.coldstoreReceivables().sort((a, b) => b.balance - a.balance);
        const p = F.pnl({ from, to, unitId: 'coldstore' });
        const inPeriod = lots.filter((l) => (!from || l.inDate >= from) && (!to || l.inDate <= to));
        const byProd = Object.entries(LD.groupBy(active, (l) => l.product)).map(([k, a]) => ({ k, kg: LD.sum(a, (l) => l.weightKg), ct: LD.sum(a, (l) => l.cartons), n: a.length }));
        const byRoom = Object.entries(LD.groupBy(active, (l) => l.room || 'بدون اتاق')).map(([k, a]) => ({ k, kg: LD.sum(a, (l) => l.weightKg), ct: LD.sum(a, (l) => l.cartons), cap: ((LD.state.data.settings.coldRooms || []).find((r) => r.name === k) || {}).capacityKg }));
        return h('div',
          h('div.kpis.sm', ui.kpi('درآمد دوره', LD.money(p.income)), ui.kpi('هزینه دوره', LD.money(p.expense)), ui.kpi('سود دوره', LD.money(p.net), null, p.net >= 0 ? 'good' : 'bad'),
            ui.kpi('ورودی در دوره', LD.fmt(LD.sum(inPeriod, (l) => l.weightKg) / 1000, 1) + ' تن'), ui.kpi('موجودی فعلی', LD.fmt(LD.sum(active, (l) => l.weightKg) / 1000, 1) + ' تن'), ui.kpi('کل مطالبات', LD.money(LD.sum(recv, (r) => r.balance)), null, 'bad')),
          h('div.grid2',
            sec('موجودی اتاق‌ها', ui.table({ rows: byRoom, cols: [{ label: 'اتاق', get: (r) => r.k }, { label: 'کیلوگرم', num: true, get: (r) => LD.fmt(r.kg) }, { label: 'کارتن', num: true, get: (r) => LD.fmt(r.ct) }, { label: 'اشغال', num: true, get: (r) => r.cap ? LD.pct(r.kg / r.cap) : '—' }] })),
            sec('موجودی محصولات', ui.table({ rows: byProd, cols: [{ label: 'محصول', get: (r) => r.k }, { label: 'محموله', num: true, get: (r) => LD.fmt(r.n) }, { label: 'کیلوگرم', num: true, get: (r) => LD.fmt(r.kg) }, { label: 'کارتن', num: true, get: (r) => LD.fmt(r.ct) }] }))),
          sec('مطالبات از مشتریان', ui.table({ rows: recv, empty: 'مطالبه‌ای وجود ندارد', cols: [{ label: 'مشتری', get: (r) => F.personName(r.personId) }, { label: 'تلفن', get: (r) => { const x = LD.db.get('people', r.personId); return x && x.phone ? LD.faNum(x.phone) : '—'; } }, { label: 'جمع کرایه', num: true, get: (r) => LD.money(r.fees) }, { label: 'پرداختی', num: true, get: (r) => LD.money(r.paid) }, { label: 'مانده', num: true, get: (r) => h('b', LD.money(r.balance)) }] })),
          sec('هزینه‌های سردخانه', catTable(sumBy(p.exp, (x) => x.categoryId || '').sort((a, b) => b.value - a.value), p.expense)));
      },
    },
    cafe: {
      title: 'گزارش کافه', desc: 'فروش، روزهای هفته، نسبت مواد اولیه و سود', period: true, noUnit: true,
      run({ from, to }) {
        const sales = LD.state.data.cafeSales.filter((s) => (!from || s.date >= from) && (!to || s.date <= to));
        const tot = (s) => (Number(s.cash) || 0) + (Number(s.card) || 0) + (Number(s.online) || 0);
        const total = LD.sum(sales, tot), p = F.pnl({ from, to, unitId: 'cafe' });
        const food = LD.sum(p.exp.filter((x) => F.catName(x.categoryId) === 'مواد اولیه'), (x) => x.amount);
        const staff = LD.sum(p.exp.filter((x) => F.catName(x.categoryId) === 'حقوق پرسنل'), (x) => x.amount);
        const order = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
        const byW = LD.groupBy(sales, (s) => J.weekday(s.date));
        const best = sales.slice().sort((a, b) => tot(b) - tot(a)).slice(0, 5);
        return h('div',
          h('div.kpis.sm', ui.kpi('فروش', LD.money(total)), ui.kpi('سود خالص', LD.money(p.net), null, p.net >= 0 ? 'good' : 'bad'), ui.kpi('میانگین روزانه', LD.money(sales.length ? total / sales.length : 0)),
            ui.kpi('مواد اولیه / فروش', total ? LD.pct(food / total) : '—'), ui.kpi('حقوق / فروش', total ? LD.pct(staff / total) : '—'),
            ui.kpi('سهم کارتخوان و آنلاین', total ? LD.pct(LD.sum(sales, (s) => (Number(s.card) || 0) + (Number(s.online) || 0)) / total) : '—')),
          sec('میانگین فروش روزهای هفته', chartBox((b) => LD.chart.bars(b, { labels: order, series: [{ name: 'میانگین فروش', values: order.map((d) => byW[d] ? LD.sum(byW[d], tot) / byW[d].length : 0), color: 'var(--s3)' }] }))),
          h('div.grid2',
            sec('هزینه‌ها', catTable(sumBy(p.exp, (x) => x.categoryId || '').sort((a, b) => b.value - a.value), p.expense)),
            sec('۵ روز پرفروش', ui.table({ rows: best, cols: [{ label: 'روز', get: (s) => J.fmt(s.date) + ' ' + J.weekday(s.date) }, { label: 'فروش', num: true, get: (s) => LD.money(tot(s)) }] }))));
      },
    },
    projects: {
      title: 'گزارش پروژه‌ها', desc: 'سرمایه، بازگشت، بازده و پیشرفت همه پروژه‌ها', noUnit: true,
      run() {
        const all = LD.state.data.projects, st = all.map((p, i) => ({ p, i, s: F.projectStats(p) }));
        const inv = LD.sum(st, (x) => x.s.invested), ret = LD.sum(st, (x) => x.s.returned);
        return h('div',
          h('div.kpis.sm', ui.kpi('تعداد', LD.fmt(all.length)), ui.kpi('کل سرمایه', LD.money(inv)), ui.kpi('کل بازگشت', LD.money(ret)), ui.kpi('ROI کل', inv ? LD.pct((ret - inv) / inv) : '—')),
          sec('جدول پروژه‌ها', ui.table({ rows: st, cols: [
            { label: 'پروژه', get: (x) => x.p.name }, { label: 'وضعیت', get: (x) => x.p.status }, { label: 'پیشرفت', num: true, get: (x) => LD.pct(x.s.progress) },
            { label: 'بودجه', num: true, get: (x) => x.s.budget ? LD.money(x.s.budget) : '—' }, { label: 'سرمایه', num: true, get: (x) => LD.money(x.s.invested) },
            { label: 'بازگشت', num: true, get: (x) => LD.money(x.s.returned) }, { label: 'سود', num: true, get: (x) => h('span.amt.' + (x.s.profit >= 0 ? 'pos' : 'neg'), LD.money(x.s.profit)) },
            { label: 'ROI', num: true, get: (x) => x.s.roi === null ? '—' : LD.pct(x.s.roi) },
          ] })),
          sec('سرمایه و بازگشت', chartBox((b) => LD.chart.bars(b, { labels: st.map((x) => x.p.name.slice(0, 12)), series: [{ name: 'سرمایه', values: st.map((x) => x.s.invested), color: 'var(--s2)' }, { name: 'بازگشت', values: st.map((x) => x.s.returned), color: 'var(--s1)' }] }))),
          sec('تایم‌لاین', chartBox((b) => LD.chart.gantt(b, { rows: st.map((x) => ({ label: x.p.name, start: x.p.startDate, end: x.p.endDate, progress: x.s.progress, milestones: x.p.milestones, color: LD.chart.S(x.i) })) }))));
      },
    },
    ideas: {
      title: 'دفتر ایده‌ها', desc: 'ایده‌ها به تفکیک حوزه و امتیاز', noUnit: true,
      run() {
        const ideas = LD.state.data.ideas.filter((x) => x.status !== 'dropped');
        const sc = (x) => ((Number(x.impact) || 0) * 2 - (Number(x.effort) || 0) + (x.urgency === 'high' ? 2 : x.urgency === 'mid' ? 1 : 0));
        const by = LD.groupBy(ideas, (x) => x.domain || 'بدون حوزه');
        return h('div', h('div.kpis.sm', ui.kpi('ایده‌های فعال', LD.fmt(ideas.length)), ui.kpi('آماده اجرا', LD.fmt(ideas.filter((x) => x.status === 'ready').length)), ui.kpi('تبدیل‌شده به پروژه', LD.fmt(ideas.filter((x) => x.status === 'project').length))),
          Object.entries(by).map(([d, list]) => sec(d, ui.table({ rows: list.sort((a, b) => sc(b) - sc(a)), cols: [
            { label: 'ایده', get: (x) => h('div', h('b', x.title), x.desc ? h('div.small.muted', x.desc.slice(0, 160)) : null) },
            { label: 'وضعیت', get: (x) => (LD.IDEA_STATUS.find((s) => s[0] === x.status) || LD.IDEA_STATUS[0])[1] },
            { label: 'اثر', num: true, get: (x) => LD.faNum(x.impact || 0) }, { label: 'سختی', num: true, get: (x) => LD.faNum(x.effort || 0) },
            { label: 'امتیاز', num: true, get: (x) => LD.faNum(sc(x)) }, { label: 'برآورد سود', num: true, get: (x) => x.estIncome ? LD.money(x.estIncome) : '—' },
          ] }))));
      },
    },
    obligations: {
      title: 'تعهدات و سررسیدها', desc: 'چک‌ها، اقساط، طلب‌ها و یادآورهای ۹۰ روز آینده', noUnit: true,
      run() {
        const up = F.upcoming(90);
        const inSum = LD.sum(up.filter((x) => x.sign > 0), (x) => x.amount), outSum = LD.sum(up.filter((x) => x.sign < 0), (x) => x.amount);
        return h('div', h('div.kpis.sm', ui.kpi('ورودی‌های قطعی', LD.money(inSum), null, 'good'), ui.kpi('خروجی‌های قطعی', LD.money(outSum), null, 'bad'), ui.kpi('معوق', LD.fmt(up.filter((x) => x.overdue).length) + ' مورد')),
          sec('فهرست به ترتیب تاریخ', ui.table({ rows: up, cols: [
            { label: 'تاریخ', get: (x) => h('span' + (x.overdue ? '.overdue-t' : ''), J.fmt(x.date) + ' ' + J.weekday(x.date)) }, { label: 'نوع', get: (x) => x.kind },
            { label: 'شرح', get: (x) => x.title }, { label: 'مبلغ', num: true, get: (x) => x.amount ? h('span.amt.' + (x.sign > 0 ? 'pos' : x.sign < 0 ? 'neg' : 'neu'), LD.money(x.amount)) : '—' },
          ] })));
      },
    },
  };
  const catTable = (rows, total) => ui.table({ rows, empty: 'موردی نیست', cols: [{ label: 'دسته', get: (r) => F.catName(r.k) }, { label: 'تعداد', num: true, get: (r) => LD.fmt(r.n) }, { label: 'مبلغ', num: true, get: (r) => LD.money(r.value) }, { label: 'سهم', num: true, get: (r) => total ? LD.pct(r.value / total) : '—' }], footer: { 'دسته': 'جمع', 'مبلغ': LD.money(total) } });
  const monthsBetween = (from, to) => {
    if (!from) return J.lastMonths(12);
    const out = []; let k = J.monthKey(from); const end = J.monthKey(to || LD.todayISO()); let g = 0;
    while (k <= end && g++ < 60) { out.push(k); const [y, m] = k.split('-').map(Number); k = m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0'); }
    return out;
  };

  /* ---------- گزارش‌ساز سفارشی ---------- */
  const DIMS = { category: ['دسته', (x) => F.catName(x.categoryId)], unit: ['واحد', (x) => F.unitName(x.unitId)], month: ['ماه', (x) => J.monthKey(x.date)], project: ['پروژه', (x) => x.projectId ? F.projectName(x.projectId) : 'بدون پروژه'],
    person: ['شخص', (x) => x.personId ? F.personName(x.personId) : 'نامشخص'], account: ['حساب', (x) => F.accountName(x.accountId)], weekday: ['روز هفته', (x) => J.weekday(x.date)], tag: ['برچسب', (x) => (x.tags && x.tags[0]) || 'بدون برچسب'], type: ['نوع', (x) => ({ income: 'درآمد', expense: 'هزینه', transfer: 'انتقال' }[x.type])] };

  /* تبدیل سؤال فارسی به تنظیمات گزارش */
  function parseQuestion(q, cfg) {
    const s = ' ' + LD.normalize(q) + ' ', t = J.toJalali(LD.todayISO()), c = Object.assign({}, cfg);
    if (/درآمد|فروش|دریافت/.test(s)) c.type = 'income'; else if (/هزینه|خرج|پرداخت|خرید/.test(s)) c.type = 'expense';
    if (/امسال/.test(s)) c.period = 'year'; else if (/پارسال|سال قبل|سال گذشته/.test(s)) c.period = 'lastyear'; else if (/ماه قبل|ماه گذشته|ماه پیش/.test(s)) c.period = 'prev'; else if (/این ماه/.test(s)) c.period = 'month'; else if (/فصل/.test(s)) c.period = 'quarter';
    const mi = J.MONTHS.findIndex((m) => s.includes(' ' + m));
    if (mi >= 0) { const y = mi + 1 > t.jm ? t.jy - 1 : t.jy; const [a, b] = J.monthRange(y, mi + 1); c.period = 'custom'; c.from = a; c.to = b; }
    for (const u of LD.db.list('units')) if ([u.name, ...(u.aliases || '').split(' ')].filter((x) => x.length > 2).some((n) => s.includes(LD.normalize(n)))) c.unit = u.id;
    const cat = LD.db.list('categories').filter((x) => (!c.unit || c.unit === 'all' || x.unitId === c.unit) && (!c.type || x.type === c.type)).find((x) => s.includes(LD.normalize(x.name).split(' ')[0]));
    c.categoryId = cat ? cat.id : '';
    if (cat && (!c.unit || c.unit === 'all')) c.unit = cat.unitId;
    const pr = LD.db.list('projects').find((x) => s.includes(LD.normalize(x.name))); c.projectId = pr ? pr.id : '';
    const pe = LD.db.list('people').find((x) => s.includes(LD.normalize(x.name))); c.personId = pe ? pe.id : '';
    if (/ماهانه|هر ماه|روند|به تفکیک ماه/.test(s)) c.group = 'month'; else if (/روز.? هفته/.test(s)) c.group = 'weekday'; else if (/به تفکیک واحد|هر واحد/.test(s)) c.group = 'unit'; else if (/پروژه/.test(s) && !pr) c.group = 'project'; else if (/مشتری|شخص|اشخاص|کی/.test(s) && !pe) c.group = 'person'; else if (/حساب/.test(s)) c.group = 'account'; else c.group = c.categoryId ? 'month' : 'category';
    c.chart = c.group === 'month' ? 'line' : 'hbar';
    c.title = q;
    return c;
  }

  function builder(el, cfg, onRun) {
    const set = (k, v) => { cfg[k] = v; onRun(); };
    const sel = (k, opts, label) => h('label.mini', h('span', label), h('select', { onchange: (e) => set(k, e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: String(cfg[k] || '') === String(v) }, l))));
    const qIn = h('input', { type: 'text', placeholder: 'سؤال خود را بنویسید یا بگویید؛ مثلاً: هزینه برق سردخانه امسال ماهانه', value: cfg.title && cfg.custom ? cfg.title : '' });
    const ask = () => { if (!qIn.value.trim()) return; Object.assign(cfg, parseQuestion(qIn.value, cfg), { custom: true }); onRun(true); };
    qIn.addEventListener('keydown', (e) => e.key === 'Enter' && ask());
    const fromIn = h('input.date-input', { type: 'text', value: cfg.from ? J.fmt(cfg.from) : '', placeholder: 'از' }), toIn = h('input.date-input', { type: 'text', value: cfg.to ? J.fmt(cfg.to) : '', placeholder: 'تا' });
    [[fromIn, 'from'], [toIn, 'to']].forEach(([inp, k]) => { inp.addEventListener('focus', () => ui.datePicker(inp, (iso) => set(k, iso))); inp.addEventListener('change', () => { const iso = J.parse(inp.value); if (iso) set(k, iso); }); });
    el.append(h('div.ask', h('div.inp.has-mic', qIn, LD.voice.micButton(qIn)), h('button.btn.primary', { onclick: ask }, 'پاسخ بده')),
      h('div.builder',
        sel('type', [['', 'همه'], ['income', 'درآمد'], ['expense', 'هزینه']], 'نوع'),
        sel('unit', [['all', 'همه واحدها'], ...LD.db.list('units').map((u) => [u.id, u.name])], 'واحد'),
        sel('categoryId', [['', 'همه دسته‌ها'], ...LD.db.list('categories').filter((c) => (cfg.unit === 'all' || !cfg.unit || c.unitId === cfg.unit) && (!cfg.type || c.type === cfg.type)).map((c) => [c.id, c.name + (cfg.unit === 'all' ? ' (' + F.unitName(c.unitId) + ')' : '')])], 'دسته'),
        sel('projectId', [['', 'همه'], ...LD.db.list('projects').map((p) => [p.id, p.name])], 'پروژه'),
        sel('personId', [['', 'همه'], ...LD.db.list('people').map((p) => [p.id, p.name])], 'شخص'),
        sel('period', [...LD.periods().map(([k, l]) => [k, l]), ['custom', 'بازه دلخواه']], 'بازه'),
        cfg.period === 'custom' ? h('label.mini.dp-wrap', h('span', 'از / تا'), h('div.row2', fromIn, toIn)) : null,
        sel('group', Object.entries(DIMS).map(([k, v]) => [k, v[0]]), 'گروه‌بندی'),
        sel('measure', [['sum', 'جمع مبلغ'], ['count', 'تعداد'], ['avg', 'میانگین']], 'معیار'),
        sel('chart', [['hbar', 'میله افقی'], ['bars', 'میله‌ای'], ['line', 'خطی'], ['donut', 'دونات'], ['none', 'بدون نمودار']], 'نمودار')));
  }

  function runCustom(cfg) {
    const [pf, pt] = cfg.period === 'custom' ? [cfg.from, cfg.to] : LD.periodRange(cfg.period || 'year');
    const rows = F.filter(F.flows(), { from: pf, to: pt, unitId: cfg.unit, type: cfg.type, categoryId: cfg.categoryId, projectId: cfg.projectId, personId: cfg.personId }).filter((x) => cfg.type || x.type !== 'transfer');
    const [label, fn] = DIMS[cfg.group || 'category'];
    let groups = Object.entries(LD.groupBy(rows, fn)).map(([k, a]) => ({ k, n: a.length, sum: LD.sum(a, (x) => x.type === 'expense' && !cfg.type ? -x.amount : x.amount) }));
    groups.forEach((g) => { g.value = cfg.measure === 'count' ? g.n : cfg.measure === 'avg' ? g.sum / g.n : g.sum; });
    if (cfg.group === 'month') { const ms = monthsBetween(pf || (rows.length ? rows.map((x) => x.date).sort()[0] : ''), pt); groups = ms.map((k) => groups.find((g) => g.k === k) || { k, n: 0, sum: 0, value: 0 }); groups.forEach((g) => (g.label = J.monthLabel(g.k))); }
    else groups.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    if (cfg.group === 'weekday') { const order = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']; groups.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k)); }
    groups.forEach((g) => (g.label = g.label || g.k));
    const total = LD.sum(rows, (x) => x.type === 'expense' && !cfg.type ? -x.amount : x.amount);
    const fmtV = (v) => cfg.measure === 'count' ? LD.fmt(v) : LD.money(v);
    const desc = [cfg.type ? { income: 'درآمد', expense: 'هزینه' }[cfg.type] : 'درآمد و هزینه (خالص)', cfg.unit && cfg.unit !== 'all' ? F.unitName(cfg.unit) : 'همه واحدها', cfg.categoryId ? F.catName(cfg.categoryId) : null, cfg.projectId ? 'پروژه ' + F.projectName(cfg.projectId) : null, cfg.personId ? F.personName(cfg.personId) : null, pf ? J.fmt(pf) + ' تا ' + J.fmt(pt) : 'کل دوره', 'به تفکیک ' + label].filter(Boolean).join(' · ');
    return h('div',
      h('p.muted', desc),
      h('div.kpis.sm', ui.kpi(cfg.type ? 'جمع' : 'خالص', LD.money(total)), ui.kpi('تعداد تراکنش', LD.fmt(rows.length)), ui.kpi('میانگین هر مورد', LD.money(rows.length ? total / rows.length : 0))),
      cfg.chart !== 'none' && groups.length ? chartBox((b) => {
        const pos = groups.map((g) => ({ label: g.label, value: Math.abs(g.value) }));
        if (cfg.chart === 'line') LD.chart.line(b, { labels: groups.map((g) => g.label), series: [{ name: label, values: groups.map((g) => g.value), color: 'var(--s1)' }] });
        else if (cfg.chart === 'bars') LD.chart.bars(b, { labels: groups.map((g) => g.label.slice(0, 12)), series: [{ name: label, values: groups.map((g) => g.value), color: 'var(--s1)' }] });
        else if (cfg.chart === 'donut') LD.chart.donut(b, { items: pos });
        else LD.chart.hbars(b, { items: pos, max: 15 });
      }) : null,
      ui.table({ rows: groups, cols: [{ label, get: (g) => g.label }, { label: 'تعداد', num: true, get: (g) => LD.fmt(g.n) }, { label: cfg.measure === 'count' ? 'تعداد' : cfg.measure === 'avg' ? 'میانگین' : 'مبلغ', num: true, get: (g) => fmtV(g.value) }, { label: 'سهم', num: true, get: (g) => total && cfg.measure !== 'count' ? LD.pct(g.sum / total) : '—' }], footer: { [label]: 'جمع', 'تعداد': LD.fmt(rows.length) } }),
      rows.length && rows.length <= 300 ? h('details.r-details', h('summary', 'ریز تراکنش‌ها (' + LD.faNum(rows.length) + ')'), ui.table({ rows: rows.sort((a, b) => a.date.localeCompare(b.date)), cols: [{ label: 'تاریخ', get: (x) => J.fmt(x.date) }, { label: 'شرح', get: (x) => x.desc || F.catName(x.categoryId) }, { label: 'واحد', get: (x) => F.unitName(x.unitId) }, { label: 'مبلغ', num: true, get: (x) => (x.type === 'expense' ? '−' : '') + LD.money(x.amount) }] })) : null);
  }

  /* ---------- صفحه گزارش‌ها ---------- */
  LD.pages.reports = {
    title: 'گزارش‌ها و تحلیل‌ها',
    render(el, params) {
      const id = params[0] || sessionStorage.getItem('ld.rep') || 'pnl';
      sessionStorage.setItem('ld.rep', id);
      const st = JSON.parse(sessionStorage.getItem('ld.repst') || '{"period":"month"}');
      const saved = LD.db.list('reports');
      const nav = h('div.rep-nav',
        Object.entries(REPORTS).map(([k, r]) => h('a.rep-link' + (k === id ? '.on' : ''), { href: '#/reports/' + k }, h('b', r.title), h('span', r.desc))),
        h('a.rep-link' + (id === 'custom' ? '.on' : ''), { href: '#/reports/custom' }, h('b', '❓ سؤال بپرس / گزارش‌ساز'), h('span', 'هر سؤالی درباره درآمد و هزینه‌ها')),
        saved.map((s) => h('a.rep-link.saved' + (id === 's:' + s.id ? '.on' : ''), { href: '#/reports/s:' + s.id }, h('b', '★ ' + s.name), h('span', 'گزارش ذخیره‌شده'))));
      const paper = h('div.paper');
      const area = h('div.rep-area');
      el.append(h('div.rep-layout', nav, area));

      if (id === 'custom' || id.startsWith('s:')) {
        const sv = id.startsWith('s:') ? LD.db.get('reports', id.slice(2)) : null;
        const cfg = sv ? Object.assign({}, sv.config) : JSON.parse(sessionStorage.getItem('ld.custom') || '{"group":"category","measure":"sum","chart":"hbar","period":"year","unit":"all"}');
        const bBox = h('div.no-print');
        const draw = (rebuild) => {
          sessionStorage.setItem('ld.custom', JSON.stringify(cfg));
          if (rebuild !== false) { bBox.innerHTML = ''; builder(bBox, cfg, draw); }
          paper.innerHTML = '';
          paper.append(h('h2', cfg.title && cfg.custom ? cfg.title : (sv ? sv.name : 'گزارش سفارشی')), runCustom(cfg));
        };
        area.append(h('div.toolbar.no-print', h('span.spacer'),
          sv ? h('button.btn.danger.ghost', { onclick: async () => { if (await ui.confirm('گزارش ذخیره‌شده حذف شود؟', 'حذف')) { LD.db.remove('reports', sv.id); LD.router.go('reports/custom'); } } }, 'حذف') : null,
          h('button.btn', { onclick: () => ui.form({ title: 'ذخیره گزارش', fields: [{ k: 'name', label: 'نام گزارش', required: true }], value: { name: sv ? sv.name : (cfg.title || '') }, onSave: (v) => { const nid = LD.db.put('reports', { id: sv ? sv.id : undefined, name: v.name, config: Object.assign({}, cfg) }); LD.router.go('reports/s:' + nid); } }) }, '★ ذخیره'),
          h('button.btn.primary', { onclick: () => LD.printNode(paper, paper.querySelector('h2').textContent) }, ui.icon('print', 16), ' چاپ / PDF')), bBox, paper);
        draw();
        return;
      }
      const R = REPORTS[id] || REPORTS.pnl;
      const save = () => sessionStorage.setItem('ld.repst', JSON.stringify(st));
      const draw = () => {
        const [from, to] = st.period === 'custom' ? [st.from, st.to] : LD.periodRange(st.period);
        const unit = R.noUnit ? 'all' : (st.unit || 'all');
        paper.innerHTML = '';
        const sub = [R.period ? (from ? J.fmt(from, true) + ' تا ' + J.fmt(to, true) : 'کل دوره') : 'وضعیت در ' + J.fmt(LD.todayISO(), true), !R.noUnit ? (unit === 'all' ? 'همه واحدها' : F.unitName(unit)) : null].filter(Boolean).join(' — ');
        paper.append(h('h2', R.title), h('p.muted', sub));
        try { paper.append(R.run({ from, to, unit })); } catch (e) { console.error(e); paper.append(h('p.err', 'خطا: ' + e.message)); }
      };
      const tools = h('div.toolbar.no-print',
        R.period ? LD.periodSelect(st.period, (v) => { st.period = v; save(); draw(); }) : null,
        !R.noUnit ? h('select', { onchange: (e) => { st.unit = e.target.value; save(); draw(); } }, [['all', 'همه واحدها'], ...LD.db.list('units').map((u) => [u.id, u.name])].map(([k, l]) => h('option', { value: k, selected: (st.unit || 'all') === k }, l))) : null,
        h('span.spacer'),
        h('button.btn.primary', { onclick: () => LD.printNode(paper, R.title) }, ui.icon('print', 16), ' چاپ / ذخیره PDF'));
      area.append(tools, paper);
      draw();
    },
  };
  LD.reports = { REPORTS, parseQuestion, runCustom };
})();
