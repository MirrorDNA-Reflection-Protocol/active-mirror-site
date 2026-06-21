import "./style.css";
import { gsap } from "gsap";

const canAnimate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const heroModes = {
  launching: {
    title: "Launch clarity",
    nextMove: "Open the launch workspace",
    receipts: [
      ["Source", "Research notes and interview clips"],
      ["Boundary", "Personal notes kept local"],
      ["Next action", "Draft landing page and user test script"],
    ],
  },
  overwhelmed: {
    title: "Overwhelm reducer",
    nextMove: "Sort open loops by energy",
    receipts: [
      ["Source", "Tabs, drafts, tasks, and notes"],
      ["Boundary", "Private context stays in browser"],
      ["Next action", "Pick one two-hour completion path"],
    ],
  },
  learning: {
    title: "Learning map",
    nextMove: "Build the next lesson route",
    receipts: [
      ["Source", "Questions and saved explanations"],
      ["Boundary", "No personal details collected"],
      ["Next action", "Practice with reflected gaps"],
    ],
  },
  building: {
    title: "Build path",
    nextMove: "Generate the smallest shippable slice",
    receipts: [
      ["Source", "Repo state and design notes"],
      ["Boundary", "Secrets and client context blocked"],
      ["Next action", "Create artifact and QA receipt"],
    ],
  },
};

const scenarios = {
  launch: {
    confidence: "Confidence: High",
    viewportType: "momentum_map",
    viewportNodes: [["Capture", "Research"], ["Reflect", "Launch proof"], ["Act", "Prototype test"]],
    insights: [
      "You have enough material to ship a first story, but the audience and proof need to be tighter.",
      "The next move is not more brainstorming. It is a visible prototype with a user test plan.",
      "Keep sensitive notes local and only promote the final positioning receipt.",
    ],
    tags: ["Momentum map", "Landing page", "User interviews", "Receipts"],
    route: [
      "Reflect on the current brief and extract the promise.",
      "Generate the first product page and visual proof strip.",
      "Run a small user test and capture objections.",
      "Promote only the learning that survives the test.",
    ],
    receipts: [
      ["Context receipt", "Sources: notes, product brief, interview summary"],
      ["Consent receipt", "Private drafts stay local. Public copy is exportable."],
      ["Output receipt", "Landing page, test script, and launch checklist"],
    ],
  },
  return: {
    confidence: "Confidence: Medium-high",
    viewportType: "return_path",
    viewportNodes: [["Sort", "Open loops"], ["Choose", "One win"], ["Act", "48-hour proof"]],
    insights: [
      "The work is not gone. It is scattered, unranked, and emotionally expensive to restart.",
      "You need a clean return path that honors what happened without reliving every detail.",
      "Start with one proof of motion, then let the system carry continuity.",
    ],
    tags: ["Restart path", "Confidence", "Open loops", "One next move"],
    route: [
      "Collect the open loops without judging them.",
      "Mark what still matters, what is stale, and what can be retired.",
      "Choose one visible win for the next 48 hours.",
      "Save a momentum receipt so tomorrow is easier.",
    ],
    receipts: [
      ["Context receipt", "Sources: unfinished docs, notes, calendar traces"],
      ["Boundary receipt", "No personal story promoted without approval"],
      ["Momentum receipt", "One completed artifact and next action"],
    ],
  },
  research: {
    confidence: "Confidence: High",
    viewportType: "source_synthesis",
    viewportNodes: [["Cluster", "Claims"], ["Verify", "Sources"], ["Decide", "Memo"]],
    insights: [
      "The research is useful, but it is not yet decision-shaped.",
      "Separate facts, assumptions, contradictions, and open questions before generating recommendations.",
      "The output should be a synthesis workspace, not a longer chat answer.",
    ],
    tags: ["Synthesis", "Contradictions", "Decision memo", "Sources"],
    route: [
      "Cluster findings by claim and evidence strength.",
      "Flag contradictions and missing sources.",
      "Generate a decision memo with assumptions exposed.",
      "Attach receipts for every promoted claim.",
    ],
    receipts: [
      ["Source receipt", "Every claim points back to a file, link, or note"],
      ["Gap receipt", "Unknowns stay visible instead of being smoothed over"],
      ["Decision receipt", "Recommendation carries assumptions and owner"],
    ],
  },
  career: {
    confidence: "Confidence: Medium",
    viewportType: "offer_map",
    viewportNodes: [["Extract", "Strengths"], ["Package", "Offers"], ["Ship", "Portfolio proof"]],
    insights: [
      "The career path is not a blank slate. Past work contains patterns that can be turned into offers.",
      "The next step is a portfolio proof, not a generic resume rewrite.",
      "Active Mirror should keep your story precise and receipt-backed.",
    ],
    tags: ["Portfolio", "Offers", "Pattern extraction", "Proof sprint"],
    route: [
      "Extract repeatable strengths from past projects.",
      "Map strengths to three marketable offers.",
      "Generate one proof artifact per offer.",
      "Track responses and compound the positioning.",
    ],
    receipts: [
      ["Memory receipt", "Only verified work history is promoted"],
      ["Offer receipt", "Each offer maps to evidence and outcome"],
      ["Momentum receipt", "One portfolio proof shipped this week"],
    ],
  },
};

