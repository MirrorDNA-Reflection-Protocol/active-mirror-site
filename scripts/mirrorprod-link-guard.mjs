#!/usr/bin/env node
// HANDLE_PROVENANCE: dist layout + route namespace from this session's dist sitemap read and per-route
// existence checks; bundle href patterns from live-bundle grep receipts; guard v1 output (48 catches)
// motivated the fatal/warn split. All paths repo-relative to this script's parent.
//
// Mirrorprod link-truth guard.
// The /mirrorprod-india bundle is a standalone SPA grafted onto this site.
// FATAL: targets the shipped page itself declares (index.html head/noscript)
//        and any bundle href that claims a live-host-namespace path — those
//        must resolve in dist/ or the deploy stops here.
// WARN:  bundle hrefs left over from the old SPA's other routes; they die
//        with the bundle but are reported every run so they can't be forgotten.
// Deterministic: no network.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const dist = join(root, 'dist');
const SITE_ORIGIN = 'https://activemirror.ai';
// Paths the current host actually owns; a bundle href in this namespace that
// fails to resolve is a real regression of the graft, not old-SPA residue.
const HOST_NS = /^\/(app(\/|$)|product(\/|$)|mirror(\/|$)|pricing$|trust$|privacy$|terms$|mirrorprod-india(\/|$)|videos(\/|$))|^\/$/;

const fail = (msg) => { console.error(`Mirrorprod link guard FAILED: ${msg}`); process.exit(1); };

const pageDirs = [join(dist, 'mirrorprod-india')];
// Include preview subpages (e.g. mirrorprod-india/next) if present.
if (existsSync(join(dist, 'mirrorprod-india'))) {
    for (const entry of readdirSync(join(dist, 'mirrorprod-india'), { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== 'assets' && existsSync(join(dist, 'mirrorprod-india', entry.name, 'index.html'))) {
            pageDirs.push(join(dist, 'mirrorprod-india', entry.name));
        }
    }
}
if (!existsSync(join(pageDirs[0], 'index.html'))) {
    fail(`missing ${join(pageDirs[0], 'index.html')} — run the build first`);
}

const resolves = (path) => {
    if (path === '/' || path === '') return existsSync(join(dist, 'index.html'));
    const clean = path.split('#')[0].split('?')[0].replace(/^\/+|\/+$/g, '');
    if (!clean) return existsSync(join(dist, 'index.html'));
    return existsSync(join(dist, clean, 'index.html')) || existsSync(join(dist, clean));
};

const normalize = (raw) => {
    let t = raw;
    if (t.startsWith(SITE_ORIGIN + '/')) t = t.slice(SITE_ORIGIN.length);
    if (!t.startsWith('/') || t.startsWith('//')) return null; // external, mailto, wa.me, tel, #hash
    return t.split('#')[0].split('?')[0] || '/';
};

const fatalChecks = new Map();
const warnChecks = new Map();

for (const dir of pageDirs) {
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    // Every page-declared target is fatal. Media must exist in dist and pass the
    // signature/content checks in mirrorprod-media-gate.mjs.
    for (const m of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
        const p = normalize(m[1]);
        if (p === null) continue;
        fatalChecks.set(p, m[1]);
    }
    // The bundle referenced by this page, if any.
    const bundleMatch = html.match(/src="(\/mirrorprod-india\/assets\/main-[^"]+\.js)"/);
    if (bundleMatch) {
        const bundleFsPath = join(dist, bundleMatch[1]);
        if (!existsSync(bundleFsPath)) fail(`referenced bundle not in dist: ${bundleMatch[1]}`);
        const js = readFileSync(bundleFsPath, 'utf8');
        for (const m of js.matchAll(/href:\s*"([^"]+)"/g)) {
            const p = normalize(m[1]);
            if (p === null) continue;
            if (HOST_NS.test(p)) fatalChecks.set(p, m[1]);
            else warnChecks.set(p, m[1]);
        }
    }
}

const fatalBroken = [];
for (const [p, raw] of [...fatalChecks.entries()].sort()) {
    const ok = resolves(p);
    console.log(`${ok ? 'ok   ' : 'FATAL'} ${p}  (from ${raw})`);
    if (!ok) fatalBroken.push(p);
}
let warnBroken = 0;
for (const [p, raw] of [...warnChecks.entries()].sort()) {
    if (!resolves(p)) { warnBroken++; console.log(`warn  ${p}  (old-SPA residue, dies with the bundle) (from ${raw})`); }
}
console.log(`Mirrorprod link guard: ${fatalChecks.size} fatal-class targets checked (${fatalBroken.length} broken), ${warnChecks.size} bundle-residue targets (${warnBroken} unresolved, non-fatal).`);

if (fatalBroken.length) fail(fatalBroken.join(', '));
console.log('Mirrorprod link guard passed.');
