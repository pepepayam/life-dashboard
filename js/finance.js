/* محاسبات مالی و تحلیلی */
'use strict';
LD.J.addMonths = (iso, n) => {
  const j = LD.J.toJalali(iso);
  let m = j.jm - 1 + n, y = j.jy + Math.floor(m / 12);
  m = ((m % 12) + 12) % 12 + 1;
  return LD.J.toISO(y, m, Math.min(j.jd, LD.J.monthLength(y, m)));
};

LD.fin = {
  rate(cur) { if (!cur || cur === 'IRT') return 1; return Number(LD.state.data.settings.rates[cur]) || 0; },

  /* همه جریان‌های پولی: تراکنش‌ها + فروش روزانه کافه + چک‌های وصول/پاس‌شده */
  flows() {
    const d = LD.state.data, out = [];
    for (const t of d.transactions) out.push(Object.assign({ src: 'tx' }, t, { amount: Number(t.amount) || 0 }));
    const saleCat = d.categories.find((c) => c.unitId === 'cafe' && c.type === 'income' && c.name === 'فروش');
    for (const s of d.cafeSales) {
      const amt = (Number(s.cash) || 0) + (Number(s.card) || 0) + (Number(s.online) || 0);
      out.push({ src: 'cafe', id: s.id, date: s.date, type: 'income', amount: amt, unitId: 'cafe', categoryId: saleCat && saleCat.id, accountId: s.accountId, desc: 'فروش روزانه کافه', tags: [] });
    }
    for (const c of d.cheques) if (c.status === 'cleared') {
      out.push({ src: 'cheque', id: c.id, date: c.clearedDate || c.dueDate, type: c.direction === 'in' ? 'income' : 'expense', amount: Number(c.amount) || 0, unitId: c.unitId, categoryId: c.categoryId, accountId: c.accountId, personId: c.personId, projectId: c.projectId, desc: 'چک ' + (c.number || '') + ' ' + (c.desc || ''), tags: [] });
    }
    return out;
  },

  filter(flows, f = {}) {
    return flows.filter((x) =>
      (!f.from || x.date >= f.from) && (!f.to || x.date <= f.to) &&
      (!f.unitId || f.unitId === 'all' || x.unitId === f.unitId) &&
      (!f.type || x.type === f.type) && (!f.projectId || x.projectId === f.projectId) &&
      (!f.categoryId || x.categoryId === f.categoryId) && (!f.personId || x.personId === f.personId) &&
      (!f.accountId || x.accountId === f.accountId || x.toAccountId === f.accountId) &&
      (!f.tag || (x.tags || []).includes(f.tag)) &&
      (!f.q || LD.normalize((x.desc || '') + ' ' + (x.tags || []).join(' ')).includes(LD.normalize(f.q))));
  },

  accountBalance(acc, upTo) {
    let b = Number(acc.opening) || 0;
    for (const x of this.flows()) {
      if (upTo && x.date > upTo) continue;
      if (x.type === 'income' && x.accountId === acc.id) b += x.amount;
      else if (x.type === 'expense' && x.accountId === acc.id) b -= x.amount;
      else if (x.type === 'transfer') { if (x.accountId === acc.id) b -= x.amount; if (x.toAccountId === acc.id) b += (Number(x.toAmount) || x.amount); }
    }
    return b;
  },
  accountsTotal(unitId) {
    return LD.sum(LD.state.data.accounts.filter((a) => !a.archived && (!unitId || unitId === 'all' || a.unitId === unitId)), (a) => this.accountBalance(a) * this.rate(a.currency));
  },

  pnl(f) {
    const fl = this.filter(this.flows(), f);
    const inc = fl.filter((x) => x.type === 'income'), exp = fl.filter((x) => x.type === 'expense');
    const income = LD.sum(inc, (x) => x.amount), expense = LD.sum(exp, (x) => x.amount);
    return { income, expense, net: income - expense, inc, exp };
  },

  /* سری ماهانه درآمد/هزینه */
  monthly(f, months) {
    const keys = months || LD.J.lastMonths(12);
    const fl = this.filter(this.flows(), f);
    const m = {}; keys.forEach((k) => (m[k] = { income: 0, expense: 0 }));
    for (const x of fl) { if (x.type === 'transfer') continue; const k = LD.J.monthKey(x.date); if (m[k]) m[k][x.type] += x.amount; }
    return keys.map((k) => ({ key: k, label: LD.J.monthLabel(k), income: m[k].income, expense: m[k].expense, net: m[k].income - m[k].expense }));
  },

  catName(id) { const c = LD.db.get('categories', id); return c ? c.name : 'بدون دسته'; },
  unitName(id) { const u = LD.db.get('units', id); return u ? u.name : '—'; },
  personName(id) { const p = LD.db.get('people', id); return p ? p.name : '—'; },
  accountName(id) { const a = LD.db.get('accounts', id); return a ? a.name : '—'; },
  projectName(id) { const p = LD.db.get('projects', id); return p ? p.name : '—'; },

  /* ---- وام ---- */
  loanInfo(l) {
    const n = Number(l.count) || 0, paid = Number(l.paidCount) || 0, amt = Number(l.installment) || 0;
    return { remaining: Math.max(0, n - paid) * amt, next: paid < n && l.firstDue ? LD.J.addMonths(l.firstDue, paid) : null, left: Math.max(0, n - paid) };
  },

  /* ---- سردخانه ---- */
  lotFee(lot, asOf = LD.todayISO()) {
    if (!lot.inDate) return { days: 0, months: 0, fee: 0 };
    const end = lot.outDate && lot.outDate < asOf ? lot.outDate : asOf;
    const days = Math.max(1, LD.daysBetween(lot.inDate, end) + 1);
    const months = lot.billing === 'daily' ? days / 30 : Math.max(1, Math.ceil(days / 30));
    const qty = lot.basis === 'carton' ? Number(lot.cartons) || 0 : lot.basis === 'fixed' ? 1 : Number(lot.weightKg) || 0;
    return { days, months, fee: Math.round((Number(lot.rate) || 0) * qty * months) };
  },
  customerStatement(personId) {
    const lots = LD.state.data.csLots.filter((l) => l.personId === personId);
    const fees = LD.sum(lots, (l) => this.lotFee(l).fee);
    const pays = this.flows().filter((x) => x.type === 'income' && x.personId === personId && x.unitId === 'coldstore');
    const paid = LD.sum(pays, (x) => x.amount);
    return { lots, fees, paid, balance: fees - paid, pays };
  },
  coldstoreReceivables() {
    const ids = [...new Set(LD.state.data.csLots.map((l) => l.personId))];
    return ids.map((id) => Object.assign({ personId: id }, this.customerStatement(id))).filter((s) => s.balance > 0);
  },

  /* ---- پروژه ---- */
  projectStats(p) {
    const fl = this.flows().filter((x) => x.projectId === p.id);
    const invested = LD.sum(fl.filter((x) => x.type === 'expense'), (x) => x.amount);
    const returned = LD.sum(fl.filter((x) => x.type === 'income'), (x) => x.amount);
    const ms = p.milestones || [];
    const progress = ms.length ? ms.filter((m) => m.done).length / ms.length : (p.status === 'done' ? 1 : 0);
    const budget = Number(p.budget) || 0;
    return { invested, returned, profit: returned - invested, roi: invested ? (returned - invested) / invested : null, progress, budget, budgetUse: budget ? invested / budget : null, flows: fl };
  },

  /* ---- ترازنامه ---- */
  balanceSheet() {
    const d = LD.state.data;
    const cash = this.accountsTotal();
    const assets = LD.sum(d.assets.filter((a) => !a.sold), (a) => (Number(a.value) || 0) * (a.currency ? this.rate(a.currency) : 1) * (Number(a.qty) || 1));
    const recvDebts = LD.sum(d.debts.filter((x) => x.direction === 'receivable' && !x.settled), (x) => x.amount);
    const recvCheques = LD.sum(d.cheques.filter((c) => c.direction === 'in' && c.status === 'pending'), (c) => c.amount);
    const recvCold = LD.sum(this.coldstoreReceivables(), (s) => s.balance);
    const payDebts = LD.sum(d.debts.filter((x) => x.direction === 'payable' && !x.settled), (x) => x.amount);
    const payCheques = LD.sum(d.cheques.filter((c) => c.direction === 'out' && c.status === 'pending'), (c) => c.amount);
    const loans = LD.sum(d.loans.filter((l) => !l.closed), (l) => this.loanInfo(l).remaining);
    const totalA = cash + assets + recvDebts + recvCheques + recvCold, totalL = payDebts + payCheques + loans;
    return { cash, assets, recvDebts, recvCheques, recvCold, payDebts, payCheques, loans, totalA, totalL, net: totalA - totalL };
  },

  /* ---- سررسیدها و یادآورها ---- */
  upcoming(days = 30) {
    const d = LD.state.data, today = LD.todayISO(), end = LD.addDays(today, days), out = [];
    const push = (date, kind, title, amount, link, sign) => { if (date && date <= end) out.push({ date, kind, title, amount, link, overdue: date < today, sign }); };
    for (const c of d.cheques) if (c.status === 'pending') push(c.dueDate, 'چک', (c.direction === 'in' ? 'دریافت چک از ' : 'پرداخت چک به ') + this.personName(c.personId), c.amount, 'cheques', c.direction === 'in' ? 1 : -1);
    for (const l of d.loans) if (!l.closed) { const i = this.loanInfo(l); push(i.next, 'قسط', 'قسط ' + l.title, l.installment, 'loans', -1); }
    for (const x of d.debts) if (!x.settled && x.dueDate) push(x.dueDate, x.direction === 'receivable' ? 'طلب' : 'بدهی', this.personName(x.personId) + ' — ' + (x.desc || ''), x.amount, 'debts', x.direction === 'receivable' ? 1 : -1);
    for (const r of d.reminders) if (!r.done) push(this.nextReminder(r), 'یادآور', r.title, r.amount, 'reminders');
    for (const v of d.vault) if (v.expiry) push(v.expiry, 'سررسید', v.title, v.amount, 'vault');
    return out.sort((a, b) => a.date.localeCompare(b.date));
  },
  nextReminder(r) {
    if (!r.date) return null;
    if (!r.repeat || r.repeat === 'none') return r.date;
    let dt = r.date; const today = LD.todayISO(); let guard = 0;
    while (dt < today && guard++ < 500) dt = r.repeat === 'yearly' ? LD.J.addMonths(dt, 12) : r.repeat === 'weekly' ? LD.addDays(dt, 7) : LD.J.addMonths(dt, 1);
    return dt;
  },
};