const heroModeTitle = document.querySelector("#hero-mode-title");
const heroNextMove = document.querySelector("#hero-next-move");
const heroReceipts = document.querySelector("#hero-receipts");
const mobileModeTitle = document.querySelector("#mobile-mode-title");
const mobileNextMove = document.querySelector("#mobile-next-move");
const mobileViewport = document.querySelector("#mobile-viewport");
const mobilePrompt = document.querySelector("#mobile-prompt");
const mobileGenerate = document.querySelector("#mobile-generate");
const mobileInspectorLabel = document.querySelector("#mobile-inspector-label");
const mobileInspectorCopy = document.querySelector("#mobile-inspector-copy");
const mobileNodeButtons = Array.from(document.querySelectorAll(".mobile-pin"));
const consoleTabs = Array.from(document.querySelectorAll(".console-tab"));
const scenarioButtons = Array.from(document.querySelectorAll(".scenario-button"));
const insightList = document.querySelector("#insight-list");
const tagRow = document.querySelector("#tag-row");
const routeList = document.querySelector("#route-list");
const receiptList = document.querySelector("#receipt-list");
const receiptDrawer = document.querySelector("#receipt-drawer");
const confidenceLabel = document.querySelector("#confidence-label");
const viewportType = document.querySelector("#viewport-type");
const viewportCanvas = document.querySelector("#viewport-canvas");
const toggleReceipts = document.querySelector("#toggle-receipts");
const closeReceipts = document.querySelector("#close-receipts");
const openWorkspace = document.querySelector("#open-workspace");
const steps = Array.from(document.querySelectorAll(".step"));
const ritualIntent = document.querySelector("#ritual-intent");
const ritualBoundary = document.querySelector("#ritual-boundary");
const ritualCount = document.querySelector("#ritual-count");
const ritualCreate = document.querySelector("#ritual-create");
const ritualReset = document.querySelector("#ritual-reset");
const ritualRefresh = document.querySelector("#ritual-refresh");
const ritualExpand = document.querySelector("#ritual-expand");
const ritualStatus = document.querySelector("#ritual-status");
const ritualBoard = document.querySelector("#ritual-board");
const mirrorDevice = document.querySelector(".mirror-device");
const ritualGoals = document.querySelector("#ritual-goals");
const ritualBlockers = document.querySelector("#ritual-blockers");
const ritualMoves = document.querySelector("#ritual-moves");
const ritualArtifact = document.querySelector("#ritual-artifact");
const ritualReceiptTime = document.querySelector("#ritual-receipt-time");
const goalCount = document.querySelector("#goal-count");
const blockerCount = document.querySelector("#blocker-count");
const moveCount = document.querySelector("#move-count");
const receiptWhy = document.querySelector("#receipt-why");
const receiptUsed = document.querySelector("#receipt-used");
const receiptExcluded = document.querySelector("#receipt-excluded");
const receiptRoute = document.querySelector("#receipt-route");
const receiptMemory = document.querySelector("#receipt-memory");
const receiptLines = Array.from(document.querySelectorAll(".receipt-line"));

