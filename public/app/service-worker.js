const CACHE_PREFIX = "active-mirror-app-shell-";
const CACHE_NAME = "active-mirror-app-shell-3457d0421eefe8c3";
const APP_INDEX = "/app/index.html";
const PRIVATE_RECALL_RUNTIME_CACHE = 'active-mirror-private-recall-runtime-v1';
const PRIVATE_RECALL_RUNTIME_PREFIX = "/app/assets/litert/wasm/";
const APP_SHELL = [
  "/app/assets/About-BD_h-wFa.js",
  "/app/assets/DeviceExperience-DeHAHIeP.js",
  "/app/assets/Enterprise-BKWnWeGp.js",
  "/app/assets/FeedbackDashboard-nij23WuI.js",
  "/app/assets/MirrorProdStory-DKxSVtqC.js",
  "/app/assets/MirrorProdStory-DPjv5eSc.css",
  "/app/assets/NotFound-BFqBuyTf.js",
  "/app/assets/Privacy-C-fYvy81.js",
  "/app/assets/Research-yjxuMl8t.js",
  "/app/assets/Start-BWYTHXzA.js",
  "/app/assets/Terms-CeH6iBkR.js",
  "/app/assets/arrow-left-CabjWx0-.js",
  "/app/assets/chart-column-hdjhcuqn.js",
  "/app/assets/database-8Hbuku5H.js",
  "/app/assets/file-check-2-CpLdUHjJ.js",
  "/app/assets/index-BSFa-CIw.js",
  "/app/assets/index-C6ZjJUxg.css",
  "/app/assets/mail-Dpq2ZtBM.js",
  "/app/assets/private-recall.worker-CHMXrwcg.js",
  "/app/assets/rotate-ccw-0MnkjJra.js",
  "/app/assets/shield-CtDUNBM4.js",
  "/app/assets/triangle-alert-OGZuzh_l.js",
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
