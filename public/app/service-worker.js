const CACHE_PREFIX = "active-mirror-app-shell-";
const CACHE_NAME = "active-mirror-app-shell-4a54a2e993e11f84";
const APP_INDEX = "/app/index.html";
const PRIVATE_RECALL_RUNTIME_CACHE = 'active-mirror-private-recall-runtime-v1';
const PRIVATE_RECALL_RUNTIME_PREFIX = "/app/assets/litert/wasm/";
const APP_SHELL = [
  "/app/assets/About-CzA-ha3Z.js",
  "/app/assets/DeviceExperience-BmFDvm5u.js",
  "/app/assets/Enterprise-C4UGnZ_-.js",
  "/app/assets/FeedbackDashboard-BYfaZuCl.js",
  "/app/assets/MirrorProdStory-B8LuhnhH.js",
  "/app/assets/MirrorProdStory-DPjv5eSc.css",
  "/app/assets/NotFound-CTe96LrD.js",
  "/app/assets/Privacy-VaE28M_D.js",
  "/app/assets/Research-BnQEk_Sk.js",
  "/app/assets/Start-DPBaidoY.js",
  "/app/assets/Terms-rv1HucPJ.js",
  "/app/assets/arrow-left-Cydij9vi.js",
  "/app/assets/chart-column-BzhgOJEm.js",
  "/app/assets/database-BKdNxex4.js",
  "/app/assets/file-check-2-Dd69ceCo.js",
  "/app/assets/index-BEWHdLDV.css",
  "/app/assets/index-BXbpWiOz.js",
  "/app/assets/mail-BoPTHreY.js",
  "/app/assets/private-recall.worker-CHMXrwcg.js",
  "/app/assets/rotate-ccw-Bv9z8Vkb.js",
  "/app/assets/shield-Ct3OFYUu.js",
  "/app/assets/triangle-alert-BJYn4jom.js",
  "/app/index.html"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/app/v1/")) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(APP_INDEX)));
    return;
  }

  if (url.pathname.startsWith(PRIVATE_RECALL_RUNTIME_PREFIX)) {
    event.respondWith(
      caches.open(PRIVATE_RECALL_RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request, { ignoreVary: true });
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (!APP_SHELL.includes(url.pathname)) return;
  event.respondWith(caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request)));
});