const mobileModeNodes = {
  launching: ["Research", "Launch proof", "Prototype", "Receipt"],
  overwhelmed: ["Tabs", "Energy map", "One move", "Boundary"],
  learning: ["Questions", "Gaps", "Practice", "Memory"],
  building: ["Repo state", "Small slice", "QA proof", "Gate"],
};

const mobilePrompts = {
  launching: "Turn this scattered launch work into my next move",
  overwhelmed: "Show me the one thing that lowers the load",
  learning: "Turn my questions into a practice path",
  building: "Generate the smallest shippable slice",
};

const mobileModeOrder = ["launching", "overwhelmed", "learning", "building"];

const mobileNodeReceiptIndex = {
  source: 0,
  reflect: 1,
  act: 2,
  receipt: 2,
};

function withViewTransition(callback) {
  if (document.startViewTransition && canAnimate) {
    document.startViewTransition(callback);
    return;
  }
  callback();
}

const ritualInitialIntent =
  "Restarting a product launch: notes, positioning, screenshots, and next steps are scattered.";

const boundaryCopy = {
  personal: {
    excluded: "Personal history, sensitive emotion, and private identity context stay out unless approved.",
    route: "Local browser board first. Hosted models can help only after a boundary gate.",
    memory: "No personal context is promoted until the receipt is accepted.",
  },
  client: {
    excluded: "Client names, partner details, commercial terms, and confidential screenshots are masked.",
    route: "Local synthesis first. Exportable copy is separated from private source material.",
    memory: "Only public-safe project learning can be promoted.",
  },
  secrets: {
    excluded: "Keys, tokens, credentials, private URLs, and operational secrets are blocked from the route.",
    route: "Secret-bearing work stays local. Cloud APIs only receive redacted tasks.",
    memory: "Secrets are never saved as memory entries.",
  },
  drafts: {
    excluded: "Loose drafts, half-formed claims, and speculative positioning stay temporary.",
    route: "The board can generate options, but rough work does not become durable truth.",
    memory: "Only accepted conclusions move into continuity.",
  },
};

const ritualModes = {
  launch: {
    goals: ["Define the audience promise", "Choose the first visible proof", "Ship a testable launch page"],
    blockers: ["Scattered notes", "Too many possible angles", "No receipt trail for claims"],
    moves: ["Extract the strongest promise", "Pick three screenshots or demos", "Write the user-test script", "Promote only validated copy"],
    artifact: ["Launch clarity memo", "Audience, promise, proof, next test."],
    why: "The work needs a visible product story and a next action, not more brainstorming.",
  },
  restart: {
    goals: ["Recover useful past work", "Lower the emotional load", "Create one proof of motion"],
    blockers: ["Old context is scattered", "Restart friction is high", "Progress is hard to see"],
    moves: ["Sort open loops without judgment", "Retire stale threads", "Choose a 48-hour win", "Save the momentum receipt"],
    artifact: ["Return path board", "What still matters, what can go, what moves first."],
    why: "The user is rebuilding momentum and needs continuity without reliving every detail.",
  },
  research: {
    goals: ["Turn findings into decisions", "Expose assumptions", "Attach source receipts"],
    blockers: ["Claims are mixed with guesses", "Contradictions are hidden", "Sources are not ranked"],
    moves: ["Cluster claims", "Mark evidence strength", "List contradictions", "Generate the decision memo"],
    artifact: ["Research synthesis memo", "Claim, source, contradiction, decision."],
    why: "The research needs a structured view with receipts, not a longer chat answer.",
  },
  career: {
    goals: ["Find repeatable strengths", "Package marketable offers", "Ship portfolio proof"],
    blockers: ["Story is too broad", "Past work is under-leveraged", "No proof sprint selected"],
    moves: ["Extract patterns from prior work", "Name three offers", "Build one proof artifact", "Track response signals"],
    artifact: ["Offer proof map", "Strength, evidence, offer, proof sprint."],
    why: "The user needs a bridge from lived work to visible proof and commercial motion.",
  },
};

