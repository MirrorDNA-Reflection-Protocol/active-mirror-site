import "./style.css";
import { gsap } from "gsap";

const canAnimate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MIRROR_GATEWAY_URL = "https://gateway.activemirror.ai";

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
    { y: 14, scale: 0.985 },
    {
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function currentRitualMode(text) {
  const value = text.toLowerCase();
  if (value.includes("career") || value.includes("job") || value.includes("offer") || value.includes("portfolio")) return "career";
  if (value.includes("research") || value.includes("source") || value.includes("study") || value.includes("memo")) return "research";
  if (value.includes("restart") || value.includes("stuck") || value.includes("return") || value.includes("overwhelm")) return "restart";
  return "launch";
}

function renderRitualList(target, items) {
  target.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
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

const mirrorIntent = document.querySelector("#mirror-intent");
const mirrorBoundary = document.querySelector("#mirror-boundary");
const mirrorRoute = document.querySelector("#mirror-route");
const mirrorTrust = document.querySelector("#mirror-trust");
const mirrorRun = document.querySelector("#mirror-run");
const mirrorCount = document.querySelector("#mirror-count");
const mirrorRouteLabel = document.querySelector("#mirror-route-label");
const mirrorGoals = document.querySelector("#mirror-goals");
const mirrorBlockers = document.querySelector("#mirror-blockers");
const mirrorMoves = document.querySelector("#mirror-moves");
const mirrorArtifact = document.querySelector("#mirror-artifact");
const mirrorGoalCount = document.querySelector("#mirror-goal-count");
const mirrorBlockerCount = document.querySelector("#mirror-blocker-count");
const mirrorMoveCount = document.querySelector("#mirror-move-count");
const mirrorReceiptId = document.querySelector("#mirror-receipt-id");
const mirrorReceiptWhy = document.querySelector("#mirror-receipt-why");
const mirrorReceiptUsed = document.querySelector("#mirror-receipt-used");
const mirrorReceiptExcluded = document.querySelector("#mirror-receipt-excluded");
const mirrorReceiptRoute = document.querySelector("#mirror-receipt-route");
const mirrorReceiptMemory = document.querySelector("#mirror-receipt-memory");
const mirrorPacketState = document.querySelector("#mirror-packet-state");
const mirrorPacketTask = document.querySelector("#mirror-packet-task");
const mirrorPacketScope = document.querySelector("#mirror-packet-scope");
const mirrorPacketUsed = document.querySelector("#mirror-packet-used");
const mirrorPacketExcluded = document.querySelector("#mirror-packet-excluded");
const mirrorPacketRoute = document.querySelector("#mirror-packet-route");
const mirrorPacketBoundary = document.querySelector("#mirror-packet-boundary");
const mirrorApprove = document.querySelector("#mirror-approve");
const mirrorForceLocal = document.querySelector("#mirror-force-local");
const mirrorCancel = document.querySelector("#mirror-cancel");
const mirrorMemoryState = document.querySelector("#mirror-memory-state");
const mirrorMemoryButtons = Array.from(document.querySelectorAll("[data-memory-decision]"));
const mirrorVaultState = document.querySelector("#mirror-vault-state");
const mirrorVaultSummary = document.querySelector("#mirror-vault-summary");
const mirrorVaultHead = document.querySelector("#mirror-vault-head");
const mirrorAudit = document.querySelector(".workspace-audit");
const mirrorAuditState = document.querySelector("#mirror-audit-state");
const mirrorAuditKnown = document.querySelector("#mirror-audit-known");
const mirrorAuditUncertain = document.querySelector("#mirror-audit-uncertain");
const mirrorAuditExcluded = document.querySelector("#mirror-audit-excluded");
const mirrorAuditCanonical = document.querySelector("#mirror-audit-canonical");
const mirrorAuditKnownCount = document.querySelector("#mirror-audit-known-count");
const mirrorAuditUncertainCount = document.querySelector("#mirror-audit-uncertain-count");
const mirrorAuditExcludedCount = document.querySelector("#mirror-audit-excluded-count");
const mirrorAuditCanonicalCount = document.querySelector("#mirror-audit-canonical-count");

const workspaceRoutes = {
  reflection: {
    label: "reflection / GPT",
    route: "GPT is the reflective reasoning route for judgment, prioritization, and structured next moves.",
    goals: ["Name the real objective", "Separate signal from noise", "Create one momentum path"],
    blockers: ["Too much context at once", "Unclear priority order", "No accepted memory decision"],
    moves: ["Extract the strongest intent", "Pick one proof artifact", "Write the next-action board", "Approve or reject memory"],
    artifact: ["Reflection board", "Objective, blockers, next moves, and receipt."],
    why: "The turn asks for judgment and momentum, so the reflection route is the strongest fit.",
  },
  chat: {
    label: "chat critique / Claude",
    route: "Claude is the chat, critique, rewrite, and receipt-review route for sharpening language and structure.",
    goals: ["Clarify the message", "Tighten the structure", "Expose weak assumptions"],
    blockers: ["Copy may overclaim", "Tone can drift", "The useful objection is hidden"],
    moves: ["Rewrite the core claim", "List objections", "Cut unsupported language", "Produce a cleaner artifact"],
    artifact: ["Critique memo", "Sharper copy, objections, and suggested rewrite."],
    why: "The turn needs language critique and structure more than raw prediction.",
  },
  media: {
    label: "media / Gemini",
    route: "Gemini is the media and multimodal route for images, video, screenshots, and visual asset planning.",
    goals: ["Define the visual output", "Protect private context", "Create a media brief"],
    blockers: ["Visual direction is vague", "Source material may be sensitive", "Media route needs tight constraints"],
    moves: ["Choose format and aspect ratio", "Write the visual brief", "Exclude private details", "Generate or queue the asset"],
    artifact: ["Media brief", "Scene, format, constraints, and receipt."],
    why: "The turn asks for visual or multimodal work, so the media route is the correct helper lane.",
  },
};

const trustModes = {
  approved: {
    label: "Approved cloud help",
    scope: "personal/default",
    localOnly: false,
    approval: "Cloud route requires explicit approval.",
    included: "Current turn intent, selected boundary, route preference, and trust mode.",
    excluded: "Stored memory, client records, files, tabs, and personal history are not included in this demo packet.",
  },
  local: {
    label: "Local only",
    scope: "local/browser",
    localOnly: true,
    approval: "No gateway call. Browser fallback generates the viewport.",
    included: "Current turn intent and selected boundary only.",
    excluded: "All cloud routes, provider APIs, stored memory, files, tabs, and external tools.",
  },
  public: {
    label: "Public-safe",
    scope: "public/shareable",
    localOnly: false,
    approval: "Only public-safe context may leave the browser after approval.",
    included: "Current turn intent after boundary review, public-safe product framing, and route preference.",
    excluded: "Private identity details, client-confidential material, secrets, and unapproved memory.",
  },
  client: {
    label: "Client-confidential",
    scope: "client/confidential",
    localOnly: false,
    approval: "Client scope requires approval and receipt-visible exclusions.",
    included: "Current turn intent, selected boundary, client-safe task label, and route preference.",
    excluded: "Personal context, unrelated client context, raw files, credentials, and anything not approved for this client scope.",
  },
};

const memoryDecisionCopy = {
  forget: "Forgotten for continuity: this turn remains visible only in the current browser session.",
  project: "Saved for this project: future turns may use this receipt inside the same project scope.",
  preference: "Saved as preference: the boundary or working style can guide future mirrors.",
  never: "Blocked from future use: this turn is marked never-use unless you reverse it later.",
};

let mirrorTurn = 1;
let mirrorRequestId = 0;
let currentContextPacket = null;
let lastMirrorReceipt = null;
let packetPreviewTimer = 0;
let auditDecisionCount = 0;
let vaultEntryCount = 0;
let vaultChainHead = "genesis";
const auditDecisionMap = new Map();

function loadAuditDecisions() {
  try {
    const prior = JSON.parse(localStorage.getItem("activeMirrorAuditDecisions") || "[]");
    if (!Array.isArray(prior)) return;
    prior.forEach((decision) => {
      if (!decision?.text || !decision?.action || auditDecisionMap.has(decision.text)) return;
      auditDecisionMap.set(decision.text, decision.action);
    });
  } catch {
    // Audit decisions still work for the current session when storage is unavailable.
  }
}

function setVaultStatus(state, summary = "", head = vaultChainHead) {
  if (!mirrorVaultState || !mirrorVaultSummary || !mirrorVaultHead) return;
  mirrorVaultState.textContent = state;
  if (summary) mirrorVaultSummary.textContent = summary;
  mirrorVaultHead.textContent = `head: ${head === "genesis" ? "genesis" : head.slice(0, 12)}`;
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getVaultFileHandle() {
  if (!navigator.storage?.getDirectory) throw new Error("opfs_unavailable");
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle("active-mirror-vault", { create: true });
  return dir.getFileHandle("ledger.jsonl", { create: true });
}

async function readOpfsVault() {
  const fileHandle = await getVaultFileHandle();
  const file = await fileHandle.getFile();
  const text = await file.text();
  const entries = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { mode: "OPFS", entries };
}

async function writeOpfsVault(entries) {
  const fileHandle = await getVaultFileHandle();
  const writable = await fileHandle.createWritable();
  const text = entries.map((entry) => JSON.stringify(entry)).join("\n");
  await writable.write(text ? `${text}\n` : "");
  await writable.close();
}

function readFallbackVault() {
  const entries = JSON.parse(localStorage.getItem("activeMirrorVaultLedger") || "[]");
  return { mode: "localStorage", entries: Array.isArray(entries) ? entries : [] };
}

function writeFallbackVault(entries) {
  localStorage.setItem("activeMirrorVaultLedger", JSON.stringify(entries.slice(-100)));
}

async function readBrowserVault() {
  try {
    return await readOpfsVault();
  } catch {
    return readFallbackVault();
  }
}

async function writeBrowserVault(mode, entries) {
  if (mode === "OPFS") {
    try {
      await writeOpfsVault(entries);
      return "OPFS";
    } catch {
      writeFallbackVault(entries);
      return "localStorage";
    }
  }
  writeFallbackVault(entries);
  return "localStorage";
}

async function initializeBrowserVault() {
  if (!mirrorVaultState) return;
  setVaultStatus("Checking", "Requesting browser-owned storage for receipts.");
  const persisted = navigator.storage?.persist ? await navigator.storage.persist().catch(() => false) : false;
  const { mode, entries } = await readBrowserVault();
  const latest = entries.at(-1);
  vaultEntryCount = entries.length;
  vaultChainHead = latest?.hash || "genesis";
  setVaultStatus(
    mode === "OPFS" ? "Vault ready" : "Vault fallback",
    `${vaultEntryCount} ledger ${vaultEntryCount === 1 ? "entry" : "entries"} in ${mode}${persisted ? "; persistent storage granted" : ""}.`,
  );
}

async function persistVaultEntry(type, payload = {}) {
  if (!mirrorVaultState) return null;
  setVaultStatus("Vault writing", "Appending a receipt-linked ledger entry.");
  const { mode, entries } = await readBrowserVault();
  const previous = entries.at(-1)?.hash || "genesis";
  const entryBody = {
    schema: "active-mirror-vault-ledger-v1",
    type,
    at: new Date().toISOString(),
    receipt_id: mirrorReceiptId?.textContent || "local-receipt",
    prev_hash: previous,
    payload,
  };
  const hash = await sha256Text(JSON.stringify(entryBody));
  const entry = { ...entryBody, hash };
  entries.push(entry);
  const storedMode = await writeBrowserVault(mode, entries);
  vaultEntryCount = entries.length;
  vaultChainHead = hash;
  setVaultStatus(
    "Vault saved",
    `${vaultEntryCount} ledger ${vaultEntryCount === 1 ? "entry" : "entries"} in ${storedMode}. Latest: ${type.replace(/_/g, " ")}.`,
    hash,
  );
  return entry;
}

function inferWorkspaceRoute(intent, selected) {
  if (selected && selected !== "auto") return selected;
  const value = intent.toLowerCase();
  if (/\b(image|video|visual|poster|screenshot|render|media|asset|thumbnail)\b/.test(value)) return "media";
  if (/\b(chat|copy|rewrite|critique|polish|tone|message|wording)\b/.test(value)) return "chat";
  return "reflection";
}

function providerLabel(route) {
  if (!route) return "";
  const model = route.model ? ` / ${route.model}` : "";
  const fallback = route.fallback ? " / fallback" : "";
  return `${route.capability} / ${route.primary}${model}${fallback}`;
}

function currentTrustMode() {
  return trustModes[mirrorTrust?.value] || trustModes.approved;
}

function boundaryLabel(value) {
  const option = Array.from(mirrorBoundary?.options || []).find((item) => item.value === value);
  return option?.textContent?.trim() || "Selected boundary";
}

function routeTargetLabel(routeKey) {
  const route = workspaceRoutes[routeKey] || workspaceRoutes.reflection;
  return route.label;
}

function estimateTokens(text) {
  return Math.max(180, Math.ceil(String(text || "").length / 4) + 320);
}

function buildContextPacket({ forceLocal = false } = {}) {
  const intent = mirrorIntent?.value.replace(/\s+/g, " ").trim() || "";
  const selectedRoute = inferWorkspaceRoute(intent, mirrorRoute?.value || "auto");
  const selectedBoundary = mirrorBoundary?.value || "personal";
  const selectedTrust = forceLocal ? trustModes.local : currentTrustMode();
  const boundary = boundaryCopy[selectedBoundary] || boundaryCopy.personal;
  const riskLevel = selectedBoundary === "secrets" || selectedTrust === trustModes.client ? "high" : selectedTrust.localOnly ? "low" : "medium";

  return {
    context_packet_id: `ctx_${Date.now()}_${String(mirrorTurn).padStart(3, "0")}`,
    task: shortIntent(intent || "No intent entered yet"),
    scope: selectedTrust.scope,
    model_target: selectedTrust.localOnly ? "local/browser" : routeTargetLabel(selectedRoute),
    memory_items_used: ["intent_current_turn", `boundary_${selectedBoundary}`, `trust_${mirrorTrust?.value || "approved"}`],
    excluded_memory_items: [
      { id: "stored_memory", reason: "not admitted for this demo turn" },
      { id: "private_files", reason: "not attached or approved" },
      { id: "external_tools", reason: "not requested for this viewport" },
    ],
    tools_requested: selectedTrust.localOnly ? ["browser_fallback"] : ["active_mirror_gateway"],
    risk_level: riskLevel,
    approval_required: !selectedTrust.localOnly,
    token_estimate: estimateTokens(intent),
    local_only: selectedTrust.localOnly,
    route_key: selectedRoute,
    boundary_key: selectedBoundary,
    boundary_label: boundaryLabel(selectedBoundary),
    trust_label: selectedTrust.label,
    included_text: selectedTrust.included,
    excluded_text: `${boundary.excluded} ${selectedTrust.excluded}`,
    approval_text: selectedTrust.approval,
    approved: false,
  };
}

function renderContextPacket(packet = currentContextPacket) {
  if (!packet || !mirrorPacketState) return;

  mirrorPacketState.textContent = packet.local_only ? "Local-only ready" : packet.approved ? "Approved" : "Needs approval";
  mirrorPacketTask.textContent = packet.task;
  mirrorPacketScope.textContent = `${packet.scope} / ${packet.trust_label}`;
  mirrorPacketUsed.textContent = `${packet.included_text} Estimated ${packet.token_estimate} tokens.`;
  mirrorPacketExcluded.textContent = packet.excluded_text;
  mirrorPacketRoute.textContent = `${packet.model_target}. ${packet.approval_text}`;
  mirrorPacketBoundary.textContent = packet.boundary_label;

  if (mirrorApprove) {
    mirrorApprove.disabled = false;
    mirrorApprove.textContent = packet.local_only ? "Generate locally" : packet.approved ? "Approved" : "Approve route";
  }
  if (mirrorRun && !mirrorRun.disabled) {
    mirrorRun.textContent = packet.local_only ? "Generate local mirror" : packet.approved ? "Generate viewport" : "Preview context packet";
    mirrorRun.classList.toggle("is-complete", Boolean(packet.local_only || packet.approved));
  }
}

function previewContextPacket({ forceLocal = false } = {}) {
  currentContextPacket = buildContextPacket({ forceLocal });
  renderContextPacket(currentContextPacket);
  mirrorRun.textContent = "Packet ready";
  mirrorRun.classList.add("is-complete");
  window.clearTimeout(packetPreviewTimer);
  packetPreviewTimer = window.setTimeout(() => {
    mirrorRun.textContent = "Preview context packet";
    mirrorRun.classList.remove("is-complete");
  }, 1100);
  animateElements(Array.from(document.querySelectorAll(".workspace-packet .packet-grid > div, .packet-actions > *")), {
    y: 8,
    duration: 0.32,
  });
}

function routeTruthText(remotePayload, routeKey, packet) {
  if (packet?.local_only) {
    return "Local-only mode: no gateway call was made. Browser deterministic fallback generated this viewport.";
  }
  if (remotePayload?.route) {
    const label = providerLabel(remotePayload.route);
    const fallback = remotePayload.fallback
      ? " Provider fallback was used and is recorded in this receipt."
      : " Gateway route completed without fallback.";
    return `${label}.${fallback}`;
  }
  if (packet?.approval_required && !packet.approved) {
    return "Packet preview only: no gateway call yet. Approve the scoped packet to route through the gateway.";
  }
  const route = workspaceRoutes[routeKey] || workspaceRoutes.reflection;
  return `${route.route} Gateway unavailable, blocked by origin policy, or provider fallback unavailable; local browser fallback used.`;
}

function captureReceiptSnapshot(packet, routeText) {
  lastMirrorReceipt = {
    receipt_id: mirrorReceiptId?.textContent || "local-receipt",
    intent: mirrorIntent?.value || "",
    packet,
    why: mirrorReceiptWhy?.textContent || "",
    context_used: mirrorReceiptUsed?.textContent || "",
    context_excluded: mirrorReceiptExcluded?.textContent || "",
    route: routeText || mirrorReceiptRoute?.textContent || "",
    memory_decision: mirrorReceiptMemory?.textContent || "",
    exported_at: new Date().toISOString(),
  };
}

function getListText(target) {
  return Array.from(target?.querySelectorAll("li") || [])
    .map((item) => item.textContent.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function getArtifactText() {
  const title = mirrorArtifact?.querySelector("p")?.textContent?.trim();
  const summary = mirrorArtifact?.querySelector("strong")?.textContent?.trim();
  return [title, summary].filter(Boolean).join(": ");
}

function uniqueList(items) {
  return Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean)));
}

function auditActionLabel(action) {
  return {
    verify: "Verify",
    forget: "Forget",
    unknown: "Mark unknown",
    keep_out: "Keep out",
    review: "Review",
    promote: "Promote",
    skip: "Skip",
  }[action] || "Mark";
}

function renderAuditList(target, countTarget, items, actions) {
  if (!target || !countTarget) return;
  const list = uniqueList(items).slice(0, 5);
  countTarget.textContent = String(list.length);
  target.innerHTML = list
    .map((item, index) => {
      const decision = auditDecisionMap.get(item);
      const actionButtons = actions
        .map(
          (action) =>
            `<button type="button" data-audit-action="${action}" data-audit-index="${index}">${auditActionLabel(action)}</button>`
        )
        .join("");
      const decisionBadge = decision ? `<small class="audit-decision-badge">${auditActionLabel(decision)} recorded</small>` : "";
      return `<li${decision ? ` data-audit-decision="${escapeHtml(decision)}"` : ""}><span>${escapeHtml(item)}</span>${decisionBadge}<div class="audit-item-actions">${actionButtons}</div></li>`;
    })
    .join("");
}

function renderMirrorAudit(packet = currentContextPacket) {
  if (!mirrorAudit || !mirrorAuditState) return;

  const activePacket = packet || buildContextPacket();
  const goals = getListText(mirrorGoals);
  const moves = getListText(mirrorMoves);
  const artifact = getArtifactText();
  const trust = activePacket.trust_label || currentTrustMode().label;
  const routeTarget = activePacket.model_target || routeTargetLabel(activePacket.route_key || "reflection");
  const receiptState = mirrorReceiptId?.textContent?.startsWith("edge-")
    ? "Edge receipt"
    : activePacket.local_only || activePacket.approved
      ? "Local receipt"
      : "Draft audit";

  const known = [
    `Intent: ${activePacket.task}`,
    `Boundary: ${activePacket.boundary_label}`,
    `Trust mode: ${trust}`,
    `Route target: ${routeTarget}`,
  ];

  const uncertain = [
    "No durable vault entries are loaded in this browser demo.",
    "No files, tabs, emails, or prior chats were admitted for this turn.",
    "Generated output is not canonical until a receipt is promoted.",
    activePacket.approval_required && !activePacket.approved ? "Gateway route has not been approved yet." : "",
  ];

  const excluded = [
    ...(activePacket.excluded_memory_items || []).map((item) => `${item.id}: ${item.reason}`),
    activePacket.excluded_text,
  ];

  const canonical = [
    goals[0] ? `Goal candidate: ${goals[0]}` : "",
    moves[0] ? `Next-move candidate: ${moves[0]}` : "",
    artifact ? `Artifact candidate: ${artifact}` : "",
    `Boundary preference: ${activePacket.boundary_label}`,
  ];

  mirrorAuditState.textContent = mirrorMemoryState?.textContent && mirrorMemoryState.textContent !== "Pending" ? "Memory reviewed" : receiptState;
  renderAuditList(mirrorAuditKnown, mirrorAuditKnownCount, known, ["verify", "forget"]);
  renderAuditList(mirrorAuditUncertain, mirrorAuditUncertainCount, uncertain, ["unknown", "verify"]);
  renderAuditList(mirrorAuditExcluded, mirrorAuditExcludedCount, excluded, ["keep_out", "review"]);
  renderAuditList(mirrorAuditCanonical, mirrorAuditCanonicalCount, canonical, ["promote", "skip"]);
}

function normalizedList(value, fallback, size) {
  const list = Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
  return [...list, ...fallback].slice(0, size);
}

function renderWorkspaceMirror(remotePayload = null, packet = currentContextPacket) {
  if (!mirrorIntent || !mirrorGoals || !mirrorBlockers || !mirrorMoves) return;

  const intent = mirrorIntent.value.replace(/\s+/g, " ").trim();
  const routeKey = packet?.route_key || inferWorkspaceRoute(intent, mirrorRoute?.value || "auto");
  const route = workspaceRoutes[routeKey];
  const boundary = boundaryCopy[mirrorBoundary?.value] || boundaryCopy.personal;
  const mirror = remotePayload?.mirror && typeof remotePayload.mirror === "object" ? remotePayload.mirror : null;
  const goals = normalizedList(mirror?.goals, route.goals, 3);
  const blockers = normalizedList(mirror?.blockers, route.blockers, 3);
  const moves = normalizedList(mirror?.moves, route.moves, 4);
  const artifactTitle = String(mirror?.artifact?.title || route.artifact[0]);
  const artifactSummary = String(mirror?.artifact?.summary || route.artifact[1]);
  const receipt = mirror?.receipt || {};

  mirrorCount.textContent = `${mirrorIntent.value.length} / 1000`;
  const routeTruth = routeTruthText(remotePayload, routeKey, packet);
  mirrorRouteLabel.textContent = packet?.local_only ? "local / browser fallback" : remotePayload?.route ? providerLabel(remotePayload.route) : route.label;
  renderRitualList(mirrorGoals, goals);
  renderRitualList(mirrorBlockers, blockers);
  renderRitualList(mirrorMoves, moves);
  mirrorGoalCount.textContent = String(goals.length);
  mirrorBlockerCount.textContent = String(blockers.length);
  mirrorMoveCount.textContent = String(moves.length);
  mirrorArtifact.innerHTML = `<p>${escapeHtml(artifactTitle)}</p><strong>${escapeHtml(artifactSummary)}</strong>`;
  mirrorReceiptId.textContent = remotePayload?.receipt_id ? `edge-${remotePayload.receipt_id}` : `local-${routeKey}-${String(mirrorTurn).padStart(3, "0")}`;
  mirrorReceiptWhy.textContent = receipt.why || route.why;
  mirrorReceiptUsed.textContent = receipt.context_used || packet?.included_text || `Intent: "${shortIntent(intent || "No intent yet")}" plus selected boundary and route.`;
  mirrorReceiptExcluded.textContent = receipt.context_excluded || packet?.excluded_text || boundary.excluded;
  mirrorReceiptRoute.textContent = receipt.route ? `${receipt.route} ${routeTruth}` : routeTruth;
  mirrorReceiptMemory.textContent = receipt.memory_decision || "Pending: nothing saved until you choose a memory decision.";
  if (mirrorMemoryState) mirrorMemoryState.textContent = "Pending";
  captureReceiptSnapshot(packet, mirrorReceiptRoute.textContent);
  renderMirrorAudit(packet);

  try {
    localStorage.setItem(
      "activeMirrorWorkspaceDemo",
      JSON.stringify({
        intent: mirrorIntent.value,
        boundary: mirrorBoundary?.value,
        route: mirrorRoute?.value,
        trust: mirrorTrust?.value,
        turn: mirrorTurn,
      })
    );
  } catch {
    // The workspace demo remains usable without local persistence.
  }
}

async function generateWorkspaceMirror() {
  const intent = mirrorIntent.value.replace(/\s+/g, " ").trim();
  if (intent.length < 12) {
    mirrorReceiptWhy.textContent = "Add a little more intent before routing to the mirror.";
    return;
  }

  if (!currentContextPacket) {
    previewContextPacket();
    return;
  }

  if (currentContextPacket.approval_required && !currentContextPacket.approved) {
    renderContextPacket(currentContextPacket);
    mirrorPacketState.textContent = "Approval required";
    return;
  }

  mirrorTurn += 1;
  const requestId = (mirrorRequestId += 1);
  window.clearTimeout(packetPreviewTimer);
  mirrorRun.disabled = true;
  mirrorRun.textContent = currentContextPacket.local_only ? "Generating locally..." : "Generating at gateway...";
  mirrorRun.classList.remove("is-complete");

  if (currentContextPacket.local_only) {
    renderWorkspaceMirror(null, currentContextPacket);
    mirrorRun.disabled = false;
    mirrorRun.textContent = "Local viewport generated";
    mirrorRun.classList.add("is-complete");
    animateElements(Array.from(document.querySelectorAll(".workspace-column, .workspace-receipt, .workspace-memory")), {
      y: 10,
      duration: 0.38,
    });
    window.setTimeout(() => {
      mirrorRun.textContent = "Generate local mirror";
      mirrorRun.classList.remove("is-complete");
    }, 1600);
    return;
  }

  let gatewayTimeout = 0;
  try {
    const controller = new AbortController();
    gatewayTimeout = window.setTimeout(() => controller.abort(), 18000);
    const response = await fetch(`${MIRROR_GATEWAY_URL}/v1/mirror/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        intent,
        boundary: mirrorBoundary?.value || "personal",
        route: mirrorRoute?.value || "auto",
        turn: mirrorTurn,
        trust_mode: mirrorTrust?.value || "approved",
        context_packet: currentContextPacket,
      }),
    });
    window.clearTimeout(gatewayTimeout);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "gateway_unavailable");
    }
    if (requestId !== mirrorRequestId) return;

    renderWorkspaceMirror(payload, currentContextPacket);
    mirrorRun.textContent = payload.fallback ? "Fallback viewport" : "Viewport generated";
    mirrorRun.classList.add("is-complete");
  } catch (error) {
    window.clearTimeout(gatewayTimeout);
    if (requestId !== mirrorRequestId) return;
    renderWorkspaceMirror(null, currentContextPacket);
    mirrorRun.textContent = "Local fallback generated";
    mirrorRun.classList.add("is-complete");
  } finally {
    mirrorRun.disabled = false;
    animateElements(Array.from(document.querySelectorAll(".workspace-column, .workspace-receipt, .workspace-memory")), {
      y: 10,
      duration: 0.38,
    });
    window.setTimeout(() => {
      mirrorRun.textContent = "Preview context packet";
      mirrorRun.classList.remove("is-complete");
    }, 1600);
  }
}

function setMemoryDecision(decision) {
  if (!mirrorReceiptMemory || !mirrorMemoryState) return;
  if (decision === "export") {
    const payload = lastMirrorReceipt || {
      receipt_id: mirrorReceiptId?.textContent || "local-receipt",
      intent: mirrorIntent?.value || "",
      packet: currentContextPacket,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${payload.receipt_id || "active-mirror-receipt"}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    mirrorMemoryState.textContent = "Exported";
    renderMirrorAudit(currentContextPacket);
    return;
  }

  const copy = memoryDecisionCopy[decision] || "Pending: nothing saved until you choose a memory decision.";
  mirrorReceiptMemory.textContent = copy;
  mirrorMemoryState.textContent =
    decision === "forget" ? "Forgotten" : decision === "never" ? "Blocked" : decision === "project" ? "Project memory" : "Preference";
  captureReceiptSnapshot(currentContextPacket, mirrorReceiptRoute?.textContent || "");
  renderMirrorAudit(currentContextPacket);

  try {
    const prior = JSON.parse(localStorage.getItem("activeMirrorMemoryDecisions") || "[]");
    prior.unshift({
      decision,
      receipt_id: mirrorReceiptId?.textContent || "local-receipt",
      at: new Date().toISOString(),
      intent: shortIntent(mirrorIntent?.value || ""),
    });
    localStorage.setItem("activeMirrorMemoryDecisions", JSON.stringify(prior.slice(0, 12)));
  } catch {
    // Memory decisions are visible in the receipt even if browser storage is blocked.
  }

  persistVaultEntry("memory_decision", {
    decision,
    boundary: currentContextPacket?.boundary_label || boundaryLabel(mirrorBoundary?.value || "personal"),
    route: mirrorRouteLabel?.textContent || routeTargetLabel(currentContextPacket?.route_key || "reflection"),
    intent: decision === "forget" ? null : shortIntent(mirrorIntent?.value || ""),
    receipt: decision === "forget" ? null : lastMirrorReceipt,
  }).catch(() => setVaultStatus("Vault blocked", "Browser storage rejected this memory decision."));
}

if (mirrorIntent && mirrorBoundary && mirrorRoute && mirrorRun) {
  try {
    const savedWorkspace = JSON.parse(localStorage.getItem("activeMirrorWorkspaceDemo") || "null");
    if (savedWorkspace?.intent) mirrorIntent.value = savedWorkspace.intent;
    if (savedWorkspace?.boundary && boundaryCopy[savedWorkspace.boundary]) mirrorBoundary.value = savedWorkspace.boundary;
    if (savedWorkspace?.route && (savedWorkspace.route === "auto" || workspaceRoutes[savedWorkspace.route])) {
      mirrorRoute.value = savedWorkspace.route;
    }
    if (savedWorkspace?.trust && trustModes[savedWorkspace.trust] && mirrorTrust) mirrorTrust.value = savedWorkspace.trust;
    if (Number.isFinite(savedWorkspace?.turn)) mirrorTurn = savedWorkspace.turn;
  } catch {
    localStorage.removeItem("activeMirrorWorkspaceDemo");
  }

  const refreshWorkspaceDraft = () => {
    currentContextPacket = buildContextPacket();
    renderContextPacket(currentContextPacket);
    renderWorkspaceMirror(null, currentContextPacket);
  };

  mirrorIntent.addEventListener("input", refreshWorkspaceDraft);
  mirrorBoundary.addEventListener("change", refreshWorkspaceDraft);
  mirrorRoute.addEventListener("change", refreshWorkspaceDraft);
  mirrorTrust?.addEventListener("change", refreshWorkspaceDraft);
  mirrorRun.addEventListener("click", () => {
    const packet = buildContextPacket();
    if (packet.local_only) {
      currentContextPacket = packet;
      renderContextPacket(currentContextPacket);
      generateWorkspaceMirror();
      return;
    }
    previewContextPacket();
  });
  mirrorApprove?.addEventListener("click", () => {
    if (!currentContextPacket) currentContextPacket = buildContextPacket();
    currentContextPacket.approved = true;
    renderContextPacket(currentContextPacket);
    generateWorkspaceMirror();
  });
  mirrorForceLocal?.addEventListener("click", () => {
    if (mirrorTrust) mirrorTrust.value = "local";
    currentContextPacket = buildContextPacket({ forceLocal: true });
    currentContextPacket.approved = true;
    renderContextPacket(currentContextPacket);
    generateWorkspaceMirror();
  });
  mirrorCancel?.addEventListener("click", () => {
    currentContextPacket = buildContextPacket();
    renderContextPacket(currentContextPacket);
    mirrorPacketState.textContent = "Canceled";
  });
  mirrorMemoryButtons.forEach((button) => {
    button.addEventListener("click", () => setMemoryDecision(button.dataset.memoryDecision));
  });
  loadAuditDecisions();
  initializeBrowserVault().catch(() => setVaultStatus("Vault fallback", "Browser vault will use local session storage only."));
  mirrorAudit?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-audit-action]");
    if (!button) return;
    const action = button.dataset.auditAction;
    const item = button.closest("li");
    const itemText = item?.querySelector("span")?.textContent || "";
    const bucket = item?.closest(".audit-bucket")?.querySelector("strong")?.textContent || "Audit";
    auditDecisionCount += 1;
    if (itemText) auditDecisionMap.set(itemText, action);
    item?.setAttribute("data-audit-decision", action);
    if (!item?.querySelector(".audit-decision-badge")) {
      const badge = document.createElement("small");
      badge.className = "audit-decision-badge";
      badge.textContent = `${auditActionLabel(action)} recorded`;
      item?.querySelector("span")?.after(badge);
    } else {
      item.querySelector(".audit-decision-badge").textContent = `${auditActionLabel(action)} recorded`;
    }
    button.textContent = action === "promote" ? "Promoted" : action === "keep_out" ? "Kept out" : "Marked";
    mirrorAuditState.textContent = `Audit edits ${auditDecisionCount}`;
    try {
      const prior = JSON.parse(localStorage.getItem("activeMirrorAuditDecisions") || "[]");
      prior.unshift({
        action,
        text: itemText,
        receipt_id: mirrorReceiptId?.textContent || "local-receipt",
        at: new Date().toISOString(),
      });
      localStorage.setItem("activeMirrorAuditDecisions", JSON.stringify(prior.slice(0, 20)));
    } catch {
      // Audit decisions remain visible in-session even when storage is unavailable.
    }
    persistVaultEntry("audit_decision", {
      action,
      bucket,
      text: itemText,
      boundary: currentContextPacket?.boundary_label || boundaryLabel(mirrorBoundary?.value || "personal"),
      route: mirrorRouteLabel?.textContent || routeTargetLabel(currentContextPacket?.route_key || "reflection"),
    }).catch(() => setVaultStatus("Vault blocked", "Browser storage rejected this audit decision."));
  });

  refreshWorkspaceDraft();
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
