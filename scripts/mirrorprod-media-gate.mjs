#!/usr/bin/env node

import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const DIST = join(ROOT, 'dist');
const WATCH_ROOT = join(DIST, 'mirrorprod-india', 'watch');
const ORIGIN = (process.env.MIRRORPROD_ORIGIN || 'https://activemirror.ai').replace(/\/+$/, '');
const MODE = process.argv[2] || 'local';
const PLAY_ALL = process.env.MIRRORPROD_PLAY_ALL === '1';
const MIN_MEDIA_BYTES = 1024;

function fail(message, detail = {}) {
  const error = new Error(message);
  error.detail = detail;
  throw error;
}

function parseAttributes(source) {
  const attributes = {};
  for (const match of source.matchAll(/\b([a-z][\w:-]*)="([^"]*)"/gi)) {
    attributes[match[1].toLowerCase()] = match[2];
  }
  return attributes;
}

function hasBooleanAttribute(source, name) {
  return new RegExp(`(?:^|\\s)${name}(?:\\s|=|$)`, 'i').test(source);
}

function discoverWatchPages() {
  if (!lstatSync(WATCH_ROOT, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`Missing built watch library at ${WATCH_ROOT}; run npm run build first.`);
  }

  const records = [];
  for (const entry of readdirSync(WATCH_ROOT, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const pagePath = join(WATCH_ROOT, entry.name, 'index.html');
    if (!lstatSync(pagePath, { throwIfNoEntry: false })?.isFile()) continue;
    const html = readFileSync(pagePath, 'utf8');
    const tags = [...html.matchAll(/<video\b([^>]*)>/gi)];
    if (tags.length !== 1) {
      fail(`Expected exactly one video on ${entry.name}, found ${tags.length}.`, { pagePath });
    }
    const tagSource = tags[0][1];
    const attributes = parseAttributes(tagSource);
    if (!attributes.src || !attributes.poster) {
      fail(`Video on ${entry.name} must declare src and poster attributes.`, { pagePath });
    }
    if (!hasBooleanAttribute(tagSource, 'controls') || !hasBooleanAttribute(tagSource, 'playsinline')) {
      fail(`Video on ${entry.name} must expose controls and playsinline.`, { pagePath });
    }
    records.push({
      slug: entry.name,
      pagePath,
      src: attributes.src,
      poster: attributes.poster,
      orientation: /class="player land"/.test(html) ? 'landscape' : 'portrait',
    });
  }

  if (records.length === 0) fail('No generated MirrorProd watch pages were discovered.');
  return records;
}

function distAssetPath(urlPath) {
  if (!urlPath.startsWith('/videos/') || urlPath.includes('..')) {
    fail(`Media path is outside the governed /videos/ namespace: ${urlPath}`);
  }
  const path = resolve(DIST, urlPath.replace(/^\/+/, ''));
  if (path !== DIST && !path.startsWith(`${DIST}${sep}`)) {
    fail(`Media path escapes dist: ${urlPath}`);
  }
  return path;
}

function signatureMatches(path, kind, header) {
  if (kind === 'video') {
    return extname(path).toLowerCase() === '.mp4'
      && header.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  if (kind === 'poster') {
    const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    return ['.jpg', '.jpeg'].includes(extname(path).toLowerCase()) && jpeg;
  }
  return false;
}

function assertMediaSignature(path, kind) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.isSymbolicLink()) fail(`Missing regular ${kind} file: ${path}`);
  if (stat.size < MIN_MEDIA_BYTES) fail(`${kind} file is unexpectedly small: ${path}`, { bytes: stat.size });
  const header = readFileSync(path).subarray(0, 16);
  if (!signatureMatches(path, kind, header)) fail(`${kind} has an invalid signature or extension: ${path}`);
  return stat.size;
}

function validateLocal(records) {
  const assets = new Map();
  let totalBytes = 0;
  for (const record of records) {
    for (const [kind, urlPath] of [['video', record.src], ['poster', record.poster]]) {
      if (assets.has(urlPath)) continue;
      const path = distAssetPath(urlPath);
      const bytes = assertMediaSignature(path, kind);
      assets.set(urlPath, { kind, path, bytes });
      totalBytes += bytes;
    }
  }
  return { assets, totalBytes };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function validateLiveHeaders(assets) {
  return mapLimit([...assets.entries()], 8, async ([urlPath, asset]) => {
    const response = await fetch(`${ORIGIN}${urlPath}`, { method: 'HEAD', redirect: 'manual' });
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const contentLengthHeader = response.headers.get('content-length');
    const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
    const expectedType = asset.kind === 'video' ? 'video/mp4' : 'image/jpeg';
    const invalidLength = contentLength !== null
      && (!Number.isFinite(contentLength) || contentLength < MIN_MEDIA_BYTES);
    if (response.status !== 200 || contentType !== expectedType || invalidLength) {
      fail(`Live ${asset.kind} response failed for ${urlPath}.`, {
        status: response.status,
        contentType,
        contentLength,
        expectedType,
      });
    }
    return { urlPath, kind: asset.kind, status: response.status, contentType, contentLength };
  });
}

function representativePages(records) {
  if (PLAY_ALL || records.length <= 3) return records;
  const portrait = records.find((record) => record.orientation === 'portrait');
  const landscape = records.find((record) => record.orientation === 'landscape');
  const median = records[Math.floor(records.length / 2)];
  return [...new Map([portrait, landscape, median].filter(Boolean).map((record) => [record.slug, record])).values()];
}

async function validateBrowserPlayback(records) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    for (const record of representativePages(records)) {
      const pageUrl = `${ORIGIN}/mirrorprod-india/watch/${record.slug}/`;
      const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!response || response.status() !== 200) {
        fail(`Watch page did not return 200: ${pageUrl}`, { status: response?.status() ?? null });
      }
      const video = page.locator('video');
      const count = await video.count();
      if (count !== 1) fail(`Expected one rendered video at ${pageUrl}, found ${count}.`);

      const playResult = await video.evaluate(async (element) => {
        try {
          await element.play();
          return { ok: true };
        } catch (error) {
          return { ok: false, name: error.name, message: error.message };
        }
      });
      if (!playResult.ok) fail(`Browser rejected playback at ${pageUrl}.`, playResult);

      await page.waitForFunction(() => {
        const element = document.querySelector('video');
        return Boolean(element && (element.currentTime >= 0.75 || element.error));
      }, null, { timeout: 15000 });
      const state = await video.evaluate((element) => ({
        currentTime: element.currentTime,
        duration: element.duration,
        paused: element.paused,
        readyState: element.readyState,
        videoWidth: element.videoWidth,
        videoHeight: element.videoHeight,
        error: element.error && { code: element.error.code, message: element.error.message },
      }));
      if (state.error || state.currentTime < 0.75 || !Number.isFinite(state.duration)
        || state.duration <= 0 || state.readyState < 2 || state.videoWidth <= 0 || state.videoHeight <= 0) {
        fail(`Video did not produce decoded temporal progress at ${pageUrl}.`, state);
      }
      await video.evaluate((element) => element.pause());
      results.push({ slug: record.slug, pageUrl, orientation: record.orientation, ...state });
    }
  } finally {
    await browser.close();
  }
  return results;
}

