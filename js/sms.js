/* ثبت تراکنش از پیامک بانک: اشتراک‌گذاری پیامک به برنامه (روی گوشی) یا چسباندن متن آن */
'use strict';
LD.sms = (() => {
  const h = LD.h;
  const EXP = ['برداشت', 'خرید', 'پرداخت', 'انتقال از', 'کارمزد', 'قسط', 'کسر'];
  const INC = ['واریز', 'انتقال به', 'دریافت', 'سود', 'برگشت', 'بستانکار'];
  const has = (s, ws) => ws.some((w) => s.includes(w));
  const digits = (s) => LD.enNum(String(s || '')).replace(/\D/g, '');
  const hash = (s) => { let x = 0; for (const c of LD.normalize(s)) x = (x * 31 + c.charCodeAt(0)) | 0; return 'sms' + (x >>> 0).toString(36); };

  function parseDate(lines) {
    for (const l of lines) {
      const m = l.match(/(\d{2,4})\/(\d{1,2})\/(\d{1,2})/);
      if (m) { const d = LD.J.parse(m[0]); if (d) return d; }
    }
    /* قالب کوتاه «MMDD-HH:MM» (مثل ملت) */
    for (const l of lines) {
      const m = l.match(/(?:^|\D)(\d{2})(\d{2})[-_ ]\d{1,2}:\d{2}/);
      if (!m) continue;
      const jm = +m[1], jd = +m[2], t = LD.J.toJalali(LD.todayISO());
      if (jm < 1 || jm > 12 || jd < 1 || jd > 31) continue;
      const jy = jm > t.jm ? t.jy - 1 : t.jy;
      return LD.J.toISO(jy, jm, Math.min(jd, LD.J.monthLength(jy, jm)));
    }
    return null;
  }

  function parse(text) {
    const raw = String(text || '').trim();
    /* «مانده» را جدا کن تا در پیامک‌های یک‌خطی با مبلغ قاطی نشود */
    const lines = LD.enNum(raw).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/(مانده|موجودی)/g, '\n$1').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const all = lines.join(' ');
    const isBal = (l) => /^(مانده|موجودی)/.test(l);
    const isMoneyLine = (l) => has(l, EXP) || has(l, INC) || /مبلغ|انتقال/.test(l);
    /* عدد مستقل (نه بخشی از کارت ستاره‌دار، تاریخ یا ساعت)؛ عدد با جداکننده هزارگان اولویت دارد */
    const num = (l) => {
      const c = [...l.matchAll(/([+\-−])?\s*(?<![\d*\/.,٬])(\d{1,3}(?:[,٬]\d{3})+|\d{4,})(?![\d*\/:.])/g)];
      const m = c.find((x) => /[,٬]/.test(x[2])) || c[0];
      return m ? { v: Number(m[2].replace(/[,٬]/g, '')), sign: m[1] || '' } : null;
    };
    let amount = null, sign = '', line = '', balance = null;
    for (const l of lines) {
      const m = num(l);
      if (!m) continue;
      if (isBal(l)) { if (balance === null) balance = m.v; continue; }
      if (amount !== null || (!isMoneyLine(l) && !m.sign)) continue; // شماره حساب، پیگیری و…
      amount = m.v; sign = m.sign; line = l;
    }
    const type = /[-−]/.test(sign) ? 'expense' : sign === '+' ? 'income'
      : has(line, EXP) ? 'expense' : has(line, INC) ? 'income' : has(all, INC) && !has(all, EXP) ? 'income' : 'expense';
    const toman = /تومان/.test(line || all);
    if (amount !== null && !toman) amount = Math.round(amount / 10);
    if (balance !== null && !toman) balance = Math.round(balance / 10);

    /* حساب: چهار رقم آخر شماره‌ای که در پیامک آمده، یا نام بانک */
    const accs = LD.db.list('accounts');
    const groups = (all.match(/\d[\d*xX.\-]{5,}\d/g) || []).map((g) => g.split(/[^\d]+/).filter((x) => x.length >= 4).pop()).filter(Boolean);
    let acc = accs.find((a) => { const n = digits(a.number); return n.length >= 4 && groups.some((g) => n.endsWith(g.slice(-4))); });
    if (!acc) acc = accs.find((a) => a.bank && all.includes(LD.normalize(a.bank)));

    const base = LD.voice.parse(raw);
    const bank = lines.find((l) => /بانک|bank/i.test(l) && !/\d{4,}/.test(l));
    return {
      kind: 'tx', type, amount, balance,
      date: parseDate(lines) || LD.todayISO(),
      accountId: acc ? acc.id : base.accountId,
      unitId: base.unitId, categoryId: base.categoryId && LD.db.get('categories', base.categoryId)?.type === type ? base.categoryId : undefined,
      personId: base.personId, projectId: base.projectId,
      desc: 'پیامک ' + (bank || 'بانک') + (balance !== null ? ' — مانده ' + LD.money(balance) : ''),
      sms: hash(raw),
    };
  }

  async function fromText(text) {
    const d = parse(text);
    if (!d.amount) { LD.toast('مبلغی در این پیامک پیدا نشد', 'warn'); return dialog(text); }
    if (LD.db.list('transactions').some((t) => t.sms === d.sms) && !(await LD.ui.confirm('این پیامک قبلاً ثبت شده است. دوباره ثبت شود؟', 'ثبت دوباره', false))) return;
    LD.pages.transactions.edit({ type: d.type, amount: d.amount, date: d.date, unitId: d.unitId, categoryId: d.categoryId, accountId: d.accountId, personId: d.personId, projectId: d.projectId, desc: d.desc, sms: d.sms });
  }

  function dialog(text) {
    const ta = h('textarea', { rows: 6, dir: 'auto', placeholder: 'متن پیامک بانک را اینجا بچسبانید…', value: text || '' });
    const go = () => { if (!ta.value.trim()) return; m.close(); fromText(ta.value); };
    const paste = navigator.clipboard && navigator.clipboard.readText
      ? h('button.btn', { type: 'button', onclick: async () => { try { ta.value = await navigator.clipboard.readText(); } catch (e) { LD.toast('دسترسی به کلیپ‌بورد داده نشد؛ متن را دستی بچسبانید', 'warn'); } } }, '📋 چسباندن')
      : null;
    const m = LD.ui.modal({
      title: 'ثبت از پیامک بانک',
      body: h('div.set-grid', ta,
        h('p.muted.small', 'راه سریع‌تر روی گوشی: در برنامه پیامک، پیام بانک را نگه دارید ← «اشتراک‌گذاری» ← «داشبورد». مبلغ، نوع (برداشت/واریز)، تاریخ و حساب خودکار پر می‌شود و قبل از ذخیره می‌توانید اصلاح کنید.')),
      actions: [paste, h('span.spacer'), h('button.btn', { onclick: () => m.close() }, 'انصراف'), h('button.btn.primary', { onclick: go }, 'تحلیل و ادامه')],
    });
  }

  return { parse, fromText, dialog };
})();
