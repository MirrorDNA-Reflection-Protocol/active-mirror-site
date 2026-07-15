const CACHE_PREFIX = "active-mirror-app-shell-";
const CACHE_NAME = "active-mirror-app-shell-6a5b8abdaaaf3d05";
const APP_INDEX = "/app/index.html";
const PRIVATE_RECALL_RUNTIME_CACHE = 'active-mirror-private-recall-runtime-v1';
const PRIVATE_RECALL_RUNTIME_PREFIX = "/app/assets/litert/wasm/";
const APP_SHELL = [
  "/app/assets/About-BCgSDEsH.js",
  "/app/assets/DeviceExperience-CRF8KYHx.js",
  "/app/assets/Enterprise-AbWNt8bp.js",
  "/app/assets/FeedbackDashboard-BHuGnqjf.js",
  "/app/assets/MirrorProdStory-Bg0tcM47.js",
  "/app/assets/MirrorProdStory-NZI4pPSv.css",
  "/app/assets/NotFound-b9r1WXHc.js",
  "/app/assets/Privacy-DH7IzQG9.js",
  "/app/assets/Research-BCndJXc-.js",
  "/app/assets/Start-CNcA6Jz2.js",
  "/app/assets/Terms-Bbqm9Chq.js",
  "/app/assets/arrow-left-Dcber7GJ.js",
  "/app/assets/chart-column-BagNLW6_.js",
  "/app/assets/database-DFPOsSvN.js",
  "/app/assets/file-check-2-BbKGwXk1.js",
  "/app/assets/index-CXC4OZXP.css",
  "/app/assets/index-DBQBEMMI.js",
  "/app/assets/mail-Bh1uujmf.js",
  "/app/assets/private-recall.worker-CHMXrwcg.js",
  "/app/assets/rotate-ccw-B2-6rQTq.js",
  "/app/assets/shield-Cm8M-76k.js",
  "/app/assets/triangle-alert-BVtfh8fs.js",
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
