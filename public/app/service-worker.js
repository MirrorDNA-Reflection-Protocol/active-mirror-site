const CACHE_PREFIX = "active-mirror-app-shell-";
const CACHE_NAME = "active-mirror-app-shell-6483625f60186dcd";
const APP_INDEX = "/app/index.html";
const PRIVATE_RECALL_RUNTIME_CACHE = 'active-mirror-private-recall-runtime-v1';
const PRIVATE_RECALL_RUNTIME_PREFIX = "/app/assets/litert/wasm/";
const APP_SHELL = [
  "/app/assets/About-DAiiQFhd.js",
  "/app/assets/DeviceExperience-BhFHGIEC.js",
  "/app/assets/Enterprise-BWTdjd-B.js",
  "/app/assets/FeedbackDashboard-CJGx7kee.js",
  "/app/assets/MirrorProdStory-BD979QFx.js",
  "/app/assets/MirrorProdStory-DPjv5eSc.css",
  "/app/assets/NotFound-R50jAL3p.js",
  "/app/assets/Privacy-BnIPx_oT.js",
  "/app/assets/Research-DST3CDSW.js",
  "/app/assets/Start-cBoc77DQ.js",
  "/app/assets/Terms-qZwQOCg3.js",
  "/app/assets/arrow-left-D8U93lkR.js",
  "/app/assets/chart-column-CjF9gu4T.js",
  "/app/assets/database-wT143riW.js",
  "/app/assets/file-check-2-C-02LQNk.js",
  "/app/assets/index-DE7OMOkt.css",
  "/app/assets/index-pOMKZoAP.js",
  "/app/assets/mail-C1knpMKf.js",
  "/app/assets/private-recall.worker-CHMXrwcg.js",
  "/app/assets/rotate-ccw-CEWqoz3e.js",
  "/app/assets/shield-CQZndra2.js",
  "/app/assets/triangle-alert-BrliIJof.js",
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
