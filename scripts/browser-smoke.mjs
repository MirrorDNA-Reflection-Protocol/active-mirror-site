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
    mustSee: [/What do you want\?/i, /Active Mirror/i],
    interact: true,
  },
  {
    name: "privacy",
    path: "/privacy",
    mustSee: [/Privacy/i, /Security limits/i, /What telemetry excludes/i],
  },
  {
    name: "terms",
    path: "/terms",
    mustSee: [/Terms/i, /Not professional or emergency advice/i],
  },
];

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

function routeUrl(routePath) {
  return routePath === "/" ? `${baseUrl}/` : `${baseUrl}${routePath}`;
}

function fail(message, detail = "") {
  const suffix = detail ? `\n${detail}` : "";
  throw new Error(`${message}${suffix}`);
}

function isIgnoredConsoleError(text) {
  return /static\.cloudflareinsights\.com\/beacon\.min\.js/i.test(text)
    && /Content Security Policy/i.test(text);
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

  await page.getByRole("button", { name: /reflect|send/i }).first().click();
  await page.getByText("Next move", { exact: false }).waitFor({ timeout: 30000 });
  await page.getByText("Ask sharper", { exact: false }).waitFor({ timeout: 10000 });
  await page.getByText("Make a draft", { exact: false }).waitFor({ timeout: 10000 });
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

        if (/vite|webpack|internal server error|failed to fetch dynamically imported module/i.test(text)) {
          fail(`${viewport.name}/${route.name} appears to show a framework/runtime error.`, text.slice(0, 1000));
        }

        if (route.interact) {
          await exerciseFirstInput(page);
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
