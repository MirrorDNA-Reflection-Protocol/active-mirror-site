import { chromium } from "playwright";

const baseUrl = (process.env.ACTIVE_MIRROR_BASE_URL || "https://activemirror.ai/app").replace(/\/+$/, "");
const timeoutMs = Number(process.env.ACTIVE_MIRROR_INTERACTION_TIMEOUT_MS || 30000);

function appUrl() {
  return `${baseUrl}/`;
}

function compact(text = "", limit = 900) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function fail(message, text = "") {
  const detail = text ? `\n${compact(text)}` : "";
  throw new Error(`${message}${detail}`);
}

async function bodyText(page) {
  return page.locator("body").innerText({ timeout: 10000 });
}

async function submitPrompt(page, prompt) {
  const input = page.locator("textarea, input[type='text'], [contenteditable='true']").first();
  await input.waitFor({ timeout: 15000 });
  await input.fill(prompt);
  await page.getByRole("button", { name: /^Send$/ }).first().click();
}

async function waitForBodyMatch(page, pattern, label) {
  const started = Date.now();
  let latest = "";
  while (Date.now() - started < timeoutMs) {
    latest = await bodyText(page);
    if (pattern.test(latest)) return latest;
    await page.waitForTimeout(600);
  }
  fail(`Timed out waiting for ${label}.`, latest);
}

async function withPage(browser, fn) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    locale: "fr-FR",
  });
  const page = await context.newPage();
  try {
    await page.goto(appUrl(), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    return await fn(page);
  } finally {
    await context.close();
  }
}

async function checkAnswerFirst(browser) {
  return withPage(browser, async (page) => {
    await submitPrompt(page, "Compare current AI chat apps with canvas features.");
    const text = await waitForBodyMatch(page, /What I found|Current public sources|checked/i, "answer-first source result");
    const answerIndex = text.search(/What I found|Current public sources|checked/i);
    const competitorIndex = text.search(/ChatGPT Canvas|Claude Artifacts|Gemini Canvas|canvas|artifact/i);
    const privacyIndex = text.search(/sensitive context|held the turn back|restate/i);
    const questionIndex = text.search(/Can you clarify|Would you like|Which claim would/i);

    if (answerIndex < 0) fail("Source prompt did not show an answer-first result.", text);
    if (competitorIndex < 0) fail("Source prompt did not include concrete competitors.", text);
    if (privacyIndex >= 0) fail("Source prompt was incorrectly blocked as private.", text);
    if (questionIndex >= 0 && questionIndex < answerIndex) {
      fail("Source prompt asked a question before giving value.", text);
    }

    return {
      flow: "answer_first_sources",
      status: "pass",
      sample: compact(text, 260),
    };
  });
}

async function checkArtifactFirst(browser) {
  return withPage(browser, async (page) => {
    await submitPrompt(page, "Write a short message asking a friend for honest feedback without sounding needy.");
    await waitForBodyMatch(page, /draft opens below|Making the draft now/i, "artifact-first status");
    const text = await waitForBodyMatch(page, /Message draft|honest feedback|could I get your honest feedback/i, "artifact output");

    if (/FOCUS\s+(Do you want|Would you like|Veux-tu)|Tu veux|Veux-tu|Écris|message court|demande courte/i.test(text)) {
      fail("Artifact prompt leaked a coaching question or wrong-language response before the draft.", text);
    }
    if (!/Message draft|honest feedback|could I get your honest feedback/i.test(text)) {
      fail("Artifact prompt did not produce a usable draft.", text);
    }

    return {
      flow: "artifact_first",
      status: "pass",
      sample: compact(text, 260),
    };
  });
}

async function checkDecisionPrompt(browser) {
  return withPage(browser, async (page) => {
    await submitPrompt(page, "Should the glass dashboard be enterprise only?");
    const text = await waitForBodyMatch(
      page,
      /FOCUS|Another opinion|Write one sentence|Name the signal|smallest test|enterprise-only|dashboard/i,
      "decision-specific reflection",
    );

    if (/Finding the useful move/i.test(text)) {
      fail("Decision prompt stayed on the loading state.", text);
    }
    if (/This is wide enough to get heavy|What would make today feel a little easier/i.test(text)) {
      fail("Decision prompt regressed to the vague fallback.", text);
    }
    if (/\b(?:Le vrai choix|Tu veux|Écris|partagé|garder|ouvrir)\b/i.test(text)) {
      fail("Decision prompt answered in the browser locale instead of the prompt language.", text);
    }
    if (!/(signal|test|control|reach|enterprise-only|write one sentence|name the signal|smallest test)/i.test(text)) {
      fail("Decision prompt did not produce a useful choice frame.", text);
    }

    return {
      flow: "decision_specific",
      status: "pass",
      sample: compact(text, 260),
    };
  });
}

async function main() {
  const browser = await launchBrowser();
  try {
    const results = [];
    results.push(await checkAnswerFirst(browser));
    results.push(await checkArtifactFirst(browser));
    results.push(await checkDecisionPrompt(browser));
    console.log(JSON.stringify({ ok: true, baseUrl, results }, null, 2));
  } finally {
    await browser.close();
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (!/Executable doesn't exist/i.test(String(error?.message || ""))) throw error;
    return chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || "chrome" });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