let ritualTurn = 1;

function animateElements(targets, vars = {}) {
  if (!canAnimate || !targets || (Array.isArray(targets) && targets.length === 0)) return;
  gsap.fromTo(
    targets,
    { autoAlpha: 0, y: 14, scale: 0.985 },
    {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.46,
      ease: "power3.out",
      stagger: 0.055,
      ...vars,
    }
  );
}

function shortIntent(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 86) return clean;
  return `${clean.slice(0, 83)}...`;
}

function currentRitualMode(text) {
  const value = text.toLowerCase();
  if (value.includes("career") || value.includes("job") || value.includes("offer") || value.includes("portfolio")) return "career";
  if (value.includes("research") || value.includes("source") || value.includes("study") || value.includes("memo")) return "research";
  if (value.includes("restart") || value.includes("stuck") || value.includes("return") || value.includes("overwhelm")) return "restart";
  return "launch";
}

function renderRitualList(target, items) {
  target.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
}

function animateRitualBoard() {
  animateElements(Array.from(document.querySelectorAll(".ritual-column")));
  animateElements(Array.from(document.querySelectorAll(".receipt-line")), { x: 0, delay: 0.08 });
}

function renderRitual() {
  if (!ritualIntent || !ritualBoundary || !ritualGoals || !ritualBlockers || !ritualMoves) return;
  const intent = ritualIntent.value || ritualInitialIntent;
  const modeKey = currentRitualMode(intent);
  const mode = ritualModes[modeKey];
  const boundary = boundaryCopy[ritualBoundary.value] || boundaryCopy.personal;

  document.documentElement.dataset.ritualMode = modeKey;
  ritualCount.textContent = String(ritualIntent.value.length);
  renderRitualList(ritualGoals, mode.goals);
  renderRitualList(ritualBlockers, mode.blockers);
  renderRitualList(ritualMoves, mode.moves);

  goalCount.textContent = String(mode.goals.length);
  blockerCount.textContent = String(mode.blockers.length);
  moveCount.textContent = String(mode.moves.length);
  ritualArtifact.innerHTML = `<p>${mode.artifact[0]}</p><strong>${mode.artifact[1]}</strong>`;
  ritualReceiptTime.textContent = `local-turn-${String(ritualTurn).padStart(3, "0")}`;
  receiptWhy.textContent = mode.why;
  receiptUsed.textContent = `Intent: "${shortIntent(intent)}" plus the selected boundary.`;
  receiptExcluded.textContent = boundary.excluded;
  receiptRoute.textContent = boundary.route;
  receiptMemory.textContent = boundary.memory;

  try {
    localStorage.setItem(
      "activeMirrorFirstUse",
      JSON.stringify({
        intent: ritualIntent.value,
        boundary: ritualBoundary.value,
        turn: ritualTurn,
      })
    );
  } catch {
    // Local persistence is opportunistic; the UI stays fully functional without it.
  }
}

function markRitualGenerated() {
  withViewTransition(() => {
    ritualTurn += 1;
    renderRitual();
    ritualStatus.textContent = "Updated in your browser";
    ritualCreate.textContent = "Mirror generated";
    ritualCreate.classList.add("is-complete");
    receiptLines[0]?.classList.add("is-open");
  });
  animateRitualBoard();

  window.setTimeout(() => {
    ritualCreate.textContent = "Create my first mirror";
    ritualCreate.classList.remove("is-complete");
  }, 1700);
}

