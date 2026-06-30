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
      /Not sure how to ask\? Start here\./i,
      /Get unstuck/i,
      /Make this sendable/i,
      /Check my thinking/i,
      /Reflect/i,
    ],
    interact: true,
  },
  {
    name: "start",
    path: "/start",
    mustSee: [/Start with you/i, /Six quick choices\. Better answers/i, /What are you bringing first/i],
    setup: true,
  },
  {
    name: "id-alias",
    path: "/id",
    mustSee: [/Start with you/i, /Six quick choices\. Better answers/i, /What are you bringing first/i],
  },
  {
    name: "brainscan-alias",
    path: "/brainscan",
    mustSee: [/Start with you/i, /BrainScan/i, /What are you bringing first/i],
  },
  {
    name: "mirrorseed-alias",
    path: "/mirrorseed",
    mustSee: [/Start with you/i, /BrainScan/i, /What are you bringing first/i],
  },
  {
    name: "mirror",
    path: "/mirror",
    mustSee: [/What do you want\?/i, /Not sure how to ask\? Start here\./i, /Reflect/i],
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
      /one next move|Open full mirror/i,
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
  return /static\.cloudflareinsights\.com\/beacon\.min\.js/i.test(text)
    && /Content Security Policy/i.test(text)
    // Production deploy bundles send allowlisted event metadata to the gateway.
    // Local preview origins are intentionally not CORS-allowed by the Worker.
    || (isLocalPreview() && /Failed to load resource: the server responded with a status of 403/i.test(text))
    || (isLocalPreview() && /gateway\.activemirror\.ai\/v1\/mirror\/create.*CORS policy/i.test(text))
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

  const testText = "I need one clear next move for launch copy.";
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
  await page.getByRole("button", { name: /^Get unstuck$/ }).first().click();
  await page.getByText(/Real question:/).waitFor({ timeout: 30000 });
  await page.getByText(/^NEXT MOVE$/i).waitFor({ timeout: 10000 });
  await page.getByText("Remember this", { exact: true }).click();
  await page.getByText("Saved for next time", { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText("What else?", { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText("Challenge me", { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText("Make it sendable", { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText("Did this help?", { exact: true }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^Almost$/ }).first().click();
  await page.getByText(/No message text was saved/i).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^What else\?$/ }).last().click();
  await page.waitForTimeout(1500);
  if (await page.getByText("This asks for current facts.", { exact: true }).isVisible().catch(() => false)) {
    fail("Starter/feedback reflection leaked source-check UI.");
  }

  const feedbackStore = await page.evaluate(() => localStorage.getItem("active_mirror_feedback_v1") || "");
  if (feedbackStore.includes(testText)) {
    fail("Feedback storage leaked prompt text.");
  }

  const eventBuffer = await page.evaluate(() => sessionStorage.getItem("active_mirror_event_buffer_v1") || "");
  if (!eventBuffer.includes("feedback_repair")) {
    fail("Feedback repair was not recorded as metadata.");
  }
  if (eventBuffer.includes(testText)) {
    fail("Privacy event buffer leaked prompt text.");
  }
}

async function exerciseStartFlow(page) {
  await page.getByRole("button", { name: /I feel stuck/i }).click();
  await page.getByText(/What do you want from the first answer\?/i).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /One next step/i }).click();
  await page.getByRole("button", { name: /Too much text/i }).click();
  await page.getByRole("button", { name: /^Gentle$/i }).click();
  await page.getByRole("button", { name: /How I like answers/i }).click();
  await page.getByRole("button", { name: /When I am spiraling/i }).click();
  await page.getByRole("button", { name: /It is short and useful/i }).click();
  await page.getByText(/You're set\./i).waitFor({ timeout: 10000 });
  await page.getByText(/Download Mirror ID/i).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /Save and reflect/i }).click();
  await page.getByText(/What do you want\?/i).waitFor({ timeout: 10000 });

  const state = await page.evaluate(() => localStorage.getItem("mirrorState_v1") || "");
  if (!state.includes("mirror-id") || !state.includes("mirrorSeed") || !state.includes("preferences")) {
    fail("BrainScan choices were not saved into the browser-local Mirror ID state.");
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
          ignoredConsoleErrors: ignoredConsoleProblems.length,
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
