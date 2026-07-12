const CACHE_PREFIX = "active-mirror-app-shell-";
const CACHE_NAME = "active-mirror-app-shell-64321e7bb1d558c0";
const APP_INDEX = "/app/index.html";
const PRIVATE_RECALL_RUNTIME_CACHE = 'active-mirror-private-recall-runtime-v1';
const PRIVATE_RECALL_RUNTIME_PREFIX = "/app/assets/litert/wasm/";
const APP_SHELL = [
  "/app/assets/About-Bm0bzq42.js",
  "/app/assets/DeviceExperience-cs0HkJNV.js",
  "/app/assets/Enterprise-DAv0RZmX.js",
  "/app/assets/FeedbackDashboard-Cu2qPuk5.js",
  "/app/assets/MirrorProdStory-BaFMUFYn.js",
  "/app/assets/MirrorProdStory-DPjv5eSc.css",
  "/app/assets/NotFound-BCCv93J0.js",
  "/app/assets/Privacy-BbV2v-TN.js",
  "/app/assets/Research-LeIOp6dS.js",
  "/app/assets/Start-sxKB4VfF.js",
  "/app/assets/Terms-DaHbQaNd.js",
  "/app/assets/arrow-left-s8ir56dR.js",
  "/app/assets/chart-column-BCa353j1.js",
  "/app/assets/database-BoadGfzp.js",
  "/app/assets/file-check-2-SRaLEFZP.js",
  "/app/assets/index-Bg4kWVES.js",
  "/app/assets/index-BgP7G3GN.css",
  "/app/assets/mail-CTBj29Ho.js",
  "/app/assets/private-recall.worker-CHMXrwcg.js",
  "/app/assets/rotate-ccw-XvxPsZkf.js",
  "/app/assets/shield-1kQ-Brsn.js",
  "/app/assets/triangle-alert-hU0sHW7b.js",
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