function renderHeroMode(modeKey) {
  const mode = heroModes[modeKey];
  if (!mode) return;
  heroModeTitle.textContent = mode.title;
  heroNextMove.textContent = mode.nextMove;
  mobileModeTitle.textContent = mode.title;
  mobileNextMove.textContent = mode.nextMove;
  mobilePrompt.value = mobilePrompts[modeKey];
  mobileViewport.dataset.mode = modeKey;
  mobileModeNodes[modeKey].forEach((label, index) => {
    const nodeLabel = mobileNodeButtons[index]?.querySelector("strong");
    if (nodeLabel) nodeLabel.textContent = label;
  });
  heroReceipts.innerHTML = mode.receipts
    .map(
      ([label, value]) => `
        <article class="receipt-mini">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `
    )
    .join("");
  const activeNode = mobileNodeButtons.find((button) => button.classList.contains("is-active")) || mobileNodeButtons[0];
  renderMobileInspector(modeKey, activeNode.dataset.mobileNode);
  animateElements(Array.from(document.querySelectorAll(".receipt-mini")), { y: 8, duration: 0.36 });
}

function renderMobileInspector(modeKey, nodeKey) {
  const mode = heroModes[modeKey];
  const receipt = mode?.receipts[mobileNodeReceiptIndex[nodeKey] || 0];
  if (!receipt) return;
  mobileInspectorLabel.textContent = receipt[0];
  mobileInspectorCopy.textContent = receipt[1];
}

function renderScenario(key) {
  const scenario = scenarios[key];
  if (!scenario) return;

  insightList.innerHTML = scenario.insights.map((insight) => `<li>${insight}</li>`).join("");
  tagRow.innerHTML = scenario.tags.map((tag) => `<span>${tag}</span>`).join("");
  routeList.innerHTML = scenario.route
    .map((item, index) => `<li><span>${index + 1}</span><strong>${item}</strong></li>`)
    .join("");
  receiptList.innerHTML = scenario.receipts
    .map(
      ([label, value]) => `
        <article class="receipt-row">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `
    )
    .join("");
  confidenceLabel.textContent = scenario.confidence;
  viewportType.textContent = scenario.viewportType;
  viewportCanvas.querySelectorAll(".viewport-node").forEach((node, index) => {
    const [title, detail] = scenario.viewportNodes[index] || ["Patch", "Next view"];
    node.querySelector("strong").textContent = title;
    node.querySelector("span").textContent = detail;
  });
  viewportCanvas.dataset.patch = key;
  animateElements(Array.from(viewportCanvas.querySelectorAll(".viewport-node")), { y: 10 });

  steps.forEach((step, index) => {
    step.classList.toggle("is-done", index < 2);
    step.classList.toggle("is-active", index === 2);
  });
}

function setActiveButton(buttons, active) {
  buttons.forEach((button) => {
    button.classList.toggle("is-active", button === active);
  });
}

function setActiveModeButton(buttons, mode) {
  buttons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
}

if (
  heroModeTitle &&
  heroNextMove &&
  heroReceipts &&
  mobileModeTitle &&
  mobileNextMove &&
  mobileViewport &&
  mobilePrompt &&
  mobileGenerate
) {
  consoleTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode;
      setActiveModeButton(consoleTabs, mode);
      renderHeroMode(mode);
    });
  });

  mobileNodeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveButton(mobileNodeButtons, button);
      renderMobileInspector(mobileViewport.dataset.mode, button.dataset.mobileNode);
    });
  });

  mobileGenerate.addEventListener("click", () => {
    const currentIndex = mobileModeOrder.indexOf(mobileViewport.dataset.mode);
    const nextMode = mobileModeOrder[(currentIndex + 1) % mobileModeOrder.length];
    setActiveModeButton(consoleTabs, nextMode);
    renderHeroMode(nextMode);
  });

  renderHeroMode("launching");
}

