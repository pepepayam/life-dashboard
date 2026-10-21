/* مدل داده، ذخیره‌سازی، همگام‌سازی و ادغام */
'use strict';
LD.COLLECTIONS = ['units', 'accounts', 'categories', 'transactions', 'cheques', 'loans', 'debts', 'people', 'assets',
  'csLots', 'cafeSales', 'projects', 'ideas', 'vault', 'reminders', 'reports'];
LD.DATA_FILE = 'life-data.ldb';

LD.defaultData = () => {
  const t = LD.now();
  const mk = (o) => Object.assign({ id: LD.uid(), createdAt: t, updatedAt: t }, o);
  const units = [
    mk({ id: 'personal', name: 'شخصی', aliases: 'خانه خونه شخصی خودم', color: 1 }),
    mk({ id: 'coldstore', name: 'سردخانه', aliases: 'سردخونه سردخانه انبار', color: 2 }),
    mk({ id: 'cafe', name: 'کافه', aliases: 'کافه کافی شاپ', color: 3 }),
    mk({ id: 'projects', name: 'پروژه‌ها', aliases: 'پروژه', color: 4 }),
  ];
  const cats = [];
  const addCats = (unitId, type, names) => names.forEach((n) => cats.push(mk({ unitId, type, name: n })));
  addCats('personal', 'expense', ['خوراک و خرید خانه', 'اجاره و قبوض', 'حمل‌ونقل و خودرو', 'سلامت و درمان', 'آموزش', 'پوشاک', 'تفریح و سفر', 'هدیه و کمک', 'اقساط و وام', 'سایر']);
  addCats('personal', 'income', ['حقوق و برداشت از کسب‌وکار', 'سود سرمایه‌گذاری', 'اجاره دریافتی', 'سایر']);
  addCats('coldstore', 'expense', ['برق', 'تعمیرات و نگهداری', 'گاز و سوخت', 'حقوق کارگران', 'بیمه و مالیات', 'حمل و تخلیه', 'سایر']);
  addCats('coldstore', 'income', ['کرایه نگهداری', 'خدمات بارگیری', 'سایر']);
  addCats('cafe', 'expense', ['مواد اولیه', 'حقوق پرسنل', 'اجاره', 'قبوض', 'تجهیزات', 'تبلیغات', 'سایر']);
  addCats('cafe', 'income', ['فروش', 'سایر']);
  addCats('projects', 'expense', ['سرمایه‌گذاری', 'هزینه جاری پروژه', 'سایر']);
  addCats('projects', 'income', ['بازگشت سرمایه', 'سود پروژه', 'سایر']);
  const catId = (u, n) => cats.find((c) => c.unitId === u && c.name === n).id;
  return {
    meta: { version: 1, rev: LD.uid(), savedAt: t, createdAt: t },
    settings: {
      updatedAt: t,
      domains: ['کسب‌وکار جدید', 'سردخانه', 'کافه', 'سرمایه‌گذاری', 'شخصی و خانواده', 'سلامت', 'یادگیری'],
      rates: { USD: 0, EUR: 0, GOLD: 0 },
      keywordMap: [
        { word: 'شیر', unitId: 'cafe', categoryId: catId('cafe', 'مواد اولیه') },
        { word: 'قهوه', unitId: 'cafe', categoryId: catId('cafe', 'مواد اولیه') },
        { word: 'شکر', unitId: 'cafe', categoryId: catId('cafe', 'مواد اولیه') },
        { word: 'کمپرسور', unitId: 'coldstore', categoryId: catId('coldstore', 'تعمیرات و نگهداری') },
        { word: 'برق', unitId: 'coldstore', categoryId: catId('coldstore', 'برق') },
        { word: 'کرایه', unitId: 'coldstore', categoryId: catId('coldstore', 'کرایه نگهداری') },
        { word: 'بنزین', unitId: 'personal', categoryId: catId('personal', 'حمل‌ونقل و خودرو') },
      ],
      autoLockMin: 15,
    },
    tombstones: {},
    units, categories: cats,
    accounts: [mk({ name: 'صندوق نقدی', kind: 'cash', unitId: 'personal', currency: 'IRT', opening: 0 })],
    transactions: [], cheques: [], loans: [], debts: [], people: [], assets: [],
    csLots: [], cafeSales: [], projects: [], ideas: [], vault: [], reminders: [], reports: [],
  };
};

/* ---------- حالت برنامه ---------- */
LD.state = { data: null, session: null, backend: null, baseRev: null, dirty: false, saving: false, listeners: [] };

