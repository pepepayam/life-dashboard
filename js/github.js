/* همگام‌سازی از طریق یک مخزن خصوصی GitHub (بدون Azure) — فایل داده قبل از ارسال رمزگذاری شده است */
'use strict';
LD.github = (() => {
  const API = 'https://api.github.com';
  const cfg = () => { try { return JSON.parse(localStorage.getItem('ld.github') || '{}'); } catch (e) { return {}; } };
  const setCfg = (p) => localStorage.setItem('ld.github', JSON.stringify(Object.assign(cfg(), p)));
  const token = () => LD.idb.get('gh.token');
  const shas = {}; // sha آخرین نسخه هر فایل برای PUT

  async function call(method, path, body) {
    const t = await token();
    if (!t) throw new Error('توکن GitHub وارد نشده');
    const r = await fetch(API + path, {
      method, cache: 'no-store',
      headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 404) return null;
    if (r.status === 401) throw new Error('توکن GitHub نامعتبر یا منقضی است');
    if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch (e) { /* */ } throw new Error('GitHub: ' + r.status + ' ' + m); }
    return r.status === 204 ? {} : r.json();
  }
  const filePath = (name) => { const { owner, repo } = cfg(); return `/repos/${owner}/${repo}/contents/${name.split('/').map(encodeURIComponent).join('/')}`; };
  /* base64 امن برای یونیکد */
  const toB64 = (s) => { const b = new TextEncoder().encode(s); let o = ''; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(o); };
  const fromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

  async function read(name) {
    const j = await call('GET', filePath(name) + '?t=' + Date.now());
    if (!j) { delete shas[name]; return null; }
    shas[name] = j.sha;
    if (j.content && j.encoding === 'base64' && j.content.length > 0) return fromB64(j.content);
    /* فایل‌های بزرگ‌تر از ۱ مگابایت: از blob بخوان */
    const { owner, repo } = cfg();
    const b = await call('GET', `/repos/${owner}/${repo}/git/blobs/${j.sha}`);
    return fromB64(b.content);
  }
  async function write(name, text) {
    if (!(name in shas)) { try { await read(name); } catch (e) { /* */ } }
    const body = { message: 'update ' + name + ' ' + new Date().toISOString(), content: toB64(text) };
    if (shas[name]) body.sha = shas[name];
    try {
      const j = await call('PUT', filePath(name), body);
      shas[name] = j.content.sha;
    } catch (e) {
      if (/409|422/.test(e.message)) { delete shas[name]; await read(name); throw new Error('فایل روی GitHub هم‌زمان تغییر کرد؛ دوباره ذخیره می‌شود'); }
      throw e;
    }
  }

  /* اتصال: توکن + نام مخزن را بررسی می‌کند */
  async function connect(tok, repoFull) {
    await LD.idb.set('gh.token', tok.trim());
    const me = await call('GET', '/user');
    let [owner, repo] = repoFull.includes('/') ? repoFull.split('/') : [me.login, repoFull];
    setCfg({ owner, repo });
    const info = await call('GET', `/repos/${owner}/${repo}`);
    if (!info) throw new Error('مخزن ' + owner + '/' + repo + ' پیدا نشد یا توکن به آن دسترسی ندارد');
    if (!info.private) throw new Error('این مخزن عمومی است! برای امنیت فقط از مخزن خصوصی استفاده کنید');
    setCfg({ connected: true });
    return { owner, repo };
  }
  async function logout() { await LD.idb.del('gh.token'); setCfg({ connected: false }); }

  return { read, write, connect, logout, cfg, setCfg };
})();

LD.backends.github = {
  label: 'GitHub (مخزن خصوصی)',
  supported: () => true,
  read: () => LD.github.read(LD.DATA_FILE),
  async write(text) {
    await LD.github.write(LD.DATA_FILE, text);
    /* روی کامپیوتر: یک نسخه هم در پوشه OneDrive/هارد */
    if (await LD.idb.get('dirHandle')) {
      try { if (await LD.backends.folder.ensurePermission(false)) await LD.backends.folder.write(text); } catch (e) { console.warn('mirror', e); }
    }
  },
  async backup(text) {
    await LD.github.write('backups/life-data-' + LD.todayISO() + '.ldb', text);
    if (await LD.idb.get('dirHandle')) { try { if (await LD.backends.folder.ensurePermission(false)) await LD.backends.folder.backup(text); } catch (e) { /* */ } }
  },
  name: async () => { const c = LD.github.cfg(); return c.owner ? c.owner + '/' + c.repo : ''; },
};

