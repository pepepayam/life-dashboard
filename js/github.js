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
