/* راه‌اندازی برنامه: صفحه ورود، پوسته، قفل خودکار، همگام‌سازی پس‌زمینه */
'use strict';
LD.app = (() => {
  const h = LD.h, ui = LD.ui;

  function setTheme(t) {
    localStorage.setItem('ld.theme', t);
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  }

  /* ---------- نصب روی گوشی (PWA) ---------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; document.querySelectorAll('.install-btn').forEach((b) => (b.hidden = false)); });
  window.addEventListener('appinstalled', () => { installEvt = null; document.querySelectorAll('.install-btn').forEach((b) => (b.hidden = true)); LD.toast('برنامه روی گوشی نصب شد'); });
  const installBtn = () => h('button.btn.install-btn', { hidden: !installEvt, onclick: async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; } }, '📲 نصب روی گوشی');

  /* ---------- صفحه ورود ---------- */
  const gate = (content) => {
    document.getElementById('app').hidden = true;
    const g = document.getElementById('gate');
    g.hidden = false; g.innerHTML = '';
    g.append(h('div.gate-box', h('div.brand.big', h('span.logo', '◐'), h('b', 'داشبورد زندگی')), content, installBtn()));
  };

  function welcome() {
    const fsOk = LD.backends.folder.supported();
    const desktop = fsOk && location.protocol === 'file:';
    const ghOpt = h('button.opt', { onclick: () => githubSetup() }, h('b', '🔄 GitHub — همگام بین کامپیوترها و گوشی' + (desktop ? '' : ' (پیشنهادی)')), h('span', 'فایل رمزگذاری‌شده در یک مخزن خصوصی GitHub نگه داشته می‌شود؛ روی کامپیوتر یک نسخه هم در پوشه OneDrive نوشته می‌شود.'));
    const folderOpt = fsOk ? h('button.opt', { onclick: async () => { try { await LD.backends.folder.pick(); localStorage.setItem('ld.backend', 'folder'); unlock(true); } catch (e) { if (e.name !== 'AbortError') LD.toast(e.message, 'warn'); } } },
      h('b', '📁 فایل روی این کامپیوتر' + (desktop ? ' (پیشنهادی)' : '')), h('span', 'پوشه LifeDashboard در OneDrive را انتخاب کنید؛ بدون اینترنت هم کار می‌کند. در تنظیمات می‌توانید پشتیبان ابری GitHub را هم روشن کنید.')) : null;
    gate(h('div',
      h('p', 'داده‌های شما در یک فایل رمزگذاری‌شده نگه داشته می‌شود. محل ذخیره را انتخاب کنید:'),
      h('div.gate-opts',
        desktop ? folderOpt : ghOpt,
        desktop ? ghOpt : folderOpt,
        h('button.opt', { onclick: () => onedriveSetup() }, h('b', '☁️ OneDrive آنلاین'), h('span', 'فقط اگر Client ID برنامه Azure دارید.')),
        h('button.opt', { onclick: () => { localStorage.setItem('ld.backend', 'local'); unlock(true); } }, h('b', '📱 فقط همین دستگاه'), h('span', 'داده در حافظه مرورگر می‌ماند؛ با «دانلود پشتیبان» می‌توانید آن را منتقل کنید.')),
        h('button.opt', { onclick: () => openFile() }, h('b', '📄 باز کردن فایل life-data.ldb'), h('span', 'یک فایل پشتیبان یا فایل داده را از گوشی/کامپیوتر باز کنید.'))),
      !fsOk ? h('p.muted.small', 'مرورگر شما انتخاب پوشه را پشتیبانی نمی‌کند (روی کامپیوتر از Chrome یا Edge استفاده کنید).') : null));
  }

  function githubSetup() {
    const c = LD.github.cfg();
    const tok = h('input', { type: 'password', dir: 'ltr', placeholder: 'github_pat_…', autocomplete: 'off' });
    const repo = h('input', { type: 'text', dir: 'ltr', value: c.owner ? c.owner + '/' + c.repo : 'life-data', placeholder: 'life-data' });
    const msg = h('p.err');
    const fsOk = LD.backends.folder.supported();
    const mirror = h('input', { type: 'checkbox', checked: fsOk });
    const btn = h('button.btn.primary', { onclick: async () => {
      msg.textContent = ''; btn.disabled = true;
      try {
        if (fsOk && mirror.checked && !(await LD.idb.get('dirHandle'))) { try { await LD.backends.folder.pick(); } catch (e) { if (e.name !== 'AbortError') throw e; } }
        await LD.github.connect(tok.value, repo.value.trim() || 'life-data');
        localStorage.setItem('ld.backend', 'github');
        unlock(true);
      } catch (e) { msg.textContent = e.message; btn.disabled = false; }
    } }, 'اتصال');
    gate(h('div',
      h('p', 'توکن GitHub و نام مخزن خصوصی داده را وارد کنید (راهنما در README-fa.md).'),
      h('label.field', h('span.lbl', 'توکن (Fine-grained, فقط همین مخزن، Contents: Read and write)'), tok),
      h('label.field', h('span.lbl', 'مخزن داده (خصوصی)'), repo),
      fsOk ? h('label.switch', mirror, h('span', 'یک نسخه هم در پوشه OneDrive روی این کامپیوتر ذخیره شود')) : null,
      msg,
      h('div.btn-row', h('button.btn', { onclick: welcome }, 'بازگشت'), btn)));
  }

  function onedriveSetup() {
    const cfg = LD.onedrive.cfg();
    const inp = h('input', { type: 'text', dir: 'ltr', value: cfg.clientId || '', placeholder: 'Application (client) ID' });
    gate(h('div',
      h('p', 'Client ID برنامه‌ای که در Azure ساخته‌اید را وارد کنید (راهنما در README-fa.md).'),
      h('label.field', h('span.lbl', 'Client ID'), inp),
      h('p.small.muted', 'Redirect URI: ', h('code', { dir: 'ltr' }, LD.onedrive.redirectUri())),
      location.protocol !== 'https:' && location.hostname !== 'localhost' ? h('p.err', 'این صفحه از آدرس https باز نشده؛ ورود به OneDrive کار نمی‌کند.') : null,
      h('div.btn-row', h('button.btn', { onclick: welcome }, 'بازگشت'),
        h('button.btn.primary', { onclick: () => { if (!inp.value.trim()) return; LD.onedrive.setCfg({ clientId: inp.value.trim() }); localStorage.setItem('ld.backend', 'onedrive'); LD.onedrive.login().catch((e) => LD.toast(e.message, 'warn')); } }, 'ورود با حساب مایکروسافت'))));
  }

  function openFile() {
    const i = h('input', { type: 'file', accept: '.ldb', style: { display: 'none' } });
    i.addEventListener('change', async () => {
      const f = i.files[0]; if (!f) return;
      const text = await f.text();
      try { LD.crypto.header(text); } catch (e) { LD.toast('این فایل داده داشبورد نیست', 'warn'); return; }
      await LD.idb.set('cache', text);
      localStorage.setItem('ld.backend', 'local');
      unlock(false);
    });
    document.body.append(i); i.click();
  }

  async function unlock(interactiveFirst) {
    const backend = localStorage.getItem('ld.backend');
    if (!backend || !LD.backends[backend]) return welcome();
    const be = LD.backends[backend];
    const name = await be.name().catch(() => '');
    const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'رمز عبور' });
    const pw2 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'تکرار رمز عبور' });
    const msg = h('p.err');
    const status = h('p.muted.small', 'محل داده: ' + be.label + (name ? ' — ' + name : ''));
    let mode = 'unlock', remoteText = null, cacheText = null, loaded = false;

    const load = async (interactive) => {
      msg.textContent = '';
      if (backend === 'folder') { const ok = await LD.backends.folder.ensurePermission(interactive); if (!ok) { msg.textContent = interactive ? 'اجازه دسترسی به پوشه داده نشد' : ''; return false; } }
      let readErr = null;
      try { remoteText = await be.read(); }
      catch (e) { remoteText = null; readErr = e; }
      cacheText = await LD.idb.get('cache');
      if (readErr) {
        /* بدون دسترسی و بدون نسخه محلی، داشبورد خالی نساز (ممکن است داده روی سرور باشد) */
        if (!cacheText) { msg.textContent = 'دسترسی به محل داده ممکن نشد: ' + readErr.message + ' — اینترنت را بررسی و دوباره «باز کردن» را بزنید.'; loaded = false; return false; }
        status.textContent += ' — دسترسی ممکن نشد (' + readErr.message + ')؛ از نسخه ذخیره‌شده روی این دستگاه استفاده می‌شود.';
      }
      mode = (remoteText || cacheText) ? 'unlock' : 'create';
      loaded = true;
      render();
      return true;
    };

    const go = async () => {
      /* نسخه کپی در پوشه OneDrive: اجازه دسترسی را با همین کلیک بگیر */
      if (backend === 'github' && (await LD.idb.get('dirHandle'))) { try { await LD.backends.folder.ensurePermission(true); } catch (e) { /* */ } }
      if (!loaded && !(await load(true))) return;
      if (!pw.value) { msg.textContent = 'رمز را وارد کنید'; return; }
      btn.disabled = true; btn.textContent = 'در حال باز کردن…';
      try {
        if (mode === 'create') {
          if (pw.value.length < 8) throw new Error('رمز باید حداقل ۸ کاراکتر باشد');
          if (pw.value !== pw2.value) throw new Error('تکرار رمز یکسان نیست');
          LD.state.session = await LD.crypto.newSession(pw.value);
          LD.state.data = LD.defaultData();
          LD.state.backend = backend; LD.state.dirty = true;
          await LD.save(true);
        } else {
          let text = remoteText || cacheText;
          await LD.openText(text, pw.value);
          LD.state.backend = backend;
          if (remoteText && cacheText && cacheText !== remoteText) {
            /* تغییرات ذخیره‌نشده آفلاین در این دستگاه را ادغام کن */
            try { const c = await LD.crypto.decrypt(cacheText, { session: LD.state.session }); if (c.data.meta.savedAt > LD.state.data.meta.savedAt || c.data.meta.rev !== LD.state.data.meta.rev) { LD.state.data = LD.merge(LD.state.data, LD.upgrade(c.data)); LD.state.dirty = true; } } catch (e) { /* کش با رمز دیگری است */ }
          }
          if (!remoteText && backend !== 'local') LD.state.dirty = true;
          if (LD.state.dirty) LD.save(true);
        }
        start();
      } catch (e) {
        msg.textContent = e.message; btn.disabled = false; btn.textContent = mode === 'create' ? 'ساخت' : 'باز کردن';
      }
    };
    const btn = h('button.btn.primary.wide', { onclick: go }, 'باز کردن');
    pw.addEventListener('keydown', (e) => e.key === 'Enter' && (mode === 'create' ? pw2.focus() : go()));
    pw2.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    const render = () => {
      gate(h('div',
        h('h3', mode === 'create' ? 'ساخت داشبورد جدید' : 'ورود'),
        mode === 'create' ? h('p.small', 'فایلی در این محل پیدا نشد. یک رمز عبور قوی انتخاب کنید؛ این رمز قابل بازیابی نیست.') : null,
        status, pw, mode === 'create' ? pw2 : null, msg, btn,
        h('button.link-btn', { onclick: () => { localStorage.removeItem('ld.backend'); welcome(); } }, 'تغییر محل ذخیره')));
      btn.textContent = mode === 'create' ? 'ساخت' : 'باز کردن';
      setTimeout(() => pw.focus(), 50);
    };
    render();
    /* اگر دسترسی از قبل هست، فایل را بی‌درنگ بخوان */
    if (backend !== 'folder' || (await LD.backends.folder.ensurePermission(false)) || interactiveFirst) load(interactiveFirst).catch((e) => (msg.textContent = e.message));
  }

  /* ---------- پوسته ---------- */
  const NAV = [
    ['dashboard', 'داشبورد', 'home'], ['transactions', 'تراکنش‌ها', 'list'], ['accounts', 'حساب‌ها و دارایی', 'wallet'],
    ['cheques', 'چک‌ها', 'cheque'], ['debts', 'وام، طلب و بدهی', 'money'],
    null,
    ['coldstore', 'سردخانه', 'box'], ['cafe', 'کافه', 'cup'], ['projects', 'پروژه‌ها', 'project'], ['ideas', 'ایده‌ها', 'bulb'],
    null,
    ['vault', 'اطلاعات کاربردی', 'vault'], ['reminders', 'یادآورها', 'bell'], ['people', 'اشخاص', 'users'],
    null,
    ['reports', 'گزارش‌ها', 'report'], ['settings', 'تنظیمات', 'gear'],
  ];

  function shell() {
    const nav = document.getElementById('nav');
    nav.innerHTML = '';
    nav.append(h('div.brand', h('span.logo', '◐'), h('b', 'داشبورد زندگی')),
      h('div.nav-links', NAV.map((n) => n ? h('a.nav-link', { href: '#/' + n[0], 'data-nav': n[0] }, ui.icon(n[2]), h('span', n[1])) : h('hr'))),
      h('div.nav-foot', h('span#save-status', { 'data-s': 'saved' }, 'ذخیره شد')));
    const top = document.getElementById('topbar');
    top.innerHTML = '';
    top.append(h('button.icon-btn.menu-btn', { 'aria-label': 'منو', onclick: () => document.body.classList.toggle('nav-open') }, ui.icon('menu')),
      h('h1#page-title', ''), h('span.spacer'),
      h('button.icon-btn', { title: 'ثبت صوتی', 'aria-label': 'ثبت صوتی', onclick: () => LD.voice.quickVoice() }, ui.icon('mic')),
      h('button.icon-btn', { title: 'همگام‌سازی', 'aria-label': 'همگام‌سازی', onclick: async () => { await LD.syncNow(); LD.router.refresh(); } }, ui.icon('sync')),
      h('button.icon-btn', { title: 'قفل', 'aria-label': 'قفل', onclick: lock }, ui.icon('lock')));
    const bb = document.getElementById('bottombar');
    bb.innerHTML = '';
    bb.append(
      h('a', { href: '#/dashboard', 'data-nav': 'dashboard' }, ui.icon('home'), h('span', 'خانه')),
      h('a', { href: '#/transactions', 'data-nav': 'transactions' }, ui.icon('list'), h('span', 'تراکنش')),
      h('button.fab', { 'aria-label': 'ثبت سریع', onclick: quickAdd }, ui.icon('plus', 28)),
      h('a', { href: '#/projects', 'data-nav': 'projects' }, ui.icon('project'), h('span', 'پروژه')),
      h('button', { onclick: () => document.body.classList.toggle('nav-open') }, ui.icon('menu'), h('span', 'بیشتر')));
    document.getElementById('scrim').onclick = () => document.body.classList.remove('nav-open');
  }

  function quickAdd() {
    const P = LD.pages;
    const items = [
      ['mic', 'ثبت صوتی', () => LD.voice.quickVoice()],
      ['list', 'پیامک بانک', () => LD.sms.dialog()],
      ['money', 'هزینه', () => P.transactions.edit({ type: 'expense' })],
      ['money', 'درآمد', () => P.transactions.edit({ type: 'income' })],
      ['cup', 'فروش روزانه کافه', () => P.cafe.editSale()],
      ['box', 'ورود محموله سردخانه', () => P.coldstore.edit()],
      ['cheque', 'چک', () => P.cheques.edit()],
      ['bulb', 'ایده', () => P.ideas.edit()],
      ['bell', 'یادآور', () => P.reminders.edit()],
      ['vault', 'اطلاعات کاربردی', () => P.vault.edit()],
      ['users', 'شخص / مشتری', () => P.people.edit()],
    ];
    const m = ui.modal({ title: 'ثبت سریع', body: h('div.quick-grid', items.map(([ic, l, fn]) => h('button.quick', { onclick: () => { m.close(); fn(); } }, ui.icon(ic, 26), h('span', l)))) });
  }

  async function lock() {
    if (LD.state.dirty) await LD.save(true);
    location.hash = '';
    location.reload();
  }
  async function switchStorage() {
    if (LD.state.dirty) await LD.save(true);
    if (!(await ui.confirm('برای تغییر محل ذخیره، برنامه قفل می‌شود و محل جدید را انتخاب می‌کنید. اگر محل جدید فایل نداشته باشد، داده فعلی در آن نوشته می‌شود.', 'ادامه', false))) return;
    localStorage.removeItem('ld.backend');
    location.reload();
  }

  /* دریافت تغییرات دستگاه‌های دیگر */
  async function pull() {
    const st = LD.state;
    if (!st.data || st.saving || st.backend === 'local' || document.visibilityState !== 'visible') return;
    if (document.querySelector('.modal-back')) return;
    try {
      const text = await LD.backend().read();
      if (!text || LD.crypto.header(text).rev === st.baseRev) return;
      const r = await LD.crypto.decrypt(text, { session: st.session });
      st.data = st.dirty ? LD.merge(st.data, LD.upgrade(r.data)) : LD.upgrade(r.data);
      st.baseRev = r.data.meta.rev;
      await LD.idb.set('cache', text);
      if (st.dirty) LD.save(); else LD.setSaveStatus('saved', 'به‌روز شد');
      LD.router.refresh();
    } catch (e) { console.warn('pull', e); }
  }

  let lastActive = Date.now();
  function start() {
    document.getElementById('gate').hidden = true;
    document.getElementById('app').hidden = false;
    shell();
    LD.router.render();
    LD.setSaveStatus(LD.state.backend === 'local' ? 'offline' : 'saved');
    ['pointerdown', 'keydown', 'scroll'].forEach((ev) => document.addEventListener(ev, () => (lastActive = Date.now()), { passive: true, capture: true }));
    setInterval(() => {
      const min = Number(LD.state.data.settings.autoLockMin) || 0;
      if (min && Date.now() - lastActive > min * 60000) lock();
    }, 30000);
    setInterval(pull, 120000);
    LD.cloud.start();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { lastActive = Date.now(); pull(); } });
    const shared = sessionStorage.getItem('ld.shared');
    if (shared) { sessionStorage.removeItem('ld.shared'); setTimeout(() => LD.sms.fromText(shared), 300); }
    const overdue = LD.fin.upcoming(3).filter((x) => x.overdue || x.date === LD.todayISO());
    if (overdue.length) LD.toast('📌 ' + LD.faNum(overdue.length) + ' سررسید امروز یا معوق دارید');
  }

  async function boot() {
    setTheme(localStorage.getItem('ld.theme') || 'auto');
    /* پیامکی که از برنامه پیامک «اشتراک‌گذاری» شده (share_target در manifest) */
    const q = new URLSearchParams(location.search);
    if (q.has('text') || q.has('title')) {
      sessionStorage.setItem('ld.shared', [q.get('title'), q.get('text')].filter(Boolean).join('\n'));
      history.replaceState(null, '', location.pathname + location.hash);
    }
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    try { if (await LD.onedrive.handleRedirect()) localStorage.setItem('ld.backend', 'onedrive'); }
    catch (e) { LD.toast('ورود به OneDrive ناموفق: ' + e.message, 'warn'); }
    if (!window.crypto || !crypto.subtle) { gate(h('p.err', 'این مرورگر رمزنگاری امن را پشتیبانی نمی‌کند. صفحه را با Chrome/Edge به‌روز یا از آدرس https باز کنید.')); return; }
    unlock(false);
  }

  return { boot, setTheme, lock, switchStorage, pull, installBtn };
})();
document.addEventListener('DOMContentLoaded', LD.app.boot);
