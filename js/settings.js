/* تنظیمات، پشتیبان‌گیری، خروجی و ورود داده */
'use strict';
(() => {
  const h = LD.h, ui = LD.ui, F = LD.fin, J = LD.J;

  const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const toCSV = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : (text.split('\n')[0].includes('\t') ? '\t' : ',');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === sep) { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  const anyDate = (s) => {
    s = LD.enNum(s).trim().split(' ')[0];
    const m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (!m) return null;
    if (+m[1] < 1700) return J.parse(m[1] + '/' + m[2] + '/' + m[3]);
    return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  };

  function exportCSV() {
    const rows = [['تاریخ شمسی', 'تاریخ میلادی', 'نوع', 'مبلغ', 'واحد', 'دسته', 'حساب', 'پروژه', 'شخص', 'شرح', 'برچسب‌ها']];
    for (const x of F.flows().sort((a, b) => a.date.localeCompare(b.date)))
      rows.push([J.fmt(x.date).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)), x.date, { income: 'درآمد', expense: 'هزینه', transfer: 'انتقال' }[x.type], x.amount, F.unitName(x.unitId), F.catName(x.categoryId), F.accountName(x.accountId), x.projectId ? F.projectName(x.projectId) : '', x.personId ? F.personName(x.personId) : '', x.desc || '', (x.tags || []).join('،')]);
    LD.downloadFile('life-transactions-' + LD.todayISO() + '.csv', toCSV(rows), 'text/csv;charset=utf-8');
  }

  function importCSV(file) {
    file.text().then((text) => {
      const rows = parseCSV(text);
      if (rows.length < 2) { LD.toast('فایل خالی است', 'warn'); return; }
      const head = rows[0].map((x, i) => [String(i), (x || 'ستون ' + (i + 1)).slice(0, 30)]);
      const guess = (re) => { const i = rows[0].findIndex((x) => re.test(x)); return i >= 0 ? String(i) : ''; };
      ui.form({
        title: 'ورود تراکنش‌ها از فایل CSV بانک (' + LD.faNum(rows.length - 1) + ' ردیف)', wide: true,
        value: { dateCol: guess(/تاریخ|date/i), descCol: guess(/شرح|توضیح|description|بابت/i), amountCol: guess(/^مبلغ$|amount/i), debitCol: guess(/برداشت|بدهکار|debit/i), creditCol: guess(/واریز|بستانکار|credit/i), unitId: 'personal' },
        fields: [
          { k: 'dateCol', label: 'ستون تاریخ', type: 'select', options: head, required: true, half: true },
          { k: 'descCol', label: 'ستون شرح', type: 'select', options: head, half: true },
          { k: 'amountCol', label: 'ستون مبلغ (مثبت=واریز، منفی=برداشت)', type: 'select', options: head, half: true },
          { k: 'debitCol', label: 'یا ستون برداشت', type: 'select', options: head, half: true },
          { k: 'creditCol', label: 'و ستون واریز', type: 'select', options: head, half: true },
          { k: 'rial', label: 'واحد مبالغ', type: 'bool', text: 'مبالغ فایل به ریال است (تقسیم بر ۱۰)', half: true },
          { k: 'unitId', label: 'واحد', type: 'select', options: () => LD.db.list('units').map((u) => [u.id, u.name]), half: true },
          { k: 'accountId', label: 'حساب', type: 'ref', ref: 'accounts', required: true, half: true },
        ],
        extra: () => h('p.muted.small', 'نمونه ردیف اول: ' + rows[1].join(' | ')),
        onSave: (v) => {
          let n = 0, skip = 0;
          const existing = new Set(LD.db.list('transactions').map((t) => t.importKey).filter(Boolean));
          for (const r of rows.slice(1)) {
            const date = anyDate(r[v.dateCol] || '');
            let amt = v.amountCol !== '' && v.amountCol !== undefined ? LD.parseNum(r[v.amountCol]) : (LD.parseNum(r[v.creditCol]) - LD.parseNum(r[v.debitCol]));
            if (String(r[v.amountCol] || '').includes('-') && amt > 0) amt = -amt;
            if (!date || !amt) { skip++; continue; }
            if (v.rial) amt /= 10;
            const key = date + '|' + amt + '|' + (r[v.descCol] || '');
            if (existing.has(key)) { skip++; continue; }
            LD.db.put('transactions', { type: amt > 0 ? 'income' : 'expense', amount: Math.abs(amt), date, unitId: v.unitId, accountId: v.accountId, desc: (r[v.descCol] || '').trim(), importKey: key, tags: ['ورود از بانک'] });
            existing.add(key); n++;
          }
          LD.toast(LD.faNum(n) + ' تراکنش وارد شد' + (skip ? ' (' + LD.faNum(skip) + ' ردیف تکراری/نامعتبر رد شد)' : ''));
          LD.router.go('transactions');
        },
      });
    });
  }

  async function restoreLDB(file) {
    const text = await file.text();
    let pw = null, r;
    try { r = await LD.crypto.decrypt(text, { session: LD.state.session }); }
    catch (e) {
      if (e.code !== 'NEED_PASSWORD') { LD.toast(e.message, 'warn'); return; }
      try { pw = await ui.askPassword('رمز فایل پشتیبان را وارد کنید:'); r = await LD.crypto.decrypt(text, { password: pw }); } catch (e2) { LD.toast(e2.message, 'warn'); return; }
    }
    const mode = await new Promise((res) => {
      const m = ui.modal({ title: 'بازیابی پشتیبان', body: h('p', 'فایل ذخیره‌شده در ' + J.fmt(r.data.meta.savedAt.slice(0, 10)) + ' است. داده‌ها ادغام شوند یا جایگزین؟'), actions: [
        h('button.btn', { onclick: () => { m.close(); res(null); } }, 'انصراف'),
        h('button.btn.danger', { onclick: () => { m.close(); res('replace'); } }, 'جایگزینی کامل'),
        h('button.btn.primary', { onclick: () => { m.close(); res('merge'); } }, 'ادغام'),
      ] });
    });
    if (!mode) return;
    const data = LD.upgrade(r.data);
    if (mode === 'replace') { const t = LD.now(); for (const col of LD.COLLECTIONS) for (const x of data[col]) x.updatedAt = t; LD.state.data = Object.assign(data, { meta: LD.state.data.meta }); }
    else LD.state.data = LD.merge(LD.state.data, data);
    LD.changed(); LD.toast('بازیابی انجام شد'); LD.router.refresh();
  }

  async function changePassword() {
    ui.form({
      title: 'تغییر رمز عبور',
      fields: [{ k: 'p1', label: 'رمز جدید (حداقل ۸ کاراکتر)', inputType: 'password', required: true, voice: false, autocomplete: 'new-password' }, { k: 'p2', label: 'تکرار رمز جدید', inputType: 'password', required: true, voice: false, autocomplete: 'new-password' }],
      onSave: async (v) => {
        if (v.p1.length < 8) { LD.toast('رمز کوتاه است', 'warn'); return false; }
        if (v.p1 !== v.p2) { LD.toast('تکرار رمز یکسان نیست', 'warn'); return false; }
        LD.state.session = await LD.crypto.newSession(v.p1);
        LD.state.baseRev = null; LD.state.dirty = true;
        LD.state.baseRev = '__force__';
        await LD.saveForceOverwrite();
        LD.toast('رمز تغییر کرد. در دستگاه‌های دیگر با رمز جدید وارد شوید.');
      },
    });
  }
  /* بعد از تغییر رمز، فایل را با کلید جدید بازنویسی می‌کند (بعد از ادغام با نسخه فعلی) */
  LD.saveForceOverwrite = async () => {
    const be = LD.backend();
    try { const remote = await be.read(); if (remote) { LD.state.baseRev = LD.crypto.header(remote).rev; } } catch (e) { /* */ }
    await LD.save(true);
  };

  const unitsEditor = () => ui.form({
    title: 'واحدها (کسب‌وکارها)', wide: true,
    value: { list: LD.db.list('units').map((u) => Object.assign({}, u)) },
    fields: [{ k: 'list', label: 'واحدها', type: 'list', addLabel: 'واحد جدید', newRow: () => ({ color: (LD.db.list('units').length % 8) + 1 }), fields: [
      { k: 'name', label: 'نام', placeholder: 'نام واحد' },
      { k: 'aliases', label: 'نام‌های دیگر', placeholder: 'نام‌های دیگر (برای صوتی)' },
      { k: 'color', label: 'رنگ', type: 'select', options: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => [i, 'رنگ ' + LD.faNum(i)]) }] }],
    extra: () => h('p.muted.small', 'برای هر کسب‌وکار جدید (مثلاً باغ، مغازه دوم) یک واحد بسازید و سپس دسته‌های آن را تعریف کنید. حذف واحدی که تراکنش دارد توصیه نمی‌شود.'),
    onSave: (v) => {
      const keep = new Set(v.list.map((u) => u.id));
      for (const u of LD.db.list('units').slice()) if (!keep.has(u.id)) LD.db.remove('units', u.id);
      for (const u of v.list) if (u.name) LD.db.put('units', { id: u.id, name: u.name, aliases: u.aliases || '', color: Number(u.color) || 1 });
      LD.router.refresh();
    },
  });

  const categoriesEditor = (unitId) => ui.form({
    title: 'دسته‌بندی‌های ' + F.unitName(unitId), wide: true,
    value: { inc: LD.db.list('categories').filter((c) => c.unitId === unitId && c.type === 'income').map((c) => ({ id: c.id, name: c.name })), exp: LD.db.list('categories').filter((c) => c.unitId === unitId && c.type === 'expense').map((c) => ({ id: c.id, name: c.name })) },
    fields: [
      { k: 'exp', label: 'دسته‌های هزینه', type: 'list', addLabel: 'دسته هزینه', fields: [{ k: 'name', label: 'نام', placeholder: 'نام دسته' }] },
      { k: 'inc', label: 'دسته‌های درآمد', type: 'list', addLabel: 'دسته درآمد', fields: [{ k: 'name', label: 'نام', placeholder: 'نام دسته' }] },
    ],
    onSave: (v) => {
      const keep = new Set([...v.inc, ...v.exp].map((c) => c.id));
      for (const c of LD.db.list('categories').filter((c) => c.unitId === unitId).slice()) if (!keep.has(c.id)) LD.db.remove('categories', c.id);
      v.inc.forEach((c) => c.name && LD.db.put('categories', { id: c.id, name: c.name, unitId, type: 'income' }));
      v.exp.forEach((c) => c.name && LD.db.put('categories', { id: c.id, name: c.name, unitId, type: 'expense' }));
      LD.router.refresh();
    },
  });

  const keywordsEditor = () => ui.form({
    title: 'کلیدواژه‌های ورود صوتی', wide: true,
    value: { list: (LD.state.data.settings.keywordMap || []).map((x) => Object.assign({ id: LD.uid() }, x)) },
    fields: [{ k: 'list', label: 'اگر جمله شامل این کلمه بود → این واحد و دسته', type: 'list', addLabel: 'کلیدواژه', fields: [
      { k: 'word', label: 'کلمه', placeholder: 'کلمه' },
      { k: 'unitId', label: 'واحد', type: 'select', options: () => LD.db.list('units').map((u) => [u.id, u.name]) },
      { k: 'categoryId', label: 'دسته', type: 'select', options: () => LD.db.list('categories').map((c) => [c.id, F.unitName(c.unitId) + ' / ' + c.name + (c.type === 'income' ? ' (درآمد)' : '')]) }] }],
    onSave: (v) => { LD.db.setSettings({ keywordMap: v.list.filter((x) => x.word).map(({ word, unitId, categoryId }) => ({ word, unitId, categoryId })) }); },
  });

  LD.pages.settings = {
    title: 'تنظیمات',
    async render(el) {
      const s = LD.state.data.settings, od = LD.onedrive.cfg();
      const beName = await LD.backend().name();
      const mirrorName = LD.state.backend === 'github' ? await LD.backends.folder.name() : '';
      const fileIn = (accept, fn) => { const i = h('input', { type: 'file', accept, style: { display: 'none' }, onchange: (e) => e.target.files[0] && fn(e.target.files[0]) }); document.body.append(i); i.click(); setTimeout(() => i.remove(), 60000); };
      const clientIn = h('input', { type: 'text', value: od.clientId || '', placeholder: 'Application (client) ID', dir: 'ltr' });
      el.append(
        ui.card('ذخیره‌سازی و همگام‌سازی', h('div.set-grid',
          h('p', 'محل فعلی داده: ', h('b', LD.backends[LD.state.backend].label), ' — ', h('code', beName)),
          h('p.muted.small', 'آخرین ذخیره: ' + J.fmt(LD.state.data.meta.savedAt.slice(0, 10)) + ' ' + new Date(LD.state.data.meta.savedAt).toLocaleTimeString('fa-IR')),
          LD.state.backend === 'github' ? h('p.small', 'نسخه کپی روی این کامپیوتر: ', h('b', mirrorName || 'ندارد')) : null,
          h('div.btn-row',
            LD.state.backend === 'github' && LD.backends.folder.supported() ? h('button.btn', { onclick: async () => { try { await LD.backends.folder.pick(); await LD.save(true); LD.toast('نسخه کپی در پوشه ذخیره شد'); LD.router.refresh(); } catch (e) { if (e.name !== 'AbortError') LD.toast(e.message, 'warn'); } } }, ui.icon('folder', 16), mirrorName ? ' تغییر پوشه کپی' : ' کپی در پوشه OneDrive') : null,
            LD.state.backend === 'github' ? h('button.btn', { onclick: async () => { if (await ui.confirm('توکن GitHub از این دستگاه حذف و برنامه قفل شود؟', 'قطع اتصال')) { await LD.save(true); await LD.github.logout(); localStorage.removeItem('ld.backend'); location.reload(); } } }, 'قطع اتصال GitHub') : null,
            h('button.btn', { onclick: async () => { await LD.syncNow(); LD.toast('همگام شد'); LD.router.refresh(); } }, ui.icon('sync', 16), ' همگام‌سازی اکنون'),
            h('button.btn', { onclick: () => LD.app.switchStorage() }, 'تغییر محل ذخیره'),
            h('button.btn', { onclick: () => LD.app.lock() }, ui.icon('lock', 16), ' قفل کردن')))),
        LD.state.backend !== 'github' ? ui.card('همگام‌سازی با GitHub (پیشنهادی برای گوشی)', h('div.set-grid',
          h('p.small', 'داده رمزگذاری‌شده در یک مخزن خصوصی GitHub نگه داشته می‌شود تا روی همه کامپیوترها و گوشی در دسترس باشد.'),
          h('div.btn-row', h('button.btn.primary', { onclick: async () => { await LD.save(true); localStorage.removeItem('ld.backend'); location.reload(); } }, 'انتقال به GitHub')),
          h('p.muted.small', 'بعد از کلیک، برنامه قفل می‌شود؛ گزینه GitHub را بزنید. داده فعلی (از کش این دستگاه) در مخزن نوشته می‌شود.'))) : null,
        ui.card('اتصال OneDrive برای گوشی (اختیاری)', h('div.set-grid',
          h('p.small', 'روی کامپیوتر، پوشه OneDrive را انتخاب کنید تا خود OneDrive همگام کند. روی گوشی، این صفحه باید از یک آدرس https (مثل GitHub Pages) باز شود و با حساب مایکروسافت وارد شوید. راهنمای ساخت Client ID در فایل README-fa.md است.'),
          h('label.field', h('span.lbl', 'Client ID برنامه Azure'), clientIn),
          h('p.small.muted', 'Redirect URI که باید در Azure ثبت کنید: ', h('code', { dir: 'ltr' }, LD.onedrive.redirectUri())),
          h('div.btn-row',
            h('button.btn', { onclick: () => { LD.onedrive.setCfg({ clientId: clientIn.value.trim() }); LD.toast('ذخیره شد'); } }, 'ذخیره Client ID'),
            od.connected ? h('button.btn', { onclick: async () => { await LD.onedrive.logout(); LD.router.refresh(); } }, 'قطع اتصال') : null,
            h('button.btn.primary', { onclick: () => { LD.onedrive.setCfg({ clientId: clientIn.value.trim() }); localStorage.setItem('ld.backend', 'onedrive'); LD.save(true).finally(() => LD.onedrive.login().catch((e) => LD.toast(e.message, 'warn'))); } }, od.connected ? 'اتصال مجدد' : 'اتصال به OneDrive')))),
        ui.card('واحدها، دسته‌ها و ورود صوتی', h('div.btn-row',
          h('button.btn', { onclick: unitsEditor }, 'مدیریت واحدها'),
          LD.db.list('units').map((u) => h('button.btn', { onclick: () => categoriesEditor(u.id) }, 'دسته‌های ' + u.name)),
          h('button.btn', { onclick: keywordsEditor }, 'کلیدواژه‌های صوتی'))),
        ui.card('نرخ ارز و طلا (برای تبدیل به تومان)', (() => {
          const box = h('div.set-grid.three');
          [['USD', 'دلار'], ['EUR', 'یورو'], ['GOLD', 'هر گرم طلای ۱۸ عیار']].forEach(([k, l]) => {
            const i = h('input', { type: 'text', inputMode: 'decimal', value: s.rates[k] ? LD.fmt(s.rates[k]) : '' });
            i.addEventListener('change', () => LD.db.setSettings({ rates: Object.assign({}, LD.state.data.settings.rates, { [k]: LD.parseNum(i.value) }) }));
            box.append(h('label.field', h('span.lbl', l + ' (تومان)'), i));
          });
          return box;
        })()),
        ui.card('امنیت', h('div.set-grid',
          h('div.btn-row', h('button.btn', { onclick: changePassword }, 'تغییر رمز عبور')),
          h('label.field', h('span.lbl', 'قفل خودکار پس از چند دقیقه بی‌کاری (۰ = هرگز)'), (() => { const i = h('input', { type: 'number', min: 0, value: s.autoLockMin }); i.addEventListener('change', () => LD.db.setSettings({ autoLockMin: Number(i.value) || 0 })); return i; })()),
          h('p.muted.small', 'رمزنگاری: AES-256-GCM با کلید مشتق از رمز (PBKDF2، ۲۵۰ هزار تکرار). رمز عبور جایی ذخیره نمی‌شود و قابل بازیابی نیست؛ آن را فراموش نکنید.'))),
        ui.card('پشتیبان‌گیری، خروجی و ورود', h('div.btn-row',
          h('button.btn', { onclick: async () => LD.downloadFile('life-data-backup-' + LD.todayISO() + '.ldb', await LD.crypto.encrypt(LD.state.session, LD.state.data), 'application/octet-stream') }, 'دانلود پشتیبان رمزدار (.ldb)'),
          h('button.btn', { onclick: () => fileIn('.ldb', restoreLDB) }, 'بازیابی از پشتیبان'),
          h('button.btn', { onclick: exportCSV }, 'خروجی Excel (CSV) تراکنش‌ها'),
          h('button.btn', { onclick: () => fileIn('.csv,.txt', importCSV) }, 'ورود از CSV بانک'),
          h('button.btn.danger.ghost', { onclick: async () => { if (await ui.confirm('خروجی JSON رمزگذاری‌نشده است و هر کسی بتواند فایل را بخواند. ادامه می‌دهید؟', 'دانلود')) LD.downloadFile('life-data-' + LD.todayISO() + '.json', JSON.stringify(LD.state.data, null, 1), 'application/json'); } }, 'خروجی JSON (بدون رمز)'))),
        ui.card('ظاهر', h('div.seg', [['auto', 'خودکار'], ['light', 'روشن'], ['dark', 'تیره']].map(([k, l]) => h('button' + ((localStorage.getItem('ld.theme') || 'auto') === k ? '.on' : ''), { onclick: () => { LD.app.setTheme(k); LD.router.refresh(); } }, l)))),
        h('p.muted.small.center', 'داشبورد زندگی — نسخه ۱٫۰ — همه داده‌ها فقط در فایل رمزگذاری‌شده شما نگه داشته می‌شود.'));
    },
  };
  LD.settingsTools = { parseCSV, anyDate, exportCSV };
})();
