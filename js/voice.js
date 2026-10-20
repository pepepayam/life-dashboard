/* ورود صوتی فارسی و تحلیل جمله به تراکنش/یادآور/ایده */
'use strict';
LD.voice = (() => {
  const h = LD.h;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SR;

  /* شنیدن یک جمله */
  function listen({ onInterim, onFinal, onEnd, onError }) {
    const r = new SR();
    r.lang = 'fa-IR'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let finalText = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
      }
      onInterim && onInterim(finalText + interim);
    };
    r.onerror = (e) => onError && onError(e.error === 'not-allowed' ? 'اجازه دسترسی به میکروفون داده نشد' : e.error === 'no-speech' ? 'صدایی شنیده نشد' : e.error === 'network' ? 'برای تشخیص گفتار اینترنت لازم است' : 'خطا: ' + e.error);
    r.onend = () => { if (finalText) onFinal && onFinal(finalText.trim()); onEnd && onEnd(); };
    r.start();
    return r;
  }

  /* دکمه میکروفون کنار فیلد */
  function micButton(input) {
    if (!supported) return null;
    const btn = h('button.mic', { type: 'button', title: 'تایپ صوتی', 'aria-label': 'تایپ صوتی' }, LD.ui.icon('mic', 18));
    let rec = null;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (rec) { rec.stop(); return; }
      const base = input.value ? input.value.trim() + ' ' : '';
      btn.classList.add('on');
      rec = listen({
        onInterim: (t) => { input.value = base + t; },
        onFinal: (t) => { input.value = base + t; input.dispatchEvent(new Event('input', { bubbles: true })); },
        onEnd: () => { btn.classList.remove('on'); rec = null; },
        onError: (m) => LD.toast(m, 'warn'),
      });
    });
    return btn;
  }

  /* ---------- تبدیل عدد حروفی فارسی ---------- */
  const SMALL = {
    'صفر': 0, 'یک': 1, 'یه': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'شیش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
    'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'پونزده': 15, 'شانزده': 16, 'شونزده': 16, 'هفده': 17, 'هیفده': 17,
    'هجده': 18, 'هیجده': 18, 'نوزده': 19, 'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
    'صد': 100, 'یکصد': 100, 'دویست': 200, 'سیصد': 300, 'چهارصد': 400, 'پانصد': 500, 'پونصد': 500, 'ششصد': 600, 'شیشصد': 600, 'هفتصد': 700, 'هشتصد': 800, 'نهصد': 900,
  };
  const MULT = { 'هزار': 1e3, 'تومن': null, 'میلیون': 1e6, 'ملیون': 1e6, 'میلیارد': 1e9, 'ملیارد': 1e9, 'تریلیون': 1e12 };
  delete MULT['تومن'];
  const isNumTok = (t) => /^\d+(\.\d+)?$/.test(t) || t in SMALL || t in MULT || t === 'نیم';

  /* همه اعداد موجود در متن را پیدا می‌کند: [{value, start, end}] (start/end روی آرایه توکن‌ها) */
  function findNumbers(tokens) {
    const out = [];
    let i = 0;
    while (i < tokens.length) {
      if (!isNumTok(tokens[i]) || (tokens[i] === 'نه' && !isNumTok(tokens[i + 1] || '') && tokens[i + 1] !== 'و')) { i++; continue; }
      let total = 0, cur = 0, lastMult = 0, j = i, any = false;
      while (j < tokens.length) {
        const t = tokens[j];
        if (/^\d+(\.\d+)?$/.test(t)) cur += parseFloat(t);
        else if (t in SMALL) cur += SMALL[t];
        else if (t in MULT) { if (MULT[t] > lastMult && lastMult) { total = (total + (cur || 0)) * MULT[t]; } else total += (cur || 1) * MULT[t]; cur = 0; lastMult = MULT[t]; }
        else if (t === 'نیم') { if (cur) cur += 0.5; else if (lastMult) total += 0.5 * lastMult; else cur = 0.5; }
        else if (t === 'و' && j + 1 < tokens.length && isNumTok(tokens[j + 1])) { j++; continue; }
        else break;
        any = true; j++;
      }
      // «سه میلیون و پانصد» در محاوره یعنی ۳٫۵ میلیون
      if (cur && cur < 1000 && lastMult >= 1e6 && total) { total += cur * lastMult / 1000; cur = 0; }
      if (any) out.push({ value: total + cur, start: i, end: j });
      i = Math.max(j, i + 1);
    }
    return out;
  }

  const tokenize = (s) => LD.normalize(s).replace(/(\d)[,٬](?=\d{3})/g, '$1').replace(/([^\d\s./])(\d)/g, '$1 $2').replace(/(\d)([^\d\s./])/g, '$1 $2').replace(/[؟?!،,.:؛]+(?!\d)/g, ' ').split(' ').filter(Boolean)
    .map((t) => (/(ی|یی)$/.test(t) && t.replace(/(ی|یی)$/, '') in MULT) ? t.replace(/(ی|یی)$/, '') : t);

  /* مقدار پولی جمله (به تومان) */
  function parseAmount(text) {
    const tokens = tokenize(text);
    const nums = findNumbers(tokens);
    if (!nums.length) return null;
    const near = (n) => tokens.slice(n.end, n.end + 2).join(' ');
    // اولویت با عددی که بعدش تومان/ریال آمده؛ وگرنه بزرگ‌ترین عدد
    let pick = nums.find((n) => /^(تومان|تومن|ریال)/.test(near(n))) || nums.slice().sort((a, b) => b.value - a.value)[0];
    let v = pick.value;
    if (/^ریال/.test(near(pick))) v = v / 10;
    return { value: Math.round(v), start: pick.start, end: pick.end };
  }

  /* ---------- تاریخ ---------- */
  function parseDate(text) {
    const s = LD.normalize(text), today = LD.todayISO();
    if (/پس ?فردا/.test(s)) return LD.addDays(today, 2);
    if (/پریروز/.test(s)) return LD.addDays(today, -2);
    if (/دیروز/.test(s)) return LD.addDays(today, -1);
    if (/فردا/.test(s)) return LD.addDays(today, 1);
    const ago = s.match(/(\S+(?: و \S+)?) روز (?:پیش|قبل)/);
    if (ago) { const n = findNumbers(tokenize(ago[1])); if (n.length) return LD.addDays(today, -n[0].value); }
    const later = s.match(/(\S+(?: و \S+)?) روز (?:دیگه|دیگر|بعد)/);
    if (later) { const n = findNumbers(tokenize(later[1])); if (n.length) return LD.addDays(today, n[0].value); }
    const toks = tokenize(s);
    for (let i = 0; i < toks.length; i++) {
      const mi = LD.J.MONTHS.indexOf(toks[i]);
      if (mi < 0) continue;
      // عدد روز قبل از نام ماه (مثل «پنج آبان» یا «۱۵ آبان»)
      const before = findNumbers(toks.slice(Math.max(0, i - 3), i)).pop();
      const day = before ? before.value : 1;
      const after = findNumbers(toks.slice(i + 1, i + 6))[0];
      let jy = LD.J.toJalali(today).jy;
      if (after && after.value > 1300 && after.value < 1600) jy = after.value;
      if (day >= 1 && day <= 31) return LD.J.toISO(jy, mi + 1, Math.min(day, LD.J.monthLength(jy, mi + 1)));
    }
    const m = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (m) return LD.J.parse(m[0]);
    return null;
  }

  const hasAny = (s, words) => words.some((w) => s.includes(w));
  const findByName = (rows, s, extra = (r) => '') => {
    let best = null;
    for (const r of rows) {
      const names = [r.name || r.title, ...String(extra(r) || '').split(/\s+/)].filter((x) => x && x.length > 1).map(LD.normalize);
      for (const n of names) if (s.includes(n) && (!best || n.length > best.len)) best = { r, len: n.length };
    }
    return best ? best.r : null;
  };

  /* تحلیل جمله → پیش‌نویس */
  function parse(text) {
    const d = LD.state.data, s = ' ' + LD.normalize(text) + ' ';
    const draft = { raw: text };
    if (hasAny(s, ['یادم بنداز', 'یادآوری', 'یادآور', 'یادت باشه'])) draft.kind = 'reminder';
    else if (hasAny(s, ['ایده', 'فکر کردم', 'به نظرم میشه'])) draft.kind = 'idea';
    else if (hasAny(s, [' چک '])) draft.kind = 'cheque';
    else if (hasAny(s, ['فروش امروز', 'فروش کافه', 'فروش روزانه'])) draft.kind = 'cafeSale';
    else draft.kind = 'tx';

    const amt = parseAmount(text);
    if (amt) draft.amount = amt.value;
    draft.date = parseDate(text) || LD.todayISO();

    const isIncome = hasAny(s, ['درآمد', 'دریافت', 'گرفتم', 'واریز شد', 'فروختم', 'فروش', 'سود', 'طلب وصول', 'به حسابم', 'پول داد', 'پرداخت کرد', 'تسویه کرد']);
    const isExpense = hasAny(s, ['پرداخت', 'خرید', 'خریدم', 'هزینه', 'دادم', 'قسط', 'قبض', 'اجاره دادم', 'حقوق دادم', 'واریز کردم']);
    draft.type = isIncome && !/پرداخت کردم|دادم|خریدم/.test(s) ? 'income' : isExpense ? 'expense' : 'expense';
    if (draft.kind === 'cheque') draft.direction = hasAny(s, ['دریافت', 'گرفتم', 'داد به من', 'دادند']) ? 'in' : 'out';

    // واحد، پروژه، حساب، شخص
    const proj = findByName(d.projects, s);
    if (proj) { draft.projectId = proj.id; draft.unitId = proj.unitId || 'projects'; }
    const unit = findByName(d.units, s, (u) => u.aliases);
    if (unit) draft.unitId = unit.id;
    const acc = findByName(d.accounts, s, (a) => [a.bank, a.aliases].filter(Boolean).join(' '));
    if (acc) draft.accountId = acc.id;
    const person = findByName(d.people, s, (p) => p.aliases);
    if (person) draft.personId = person.id;

    // کلیدواژه → دسته
    for (const k of d.settings.keywordMap || []) {
      if (k.word && s.includes(LD.normalize(k.word))) {
        if (!draft.unitId) draft.unitId = k.unitId;
        const cat = LD.db.get('categories', k.categoryId);
        if (cat && cat.unitId === draft.unitId) { draft.categoryId = cat.id; if (!isIncome && !isExpense) draft.type = cat.type; }
        break;
      }
    }
    if (!draft.categoryId && draft.unitId) {
      const cat = findByName(d.categories.filter((c) => c.unitId === draft.unitId && c.type === draft.type), s);
      if (cat) draft.categoryId = cat.id;
    }
    if (draft.kind === 'idea') {
      const dom = (d.settings.domains || []).find((x) => s.includes(LD.normalize(x)));
      if (dom) draft.domain = dom;
    }
    if (draft.kind === 'reminder') {
      draft.repeat = /هر ماه|ماهانه/.test(s) ? 'monthly' : /هر سال|سالانه/.test(s) ? 'yearly' : /هر هفته|هفتگی/.test(s) ? 'weekly' : 'none';
      draft.title = text.replace(/یادم بنداز|یادآوری کن|یادت باشه/g, '').trim();
    }
    draft.desc = text.trim();
    draft.unitId = draft.unitId || 'personal';
    return draft;
  }

  /* پنجره ثبت صوتی هوشمند */
  function quickVoice() {
    const live = h('div.voice-live', supported ? 'روی میکروفون بزنید و جمله را بگویید…' : 'مرورگر شما تشخیص گفتار ندارد؛ می‌توانید از تایپ صوتی کیبورد گوشی استفاده کنید.');
    const ta = h('textarea', { rows: 3, placeholder: 'مثال: پرداخت دویست و پنجاه هزار تومان خرید شیر برای کافه از کارت ملت' });
    const big = h('button.mic-big', { type: 'button', 'aria-label': 'شروع ضبط' }, LD.ui.icon('mic', 40));
    let rec = null;
    big.addEventListener('click', () => {
      if (!supported) { ta.focus(); return; }
      if (rec) { rec.stop(); return; }
      big.classList.add('on'); live.textContent = 'در حال شنیدن…';
      rec = listen({
        onInterim: (t) => { ta.value = t; live.textContent = t; },
        onFinal: (t) => { ta.value = t; go(); },
        onEnd: () => { big.classList.remove('on'); rec = null; },
        onError: (msg) => { live.textContent = msg; },
      });
    });
    const go = () => { if (!ta.value.trim()) return; m.close(); openDraft(parse(ta.value)); };
    const m = LD.ui.modal({
      title: 'ثبت صوتی',
      body: h('div.voice-box', big, live, ta, h('p.muted.small', 'نمونه‌ها: «دیروز سه میلیون و پانصد کرایه نگهداری از آقای رضایی گرفتم» — «یادم بنداز ۱۰ آذر قسط وام» — «ایده: فروش آنلاین سیب برای سردخانه» — «فروش امروز کافه دوازده میلیون»')),
      actions: [h('button.btn', { onclick: () => m.close() }, 'انصراف'), h('button.btn.primary', { onclick: go }, 'تحلیل و ادامه')],
    });
    if (supported) setTimeout(() => big.click(), 250);
  }

  /* پیش‌نویس را در فرم مناسب باز می‌کند تا کاربر تأیید کند */
  function openDraft(dr) {
    const P = LD.pages;
    if (dr.kind === 'reminder') return P.reminders.edit({ title: dr.title || dr.desc, date: dr.date, repeat: dr.repeat, amount: dr.amount, unitId: dr.unitId });
    if (dr.kind === 'idea') return P.ideas.edit({ title: dr.desc.replace(/^ایده[:：]?\s*/, '').slice(0, 80), desc: dr.desc, domain: dr.domain, unitId: dr.unitId, status: 'raw', estCost: dr.amount });
    if (dr.kind === 'cheque') return P.cheques.edit({ direction: dr.direction, amount: dr.amount, dueDate: dr.date, personId: dr.personId, unitId: dr.unitId, accountId: dr.accountId, desc: dr.desc, status: 'pending' });
    if (dr.kind === 'cafeSale') return P.cafe.editSale({ date: dr.date, cash: dr.amount, note: dr.desc });
    return P.transactions.edit({ type: dr.type, amount: dr.amount, date: dr.date, unitId: dr.unitId, categoryId: dr.categoryId, accountId: dr.accountId, projectId: dr.projectId, personId: dr.personId, desc: dr.desc });
  }

  return { supported, listen, micButton, parse, parseAmount, parseDate, findNumbers, tokenize, quickVoice, openDraft };
})();
