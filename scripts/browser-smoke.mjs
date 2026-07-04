import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.ACTIVE_MIRROR_BASE_URL || "https://activemirror.ai/app").replace(/\/+$/, "");
const screenshotDir = process.env.SMOKE_SCREENSHOT_DIR || "";
const submitFirstTurn = process.env.SMOKE_SUBMIT_FIRST_TURN === "true";

const routes = [
  {
    name: "home",
    path: "/",
    mustSee: [
      /What do you want\?/i,
      /Start here/i,
      /Already have one\?/i,
      /Send/i,
    ],
    interact: true,
  },
  {
    name: "start",
    path: "/start",
    mustSee: [/Set it up\./i, /What are you here for\?/i, /Get unstuck/i],
    setup: true,
  },
  {
    name: "id-alias",
    path: "/id",
    mustSee: [/Set it up\./i, /What are you here for\?/i, /Get unstuck/i],
  },
  {
    name: "brainscan-alias",
    path: "/brainscan",
    mustSee: [/Set it up\./i, /What are you here for\?/i, /Get unstuck/i],
  },
  {
    name: "mirrorseed-alias",
    path: "/mirrorseed",
    mustSee: [/Set it up\./i, /What are you here for\?/i, /Get unstuck/i],
  },
  {
    name: "mirror",
    path: "/mirror",
    mustSee: [/What do you want\?/i, /Start here/i, /Already have one\?/i, /Send/i],
  },
  {
    name: "enterprise",
    path: "/enterprise",
    mustSee: [/AI work your team can govern/i, /Pick one workflow/i, /No silent sharing/i],
  },
  {
    name: "device",
    path: "/device",
    mustSee: [
      /What is one thing you are stuck on\?|Best on this device/i,
      /ONE MOVE|Make it sendable|Open full mirror/i,
      /Private by default|Saving stays your choice/i,
    ],
  },
  {
    name: "privacy",
    path: "/privacy",
    mustSee: [/Privacy/i, /Safety limits/i, /What telemetry excludes/i],
  },
  {
    name: "terms",
    path: "/terms",
    mustSee: [/Terms/i, /Not professional or emergency advice/i],
  },
];

const forbiddenVisibleText = [
  /\bBrainScan\b/i,
  /\bMirror ID\b/i,
  /\bMirrorSeed\b/i,
  /\blocal seed\b/i,
  /\bcognitive assessment\b/i,
  /\blocal signature\b/i,
  /\bsovereign protocol\b/i,
];

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

function routeUrl(routePath) {
  return routePath === "/" ? `${baseUrl}/` : `${baseUrl}${routePath}/`;
}

function fail(message, detail = "") {
  const suffix = detail ? `\n${detail}` : "";
  throw new Error(`${message}${suffix}`);
}

function isLocalPreview() {
  return /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\b/i.test(baseUrl);
}

function isIgnoredConsoleError(text) {
  return (/static\.cloudflareinsights\.com\/beacon\.min\.js/i.test(text)
    && /Content Security Policy/i.test(text))
    // Production deploy bundles send allowlisted event metadata to the gateway.
    // Local preview origins are intentionally not CORS-allowed by the Worker.
    || (isLocalPreview() && /Failed to load resource: the server responded with a status of 403/i.test(text))
    || (isLocalPreview() && /gateway\.activemirror\.ai\/v1\/mirror\/create.*CORS policy/i.test(text))
    || (isLocalPreview() && /gateway\.activemirror\.ai\/v1\/mirror\/artifact.*CORS policy/i.test(text))
    || (isLocalPreview() && /gateway\.activemirror\.ai\/v1\/mirror\/enterprise-stream.*CORS policy/i.test(text))
    || (isLocalPreview() && /Failed to load resource: net::ERR_FAILED/i.test(text));
}

async function visibleText(page) {
  return page.locator("body").innerText({ timeout: 10000 });
}

