/* Service Worker: نسخه آفلاین برنامه روی گوشی (فقط کد برنامه کش می‌شود، نه داده‌ها) */
const CACHE = 'lifedashboard-202610220210';
const FILES = ['./', './index.html', './styles.css', './manifest.webmanifest', './icon.svg', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable.png', './js/app.js', './js/charts.js', './js/crypto.js', './js/finance.js', './js/github.js', './js/jalali.js', './js/onedrive.js', './js/pages-biz.js', './js/pages-core.js', './js/reports.js', './js/settings.js', './js/sms.js', './js/store.js', './js/ui.js', './js/util.js', './js/voice.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Graph و ورود مایکروسافت مستقیم
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))));
});