/* حالت پوشه روی کامپیوتر: پشتیبان ابری در GitHub هر وقت اینترنت باشد (خودکار و دستی)
   تغییرات گوشی/دستگاه دیگر که در GitHub نوشته شده، قبل از ارسال ادغام می‌شود */
LD.cloud = (() => {
  let busy = false, lastError = '';
  const ready = async () => LD.github.cfg().connected && !!(await LD.idb.get('gh.token'));
  const auto = () => LD.github.cfg().auto !== false;
  const waitSave = async () => { while (LD.state.saving) await new Promise((r) => setTimeout(r, 200)); };

  async function run(manual) {
    const st = LD.state;
    if (busy || !st.data || st.backend !== 'folder') return false;
    if (!(await ready())) { if (manual) LD.toast('برای پشتیبان ابری، در تنظیمات به GitHub وصل شوید', 'warn'); return false; }
    if (!navigator.onLine) { if (manual) LD.toast('اینترنت وصل نیست؛ پشتیبان ابری بعداً خودکار انجام می‌شود', 'warn'); return false; }
    busy = true;
    try {
      await waitSave();
      if (st.dirty) { await LD.save(true); await waitSave(); }
      const remote = await LD.github.read(LD.DATA_FILE);
      if (remote) {
        const rev = LD.crypto.header(remote).rev;
        if (rev !== st.baseRev && rev !== (await LD.idb.get('cloudRev'))) {
          let r;
          try { r = await LD.crypto.decrypt(remote, { session: st.session }); }
          catch (e) {
            if (e.code !== 'NEED_PASSWORD') throw e;
            if (!manual) throw new Error('رمز فایل روی GitHub با رمز فعلی فرق دارد؛ «پشتیبان‌گیری ابری اکنون» را بزنید');
            r = await LD.crypto.decrypt(remote, { password: await LD.ui.askPassword('رمز فایل روی GitHub با رمز فعلی فرق دارد. رمز آن را وارد کنید:') });
          }
          st.data = LD.merge(st.data, LD.upgrade(r.data)); st.dirty = true;
          await LD.save(true); await waitSave();
          LD.toast('تغییرات GitHub (گوشی یا دستگاه دیگر) ادغام شد');
          LD.router.refresh();
        }
      }
      if (st.dirty) throw new Error('فایل پوشه ذخیره نشد');
      const text = await LD.idb.get('cache');
      const rev = LD.crypto.header(text).rev;
      if (!remote || LD.crypto.header(remote).rev !== rev) await LD.github.write(LD.DATA_FILE, text);
      if ((await LD.idb.get('lastBackup:cloud')) !== LD.todayISO()) {
        await LD.github.write('backups/life-data-' + LD.todayISO() + '.ldb', text);
        await LD.idb.set('lastBackup:cloud', LD.todayISO());
      }
      await LD.idb.set('cloudRev', rev);
      await LD.idb.set('cloudAt', LD.now());
      lastError = '';
      if (manual) LD.toast('پشتیبان ابری انجام شد');
      return true;
    } catch (e) {
      lastError = e.message || String(e);
      console.warn('cloud', e);
      if (manual) LD.toast('پشتیبان ابری ناموفق: ' + lastError, 'warn');
      return false;
    } finally { busy = false; }
  }

  const schedule = LD.debounce(() => { if (auto()) run(false); }, 20000);
  function start() {
    if (LD.state.backend !== 'folder') return;
    window.addEventListener('online', schedule);
    setInterval(() => { if (auto() && document.visibilityState === 'visible') run(false); }, 600000);
    setTimeout(() => { if (auto()) run(false); }, 3000);
  }
  const status = async () => ({ at: await LD.idb.get('cloudAt'), error: lastError });

  return { run, schedule, start, status, ready, auto };
})();