function runSelfCheck() {
  const mp4 = Buffer.alloc(16);
  mp4.write('ftyp', 4, 'ascii');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const html = Buffer.from('<!doctype html><html><body>SPA fallback</body></html>');
  const rejects = (fn) => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };
  const checks = {
    validMp4Accepted: signatureMatches('/tmp/sample.mp4', 'video', mp4),
    htmlShellRejectedAsMp4: !signatureMatches('/tmp/sample.mp4', 'video', html),
    wrongVideoExtensionRejected: !signatureMatches('/tmp/sample.html', 'video', mp4),
    validJpegAccepted: signatureMatches('/tmp/poster.jpg', 'poster', jpeg),
    htmlShellRejectedAsJpeg: !signatureMatches('/tmp/poster.jpg', 'poster', html),
    booleanControlsDetected: hasBooleanAttribute(' controls playsinline muted', 'controls'),
    controlsInsideUrlNotAccepted: !hasBooleanAttribute(' src="/videos/controls-demo.mp4"', 'controls'),
    outsideMediaNamespaceRejected: rejects(() => distAssetPath('/assets/sample.mp4')),
    traversalRejected: rejects(() => distAssetPath('/videos/../secrets.txt')),
  };
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ schemaVersion: 'mirrorprod-media-gate-self-check/v1', ok, checks }, null, 2));
  return ok ? 0 : 1;
}

async function main() {
  if (MODE === 'self-check') {
    process.exitCode = runSelfCheck();
    return;
  }
  if (!['local', 'live'].includes(MODE)) fail(`Unknown mode: ${MODE}. Use local, live, or self-check.`);
  const records = discoverWatchPages();
  const local = validateLocal(records);
  const receipt = {
    schemaVersion: 'mirrorprod-media-gate/v1',
    mode: MODE,
    ok: true,
    watchPages: records.length,
    assets: local.assets.size,
    localBytes: local.totalBytes,
    checked: [
      'every generated watch page has one source-backed video and poster',
      'every referenced dist asset is a regular non-symlink file with the expected MP4 or JPEG signature',
    ],
    unchecked: [],
  };

  if (MODE === 'live') {
    const liveHeaders = await validateLiveHeaders(local.assets);
    const browserPlayback = await validateBrowserPlayback(records);
    receipt.liveHeaders = {
      checked: liveHeaders.length,
      videos: liveHeaders.filter((item) => item.kind === 'video').length,
      posters: liveHeaders.filter((item) => item.kind === 'poster').length,
      contentLengthObserved: liveHeaders.filter((item) => item.contentLength !== null).length,
    };
    receipt.browserPlayback = {
      checked: browserPlayback.length,
      slugs: browserPlayback.map((item) => item.slug),
      orientations: [...new Set(browserPlayback.map((item) => item.orientation))].sort(),
      minAdvancedSeconds: Math.min(...browserPlayback.map((item) => item.currentTime)),
      minReadyState: Math.min(...browserPlayback.map((item) => item.readyState)),
      decodedDimensions: [...new Set(browserPlayback.map((item) => `${item.videoWidth}x${item.videoHeight}`))].sort(),
    };
    receipt.playbackScope = PLAY_ALL ? 'all_generated_watch_pages' : 'representative_portrait_landscape_and_median_pages';
    if (!PLAY_ALL && browserPlayback.length < records.length) {
      receipt.unchecked.push(`${records.length - browserPlayback.length} generated watch pages were not browser-played in this run`);
    }
  } else {
    receipt.unchecked.push('live HTTP content types and browser playback are not checked in local mode');
  }

  console.log(JSON.stringify(receipt, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    schemaVersion: 'mirrorprod-media-gate/v1',
    mode: MODE,
    ok: false,
    error: error.message,
    detail: error.detail || {},
  }, null, 2));
  process.exit(1);
});