LD.db = {
  list(col) { return (LD.state.data[col] || []); },
  get(col, id) { return this.list(col).find((x) => x.id === id); },
  put(col, obj) {
    const arr = LD.state.data[col] || (LD.state.data[col] = []);
    const t = LD.now();
    for (const k in obj) if (obj[k] === undefined) delete obj[k];
    if (!obj.id) obj.id = LD.uid();
    const i = arr.findIndex((x) => x.id === obj.id);
    if (i >= 0) arr[i] = Object.assign({}, arr[i], obj, { updatedAt: t });
    else arr.push(Object.assign({ createdAt: t }, obj, { updatedAt: t }));
    LD.changed();
    return obj.id;
  },
  remove(col, id) {
    const arr = LD.state.data[col] || [];
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) arr.splice(i, 1);
    LD.state.data.tombstones[id] = LD.now();
    LD.changed();
  },
  setSettings(patch) { Object.assign(LD.state.data.settings, patch, { updatedAt: LD.now() }); LD.changed(); },
};

LD.onChange = (fn) => LD.state.listeners.push(fn);
LD.changed = () => {
  LD.state.dirty = true;
  LD.setSaveStatus('pending');
  LD.scheduleSave();
};
LD.scheduleSave = LD.debounce(() => LD.save(), 1500);
LD.setSaveStatus = (s, msg) => {
  const el = document.getElementById('save-status');
  if (!el) return;
  const map = { pending: 'در حال تغییر…', saving: 'در حال ذخیره…', saved: 'ذخیره شد', error: 'خطا در ذخیره', offline: 'فقط روی این دستگاه' };
  el.textContent = msg || map[s];
  el.dataset.s = s;
};

/* ---------- ادغام رکوردبه‌رکورد ---------- */
LD.merge = (local, remote) => {
  const out = JSON.parse(JSON.stringify(local));
  const tomb = Object.assign({}, remote.tombstones || {});
  for (const id in local.tombstones || {}) if (!tomb[id] || tomb[id] < local.tombstones[id]) tomb[id] = local.tombstones[id];
  out.tombstones = tomb;
  for (const col of LD.COLLECTIONS) {
    const map = new Map();
    for (const x of remote[col] || []) map.set(x.id, x);
    for (const x of local[col] || []) { const r = map.get(x.id); if (!r || (x.updatedAt || '') >= (r.updatedAt || '')) map.set(x.id, x); }
    out[col] = [...map.values()].filter((x) => !tomb[x.id] || tomb[x.id] < x.updatedAt);
  }
  if ((remote.settings?.updatedAt || '') > (local.settings?.updatedAt || '')) out.settings = remote.settings;
  return out;
};

/* ---------- لایه‌های ذخیره‌سازی ---------- */
LD.backends = {
  /* پوشه روی دیسک (پوشه OneDrive) با File System Access API */
  folder: {
    label: 'پوشه روی این کامپیوتر',
    supported: () => 'showDirectoryPicker' in window,
    async pick() {
      const dir = await window.showDirectoryPicker({ id: 'lifedashboard', mode: 'readwrite', startIn: 'documents' });
      await LD.idb.set('dirHandle', dir);
      return dir;
    },
    async ensurePermission(interactive) {
      const dir = await LD.idb.get('dirHandle');
      if (!dir) return false;
      let p = await dir.queryPermission({ mode: 'readwrite' });
      if (p !== 'granted' && interactive) p = await dir.requestPermission({ mode: 'readwrite' });
      return p === 'granted' ? dir : false;
    },
    async read() {
      const dir = await this.ensurePermission(false);
      if (!dir) throw new Error('دسترسی به پوشه داده نشده');
      try { const fh = await dir.getFileHandle(LD.DATA_FILE); return await (await fh.getFile()).text(); }
      catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
    },
    async write(text) {
      const dir = await this.ensurePermission(false);
      if (!dir) throw new Error('دسترسی به پوشه داده نشده');
      const fh = await dir.getFileHandle(LD.DATA_FILE, { create: true });
      const w = await fh.createWritable(); await w.write(text); await w.close();
    },
    async backup(text) {
      const dir = await this.ensurePermission(false);
      const bdir = await dir.getDirectoryHandle('backups', { create: true });
      const name = 'life-data-' + LD.todayISO() + '.ldb';
      const fh = await bdir.getFileHandle(name, { create: true });
      const w = await fh.createWritable(); await w.write(text); await w.close();
      const names = [];
      for await (const [n] of bdir.entries()) if (/^life-data-.*\.ldb$/.test(n)) names.push(n);
      names.sort();
      while (names.length > 30) await bdir.removeEntry(names.shift());
    },
    async name() { const d = await LD.idb.get('dirHandle'); return d ? d.name : ''; },
  },
  /* OneDrive از طریق Microsoft Graph (برای گوشی) — در onedrive.js پیاده شده */
  onedrive: {
    label: 'OneDrive (آنلاین)',
    supported: () => location.protocol === 'https:' || location.hostname === 'localhost',
    read: () => LD.onedrive.read(LD.DATA_FILE),
    write: (text) => LD.onedrive.write(LD.DATA_FILE, text),
    backup: (text) => LD.onedrive.write('backups/life-data-' + LD.todayISO() + '.ldb', text),
    name: async () => 'OneDrive/LifeDashboard',
  },
  /* فقط همین دستگاه (کش مرورگر) */
  local: {
    label: 'فقط همین دستگاه',
    supported: () => true,
    read: () => LD.idb.get('cache').then((x) => x || null),
    write: () => Promise.resolve(),
    backup: () => Promise.resolve(),
    name: async () => 'حافظه مرورگر',
  },
};

