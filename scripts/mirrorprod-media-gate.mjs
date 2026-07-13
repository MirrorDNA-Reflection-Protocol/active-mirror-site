#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const DIST = join(ROOT, 'dist');
const WATCH_ROOT = join(DIST, 'mirrorprod-india', 'watch');
const ORIGIN = (process.env.MIRRORPROD_ORIGIN || 'https://activemirror.ai').replace(/\/+$/, '');
const MODE = process.argv[2] || 'local';
const PLAY_ALL = process.env.MIRRORPROD_PLAY_ALL === '1';
const PLAY_TO_END = process.env.MIRRORPROD_PLAY_TO_END === '1';
const PROBE_AUDIO = process.env.MIRRORPROD_PROBE_AUDIO === '1';
const BROWSER_NAMES = parseList(process.env.MIRRORPROD_BROWSERS, ['chromium']);
const VIEWPORT_NAMES = parseList(process.env.MIRRORPROD_VIEWPORTS, ['mobile']);
const MIN_MEDIA_BYTES = 1024;
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};
// ffprobe-observed baseline from 2026-07-13; any change requires explicit content review.
const EXPECTED_NO_AUDIO = new Set([
  '/videos/factory-demo.mp4',
  '/videos/mobile-continuity-demo.mp4',
  '/videos/mprod-food-promo.mp4',
]);

function parseList(value, fallback) {
  const parsed = String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  return parsed.length ? [...new Set(parsed)] : fallback;
}

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

function probeAudioStreams(assets) {
  const videos = [...assets.entries()].filter(([, asset]) => asset.kind === 'video');
  const results = videos.map(([urlPath, asset]) => {
    let parsed;
    try {
      parsed = JSON.parse(execFileSync('ffprobe', [
        '-v', 'error',
        '-select_streams', 'a',
        '-show_entries', 'stream=index,codec_name',
        '-of', 'json',
        asset.path,
      ], { encoding: 'utf8' }));
    } catch (error) {
      fail(`ffprobe could not inspect audio streams for ${urlPath}.`, {
        status: error.status ?? null,
        stderr: String(error.stderr || '').trim(),
      });
    }
    const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
    return {
      urlPath,
      streams: streams.length,
      codecs: [...new Set(streams.map((stream) => stream.codec_name).filter(Boolean))].sort(),
    };
  });
  const withoutAudio = results.filter((item) => item.streams === 0).map((item) => item.urlPath).sort();
  const expected = [...EXPECTED_NO_AUDIO].sort();
  if (JSON.stringify(withoutAudio) !== JSON.stringify(expected)) {
    fail('Observed no-audio media set differs from the reviewed baseline.', { expected, observed: withoutAudio });
  }
  return {
    checked: results.length,
    withAudio: results.filter((item) => item.streams > 0).length,
    withoutAudio: withoutAudio.length,
    withoutAudioPaths: withoutAudio,
    codecs: [...new Set(results.flatMap((item) => item.codecs))].sort(),
  };
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
  if (records.length <= 3) return records;
  const portrait = records.find((record) => record.orientation === 'portrait');
  const landscape = records.find((record) => record.orientation === 'landscape');
  const median = records[Math.floor(records.length / 2)];
  return [...new Map([portrait, landscape, median].filter(Boolean).map((record) => [record.slug, record])).values()];
}

