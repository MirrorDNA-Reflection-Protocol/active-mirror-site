#!/usr/bin/env node
// HANDLE_PROVENANCE: per-video landing-page generator, built 2026-07-13 per Paul "yes lets do it" (move #3).
// Reads the real video catalog (VIDEO_INVENTORY) from the mirrorprod rescue worktree — the same data that
// powers the live /videos/*.mp4 (served by the worker media layer, verified 200 in prior sessions).
// Emits /mirrorprod-india/watch/<slug>/ per video + /mirrorprod-india/watch/ index, and a unified sitemap
// covering the main page, the 4 answer pages, the library index, and every watch page.
// Palette matches the live page. Every video page is forwardable, plays inline, labelled AI-generated,
// routes to the WhatsApp brief, and links the Certificate section.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CATALOG = '/Users/mirror-pro/repos/activemirror-site-mirrorprod-rescue/src/data/showcaseVideos.generated.js';
const OUT = join(ROOT, 'public', 'mirrorprod-india');
const WA = (t) => `https://wa.me/917756858857?text=${encodeURIComponent(t)}`;

// Parse VIDEO_INVENTORY out of the generated ESM file (avoids a runtime cross-repo import dependency).
const raw = readFileSync(CATALOG, 'utf8');
const start = raw.indexOf('[', raw.indexOf('VIDEO_INVENTORY'));
const end = raw.indexOf('\n];', start);
const inventory = JSON.parse(raw.slice(start, end + 2));

// Only honest, shippable samples: published + curated. Skip anything without a poster/src.
const VIDEOS = inventory.filter(v => v.published && v.reviewState === 'curated' && v.src && v.poster);

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const catLabel = (v) => v.tag || 'Sample';
const HOST = 'https://activemirror.ai';

const STYLE = `<style>
  :root{--ink:#131009;--smoke:#1e1912;--bone:#f1e9db;--dust:#b9ae9c;--brass:#c9a464;--brass-hot:#e6c07a;--line:#3a3226;--serif:Georgia,'Times New Roman',serif;--sans:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--mono:ui-monospace,'SF Mono',Menlo,monospace}
  *{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
  body{background:var(--ink);color:var(--bone);font-family:var(--sans);line-height:1.6}
  img,video{display:block;max-width:100%}a{color:var(--brass)}a:hover{color:var(--brass-hot)}
  a:focus-visible{outline:2px solid var(--brass-hot);outline-offset:3px;border-radius:3px}
  .wrap{max-width:46rem;margin:0 auto;padding:0 1.1rem}
  header{position:sticky;top:0;z-index:20;background:rgba(19,16,9,.92);border-bottom:1px solid var(--line);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
  .bar{display:flex;align-items:center;justify-content:space-between;padding:.7rem 0;gap:1rem}
  .brand{text-decoration:none;color:var(--bone);font-family:var(--serif);font-size:1.1rem}
  .brand small{display:block;font-family:var(--mono);font-size:.56rem;letter-spacing:.26em;text-transform:uppercase;color:var(--dust)}
  .btn{display:inline-flex;align-items:center;gap:.4rem;background:var(--brass);color:#191204;font-weight:650;font-size:.82rem;padding:.55rem .95rem;border-radius:999px;text-decoration:none}
  .btn:hover{background:var(--brass-hot);color:#191204}
  main{padding:2.4rem 0 1rem}
  .crumb{font-family:var(--mono);font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--brass);margin-bottom:.7rem}
  h1{font-family:var(--serif);font-weight:500;font-size:clamp(1.7rem,4.5vw,2.5rem);line-height:1.1;letter-spacing:-.02em;margin-bottom:.5rem}
  .tagline{color:var(--dust);margin-bottom:1.4rem}
  .player{position:relative;background:#000;border:1px solid var(--line);border-radius:.7rem;overflow:hidden}
  .player video{width:100%;aspect-ratio:9/16;object-fit:contain;background:#000}
  .player.land video{aspect-ratio:16/9}
  .chip{position:absolute;left:.6rem;top:.6rem;z-index:2;display:inline-flex;align-items:center;gap:.35rem;border:1px solid var(--line);border-radius:999px;padding:.2rem .55rem;background:rgba(19,16,9,.72);font-family:var(--mono);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--bone)}
  .chip::before{content:"\\25C7";color:var(--brass)}
  .meta{display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0}
  .meta span{font-family:var(--mono);font-size:.66rem;letter-spacing:.1em;color:var(--dust);border:1px solid var(--line);border-radius:999px;padding:.2rem .6rem}
  .cta{margin:1.8rem 0 1rem;padding:1.3rem;border:1px solid var(--line);border-radius:.7rem;background:var(--smoke);text-align:center}
  .cta p{color:var(--dust);margin-bottom:.9rem}
  .trust{font-family:var(--mono);font-size:.68rem;color:var(--dust);border-top:1px solid var(--line);padding-top:1rem;margin-top:1.6rem}
  .grid{display:grid;gap:.9rem;grid-template-columns:1fr 1fr}
  @media(min-width:640px){.grid{grid-template-columns:repeat(3,1fr)}}
  .card{border:1px solid var(--line);border-radius:.6rem;overflow:hidden;background:var(--smoke);text-decoration:none;color:inherit;display:block}
  .card img{aspect-ratio:3/4;object-fit:cover;width:100%;background:#000}
  .card .b{padding:.6rem .7rem}
  .card .t{font-family:var(--mono);font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;color:var(--brass)}
  .card h3{font-family:var(--serif);font-weight:500;font-size:.92rem;margin-top:.2rem}
  footer{padding:2rem 0;color:var(--dust);font-size:.8rem;border-top:1px solid var(--line);margin-top:2rem}
</style>`;