if (ritualIntent && ritualBoundary && ritualCreate && ritualReset) {
  try {
    const savedRitual = JSON.parse(localStorage.getItem("activeMirrorFirstUse") || "null");
    if (savedRitual?.intent) ritualIntent.value = savedRitual.intent;
    if (savedRitual?.boundary && boundaryCopy[savedRitual.boundary]) ritualBoundary.value = savedRitual.boundary;
    if (Number.isFinite(savedRitual?.turn)) ritualTurn = savedRitual.turn;
  } catch {
    localStorage.removeItem("activeMirrorFirstUse");
  }

  ritualIntent.addEventListener("input", () => {
    renderRitual();
  });

  ritualBoundary.addEventListener("change", () => {
    withViewTransition(renderRitual);
    animateRitualBoard();
  });

  ritualCreate.addEventListener("click", markRitualGenerated);
  ritualRefresh?.addEventListener("click", markRitualGenerated);
  ritualExpand?.addEventListener("click", async () => {
    if (!mirrorDevice) return;
    if (!document.fullscreenElement && mirrorDevice.requestFullscreen) {
      await mirrorDevice.requestFullscreen();
      ritualExpand.textContent = "Close";
      return;
    }
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      ritualExpand.textContent = "Expand";
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (ritualExpand) ritualExpand.textContent = document.fullscreenElement ? "Close" : "Expand";
  });

  ritualReset.addEventListener("click", () => {
    withViewTransition(() => {
      ritualTurn = 1;
      ritualIntent.value = ritualInitialIntent;
      ritualBoundary.value = "personal";
      ritualStatus.textContent = "Generated just now";
      receiptLines.forEach((line, index) => line.classList.toggle("is-open", index === 0));
      renderRitual();
    });
    animateRitualBoard();
  });

  receiptLines.forEach((line) => {
    line.addEventListener("click", () => {
      const willOpen = !line.classList.contains("is-open");
      receiptLines.forEach((other) => other.classList.remove("is-open"));
      line.classList.toggle("is-open", willOpen);
      if (canAnimate && willOpen) {
        gsap.fromTo(line.querySelector("strong"), { autoAlpha: 0, y: 5 }, { autoAlpha: 1, y: 0, duration: 0.24 });
      }
    });
  });

  renderRitual();
  animateElements(Array.from(document.querySelectorAll(".ritual-create-panel, .mirror-device, .receipt-pack, .space-control")), {
    y: 22,
    duration: 0.7,
    stagger: 0.09,
  });
}

if (
  insightList &&
  tagRow &&
  routeList &&
  receiptList &&
  receiptDrawer &&
  confidenceLabel &&
  viewportType &&
  viewportCanvas
) {
  scenarioButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveButton(scenarioButtons, button);
      renderScenario(button.dataset.scenario);
      receiptDrawer.classList.add("is-open");
    });
  });

  if (toggleReceipts) {
    toggleReceipts.addEventListener("click", () => {
      const open = receiptDrawer.classList.toggle("is-open");
      toggleReceipts.textContent = open ? "Hide receipts" : "Open receipts";
    });
  }

  if (closeReceipts) {
    closeReceipts.addEventListener("click", () => {
      receiptDrawer.classList.remove("is-open");
      if (toggleReceipts) toggleReceipts.textContent = "Open receipts";
    });
  }

  if (openWorkspace) {
    openWorkspace.addEventListener("click", () => {
      receiptDrawer.classList.add("is-open");
      steps.forEach((step, index) => {
        step.classList.toggle("is-done", index < 4);
        step.classList.toggle("is-active", index === 3);
      });
    });
  }

  renderScenario("launch");
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  { threshold: 0.16 }
);

document.querySelectorAll("section, .tool-strip, .cta-panel").forEach((section) => {
  section.classList.add("reveal");
  observer.observe(section);
});
