const CACHE_PREFIX = "active-mirror-app-shell-";
const CACHE_NAME = "active-mirror-app-shell-23099a2ef95ade0f";
const APP_INDEX = "/app/index.html";
const PRIVATE_RECALL_RUNTIME_CACHE = 'active-mirror-private-recall-runtime-v1';
const PRIVATE_RECALL_RUNTIME_PREFIX = "/app/assets/litert/wasm/";
const APP_SHELL = [
  "/app/assets/About-B9LuAHbo.js",
  "/app/assets/DeviceExperience-Dz22ytbs.js",
  "/app/assets/Enterprise-BY0aelBt.js",
  "/app/assets/FeedbackDashboard-1WvW6GR9.js",
  "/app/assets/MirrorProdStory-Cqi77_Dn.js",
  "/app/assets/MirrorProdStory-DPjv5eSc.css",
  "/app/assets/NotFound-BgSwEpzw.js",
  "/app/assets/Privacy-CsxRVzId.js",
  "/app/assets/Research-fqhoLhUv.js",
  "/app/assets/Start-B71Ka1Qn.js",
  "/app/assets/Terms-D85aRcXH.js",
  "/app/assets/arrow-left-B1s_8owA.js",
  "/app/assets/chart-column-KWgUnikB.js",
  "/app/assets/database-C-B0avtd.js",
  "/app/assets/file-check-2-DVQZIGId.js",
  "/app/assets/index-BqBPpC74.css",
  "/app/assets/index-DYYfpVb7.js",
  "/app/assets/mail-CcbzW80s.js",
  "/app/assets/private-recall.worker-CHMXrwcg.js",
  "/app/assets/rotate-ccw-B16WuJvA.js",
  "/app/assets/shield-BEIKEO4Y.js",
  "/app/assets/triangle-alert-DTUDikgF.js",
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
