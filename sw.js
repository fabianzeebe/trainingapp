// Service Worker: App offline verfügbar machen. Bei Änderungen VERSION erhöhen.
const VERSION = 'v7';
const CACHE = `trainingapp-${VERSION}`;
const SHELL = ['./', 'index.html', 'styles.css', 'js/app.js', 'js/core.js', 'js/engine.js', 'js/store.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'plan.json', 'coach.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Plan & Code: zuerst Netz (aktuell), sonst Cache (offline)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && !url.search) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