const BEACON = `<script>(function(){function s(t){try{var b=JSON.stringify({t:t,p:location.pathname});if(navigator.sendBeacon){navigator.sendBeacon('/e',new Blob([b],{type:'application/json'}))}else{fetch('/e',{method:'POST',body:b,keepalive:true})}}catch(e){}}s('pageview');var v=document.querySelector('video');if(v){v.addEventListener('play',function(){s('sample_play')},{once:true})}document.querySelectorAll('a[href*="wa.me"]').forEach(function(a){a.addEventListener('click',function(){s('wa_tap')})})})();</script>`;

function watchPage(v) {
  const url = `${HOST}/mirrorprod-india/watch/${v.slug}/`;
  const land = v.orientation === 'landscape' ? ' land' : '';
  const dur = v.durationSeconds ? `${Math.round(v.durationSeconds)}s` : null;
  const ld = { '@context': 'https://schema.org', '@type': 'VideoObject', name: v.label, description: v.edge || v.mood || `${v.label} — a MirrorProd sample.`, thumbnailUrl: HOST + v.poster, contentUrl: HOST + v.src, uploadDate: '2026-04-24', inLanguage: v.language || 'en' };
  const waMsg = `Hi, I want a MirrorProd video like "${v.label}" for my business.`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(v.label)} — MirrorProd sample video</title>
<meta name="description" content="${esc(v.edge || v.mood || v.label)} — a MirrorProd sample made without a shoot, ${esc(v.language || 'English')}. Want one like it? Send a rough brief.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="video.other">
<meta property="og:title" content="${esc(v.label)} — MirrorProd sample">
<meta property="og:description" content="${esc(v.edge || v.mood || v.label)}">
<meta property="og:image" content="${HOST}${esc(v.poster)}">
<meta property="og:url" content="${url}">
<meta name="theme-color" content="#131009">
<link rel="icon" type="image/png" href="/mirrorprod-india/favicon.png">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
${STYLE}
</head>
<body>
<header><div class="wrap bar">
  <a class="brand" href="/mirrorprod-india/">MirrorProd<small>by Active Mirror · India</small></a>
  <a class="btn" href="${WA('Hi, I want a MirrorProd video for my business.')}">Send brief</a>