LD.backend = () => LD.backends[LD.state.backend];

/* بارگذاری: متن فایل را رمزگشایی می‌کند */
LD.openText = async (text, password) => {
  const { data, session } = await LD.crypto.decrypt(text, { session: LD.state.session, password });
  LD.state.data = LD.upgrade(data);
  LD.state.session = session;
  LD.state.baseRev = data.meta.rev;
  await LD.idb.set('cache', text);
};

LD.upgrade = (data) => {
  const def = LD.defaultData();
  for (const col of LD.COLLECTIONS) if (!Array.isArray(data[col])) data[col] = def[col];
  data.tombstones = data.tombstones || {};
  data.settings = Object.assign({}, def.settings, data.settings || {});
  return data;
};

/* ذخیره با تشخیص تعارض */
LD.save = async (force = false) => {
  const st = LD.state;
  if (!st.data || !st.session) return;
  if (st.saving) { LD.scheduleSave(); return; }
  if (!st.dirty && !force) return;
  st.saving = true; LD.setSaveStatus('saving');
  try {
    const be = LD.backend();
    let remoteText = null;
    try { remoteText = await be.read(); } catch (e) { if (st.backend !== 'local') throw e; }
    if (remoteText && st.backend !== 'local') {
      const h = LD.crypto.header(remoteText);
      if (h.rev !== st.baseRev) {
        let remote;
        try { remote = (await LD.crypto.decrypt(remoteText, { session: st.session })).data; }
        catch (e) {
          if (e.code !== 'NEED_PASSWORD') throw e;
          const pw = await LD.ui.askPassword('رمز فایل روی فضای ابری تغییر کرده است. رمز جدید را وارد کنید:');
          const r = await LD.crypto.decrypt(remoteText, { password: pw });
          remote = r.data; st.session = r.session;
        }
        st.data = LD.merge(st.data, LD.upgrade(remote));
        LD.toast('تغییرات دستگاه دیگر ادغام شد');
        LD.router && LD.router.refresh();
      }
    }
    st.dirty = false;
    st.data.meta.rev = LD.uid();
    st.data.meta.savedAt = LD.now();
    const text = await LD.crypto.encrypt(st.session, st.data);
    await be.write(text);
    await LD.idb.set('cache', text);
    st.baseRev = st.data.meta.rev;
    const last = await LD.idb.get('lastBackup:' + st.backend);
    if (last !== LD.todayISO() && st.backend !== 'local') {
      try { await be.backup(text); await LD.idb.set('lastBackup:' + st.backend, LD.todayISO()); } catch (e) { console.warn('backup', e); }
    }
    LD.setSaveStatus(st.backend === 'local' ? 'offline' : 'saved');
    if (st.backend === 'folder') LD.cloud.schedule();
  } catch (e) {
    console.error(e);
    st.dirty = true;
    /* در صورت قطعی، داده در کش محلی حفظ می‌شود */
    try { await LD.idb.set('cache', await LD.crypto.encrypt(st.session, st.data)); } catch (_) { /* */ }
    LD.setSaveStatus('error', 'ذخیره نشد: ' + (e.message || e) + ' (در این دستگاه نگه داشته شد)');
    if (/هم‌زمان/.test(e.message || '')) setTimeout(() => LD.save(), 1500);
  } finally { st.saving = false; }
};

/* بارگذاری مجدد از منبع (برای دیدن تغییرات دستگاه‌های دیگر) */
LD.syncNow = async () => {
  LD.state.dirty = true; await LD.save(true);
  if (LD.state.backend === 'folder' && (await LD.cloud.ready())) await LD.cloud.run(true);
};

window.addEventListener('beforeunload', (e) => { if (LD.state.dirty) { LD.save(); e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && LD.state.dirty) LD.save(); });
