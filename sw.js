/* network-first: أي تحديث ترفعه على GitHub يظهر فورًا، والكاش للأوفلاين بس */
const CACHE = 'packbulk-v1';
const ASSETS = ['./', 'index.html', 'styles.css?v=1', 'app.js?v=1', 'manifest.json?v=1', 'icon-192.png', 'apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: false }).then((m) => m || caches.match('index.html')))
  );
});