</div></header>
<main><div class="wrap">
  <div class="crumb"><a href="/mirrorprod-india/">MirrorProd</a> · <a href="/mirrorprod-india/watch/">Samples</a></div>
  <h1>${esc(v.label)}</h1>
  <p class="tagline">${esc(v.edge || v.mood || 'A MirrorProd sample, made without a shoot.')}</p>
  <div class="player${land}">
    <span class="chip">AI-generated</span>
    <video controls playsinline muted preload="none" poster="${esc(v.poster)}" src="${esc(v.src)}"></video>
  </div>
  <div class="meta">
    <span>${esc(catLabel(v))}</span>
    ${v.language ? `<span>${esc(v.language)}</span>` : ''}
    ${dur ? `<span>${dur}</span>` : ''}
    <span>${v.orientation === 'landscape' ? 'Landscape' : 'Reel format'}</span>
    <span>No shoot</span>
  </div>
  <div class="cta">
    <p>Want a video like this for your business? Send a rough brief — every delivery ships labelled, provenance-tagged, and consent-receipted.</p>
    <a class="btn" href="${WA(waMsg)}">Send a rough brief on WhatsApp</a>
  </div>
  <p class="trust">Every MirrorProd delivery includes a <a href="/mirrorprod-india/#certificate">Certificate of Provenance</a> — the visible AI label and provenance metadata India's IT Rules ask for. Rules status as of 13 Jul 2026; a delivery standard, not legal advice.</p>
</div></main>
<footer><div class="wrap">MirrorProd by <a href="https://activemirror.ai/">Active Mirror</a> · <a href="/mirrorprod-india/watch/">All samples</a> · <a href="/mirrorprod-india/">Back to MirrorProd</a></div></footer>
${BEACON}
</body>
</html>`;
}

function indexPage() {
  const cards = VIDEOS.map(v => `    <a class="card" href="/mirrorprod-india/watch/${v.slug}/"><img src="${esc(v.poster)}" alt="${esc(v.label)}" loading="lazy"><div class="b"><div class="t">${esc(catLabel(v))}</div><h3>${esc(v.label)}</h3></div></a>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sample videos — MirrorProd India (${VIDEOS.length} made without shoots)</title>
<meta name="description" content="Browse ${VIDEOS.length} MirrorProd sample videos — founder ads, product ads, awareness, local business — all made without a shoot, in English and Hindi.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${HOST}/mirrorprod-india/watch/">
<meta name="theme-color" content="#131009">
<link rel="icon" type="image/png" href="/mirrorprod-india/favicon.png">
${STYLE}
</head>
<body>
<header><div class="wrap bar">
  <a class="brand" href="/mirrorprod-india/">MirrorProd<small>by Active Mirror · India</small></a>
  <a class="btn" href="${WA('Hi, I want a MirrorProd video for my business.')}">Send brief</a>
</div></header>
<main><div class="wrap" style="max-width:60rem">
  <div class="crumb"><a href="/mirrorprod-india/">MirrorProd</a> · Samples</div>
  <h1>${VIDEOS.length} sample videos, made without a shoot.</h1>
  <p class="tagline">Founder ads, product ads, awareness, and local-business promos — English and Hindi. Tap any to watch; each carries its AI label.</p>
  <div class="grid">
${cards}
  </div>
</div></main>
<footer><div class="wrap">MirrorProd by <a href="https://activemirror.ai/">Active Mirror</a> · <a href="/mirrorprod-india/">Back to MirrorProd</a></div></footer>
${BEACON}
</body>
</html>`;
}

let n = 0;
for (const v of VIDEOS) {
  const dir = join(OUT, 'watch', v.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), watchPage(v));
  n++;
}
mkdirSync(join(OUT, 'watch'), { recursive: true });
writeFileSync(join(OUT, 'watch', 'index.html'), indexPage());
console.log(`wrote ${n} watch pages + watch/ index`);

// Unified sitemap: main + answers + library + every watch page
const today = '2026-07-13';
const ANSWERS = ['is-ai-video-legal-for-ads-india', 'meity-ai-video-labelling-rules-explained', 'dpdp-consent-for-ai-founder-videos', 'ai-video-vs-shoot-cost-india'];
const urls = [
  `${HOST}/mirrorprod-india/`,
  `${HOST}/mirrorprod-india/watch/`,
  ...ANSWERS.map(s => `${HOST}/mirrorprod-india/answers/${s}/`),
  ...VIDEOS.map(v => `${HOST}/mirrorprod-india/watch/${v.slug}/`),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(OUT, 'sitemap.xml'), sitemap);
console.log(`wrote sitemap.xml (${urls.length} urls)`);
console.log(`DONE: ${n} videos`);
