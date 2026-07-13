#!/usr/bin/env node
// HANDLE_PROVENANCE: MirrorProd compliance-intent content generator, built 2026-07-13 per Paul "do it all".
// Content facts are the MeitY/DPDP claims verified + ledger-recorded in the prior research
// (claim-27654f6474e7): IT Rules amendment notified 2026-02-10, effective 2026-02-20, mandatory
// labelling + embedded provenance for synthetic media, 3-hour takedown, continuous-visibility draft
// (consultation to 2026-05-07); DPDP consent for likeness/voice. Every page carries the not-legal-advice
// disclaimer + a rules-status line. Palette matches the live /mirrorprod-india/ page.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const OUT = join(ROOT, 'public', 'mirrorprod-india', 'answers');
const WA = 'https://wa.me/917756858857?text=Hi%2C%20I%20want%20a%20MirrorProd%20video%20for%20my%20business.';
const RULES_STATUS = 'Rules status as of 13 Jul 2026 — labelling and provenance obligations effective 20 Feb 2026; final label-visibility norms still in consultation. This is a delivery standard, not legal advice.';

const PAGES = [
  {
    slug: 'is-ai-video-legal-for-ads-india',
    title: 'Is AI video legal to run as an ad in India? (2026)',
    desc: 'Short answer: yes — if the video is labelled and provenance-tagged under India’s Feb-2026 IT Rules. Here’s what that means for a business running AI-made ads.',
    h1: 'Is AI video legal to run as an ad in India?',
    answer: 'Yes. AI-generated video is legal to publish and advertise in India — provided it carries a visible AI label and embedded provenance metadata, as India’s IT Rules have required since 20 February 2026. The risk isn’t using AI; it’s publishing it without the disclosure the rules now expect.',
    sections: [
      ['What the rules actually say', 'On 10 February 2026 India’s Ministry of Electronics and IT (MeitY) notified an amendment bringing synthetically generated information — deepfakes and AI-generated media — under the IT Rules’ due-diligence framework, effective 20 February 2026. Realistic AI content must be labelled and carry provenance metadata that traces its origin. Platforms must act on takedown orders within three hours.'],
      ['What a compliant AI ad needs', 'Two things travel with a compliant AI video: a visible on-screen label that the content is AI-generated, and machine-readable provenance metadata embedded in the file. A draft tightening (in consultation to 7 May 2026) would require the label to stay continuously visible for the full duration of the video, not just flash at the start.'],
      ['Where businesses get caught out', 'Most AI video tools hand you a clean file and leave labelling and provenance to you. If you run that as a paid ad without the disclosure, you carry the compliance gap — not the tool. That’s the part worth getting right before you spend on media.'],
      ['How MirrorProd handles this', 'Every MirrorProd delivery ships with the label burned in, provenance metadata embedded, and — when a real face or voice appears — a consent receipt on file. It’s the delivery standard, so the video leaves ready to run rather than needing compliance retrofitted after the fact.'],
    ],
  },
  {
    slug: 'meity-ai-video-labelling-rules-explained',
    title: 'India’s AI video labelling rules, explained for businesses (2026)',
    desc: 'Plain-English guide to India’s Feb-2026 AI labelling and provenance rules: what a compliant label looks like and what your business must keep on file.',
    h1: 'India’s AI video labelling rules, explained for businesses',
    answer: 'Since 20 February 2026, realistic AI-generated video published in India must carry a visible AI label and embedded provenance metadata. Here’s what that looks like in practice, without the legalese.',
    sections: [
      ['The core obligation', 'MeitY’s February 2026 amendment to the IT Rules treats realistic AI-generated media as “synthetically generated information.” Anyone publishing it must label it clearly and attach provenance metadata that records where it came from. The intent is simple: a viewer should be able to tell it’s AI, and a platform should be able to trace it.'],
      ['What a compliant label looks like', 'A visible disclosure on the video that it is AI-generated. The current draft under consultation would require that label to remain continuously and clearly visible throughout the video’s duration — so a one-frame watermark at the start is unlikely to be enough going forward.'],
      ['What provenance metadata means', 'Machine-readable data embedded in the file itself that identifies the content as AI-generated and records its origin, so the label can’t simply be cropped away without a trace. Platforms are expected to preserve, not strip, this metadata.'],
      ['What to keep on file', 'Keep the labelled master, the provenance metadata, and — if a real person’s face or voice is used — a record of their consent. MirrorProd issues all three as a Certificate of Provenance with every delivery, so the paper trail exists before you need it.'],
    ],
  },
  {
    slug: 'dpdp-consent-for-ai-founder-videos',
    title: 'DPDP consent for AI founder videos: what to keep on file (2026)',
    desc: 'Making an AI video of your own face or voice? Here’s the DPDP consent picture for founder videos and why a consent receipt matters.',
    h1: 'DPDP consent for AI founder videos',
    answer: 'If an AI video uses a real person’s face or voice, their consent matters — under both India’s data-protection expectations and the synthetic-media rules. For a founder using their own likeness, that means keeping a clear consent record on file.',
    sections: [
      ['Why consent is the sensitive part', 'A founder video built on your own face and voice is personal data being processed to create a likeness. India’s Digital Personal Data Protection framework expects that processing to rest on clear, informed consent — and the 2026 synthetic-media rules add labelling on top. The likeness is the asset; the consent is what makes reusing it clean.'],
      ['What a consent record should capture', 'Who consented, to what use, for how long, and the ability to withdraw. For a founder that’s straightforward — you’re consenting to your own likeness — but if you later feature a colleague, a customer, or a spokesperson, each needs their own record.'],
      ['The reuse problem nobody plans for', 'AI founder videos are valuable precisely because you can reuse the likeness across campaigns. That’s also where consent gets murky: a face captured for one video quietly reused everywhere. A consent receipt that travels with the project keeps every reuse accountable.'],
      ['How MirrorProd’s founder lane handles it', 'The founder lane captures your likeness with explicit consent, uses it only per approval, and receipts every reuse — the consent artifact travels with the project as part of the Certificate of Provenance. Consent custody, not just a signed form in a drawer.'],
    ],
  },
  {
    slug: 'ai-video-vs-shoot-cost-india',
    title: 'AI video vs a shoot: real cost comparison for Indian businesses (2026)',
    desc: 'An honest comparison of AI video production against a traditional shoot for Indian businesses — cost, speed, what you trade, and the compliance angle.',
    h1: 'AI video vs a shoot: the real comparison',
    answer: 'A traditional shoot buys you a crew, a location, and full physical control — at a day-rate cost and a scheduling tax. AI video production trades that for speed and reusability at campaign-pack pricing. Here’s the honest trade, including the part most comparisons skip: compliance.',
    sections: [
      ['What a shoot really costs', 'A shoot isn’t just the invoice — it’s the crew, the location, the talent day, the reshoots, and the calendar it eats. For a single reel that can run well into five figures before you’ve posted anything, and every new variation means booking it all again.'],
      ['What AI production trades', 'AI video removes the shoot day. You brief the idea, a concept comes back, and you get a ready-to-post cut — with the ability to spin variations without re-booking anything. What you trade is on-set physical control and the specific texture of a real camera; for founder content, product ads, and local promos, that trade usually favours AI.'],
      ['MirrorProd pricing, plainly', 'MirrorProd is priced as campaign packs, not per-clip: Starter ₹39k–59k (one concept, one hero cut, three platform recuts, compliance bundle), Growth ₹79k–99k (multiple openings, reusable brand + founder setup, review lane), and Custom for larger rollouts. You’re buying a campaign, not a single clip.'],
      ['The angle most comparisons skip', 'A shoot produces real footage with no labelling obligation. AI video does — since Feb 2026, it must be labelled and provenance-tagged in India. MirrorProd builds that in, so the compliance work that a cheap per-video tool leaves on your desk is already done when the file lands.'],
    ],
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render(p) {
  const url = `https://activemirror.ai/mirrorprod-india/answers/${p.slug}/`;
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [{ '@type': 'Question', name: p.h1, acceptedAnswer: { '@type': 'Answer', text: p.answer } },
      ...p.sections.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))],
  };
  const sections = p.sections.map(([h, b]) => `      <section class="blk"><h2>${esc(h)}</h2><p>${esc(b)}</p></section>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://activemirror.ai/mirrorprod-india/assets/og-mirrorprod.png">
<meta name="theme-color" content="#131009">
<link rel="icon" type="image/png" href="/mirrorprod-india/favicon.png">
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
<style>
  :root{--ink:#131009;--smoke:#1e1912;--bone:#f1e9db;--dust:#b9ae9c;--brass:#c9a464;--brass-hot:#e6c07a;--line:#3a3226;--serif:Georgia,'Times New Roman',serif;--sans:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--mono:ui-monospace,'SF Mono',Menlo,monospace}
  *{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
  body{background:var(--ink);color:var(--bone);font-family:var(--sans);line-height:1.65}
  a{color:var(--brass)}a:hover{color:var(--brass-hot)}
  a:focus-visible{outline:2px solid var(--brass-hot);outline-offset:3px;border-radius:3px}
  .wrap{max-width:44rem;margin:0 auto;padding:0 1.1rem}
  header{position:sticky;top:0;z-index:20;background:rgba(19,16,9,.92);border-bottom:1px solid var(--line);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
  .bar{display:flex;align-items:center;justify-content:space-between;padding:.7rem 0;gap:1rem}
  .brand{text-decoration:none;color:var(--bone);font-family:var(--serif);font-size:1.1rem}
  .brand small{display:block;font-family:var(--mono);font-size:.56rem;letter-spacing:.26em;text-transform:uppercase;color:var(--dust)}
  .btn{display:inline-flex;align-items:center;gap:.4rem;background:var(--brass);color:#191204;font-weight:650;font-size:.82rem;padding:.55rem .95rem;border-radius:999px;text-decoration:none}
  .btn:hover{background:var(--brass-hot);color:#191204}
  main{padding:2.6rem 0 1rem}
  .crumb{font-family:var(--mono);font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--brass);margin-bottom:.7rem}
  .crumb a{color:var(--brass)}
  h1{font-family:var(--serif);font-weight:500;font-size:clamp(2rem,5vw,2.9rem);line-height:1.08;letter-spacing:-.02em;margin-bottom:1rem}
  .answer{font-size:1.15rem;color:var(--bone);border-left:2px solid var(--brass);padding-left:1rem;margin-bottom:2rem}
  .blk{margin:1.6rem 0}
  .blk h2{font-family:var(--serif);font-weight:500;font-size:1.35rem;margin-bottom:.4rem}
  .blk p{color:var(--dust)}
  .cta{margin:2.4rem 0 1rem;padding:1.4rem;border:1px solid var(--line);border-radius:.7rem;background:var(--smoke);text-align:center}
  .cta p{color:var(--dust);margin-bottom:.9rem}
  .fine{font-family:var(--mono);font-size:.68rem;color:var(--dust);letter-spacing:.04em;border-top:1px solid var(--line);padding-top:1rem;margin-top:2.2rem}
  .related{margin:1.6rem 0;font-size:.9rem}
  .related a{display:block;padding:.3rem 0;color:var(--bone)}
  footer{padding:2rem 0;color:var(--dust);font-size:.8rem;border-top:1px solid var(--line);margin-top:2rem}
</style>
</head>
<body>
<header><div class="wrap bar">
  <a class="brand" href="/mirrorprod-india/">MirrorProd<small>by Active Mirror · India</small></a>
  <a class="btn" href="${WA}">Send brief</a>
</div></header>
<main><div class="wrap">
  <div class="crumb"><a href="/mirrorprod-india/">MirrorProd</a> · Answers</div>
  <h1>${esc(p.h1)}</h1>
  <p class="answer">${esc(p.answer)}</p>
${sections}
  <div class="cta">
    <p>MirrorProd makes professional videos without shoots — every delivery ships labelled, provenance-tagged, and consent-receipted.</p>
    <a class="btn" href="${WA}">Send a rough brief on WhatsApp</a>
  </div>
  <div class="related">
    <div class="crumb">More answers</div>
    ${PAGES.filter(o => o.slug !== p.slug).map(o => `<a href="/mirrorprod-india/answers/${o.slug}/">${esc(o.h1)}</a>`).join('\n    ')}
  </div>
  <p class="fine">${RULES_STATUS}</p>
</div></main>
<footer><div class="wrap">MirrorProd by <a href="https://activemirror.ai/">Active Mirror</a> · <a href="/mirrorprod-india/">Back to MirrorProd</a></div></footer>
<script>(function(){function send(t){try{var b=JSON.stringify({t:t,p:location.pathname});if(navigator.sendBeacon){navigator.sendBeacon('/e',new Blob([b],{type:'application/json'}))}else{fetch('/e',{method:'POST',body:b,keepalive:true})}}catch(e){}}send('pageview');document.querySelectorAll('a[href*="wa.me"]').forEach(function(a){a.addEventListener('click',function(){send('wa_tap')})})})();</script>
</body>
</html>`;
}

let n = 0;
for (const p of PAGES) {
  const dir = join(OUT, p.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), render(p));
  n++;
  console.log(`wrote answers/${p.slug}/index.html`);
}

// MirrorProd-scoped sitemap (the main sitemap.xml is Codex/host-owned; this is additive)
const today = process.argv[2] || '2026-07-13';
const urls = [
  'https://activemirror.ai/mirrorprod-india/',
  ...PAGES.map(p => `https://activemirror.ai/mirrorprod-india/answers/${p.slug}/`),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'public', 'mirrorprod-india', 'sitemap.xml'), sitemap);
console.log(`wrote mirrorprod-india/sitemap.xml (${urls.length} urls)`);
console.log(`DONE: ${n} answer pages`);
