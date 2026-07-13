const APP_SHELL_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Bring one thing you are stuck on. Active Mirror reflects it into a better question, one next move, and memory you control." />
    <meta property="og:title" content="Active Mirror - start with one thing" />
    <meta property="og:description" content="Bring one thing you want to move. Active Mirror helps make it useful without taking over your private context." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://activemirror.ai/app/" />
    <meta property="og:image" content="https://activemirror.ai/app/assets/active-mirror-trust-poster.jpg" />
    <meta property="og:image:width" content="1024" />
    <meta property="og:image:height" content="1144" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Active Mirror - start with one thing" />
    <meta name="twitter:description" content="Bring one thing you want to move. Active Mirror helps make it useful without taking over your private context." />
    <meta name="twitter:image" content="https://activemirror.ai/app/assets/active-mirror-trust-poster.jpg" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://gateway.activemirror.ai; connect-src 'self' https://gateway.activemirror.ai https://cloudflareinsights.com https://static.cloudflareinsights.com https://storage.googleapis.com https://huggingface.co https://*.hf.co; font-src 'self' data:; media-src 'self' blob: data:; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta name="theme-color" content="#0b110e" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="alternate" type="text/plain" href="https://activemirror.ai/llms.txt" title="Active Mirror AI instructions" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%230b110e'/%3E%3Cpath d='M32 10 50 20.5v21L32 54 14 41.5v-21L32 10Z' fill='none' stroke='%235db8a5' stroke-width='4'/%3E%3Cpath d='M32 21 42 27v10L32 43 22 37V27L32 21Z' fill='none' stroke='%2370b7e6' stroke-width='4'/%3E%3C/svg%3E" />
    <title>Active Mirror - start with one thing</title>
    <script type="module" crossorigin src="/app/assets/index-BXbpWiOz.js"></script>
    <link rel="stylesheet" crossorigin href="/app/assets/index-BEWHdLDV.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

function isAppShellRoute(pathname) {
  if (pathname === "/app" || pathname === "/app/") return true;
  if (!pathname.startsWith("/app/")) return false;
  if (pathname === "/app/service-worker.js") return false;
  return !pathname.startsWith("/app/assets/");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.activemirror.ai") {
      url.hostname = "activemirror.ai";
      return Response.redirect(url.toString(), 308);
    }

    // First-party event beacon (sovereign measurement — no third-party tracker, no PII stored).
    // POST /e {t: eventType, p: path}. Fails closed to 204 so metrics never break a page.
    if (url.pathname === "/e" && request.method === "POST") {
      try {
        const body = await request.json();
        const type = String(body?.t || "").slice(0, 24);
        const path = String(body?.p || "").split("?")[0].slice(0, 128);
        const allowed = ["pageview", "sample_play", "brief_view", "wa_tap"];
        if (env.MP_METRICS && allowed.includes(type)) {
          env.MP_METRICS.writeDataPoint({
            blobs: [type, path],
            indexes: [type],
            doubles: [1],
          });
        }
      } catch (_e) { /* swallow — a metrics error must never affect the visitor */ }
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }

    if (isAppShellRoute(url.pathname)) {
      return new Response(APP_SHELL_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