async function validateBrowserPlayback(records) {
  const playwright = await import('playwright');
  const unsupportedBrowsers = BROWSER_NAMES.filter((name) => !['chromium', 'firefox', 'webkit'].includes(name));
  const unsupportedViewports = VIEWPORT_NAMES.filter((name) => !VIEWPORTS[name]);
  if (unsupportedBrowsers.length) fail('Unsupported Playwright browser engine requested.', { unsupportedBrowsers });
  if (unsupportedViewports.length) fail('Unsupported viewport profile requested.', { unsupportedViewports });

  const results = [];
  const representatives = representativePages(records);
  for (const [browserIndex, browserName] of BROWSER_NAMES.entries()) {
    const browser = await playwright[browserName].launch({ headless: true });
    try {
      for (const [viewportIndex, viewportName] of VIEWPORT_NAMES.entries()) {
        const page = await browser.newPage({ viewport: VIEWPORTS[viewportName] });
        const isPrimaryCase = browserIndex === 0 && viewportIndex === 0;
        const caseRecords = PLAY_ALL && isPrimaryCase ? records : representatives;
        try {
          for (const record of caseRecords) {
            const pageUrl = `${ORIGIN}/mirrorprod-india/watch/${record.slug}/`;
            const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            if (!response || response.status() !== 200) {
              fail(`Watch page did not return 200: ${pageUrl}`, {
                browser: browserName,
                viewport: viewportName,
                status: response?.status() ?? null,
              });
            }
            const video = page.locator('video');
            const count = await video.count();
            if (count !== 1) fail(`Expected one rendered video at ${pageUrl}, found ${count}.`);

            const playResult = await video.evaluate(async (element) => {
              try {
                element.muted = true;
                await element.play();
                return { ok: true };
              } catch (error) {
                return { ok: false, name: error.name, message: error.message };
              }
            });
            if (!playResult.ok) {
              fail(`Browser rejected playback at ${pageUrl}.`, {
                browser: browserName,
                viewport: viewportName,
                ...playResult,
              });
            }

            await page.waitForFunction(() => {
              const element = document.querySelector('video');
              return Boolean(element && (element.currentTime >= 0.75 || element.error));
            }, null, { timeout: 15000 });
            let state = await video.evaluate((element) => ({
              currentTime: element.currentTime,
              duration: element.duration,
              ended: element.ended,
              paused: element.paused,
              readyState: element.readyState,
              videoWidth: element.videoWidth,
              videoHeight: element.videoHeight,
              error: element.error && { code: element.error.code, message: element.error.message },
            }));
            if (state.error || state.currentTime < 0.75 || !Number.isFinite(state.duration)
              || state.duration <= 0 || state.readyState < 2 || state.videoWidth <= 0 || state.videoHeight <= 0) {
              fail(`Video did not produce decoded temporal progress at ${pageUrl}.`, {
                browser: browserName,
                viewport: viewportName,
                ...state,
              });
            }

            if (PLAY_TO_END) {
              const remainingMs = Math.ceil(Math.max(15, state.duration - state.currentTime + 10) * 1000);
              await page.waitForFunction(() => {
                const element = document.querySelector('video');
                return Boolean(element && (element.ended || element.error));
              }, null, { timeout: remainingMs });
              state = await video.evaluate((element) => ({
                currentTime: element.currentTime,
                duration: element.duration,
                ended: element.ended,
                paused: element.paused,
                readyState: element.readyState,
                videoWidth: element.videoWidth,
                videoHeight: element.videoHeight,
                error: element.error && { code: element.error.code, message: element.error.message },
              }));
              if (state.error || !state.ended || Math.abs(state.duration - state.currentTime) > 0.25) {
                fail(`Video did not reach its ended state at ${pageUrl}.`, {
                  browser: browserName,
                  viewport: viewportName,
                  ...state,
                });
              }
            } else {
              await video.evaluate((element) => element.pause());
            }
            results.push({
              slug: record.slug,
              pageUrl,
              orientation: record.orientation,
              browser: browserName,
              viewport: viewportName,
              primaryCase: isPrimaryCase,
              mutedPlayback: true,
              ...state,
            });
          }
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
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
    reviewedNoAudioBaselinePresent: EXPECTED_NO_AUDIO.size === 3,
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
  const audioStreams = PROBE_AUDIO ? probeAudioStreams(local.assets) : null;
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
  if (audioStreams) {
    receipt.audioStreams = audioStreams;
    receipt.checked.push('all local MP4 files were inspected for encoded audio streams against the reviewed no-audio baseline');
    receipt.unchecked.push('encoded audio-stream presence does not prove audible hardware output');
  } else {
    receipt.unchecked.push('encoded audio streams were not inspected in this run');
  }

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
      uniqueSlugs: [...new Set(browserPlayback.map((item) => item.slug))].length,
      primaryCaseChecked: browserPlayback.filter((item) => item.primaryCase).length,
      browsers: BROWSER_NAMES,
      viewportProfiles: VIEWPORT_NAMES,
      matrixCases: BROWSER_NAMES.flatMap((browser) => VIEWPORT_NAMES.map((viewport) => ({
        browser,
        viewport,
        checked: browserPlayback.filter((item) => item.browser === browser && item.viewport === viewport).length,
      }))),
      orientations: [...new Set(browserPlayback.map((item) => item.orientation))].sort(),
      minAdvancedSeconds: Math.min(...browserPlayback.map((item) => item.currentTime)),
      minReadyState: Math.min(...browserPlayback.map((item) => item.readyState)),
      decodedDimensions: [...new Set(browserPlayback.map((item) => `${item.videoWidth}x${item.videoHeight}`))].sort(),
      playToEnd: PLAY_TO_END,
      ended: browserPlayback.filter((item) => item.ended).length,
      mutedPlayback: true,
    };
    receipt.playbackScope = PLAY_ALL
      ? 'all generated watch pages in the primary browser/viewport case; representative portrait, landscape, and median pages in secondary cases'
      : 'representative portrait, landscape, and median pages in every requested browser/viewport case';
    if (!PLAY_ALL) {
      receipt.unchecked.push(`${records.length - representativePages(records).length} generated watch pages were not browser-played in any case during this run`);
    }
    if (!PLAY_TO_END) {
      receipt.unchecked.push('browser playback was not observed through the ended state');
    }
    if (!BROWSER_NAMES.includes('firefox')) receipt.unchecked.push('Firefox engine playback was not checked');
    if (!BROWSER_NAMES.includes('webkit')) receipt.unchecked.push('Playwright WebKit engine playback was not checked');
    if (!VIEWPORT_NAMES.includes('desktop')) receipt.unchecked.push('desktop viewport playback was not checked');
    if (BROWSER_NAMES.includes('webkit')) {
      receipt.unchecked.push('Playwright WebKit is an engine-level proxy and does not prove physical Safari playback');
    }
    receipt.unchecked.push('physical-device playback and audible hardware output were not checked');
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
