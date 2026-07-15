const CACHE_PREFIX = "active-mirror-app-shell-";
const CACHE_NAME = "active-mirror-app-shell-03d802f6fbabe426";
const APP_INDEX = "/app/index.html";
const PRIVATE_RECALL_RUNTIME_CACHE = 'active-mirror-private-recall-runtime-v1';
const PRIVATE_RECALL_RUNTIME_PREFIX = "/app/assets/litert/wasm/";
const APP_SHELL = [
  "/app/assets/About-BonzgY_y.js",
  "/app/assets/DeviceExperience-DjxXp5p6.js",
  "/app/assets/Enterprise-Bt-euOQX.js",
  "/app/assets/FeedbackDashboard-DwGYTrcm.js",
  "/app/assets/MirrorProdStory-NZI4pPSv.css",
  "/app/assets/MirrorProdStory-hOsG6-B7.js",
  "/app/assets/NotFound-DQRjpFzy.js",
  "/app/assets/Privacy-B0JnpXyK.js",
  "/app/assets/Research-Dc5LKXNS.js",
  "/app/assets/Start-BJ8-MZrn.js",
  "/app/assets/Terms-Dz4NWhzF.js",
  "/app/assets/arrow-left-BSdQoBrS.js",
  "/app/assets/chart-column-RPRsVuyL.js",
  "/app/assets/database-Baft5tCR.js",
  "/app/assets/file-check-2-zw8dODDq.js",
  "/app/assets/index-CMi7Qo4P.js",
  "/app/assets/index-CXC4OZXP.css",
  "/app/assets/mail-BKdXOyT7.js",
  "/app/assets/private-recall.worker-CHMXrwcg.js",
  "/app/assets/rotate-ccw-dDHrvdal.js",
  "/app/assets/shield-Ce3PzBVp.js",
  "/app/assets/triangle-alert-BSeKH1im.js",
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