async function exerciseFirstInput(page) {
  const input = page.locator("textarea, input[type='text'], [contenteditable='true']").first();
  if ((await input.count()) === 0) {
    fail("Home route did not expose a usable first input.");
  }

  const testText = "I need one clear thing to try for launch copy.";
  await input.fill(testText);

  const tagName = await input.evaluate((node) => node.tagName.toLowerCase());
  const value =
    tagName === "textarea" || tagName === "input"
      ? await input.inputValue()
      : await input.textContent();

  if (!value || !value.includes(testText)) {
    fail("Home route input did not retain typed text.");
  }

  if (!submitFirstTurn) return;

  await page.goto(routeUrl("/"), { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.locator("textarea, input[type='text'], [contenteditable='true']").first().fill(testText);
  await page.getByRole("button", { name: /^Send$/ }).first().click();
  await page.getByRole("button", { name: /^Save$/ }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.getByRole("button", { name: /^Saved$/ }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^(Different angle|Another angle)$/ }).last().waitFor({ timeout: 10000 });
  const artifactButton = page.getByRole("button", { name: /^(Draft it|Make doc|Make code starter|Make visual brief)$/ }).first();
  await artifactButton.waitFor({ timeout: 10000 });
  await artifactButton.click();
  await page.getByRole("button", { name: /^Download(?: \.[a-z0-9]+| brief| code)?$/ }).last().waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Copy$/ }).last().waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^(Different angle|Another angle)$/ }).last().click();
  await page.waitForTimeout(1500);
  if (await page.getByText("This asks for current facts.", { exact: true }).isVisible().catch(() => false)) {
    fail("Starter/feedback reflection leaked source-check UI.");
  }

  const feedbackStore = await page.evaluate(() => localStorage.getItem("active_mirror_feedback_v1") || "");
  if (feedbackStore.includes(testText)) {
    fail("Feedback storage leaked prompt text.");
  }

  const eventBuffer = await page.evaluate(() => sessionStorage.getItem("active_mirror_event_buffer_v1") || "");
  if (!eventBuffer.includes("sendable_created")) {
    fail("Artifact creation was not recorded as metadata.");
  }
  if (eventBuffer.includes(testText)) {
    fail("Privacy event buffer leaked prompt text.");
  }
}

async function exerciseStartFlow(page) {
  await page.getByText(/What are you here for\?/i).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /Get unstuck/i }).click();
  await page.getByRole("button", { name: /^Direct$/i }).click();
  await page.getByRole("button", { name: /Easy agreement/i }).click();
  await page.getByRole("button", { name: /A next step/i }).click();
  await page.getByText(/^Ready\.$/i).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /Keep a copy/i }).waitFor({ timeout: 10000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Keep a copy/i }).click();
  const download = await downloadPromise;
  if (download.suggestedFilename() !== "active-mirror-id.json") {
    fail(`Setup ID download used unexpected filename: ${download.suggestedFilename()}`);
  }

  await page.getByRole("button", { name: /Start chat/i }).click();
  await page.waitForURL(/\/app\/?$/, { timeout: 10000 });
  await page.getByText(/What do you want\?/i).waitFor({ timeout: 10000 });

  const state = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("mirrorState_v1") || "{}");
    } catch {
      return {};
    }
  });
  if (!state.mirrorSeed || !Array.isArray(state.preferences) || state.preferences.length !== 4) {
    fail("Setup choices were not saved into the browser-local state.");
  }
}

async function main() {
  if (screenshotDir) {
    await mkdir(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      const consoleProblems = [];
      const ignoredConsoleProblems = [];
      const pageErrors = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          if (isIgnoredConsoleError(text)) {
            ignoredConsoleProblems.push(text);
          } else {
            consoleProblems.push(text);
          }
        }
      });
      page.on("pageerror", (err) => {
        pageErrors.push(err.message);
      });

      for (const route of routes) {
        const ignoredBefore = ignoredConsoleProblems.length;
        const url = routeUrl(route.path);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

        const text = await visibleText(page);
        if (text.trim().length < 120) {
          fail(`${viewport.name}/${route.name} rendered too little content.`, text.slice(0, 500));
        }

        for (const pattern of route.mustSee) {
          if (!pattern.test(text)) {
            fail(`${viewport.name}/${route.name} missing expected text: ${pattern}`, text.slice(0, 1000));
          }
        }

        for (const pattern of forbiddenVisibleText) {
          if (pattern.test(text)) {
            fail(`${viewport.name}/${route.name} leaked internal-facing copy: ${pattern}`, text.slice(0, 1200));
          }
        }

        if (/vite|webpack|internal server error|failed to fetch dynamically imported module/i.test(text)) {
          fail(`${viewport.name}/${route.name} appears to show a framework/runtime error.`, text.slice(0, 1000));
        }

        if (route.interact) {
          await exerciseFirstInput(page);
        }

        if (route.setup) {
          await exerciseStartFlow(page);
        }

        if (screenshotDir) {
          await page.screenshot({
            path: path.join(screenshotDir, `${viewport.name}-${route.name}.png`),
            fullPage: false,
          });
        }

        results.push({
          viewport: viewport.name,
          route: route.name,
          url: page.url(),
          status: "pass",
          ignoredConsoleErrors: ignoredConsoleProblems.length - ignoredBefore,
        });
      }

      if (consoleProblems.length || pageErrors.length) {
        fail(
          `${viewport.name} browser errors detected.`,
          JSON.stringify({ consoleProblems, pageErrors }, null, 2),
        );
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ ok: true, baseUrl, results }, null, 2));
  if (submitFirstTurn) {
    console.log("First-turn model render checked.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
