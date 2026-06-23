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
    nextMove: "Build the next lesson path",
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
    viewportType: "Momentum map",
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
    viewportType: "Restart path",
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
    viewportType: "Source synthesis",
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
    viewportType: "Offer map",
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
const openGeneratedMirror = document.querySelector("#open-generated-mirror");
const homeModelMode = document.querySelector("#home-model-mode");
const homeWorkControls = Array.from(document.querySelectorAll(".home-work-lane, .arch-node"));
const homeSurfaceTitle = document.querySelector("#home-surface-title");
const homeSurfaceType = document.querySelector("#home-surface-type");
const homeSurfaceOutput = document.querySelector("#home-surface-output");
const homeSurfaceTabs = Array.from(document.querySelectorAll("[data-surface-tab]"));
const homeContextCopy = document.querySelector("#home-context-copy");
const homeRouteTitle = document.querySelector("#home-route-title");
const homeRouteCopy = document.querySelector("#home-route-copy");
const homeOutputTitle = document.querySelector("#home-output-title");
const homeOutputCopy = document.querySelector("#home-output-copy");
const homeStateMode = document.querySelector("#home-state-mode");
const homeStateRoute = document.querySelector("#home-state-route");
const homeStateBoundary = document.querySelector("#home-state-boundary");
const homeStateReceipt = document.querySelector("#home-state-receipt");
const homeChatSummary = document.querySelector("#home-chat-summary");
const homeChatNext = document.querySelector("#home-chat-next");
const homeChatBoundary = document.querySelector("#home-chat-boundary");
const homeFollowups = document.querySelector("#home-followups");

let currentHomeLane = "decision";
let homeRemotePayload = null;
let homeRequestId = 0;

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
    route: "Browser reflection first. Extra help can join only after a boundary check.",
    memory: "No personal context is promoted until the receipt is accepted.",
  },
  client: {
    excluded: "Client names, partner details, commercial terms, and confidential screenshots are masked.",
    route: "Local synthesis first. Exportable copy is separated from private source material.",
    memory: "Only public-safe project learning can be promoted.",
  },
  secrets: {
    excluded: "Keys, tokens, credentials, private URLs, and operational secrets are blocked from sharing.",
    route: "Secret-bearing work stays local. Extra help only receives a redacted task.",
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
    moves: ["Sort open loops without judging them", "Retire stale threads", "Choose a 48-hour win", "Save the momentum receipt"],
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

function initMagneticControls() {
  if (!canAnimate || !window.matchMedia("(pointer: fine)").matches) return;
  const controls = Array.from(document.querySelectorAll(".button, .scenario-button, .card-link, .tool-button"));
  controls.forEach((control) => {
    control.addEventListener("pointermove", (event) => {
      const rect = control.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) * 0.12;
      const y = (event.clientY - rect.top - rect.height / 2) * 0.16;
      gsap.to(control, { x, y, duration: 0.35, ease: "power3.out" });
    });
    control.addEventListener("pointerleave", () => {
      gsap.to(control, { x: 0, y: 0, duration: 0.55, ease: "elastic.out(1, 0.55)" });
    });
  });
}

function initHeroParallax() {
  if (!canAnimate || !window.matchMedia("(pointer: fine)").matches) return;
  const hero = document.querySelector(".ritual-hero") || document.querySelector(".genui-workspace");
  const stage = document.querySelector(".ritual-stage") || document.querySelector(".genui-stage");
  const receipt = document.querySelector(".receipt-pack") || document.querySelector(".ritual-receipt");
  if (!hero || !stage) return;

  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    const x = event.clientX / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    gsap.to(stage, { x: x * 12, y: y * 10, duration: 0.8, ease: "power3.out" });
    if (receipt) gsap.to(receipt, { x: x * -8, y: y * -5, rotate: x * -0.7, duration: 0.8, ease: "power3.out" });
  });
  hero.addEventListener("pointerleave", () => {
    gsap.to([stage, receipt].filter(Boolean), { x: 0, y: 0, rotate: 0, duration: 0.7, ease: "power3.out" });
  });
}

function initScrollReveals() {
  if (!canAnimate) return;
  const revealTargets = Array.from(
    document.querySelectorAll(".receipt-line, .route-card, .airlock-stack > div, .image-frame, .linked-card")
  );
  if (!revealTargets.length) return;

  const revealObserver = new IntersectionObserver(
    (entries, localObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.target.dataset.revealed) return;
        entry.target.dataset.revealed = "true";
        gsap.fromTo(
          entry.target,
          { autoAlpha: 0, y: 18, filter: "blur(8px)" },
          { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.62, ease: "power3.out" }
        );
        localObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
  );

  revealTargets.forEach((target) => revealObserver.observe(target));
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
  if (!target) return;
  target.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function inferHomeSurface(text) {
  const value = text.toLowerCase();
  if (/\b(file|files|folder|upload|table|spreadsheet|excel|csv|rows|data|compare|comparison|tracker)\b/.test(value)) return "table";
  if (/\b(image|video|visual|media|poster|screenshot|deck|slide|asset)\b/.test(value)) return "media";
  if (/\b(web|website|browser|online|research|source|competitor|link|url)\b/.test(value)) return "browser";
  if (/\b(doc|document|word|pdf|memo|brief|summary|write|draft|note)\b/.test(value)) return "document";
  return "plan";
}

function inferHomeLane(text, surfaceKey = inferHomeSurface(text)) {
  const value = text.toLowerCase();
  if (/\b(memory|remember|saved|continuity|receipt|tomorrow)\b/.test(value)) return "memory";
  if (surfaceKey === "table") return "files";
  if (surfaceKey === "media") return "images";
  if (surfaceKey === "browser") return "research";
  return "decision";
}

function homeLaneCopy(laneKey = currentHomeLane) {
  const lanes = {
    decision: {
      mode: "Decision",
      route: "Browser first",
      boundary: "Private",
      receipt: "Ready",
      output: "Plan",
      outputCopy: "A useful next step, not a long answer.",
    },
    files: {
      mode: "Files",
      route: "Local first",
      boundary: "Scoped",
      receipt: "Tracked",
      output: "File plan",
      outputCopy: "Inputs stay local until you approve sharing.",
    },
    images: {
      mode: "Visual",
      route: "Media after approval",
      boundary: "Public-safe",
      receipt: "Tracked",
      output: "Visual brief",
      outputCopy: "Approved context becomes a usable creative brief.",
    },
    research: {
      mode: "Research",
      route: "Web after approval",
      boundary: "Redacted",
      receipt: "Sources",
      output: "Source plan",
      outputCopy: "Evidence is separated from private context.",
    },
    memory: {
      mode: "Memory",
      route: "Browser ledger",
      boundary: "Explicit",
      receipt: "Pending",
      output: "Continuity note",
      outputCopy: "Nothing is saved until you accept the receipt.",
    },
  };
  return lanes[laneKey] || lanes.decision;
}

function homeHelpMode() {
  const value = homeModelMode?.value || "local";
  return ["local", "reflection", "media"].includes(value) ? value : "local";
}

function homeRouteFromMode(laneKey = currentHomeLane) {
  const mode = homeHelpMode();
  if (mode !== "local") return mode;
  if (laneKey === "images") return "media";
  return "reflection";
}

function homeHelpLabel(mode = homeHelpMode()) {
  return {
    local: "Browser first",
    reflection: "Deep reflection",
    chat: "Critique",
    media: "Visual creation",
  }[mode] || "Browser first";
}

function homeProviderLabel(route) {
  if (!route) return homeHelpLabel();
  const fallback = route.fallback ? " / backup" : "";
  return `${homeHelpLabel(route.capability)}${fallback}`;
}

function setActiveHomeLane(laneKey = currentHomeLane) {
  currentHomeLane = laneKey;
  homeWorkControls.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.workLane === currentHomeLane);
  });
  if (canAnimate) {
    const activeControls = homeWorkControls.filter((button) => button.dataset.workLane === currentHomeLane);
    if (activeControls.length) {
      gsap.fromTo(activeControls, { scale: 0.992 }, { scale: 1, duration: 0.28, ease: "power2.out" });
    }
  }
}

function setOpenWorkspaceHref() {
  if (!openGeneratedMirror || !ritualIntent || !ritualBoundary) return;
  openGeneratedMirror.href = "#first-use";
}

function animateHomeReflection() {
  if (!canAnimate) return;
  const stage = document.querySelector(".genui-stage");
  const surface = document.querySelector(".home-surface");
  const receipt = document.querySelector(".receipt-card");
  const highlighted = [surface, receipt].filter(Boolean);

  stage?.classList.add("is-reflecting");
  highlighted.forEach((element) => element.classList.add("is-updated"));

  gsap.fromTo(
    highlighted,
    { y: 14, scale: 0.99, filter: "saturate(0.92)" },
    { y: 0, scale: 1, filter: "saturate(1.04)", duration: 0.62, stagger: 0.06, ease: "power3.out" }
  );
  gsap.fromTo(
    ".surface-output > article",
    { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: 0.42, ease: "power3.out" }
  );
  gsap.fromTo(".receipt-line.is-open", { x: -5 }, { x: 0, duration: 0.32, ease: "power2.out" });

  window.setTimeout(() => {
    stage?.classList.remove("is-reflecting");
    highlighted.forEach((element) => element.classList.remove("is-updated"));
  }, 1400);
}

function followupOptions(modeKey, laneKey, surfaceKey) {
  if (laneKey === "files" || surfaceKey === "table") {
    return ["Turn this into a file plan", "What can stay local?", "Make the summary shorter"];
  }
  if (laneKey === "images" || surfaceKey === "media") {
    return ["Create a visual brief", "What is safe to share?", "Give me three directions"];
  }
  if (laneKey === "research" || surfaceKey === "browser") {
    return ["What should I verify?", "Find the strongest sources", "Separate facts from guesses"];
  }
  if (laneKey === "memory") {
    return ["What should be remembered?", "What should be temporary?", "Show the memory receipt"];
  }
  if (modeKey === "restart") {
    return ["Make a 48-hour path", "What should I retire?", "Choose one visible win"];
  }
  if (modeKey === "career") {
    return ["Package this as an offer", "Find the proof", "What is the next outreach?"];
  }
  return ["What should I do first?", "What should I leave out?", "Make this a proof sprint"];
}

function renderHomeConversation({ intent, mode, boundary, laneKey, surfaceKey }) {
  if (homeChatSummary) homeChatSummary.textContent = shortIntent(intent || ritualInitialIntent);
  if (homeChatNext) homeChatNext.textContent = mode.moves?.[0] || mode.why;
  if (homeChatBoundary) homeChatBoundary.textContent = `Kept out: ${boundary.excluded}`;
  if (!homeFollowups) return;
  homeFollowups.innerHTML = followupOptions(currentRitualMode(intent), laneKey, surfaceKey)
    .map((question) => `<button type="button" data-followup="${escapeHtml(question)}">${escapeHtml(question)}</button>`)
    .join("");
  homeFollowups.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.dataset.followup || button.textContent || "";
      const base = ritualIntent?.value.trim() || ritualInitialIntent;
      if (ritualIntent) ritualIntent.value = `${base}\n\nFollow-up: ${question}`;
      homeRemotePayload = null;
      renderRitual();
      markRitualGenerated(surfaceKey, laneKey);
    });
  });
}

function setHomeSurfaceTab(surfaceKey) {
  homeSurfaceTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.surfaceTab === surfaceKey);
  });
}

function activeHomeSurfaceKey() {
  return homeSurfaceTabs.find((button) => button.classList.contains("is-active"))?.dataset.surfaceTab || inferHomeSurface(ritualIntent?.value || ritualInitialIntent);
}

function activeHomeLaneKey() {
  return document.querySelector(".home-work-lane.is-active")?.dataset.workLane || currentHomeLane;
}

function runSelectedHomeReflection() {
  markRitualGenerated(activeHomeSurfaceKey(), activeHomeLaneKey());
}

function renderHomeSurface(surfaceKey = inferHomeSurface(ritualIntent?.value || ritualInitialIntent), laneOverride = null) {
  if (!homeSurfaceOutput || !ritualIntent) return;

  const intent = ritualIntent.value || ritualInitialIntent;
  const laneKey = laneOverride || inferHomeLane(intent, surfaceKey);
  if (laneKey !== currentHomeLane || !homeWorkControls.some((button) => button.classList.contains("is-active"))) {
    setActiveHomeLane(laneKey);
  }
  const lane = homeLaneCopy(laneKey);
  const mode = ritualModes[currentRitualMode(intent)];
  const mirror = homeRemotePayload?.mirror && typeof homeRemotePayload.mirror === "object" ? homeRemotePayload.mirror : null;
  const goals = normalizedList(mirror?.goals, mode.goals, 3);
  const blockers = normalizedList(mirror?.blockers, mode.blockers, 3);
  const moves = normalizedList(mirror?.moves, mode.moves, 4);
  const artifactTitle = String(mirror?.artifact?.title || mode.artifact[0]);
  const artifactSummary = String(mirror?.artifact?.summary || mode.artifact[1]);
  const receipt = mirror?.receipt || {};
  const short = shortIntent(intent);
  const helpMode = homeHelpMode();
  const routeLabel = homeRemotePayload?.route ? homeProviderLabel(homeRemotePayload.route) : helpMode === "local" ? lane.route : homeHelpLabel(helpMode);
  const receiptState = homeRemotePayload ? (homeRemotePayload.fallback ? "Backup" : "Ready") : helpMode === "local" ? lane.receipt : "Approval";
  const surfaceLabels = {
    plan: ["Plan", "Next move"],
    document: laneKey === "memory" ? ["Continuity note", "Memory"] : ["Note", "Draft"],
    table: ["File plan", "Local context"],
    browser: ["Web check", "Research"],
    media: ["Visual brief", "Creative"],
  };
  const [title, type] = surfaceLabels[surfaceKey] || surfaceLabels.plan;

  if (homeSurfaceTitle) homeSurfaceTitle.textContent = title;
  if (homeSurfaceType) homeSurfaceType.textContent = type;
  if (homeContextCopy) homeContextCopy.textContent = short;
  if (homeRouteTitle) homeRouteTitle.textContent = routeLabel;
  if (homeRouteCopy) {
    homeRouteCopy.textContent = homeRemotePayload
      ? "The receipt records the help used, fallback, and memory decision."
      : helpMode !== "local"
        ? "Only the current turn and selected boundary are shared after approval."
        : laneKey === "research"
          ? "The page prepares the question before anything leaves your browser."
          : laneKey === "images"
            ? "Media help receives only the public-safe brief you approve."
            : "Private reflection runs first. External help waits for your approval.";
  }
  if (homeOutputTitle) homeOutputTitle.textContent = lane.output;
  if (homeOutputCopy) homeOutputCopy.textContent = surfaceKey === "plan" ? moves[0] : lane.outputCopy;
  if (homeStateMode) homeStateMode.textContent = lane.mode;
  if (homeStateRoute) homeStateRoute.textContent = routeLabel;
  if (homeStateBoundary) homeStateBoundary.textContent = lane.boundary;
  if (homeStateReceipt) homeStateReceipt.textContent = receiptState;
  setOpenWorkspaceHref();
  renderHomeConversation({
    intent,
    mode,
    boundary: boundaryCopy[ritualBoundary?.value || "personal"],
    laneKey,
    surfaceKey,
  });

  const templates = {
    plan: `
      <article class="surface-plan">
        <strong>${escapeHtml(artifactTitle)}</strong>
        <p>${escapeHtml(receipt.why || mode.why)}</p>
        <ol>
          ${moves.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ol>
      </article>
    `,
    document: `
      <article class="surface-document">
        <h3>Decision note</h3>
        <p><strong>What I heard:</strong> ${escapeHtml(receipt.context_used || short)}</p>
        <p><strong>Watch for:</strong> ${escapeHtml(blockers[0])}</p>
        <p><strong>Next:</strong> ${escapeHtml(moves[0])}</p>
      </article>
    `,
    table: `
      <article class="surface-files">
        <label class="surface-upload">
          <span>Choose local files</span>
          <input data-local-picker type="file" multiple />
        </label>
        <p data-file-state>Nothing is uploaded. Selection stays in this browser.</p>
        <table class="surface-table">
          <thead><tr><th>Input</th><th>Use</th><th>Decision</th></tr></thead>
          <tbody>
            ${["Document", "Screenshot", "Notes"].map((item, index) => `
              <tr>
                <td>${item}</td>
                <td>${escapeHtml(goals[index] || goals[0])}</td>
                <td>${index === 0 ? "Use locally" : index === 1 ? "Ask before sharing" : "Summarize only"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
    `,
    browser: `
      <article class="surface-browser">
        <div><span></span><span></span><span></span><strong>Web check prepared</strong></div>
        <p>Search only after approval. Start with: ${escapeHtml(short)}</p>
        <ul>
          <li>What claim needs evidence?</li>
          <li>Which source would change the decision?</li>
          <li>What should stay out of the request?</li>
        </ul>
      </article>
    `,
    media: `
      <article class="surface-media">
        <strong>${escapeHtml(surfaceKey === "media" ? artifactTitle : "Visual brief")}</strong>
        <p>${escapeHtml(surfaceKey === "media" ? artifactSummary : "Create a clear asset from the approved public-safe idea only.")}</p>
        <label class="surface-upload">
          <span>Add local visual reference</span>
          <input data-local-picker type="file" accept="image/*,video/*" multiple />
        </label>
        <p data-file-state>No media selected. References stay local until approved.</p>
        <div>
          <span>Output</span><b>Image, slide, or short clip</b>
          <span>Boundary</span><b>${escapeHtml(boundaryCopy[ritualBoundary?.value || "personal"].excluded)}</b>
        </div>
      </article>
    `,
  };

  homeSurfaceOutput.innerHTML = templates[surfaceKey] || templates.plan;
  const localPicker = homeSurfaceOutput.querySelector("[data-local-picker]");
  const fileState = homeSurfaceOutput.querySelector("[data-file-state]");
  localPicker?.addEventListener("change", () => {
    const count = localPicker.files?.length || 0;
    if (fileState) {
      fileState.textContent = count
        ? `${count} local ${count === 1 ? "item" : "items"} selected. Still browser-only until you approve a route.`
        : "Nothing selected. Nothing leaves this browser.";
    }
  });
  setHomeSurfaceTab(surfaceKey);
}

function applyHomeRemoteReceipt(payload) {
  const mirror = payload?.mirror || {};
  const receipt = mirror.receipt || {};
  if (ritualReceiptTime && payload?.receipt_id) ritualReceiptTime.textContent = `help-${payload.receipt_id}`;
  if (receiptWhy) receiptWhy.textContent = receipt.why || "Extra help produced a receipt-backed working surface.";
  if (receiptUsed) receiptUsed.textContent = receipt.context_used || "Current turn intent, selected boundary, and approved help.";
  if (receiptExcluded) receiptExcluded.textContent = receipt.context_excluded || boundaryCopy[ritualBoundary?.value || "personal"].excluded;
  if (receiptRoute) receiptRoute.textContent = receipt.route || homeProviderLabel(payload?.route);
  if (receiptMemory) receiptMemory.textContent = receipt.memory_decision || "Nothing is saved until you accept the receipt.";
}

async function runHomeGateway(routeKey) {
  const intent = ritualIntent?.value.replace(/\s+/g, " ").trim() || "";
  if (intent.length < 12) throw new Error("intent_too_short");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 26000);
  try {
    const response = await fetch(`${MIRROR_GATEWAY_URL}/v1/mirror/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        intent,
        boundary: ritualBoundary?.value || "personal",
        route: routeKey,
        turn: ritualTurn,
        trust_mode: "approved",
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "gateway_unavailable");
    }
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

function animateRitualBoard() {
  animateElements(Array.from(document.querySelectorAll(".ritual-column")));
  animateElements(Array.from(document.querySelectorAll(".receipt-line")), { x: 0, delay: 0.08 });
}

function renderRitual(surfaceOverride = null, laneOverride = null) {
  if (!ritualIntent || !ritualBoundary) return;
  const intent = ritualIntent.value || ritualInitialIntent;
  const modeKey = currentRitualMode(intent);
  const mode = ritualModes[modeKey];
  const boundary = boundaryCopy[ritualBoundary.value] || boundaryCopy.personal;

  document.documentElement.dataset.ritualMode = modeKey;
  if (ritualCount) ritualCount.textContent = String(ritualIntent.value.length);
  renderRitualList(ritualGoals, mode.goals);
  renderRitualList(ritualBlockers, mode.blockers);
  renderRitualList(ritualMoves, mode.moves);

  if (goalCount) goalCount.textContent = String(mode.goals.length);
  if (blockerCount) blockerCount.textContent = String(mode.blockers.length);
  if (moveCount) moveCount.textContent = String(mode.moves.length);
  if (ritualArtifact) ritualArtifact.innerHTML = `<p>${mode.artifact[0]}</p><strong>${mode.artifact[1]}</strong>`;
  if (ritualReceiptTime) ritualReceiptTime.textContent = `local-turn-${String(ritualTurn).padStart(3, "0")}`;
  if (receiptWhy) receiptWhy.textContent = mode.why;
  if (receiptUsed) receiptUsed.textContent = `Intent: "${shortIntent(intent)}" plus the selected boundary.`;
  if (receiptExcluded) receiptExcluded.textContent = boundary.excluded;
  if (receiptRoute) receiptRoute.textContent = boundary.route;
  if (receiptMemory) receiptMemory.textContent = boundary.memory;
  if (openGeneratedMirror) {
    openGeneratedMirror.href = mirrorStartPath({
      intent,
      boundary: ritualBoundary.value || "personal",
      route: "reflection",
      trust: "local",
    });
  }
  renderHomeSurface(surfaceOverride || inferHomeSurface(intent), laneOverride);

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

async function markRitualGenerated(surfaceOverride = null, laneOverride = null) {
  const surfaceKey = surfaceOverride || inferHomeSurface(ritualIntent?.value || ritualInitialIntent);
  const laneKey = laneOverride || inferHomeLane(ritualIntent?.value || ritualInitialIntent, surfaceKey);
  const selectedHelp = homeHelpMode();
  const routeKey = homeRouteFromMode(laneKey);
  const requestId = (homeRequestId += 1);
  homeRemotePayload = null;
  withViewTransition(() => {
    ritualTurn += 1;
    setActiveHomeLane(laneKey);
    renderRitual(surfaceKey, laneKey);
    if (ritualStatus) ritualStatus.textContent = selectedHelp === "local" ? "Reflected in browser" : `Using ${homeHelpLabel(selectedHelp)}`;
    ritualCreate.textContent = selectedHelp === "local" ? "Reflected" : "Working...";
    ritualCreate.disabled = selectedHelp !== "local";
    ritualCreate.classList.add("is-complete");
    receiptLines[0]?.classList.add("is-open");
  });
  animateRitualBoard();
  renderHomeSurface(surfaceKey, laneKey);
  animateHomeReflection();
  if (canAnimate) {
    const architecture = document.querySelector(".mirror-architecture");
    architecture?.classList.add("is-routing");
    gsap.fromTo(
      ".genui-stage",
      { scale: 0.992, filter: "saturate(0.94)" },
      { scale: 1, filter: "saturate(1.04)", duration: 0.72, ease: "power3.out" }
    );
    const pulseTargets = Array.from(document.querySelectorAll(".stage-pulse"));
    if (pulseTargets.length) {
      gsap.fromTo(
        pulseTargets,
        { autoAlpha: 0.2, scale: 0.82 },
        { autoAlpha: 1, scale: 1.08, duration: 0.82, stagger: 0.08, ease: "power3.out" }
      );
    }
    window.setTimeout(() => architecture?.classList.remove("is-routing"), 1400);
  }

  if (selectedHelp !== "local") {
    try {
      const payload = await runHomeGateway(routeKey);
      if (requestId !== homeRequestId) return;
      homeRemotePayload = payload;
      applyHomeRemoteReceipt(payload);
      renderHomeSurface(surfaceKey, laneKey);
      animateHomeReflection();
      if (ritualStatus) ritualStatus.textContent = payload.fallback ? "Backup receipt ready" : "Receipt ready";
      ritualCreate.textContent = payload.fallback ? "Backup ready" : "Receipt ready";
    } catch {
      if (requestId !== homeRequestId) return;
      homeRemotePayload = null;
      if (ritualStatus) ritualStatus.textContent = "Browser fallback ready";
      if (receiptRoute) receiptRoute.textContent = "Extra help was unavailable, so the browser kept this turn local.";
      if (homeStateReceipt) homeStateReceipt.textContent = "Browser";
      ritualCreate.textContent = "Browser ready";
    } finally {
      if (requestId === homeRequestId) {
        ritualCreate.disabled = false;
      }
    }
  }

  window.setTimeout(() => {
    if (requestId !== homeRequestId) return;
    ritualCreate.textContent = "Reflect again";
    ritualCreate.classList.remove("is-complete");
  }, selectedHelp === "local" ? 1700 : 2200);
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
    const [title, detail] = scenario.viewportNodes[index] || ["Update", "Next step"];
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

function mirrorStartPath({ intent = "", boundary = "", route = "", trust = "local" } = {}) {
  const url = new URL("/mirror/", window.location.origin);
  url.searchParams.set("start", "1");
  url.searchParams.set("trust", trust || "local");
  if (intent) url.searchParams.set("intent", intent);
  if (boundary) url.searchParams.set("boundary", boundary);
  if (route) url.searchParams.set("route", route);
  return `${url.pathname}${url.search}${url.hash}`;
}

function buildMirrorStartUrl(source) {
  return mirrorStartPath({
    intent: source.dataset.mirrorIntent || "",
    boundary: source.dataset.mirrorBoundary || "",
    route: source.dataset.mirrorRoute || "",
    trust: source.dataset.mirrorTrust || "local",
  });
}

function setMirrorStartHref(source) {
  if (!source) return;
  source.setAttribute("href", buildMirrorStartUrl(source));
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

if (ritualIntent && ritualBoundary && ritualCreate) {
  try {
    const savedRitual = JSON.parse(localStorage.getItem("activeMirrorFirstUse") || "null");
    if (savedRitual?.intent) ritualIntent.value = savedRitual.intent;
    if (savedRitual?.boundary && boundaryCopy[savedRitual.boundary]) ritualBoundary.value = savedRitual.boundary;
    if (Number.isFinite(savedRitual?.turn)) ritualTurn = savedRitual.turn;
  } catch {
    localStorage.removeItem("activeMirrorFirstUse");
  }

  ritualIntent.addEventListener("input", () => {
    homeRemotePayload = null;
    renderRitual();
  });

  ritualBoundary.addEventListener("change", () => {
    homeRemotePayload = null;
    withViewTransition(renderRitual);
    animateRitualBoard();
  });

  homeModelMode?.addEventListener("change", () => {
    homeRemotePayload = null;
    renderRitual();
    renderHomeSurface(inferHomeSurface(ritualIntent.value), currentHomeLane);
  });

  ritualCreate.addEventListener("click", runSelectedHomeReflection);

  openGeneratedMirror?.addEventListener("click", (event) => {
    event.preventDefault();
    ritualIntent.focus({ preventScroll: true });
    document.querySelector("#first-use")?.scrollIntoView({ behavior: canAnimate ? "smooth" : "auto", block: "start" });
    runSelectedHomeReflection();
  });

  homeWorkControls.forEach((button) => {
    button.addEventListener("click", () => {
      homeRemotePayload = null;
      const currentText = ritualIntent.value.trim();
      const untouched = currentText === ritualInitialIntent.trim();
      if (!currentText || untouched) {
        ritualIntent.value = button.dataset.intent || ritualInitialIntent;
      }
      if (button.dataset.boundary && boundaryCopy[button.dataset.boundary]) {
        ritualBoundary.value = button.dataset.boundary;
      }
      const surfaceKey = button.dataset.surface || inferHomeSurface(ritualIntent.value);
      const laneKey = button.dataset.workLane || inferHomeLane(ritualIntent.value, surfaceKey);
      setActiveHomeLane(laneKey);
      renderRitual(surfaceKey, laneKey);
    });
  });

  homeSurfaceTabs.forEach((button) => {
    button.addEventListener("click", () => {
      renderHomeSurface(button.dataset.surfaceTab, currentHomeLane);
    });
  });
  ritualRefresh?.addEventListener("click", runSelectedHomeReflection);
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

  ritualReset?.addEventListener("click", () => {
    withViewTransition(() => {
      homeRemotePayload = null;
      ritualTurn = 1;
      ritualIntent.value = ritualInitialIntent;
      ritualBoundary.value = "personal";
      if (homeModelMode) homeModelMode.value = "local";
      setActiveHomeLane("decision");
      if (ritualStatus) ritualStatus.textContent = "Reflects first";
      receiptLines.forEach((line, index) => line.classList.toggle("is-open", index === 0));
      renderRitual();
      renderHomeSurface("plan", "decision");
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
  animateElements(Array.from(document.querySelectorAll(".ritual-create-panel, .genui-panel, .mirror-device, .genui-stage, .receipt-pack, .space-control")), {
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
    setMirrorStartHref(button);
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
    const activeScenario = scenarioButtons.find((button) => button.classList.contains("is-active")) || scenarioButtons[0];
    if (activeScenario) {
      openWorkspace.dataset.mirrorIntent = activeScenario.dataset.mirrorIntent || "";
      openWorkspace.dataset.mirrorBoundary = activeScenario.dataset.mirrorBoundary || "";
      openWorkspace.dataset.mirrorRoute = activeScenario.dataset.mirrorRoute || "";
      setMirrorStartHref(openWorkspace);
    }
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

document.querySelectorAll("[data-mirror-intent], [data-mirror-start]").forEach(setMirrorStartHref);

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
const mirrorSummaryType = document.querySelector("#mirror-summary-type");
const mirrorCreateSummary = document.querySelector("#mirror-create-summary");
const mirrorSummaryState = document.querySelector("#mirror-summary-state");
const mirrorSummaryOutput = document.querySelector("#mirror-summary-output");
const mirrorExportMarkdown = document.querySelector("#mirror-export-markdown");
const mirrorExportJson = document.querySelector("#mirror-export-json");
const mirrorMemoryCandidates = document.querySelector("#mirror-memory-candidates");
const mirrorPrivateContextCount = document.querySelector("#mirror-private-context-count");
const mirrorPrivateContextList = document.querySelector("#mirror-private-context-list");
const mirrorFollowupsState = document.querySelector("#mirror-followups-state");
const mirrorFollowups = document.querySelector("#mirror-followups");

const workspaceRoutes = {
  reflection: {
    label: "decision help",
    route: "Approved extra help supports decisions, prioritization, and structured next moves.",
    goals: ["Name the real objective", "Separate signal from noise", "Create one momentum path"],
    blockers: ["Too much context at once", "Unclear priority order", "No accepted memory decision"],
    moves: ["Extract the strongest intent", "Pick one proof artifact", "Write the next-action board", "Approve or reject memory"],
    artifact: ["Reflection board", "Objective, blockers, next moves, and receipt."],
    why: "The turn asks for a decision and momentum, so the decision route is the strongest fit.",
  },
  chat: {
    label: "critique help",
    route: "Approved extra help sharpens language, structure, critique, and receipt review.",
    goals: ["Clarify the message", "Tighten the structure", "Expose weak assumptions"],
    blockers: ["Copy may overclaim", "Tone can drift", "The useful objection is hidden"],
    moves: ["Rewrite the core claim", "List objections", "Cut unsupported language", "Produce a cleaner artifact"],
    artifact: ["Critique memo", "Sharper copy, objections, and suggested rewrite."],
    why: "The turn needs language critique and structure more than raw prediction.",
  },
  media: {
    label: "media help",
    route: "Approved media help supports images, video, screenshots, and visual planning.",
    goals: ["Define the visual output", "Protect private context", "Create a media brief"],
    blockers: ["Visual direction is vague", "Source material may be sensitive", "Media work needs tight constraints"],
    moves: ["Choose format and aspect ratio", "Write the visual brief", "Exclude private details", "Generate or queue the asset"],
    artifact: ["Media brief", "Scene, format, constraints, and receipt."],
    why: "The turn asks for visual or multimodal work, so the media route is the correct helper lane.",
  },
};

const trustModes = {
  approved: {
    label: "Approved extra help",
    scope: "Standard workspace",
    localOnly: false,
    approval: "Extra help requires explicit approval.",
    included: "Current turn intent, selected boundary, help type, and privacy setting.",
    excluded: "Saved context, client records, files, tabs, and personal history are not included in this sharing review.",
  },
  local: {
    label: "Local only",
    scope: "In this browser",
    localOnly: true,
    approval: "No external call. The browser creates the workspace.",
    included: "Current turn intent and selected boundary only.",
    excluded: "Extra help, saved context, files, tabs, and external tools.",
  },
  public: {
    label: "Public-safe",
    scope: "public/shareable",
    localOnly: false,
    approval: "Only public-safe context may leave the browser after approval.",
    included: "Current turn intent after boundary review, public-safe product framing, and help type.",
    excluded: "Private identity details, client-confidential material, secrets, and unapproved memory.",
  },
  client: {
    label: "Client-confidential",
    scope: "client/confidential",
    localOnly: false,
    approval: "Client-confidential work requires approval and receipt-visible exclusions.",
    included: "Current turn intent, selected boundary, client-safe task label, and help type.",
    excluded: "Personal context, unrelated client context, raw files, credentials, and anything not approved for this client scope.",
  },
};

const memoryDecisionCopy = {
  forget: "Forgotten for future context: this turn remains visible only in the current browser session.",
  project: "Saved for this project: future turns may use this receipt inside the same project.",
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
let currentSummary = null;
let currentMemoryCandidates = [];
let currentFollowups = [];
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
  mirrorVaultHead.textContent = `receipt chain: ${head === "genesis" ? "empty" : head.slice(0, 12)}`;
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
  setVaultStatus("Checking", "Checking browser storage for receipts.");
  const persisted = navigator.storage?.persist ? await navigator.storage.persist().catch(() => false) : false;
  const { mode, entries } = await readBrowserVault();
  const latest = entries.at(-1);
  vaultEntryCount = entries.length;
  vaultChainHead = latest?.hash || "genesis";
  setVaultStatus(
    mode === "OPFS" ? "Storage ready" : "Storage limited",
    `${vaultEntryCount} receipt ${vaultEntryCount === 1 ? "entry" : "entries"} saved in this browser${persisted ? "; protected storage granted" : ""}.`,
  );
}

async function persistVaultEntry(type, payload = {}) {
  if (!mirrorVaultState) return null;
  setVaultStatus("Saving", "Saving a receipt-linked entry.");
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
    "Saved",
    `${vaultEntryCount} receipt ${vaultEntryCount === 1 ? "entry" : "entries"} saved. Latest: ${type.replace(/_/g, " ")}.`,
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
  const fallback = route.fallback ? " / backup" : "";
  return `${route.capability} help${fallback}`;
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

function selectHasValue(select, value) {
  if (!select || !value) return false;
  return Array.from(select.options || []).some((option) => option.value === value);
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
    model_target: selectedTrust.localOnly ? "Browser only" : routeTargetLabel(selectedRoute),
    memory_items_used: ["intent_current_turn", `boundary_${selectedBoundary}`, `trust_${mirrorTrust?.value || "approved"}`],
    excluded_memory_items: [
      { id: "Saved context", reason: "not approved for this turn" },
      { id: "Private files", reason: "not attached or approved" },
      { id: "External tools", reason: "not requested for this workspace" },
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

  mirrorPacketState.textContent = packet.local_only ? "Browser only ready" : packet.approved ? "Approved" : "Needs approval";
  mirrorPacketTask.textContent = packet.task;
  mirrorPacketScope.textContent = `${packet.scope} / ${packet.trust_label}`;
  mirrorPacketUsed.textContent = `${packet.included_text} Estimated ${packet.token_estimate} tokens.`;
  mirrorPacketExcluded.textContent = packet.excluded_text;
    mirrorPacketRoute.textContent = `${packet.model_target}. ${packet.approval_text}`;
  mirrorPacketBoundary.textContent = packet.boundary_label;

  if (mirrorApprove) {
    mirrorApprove.disabled = false;
    mirrorApprove.textContent = packet.local_only ? "Create in browser" : packet.approved ? "Approved" : "Approve extra help";
  }
  if (mirrorRun && !mirrorRun.disabled) {
    mirrorRun.textContent = packet.local_only ? "Create browser workspace" : packet.approved ? "Create workspace" : "Review what is shared";
    mirrorRun.classList.toggle("is-complete", Boolean(packet.local_only || packet.approved));
  }
}

function previewContextPacket({ forceLocal = false } = {}) {
  currentContextPacket = buildContextPacket({ forceLocal });
  renderContextPacket(currentContextPacket);
  mirrorRun.textContent = "Sharing review ready";
  mirrorRun.classList.add("is-complete");
  window.clearTimeout(packetPreviewTimer);
  packetPreviewTimer = window.setTimeout(() => {
    mirrorRun.textContent = "Review what is shared";
    mirrorRun.classList.remove("is-complete");
  }, 1100);
  animateElements(Array.from(document.querySelectorAll(".workspace-packet .packet-grid > div, .packet-actions > *")), {
    y: 8,
    duration: 0.32,
  });
}

function routeTruthText(remotePayload, routeKey, packet) {
  if (packet?.local_only) {
    return "Browser-only mode: no external call was made. This workspace was created in your browser.";
  }
  if (remotePayload?.route) {
    const label = providerLabel(remotePayload.route);
    const fallback = remotePayload.fallback
      ? " Backup help was used and is recorded in this receipt."
      : " Extra help completed without a backup path.";
    return `${label}.${fallback}`;
  }
  if (packet?.approval_required && !packet.approved) {
    return "Review only: no external call yet. Approve what can be shared before extra help runs.";
  }
  const route = workspaceRoutes[routeKey] || workspaceRoutes.reflection;
  return `${route.route} Extra help was unavailable, so the browser created this workspace.`;
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
    followups: currentFollowups.map((item) => ({
      label: item.label,
      question: item.question,
      decision: item.decision || "pending",
      answer: item.decision === "answered" ? item.answer || "" : null,
      assumption: item.decision === "assumed" ? item.assumption || item.reason || "" : null,
    })),
    exported_at: new Date().toISOString(),
  };
}

const summaryTypeLabels = {
  decision: "Decision summary",
  strategy: "Strategy note",
  action: "Action plan",
  meeting: "Meeting prep",
  reflection: "Reflection note",
};

function readPrivateContext() {
  try {
    const value = JSON.parse(localStorage.getItem("activeMirrorPrivateContext") || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writePrivateContext(items) {
  localStorage.setItem("activeMirrorPrivateContext", JSON.stringify(items.slice(0, 24)));
}

function renderPrivateContext() {
  if (!mirrorPrivateContextList || !mirrorPrivateContextCount) return;
  const items = readPrivateContext();
  mirrorPrivateContextCount.textContent = `${items.length} saved`;
  if (!items.length) {
    mirrorPrivateContextList.innerHTML = "<p>No approved context yet.</p>";
    return;
  }
  mirrorPrivateContextList.innerHTML = items
    .map(
      (item) => `
        <article>
          <strong>${escapeHtml(item.label || "Saved context")}</strong>
          <p>${escapeHtml(item.text || "")}</p>
          <span>${escapeHtml(item.receipt_id || "local receipt")}</span>
        </article>
      `
    )
    .join("");
}

function setSummaryExportReady(ready) {
  if (mirrorExportMarkdown) mirrorExportMarkdown.disabled = !ready;
  if (mirrorExportJson) mirrorExportJson.disabled = !ready;
}

function clearSummaryReview() {
  currentSummary = null;
  currentMemoryCandidates = [];
  currentFollowups = [];
  if (mirrorSummaryState) mirrorSummaryState.textContent = "Ready";
  if (mirrorSummaryOutput) {
    mirrorSummaryOutput.innerHTML = `
      <strong>No summary yet</strong>
      <p>Create a summary after the workspace has a receipt.</p>
    `;
  }
  if (mirrorMemoryCandidates) {
    mirrorMemoryCandidates.innerHTML = "<p>No saved-context suggestions yet. Create a summary to review them.</p>";
  }
  if (mirrorFollowupsState) mirrorFollowupsState.textContent = "Waiting";
  if (mirrorFollowups) {
    mirrorFollowups.innerHTML = "<p>Create a summary to see the questions worth answering.</p>";
  }
  setSummaryExportReady(false);
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

function buildSessionSummary(type = mirrorSummaryType?.value || "decision") {
  const packet = currentContextPacket || buildContextPacket();
  const goals = getListText(mirrorGoals);
  const blockers = getListText(mirrorBlockers);
  const nextMoves = getListText(mirrorMoves);
  const artifact = getArtifactText();
  const label = summaryTypeLabels[type] || summaryTypeLabels.decision;
  const recommendation = nextMoves[0] || goals[0] || "Choose one concrete next move.";

  return {
    schema: "active-mirror-summary-v1",
    type,
    label,
    title: `${label}: ${packet.task}`,
    intent: packet.task,
    boundary: packet.boundary_label,
    route: mirrorRouteLabel?.textContent || packet.model_target,
    receipt_id: mirrorReceiptId?.textContent || "local-receipt",
    created_at: new Date().toISOString(),
    why: mirrorReceiptWhy?.textContent || "",
    context_used: mirrorReceiptUsed?.textContent || "",
    context_excluded: mirrorReceiptExcluded?.textContent || "",
    memory_decision: mirrorReceiptMemory?.textContent || "Pending review",
    goals,
    blockers,
    next_moves: nextMoves,
    artifact,
    recommendation,
  };
}

function buildMemoryCandidates(summary) {
  return [
    {
      id: "decision_focus",
      label: "Decision focus",
      text: `Decision focus: ${summary.intent}`,
    },
    {
      id: "next_step",
      label: "Next step",
      text: `Next step: ${summary.recommendation}`,
    },
    {
      id: "boundary",
      label: "Boundary",
      text: `Boundary preference: ${summary.boundary}`,
    },
    {
      id: "artifact",
      label: "Saved note",
      text: `Saved note: ${summary.title}. ${summary.artifact || summary.recommendation}`,
    },
  ];
}

function buildFollowups(summary) {
  const packet = currentContextPacket || buildContextPacket();
  const primaryMove = summary.recommendation || "the next move";
  const routeKey = packet.route_key || "reflection";
  const routeSpecific =
    routeKey === "media"
      ? {
          label: "Source material",
          question: "Which image, video, screenshot, or brand constraint should shape the media output?",
          reason: "This prevents generic visuals and keeps private material out unless approved.",
        }
      : routeKey === "chat"
        ? {
            label: "Audience",
            question: "Who is this message for, and what should they do after reading it?",
            reason: "This makes critique concrete instead of polishing in the abstract.",
          }
        : {
            label: "Success",
            question: `What outcome would make \"${primaryMove}\" a win?`,
            reason: "This turns the recommendation into a measurable decision.",
          };

  return [
    routeSpecific,
    {
      label: "Risk",
      question: "What constraint or missing fact could make this recommendation wrong?",
      reason: "This keeps the receipt honest before the work is reused.",
    },
    {
      label: "Future context",
      question: "Should this be remembered as project context, a personal preference, temporary context, or not at all?",
      reason: "This prevents silent memory and keeps continuity under your control.",
    },
  ].slice(0, 3);
}

function renderFollowups(items = currentFollowups) {
  if (!mirrorFollowups || !mirrorFollowupsState) return;
  currentFollowups = items;
  mirrorFollowupsState.textContent = items.length ? "Review" : "Waiting";
  if (!items.length) {
    mirrorFollowups.innerHTML = "<p>Create a summary to see the questions worth answering.</p>";
    return;
  }
  mirrorFollowups.innerHTML = items
    .map(
      (item, index) => `
        <article class="followup-question" data-followup-index="${index}" data-decision="${escapeHtml(item.decision || "pending")}">
          <span>${escapeHtml(item.label)}</span>
          <p>${escapeHtml(item.question)}</p>
          <small>${escapeHtml(item.reason)}</small>
          <textarea rows="2" aria-label="${escapeHtml(item.label)} answer" placeholder="Optional answer"></textarea>
          <div class="followup-actions">
            <button type="button" data-followup-index="${index}" data-followup-action="answered">Save answer</button>
            <button type="button" data-followup-index="${index}" data-followup-action="assumed">Make assumption</button>
            <button type="button" data-followup-index="${index}" data-followup-action="skipped">Skip</button>
          </div>
        </article>
      `
    )
    .join("");
}

function setFollowupDecision(index, action) {
  const item = currentFollowups[index];
  if (!item || !mirrorFollowups || !mirrorFollowupsState) return;
  const card = mirrorFollowups.querySelector(`[data-followup-index="${index}"]`);
  const answer = card?.querySelector("textarea")?.value.replace(/\s+/g, " ").trim() || "";
  if (action === "answered" && !answer) {
    mirrorFollowupsState.textContent = "Answer needed";
    return;
  }

  item.decision = action;
  item.answer = action === "answered" ? answer : "";
  item.assumption =
    action === "assumed"
      ? answer || "Proceeding with the current receipt; this point remains an assumption."
      : "";
  card?.setAttribute("data-decision", action);
  const label = card?.querySelector("span");
  if (label) {
    label.textContent =
      action === "answered"
        ? `${item.label} - Answered`
        : action === "assumed"
          ? `${item.label} - Assumed`
          : `${item.label} - Skipped`;
  }
  const reviewed = currentFollowups.filter((followup) => followup.decision).length;
  mirrorFollowupsState.textContent = `${reviewed} reviewed`;
  captureReceiptSnapshot(currentContextPacket, mirrorReceiptRoute?.textContent || "");
  renderMirrorAudit(currentContextPacket);
  persistVaultEntry("followup_decision", {
    label: item.label,
    question: item.question,
    decision: action,
    answer: action === "answered" ? answer : null,
    assumption: action === "assumed" ? item.assumption : null,
    receipt_id: mirrorReceiptId?.textContent || "local-receipt",
  }).catch(() => setVaultStatus("Vault blocked", "Browser storage rejected this follow-up receipt."));
}

function renderSummary(summary = buildSessionSummary()) {
  currentSummary = summary;
  if (mirrorSummaryState) mirrorSummaryState.textContent = "Created";
  if (mirrorSummaryOutput) {
    mirrorSummaryOutput.innerHTML = `
      <strong>${escapeHtml(summary.title)}</strong>
      <p>${escapeHtml(summary.why || "The workspace created a structured next step from the current intent and boundary.")}</p>
      <div>
        <span>Recommended next move</span>
        <strong>${escapeHtml(summary.recommendation)}</strong>
      </div>
      <ul>
        ${summary.next_moves.slice(0, 4).map((move) => `<li>${escapeHtml(move)}</li>`).join("")}
      </ul>
    `;
  }
  renderFollowups(buildFollowups(summary));
  currentMemoryCandidates = buildMemoryCandidates(summary);
  renderMemoryCandidates(currentMemoryCandidates);
  setSummaryExportReady(true);
  captureReceiptSnapshot(currentContextPacket, mirrorReceiptRoute?.textContent || "");
}

function renderMemoryCandidates(candidates = currentMemoryCandidates) {
  if (!mirrorMemoryCandidates) return;
  if (!candidates.length) {
    mirrorMemoryCandidates.innerHTML = "<p>No saved-context suggestions yet. Create a summary to review them.</p>";
    return;
  }
  mirrorMemoryCandidates.innerHTML = candidates
    .map(
      (candidate, index) => `
        <article class="memory-candidate" data-candidate-index="${index}" data-decision="${escapeHtml(candidate.decision || "pending")}">
          <div>
            <strong>${escapeHtml(candidate.label)}</strong>
            <span>${candidate.decision ? `${escapeHtml(candidate.decision)} recorded` : "Needs review"}</span>
          </div>
          <textarea rows="2" aria-label="${escapeHtml(candidate.label)} saved context">${escapeHtml(candidate.text)}</textarea>
          <div class="candidate-actions">
            <button type="button" data-memory-candidate="${index}" data-memory-action="approve">Approve</button>
            <button type="button" data-memory-candidate="${index}" data-memory-action="temporary">Temporary</button>
            <button type="button" data-memory-candidate="${index}" data-memory-action="reject">Reject</button>
          </div>
        </article>
      `
    )
    .join("");
}

function setFutureContextDecision(index, action) {
  const candidate = currentMemoryCandidates[index];
  if (!candidate || !mirrorMemoryCandidates) return;
  const card = mirrorMemoryCandidates.querySelector(`[data-candidate-index="${index}"]`);
  const editedText = card?.querySelector("textarea")?.value.replace(/\s+/g, " ").trim() || candidate.text;
  candidate.decision = action;
  candidate.text = editedText;
  card?.setAttribute("data-decision", action);
  const status = card?.querySelector("div > span");
  if (status) status.textContent = action === "approve" ? "Approved" : action === "temporary" ? "Temporary" : "Rejected";

  const receiptId = mirrorReceiptId?.textContent || "local-receipt";
  if (action === "approve") {
    const items = readPrivateContext();
    items.unshift({
      id: `${candidate.id}_${Date.now()}`,
      label: candidate.label,
      text: editedText,
      receipt_id: receiptId,
      saved_at: new Date().toISOString(),
    });
    try {
      writePrivateContext(items);
    } catch {
      setVaultStatus("Vault blocked", "Browser storage rejected the approved context.");
    }
    mirrorReceiptMemory.textContent = `Approved for future context: ${candidate.label}.`;
    mirrorMemoryState.textContent = "Approved";
    persistVaultEntry("approved_private_context", {
      candidate_id: candidate.id,
      label: candidate.label,
      text: editedText,
      receipt_id: receiptId,
    }).catch(() => setVaultStatus("Vault blocked", "Browser storage rejected the approved context."));
  } else if (action === "temporary") {
    try {
      const temporary = JSON.parse(sessionStorage.getItem("activeMirrorTemporaryContext") || "[]");
      temporary.unshift({ label: candidate.label, text: editedText, receipt_id: receiptId, saved_at: new Date().toISOString() });
      sessionStorage.setItem("activeMirrorTemporaryContext", JSON.stringify(temporary.slice(0, 12)));
    } catch {
      // Temporary context is best-effort and never promoted to durable memory.
    }
    mirrorReceiptMemory.textContent = `Kept temporary for this session: ${candidate.label}.`;
    mirrorMemoryState.textContent = "Temporary";
    persistVaultEntry("temporary_context_decision", {
      candidate_id: candidate.id,
      label: candidate.label,
      text: editedText,
      receipt_id: receiptId,
    }).catch(() => setVaultStatus("Vault blocked", "Browser storage rejected this temporary decision."));
  } else {
    candidate.text = "";
    if (card) {
      const textarea = card.querySelector("textarea");
      if (textarea) textarea.value = "";
      card.classList.add("is-rejected");
    }
    mirrorReceiptMemory.textContent = `Rejected saved context: ${candidate.label}. Rejected text was not saved.`;
    mirrorMemoryState.textContent = "Rejected";
    persistVaultEntry("memory_candidate_rejected", {
      candidate_id: candidate.id,
      label: candidate.label,
      text: null,
      receipt_id: receiptId,
    }).catch(() => setVaultStatus("Vault blocked", "Browser storage rejected this rejection receipt."));
  }

  captureReceiptSnapshot(currentContextPacket, mirrorReceiptRoute?.textContent || "");
  renderPrivateContext();
  renderMirrorAudit(currentContextPacket);
}

function summaryMarkdown(summary = currentSummary || buildSessionSummary()) {
  return [
    `# ${summary.title}`,
    "",
    `- Receipt: ${summary.receipt_id}`,
    `- Boundary: ${summary.boundary}`,
    `- Help path: ${summary.route}`,
    "",
    "## Why",
    summary.why || "No rationale recorded.",
    "",
    "## Recommended next move",
    summary.recommendation,
    "",
    "## Next moves",
    ...summary.next_moves.map((move) => `- ${move}`),
    "",
    "## Receipt",
    `Context used: ${summary.context_used || "Not recorded."}`,
    "",
    `Context excluded: ${summary.context_excluded || "Not recorded."}`,
    "",
    `Memory decision: ${summary.memory_decision || "Pending review."}`,
    "",
  ].join("\n");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportSummary(format) {
  const summary = currentSummary || buildSessionSummary();
  if (!currentSummary) renderSummary(summary);
  const baseName = summary.receipt_id || "active-mirror-summary";
  if (format === "markdown") {
    downloadFile(`${baseName}.md`, summaryMarkdown(summary), "text/markdown");
  } else {
    downloadFile(
      `${baseName}.json`,
      JSON.stringify({ summary, receipt: lastMirrorReceipt }, null, 2),
      "application/json"
    );
  }
  if (mirrorSummaryState) mirrorSummaryState.textContent = "Exported";
  persistVaultEntry("summary_exported", {
    format,
    receipt_id: summary.receipt_id,
    title: summary.title,
  }).catch(() => setVaultStatus("Vault blocked", "Browser storage rejected this export receipt."));
}

function auditActionLabel(action) {
  return {
    verify: "Verify",
    forget: "Forget",
    unknown: "Mark unknown",
    keep_out: "Keep out",
    review: "Review",
    promote: "Save",
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
  const receiptState = mirrorReceiptId?.textContent?.startsWith("help-")
    ? "Help receipt"
    : activePacket.local_only || activePacket.approved
      ? "Browser receipt"
      : "Draft review";

  const known = [
    `Intent: ${activePacket.task}`,
    `Boundary: ${activePacket.boundary_label}`,
    `Privacy: ${trust}`,
    `Help path: ${routeTarget}`,
  ];

  const uncertain = [
    "No saved context from this browser has been approved for this turn.",
    "No files, tabs, emails, or prior chats were admitted for this turn.",
    "Generated output is not reusable until you approve what should be saved.",
    activePacket.approval_required && !activePacket.approved ? "Extra help has not been approved yet." : "",
  ];

  const excluded = [
    ...(activePacket.excluded_memory_items || []).map((item) => `${item.id}: ${item.reason}`),
    activePacket.excluded_text,
  ];

  const canonical = [
    goals[0] ? `Goal to save: ${goals[0]}` : "",
    moves[0] ? `Next move to save: ${moves[0]}` : "",
    artifact ? `Artifact to save: ${artifact}` : "",
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
  mirrorRouteLabel.textContent = packet?.local_only ? "browser only" : remotePayload?.route ? providerLabel(remotePayload.route) : route.label;
  renderRitualList(mirrorGoals, goals);
  renderRitualList(mirrorBlockers, blockers);
  renderRitualList(mirrorMoves, moves);
  mirrorGoalCount.textContent = String(goals.length);
  mirrorBlockerCount.textContent = String(blockers.length);
  mirrorMoveCount.textContent = String(moves.length);
  mirrorArtifact.innerHTML = `<p>${escapeHtml(artifactTitle)}</p><strong>${escapeHtml(artifactSummary)}</strong>`;
  mirrorReceiptId.textContent = remotePayload?.receipt_id ? `help-${remotePayload.receipt_id}` : `browser-${routeKey}-${String(mirrorTurn).padStart(3, "0")}`;
  mirrorReceiptWhy.textContent = receipt.why || route.why;
  mirrorReceiptUsed.textContent = receipt.context_used || packet?.included_text || `Intent: "${shortIntent(intent || "No intent yet")}" plus selected boundary and help type.`;
  mirrorReceiptExcluded.textContent = receipt.context_excluded || packet?.excluded_text || boundary.excluded;
  mirrorReceiptRoute.textContent = receipt.route ? `${receipt.route} ${routeTruth}` : routeTruth;
  mirrorReceiptMemory.textContent = receipt.memory_decision || "Pending: nothing saved until you choose a memory decision.";
  if (mirrorMemoryState) mirrorMemoryState.textContent = "Pending";
  captureReceiptSnapshot(packet, mirrorReceiptRoute.textContent);
  renderMirrorAudit(packet);
  clearSummaryReview();

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
    // The workspace remains usable without local persistence.
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
  mirrorRun.textContent = currentContextPacket.local_only ? "Creating in browser..." : "Using approved extra help...";
  mirrorRun.classList.remove("is-complete");

  if (currentContextPacket.local_only) {
    renderWorkspaceMirror(null, currentContextPacket);
    mirrorRun.disabled = false;
    mirrorRun.textContent = "Local workspace ready";
    mirrorRun.classList.add("is-complete");
    animateElements(Array.from(document.querySelectorAll(".workspace-column, .workspace-receipt, .workspace-summary, .workspace-followups, .workspace-memory, .workspace-private-context")), {
      y: 10,
      duration: 0.38,
    });
    window.setTimeout(() => {
      mirrorRun.textContent = "Create browser workspace";
      mirrorRun.classList.remove("is-complete");
    }, 1600);
    return;
  }

  let gatewayTimeout = 0;
  try {
    const controller = new AbortController();
    gatewayTimeout = window.setTimeout(() => controller.abort(), 26000);
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
    mirrorRun.textContent = payload.fallback ? "Backup workspace ready" : "Workspace ready";
    mirrorRun.classList.add("is-complete");
  } catch (error) {
    window.clearTimeout(gatewayTimeout);
    if (requestId !== mirrorRequestId) return;
    renderWorkspaceMirror(null, currentContextPacket);
    mirrorRun.textContent = "Browser workspace ready";
    mirrorRun.classList.add("is-complete");
  } finally {
    mirrorRun.disabled = false;
    animateElements(Array.from(document.querySelectorAll(".workspace-column, .workspace-receipt, .workspace-summary, .workspace-followups, .workspace-memory, .workspace-private-context")), {
      y: 10,
      duration: 0.38,
    });
    window.setTimeout(() => {
      mirrorRun.textContent = "Review what is shared";
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

  const applyMirrorStartParams = () => {
    const params = new URLSearchParams(window.location.search);
    const shouldStart =
      params.has("start") || params.has("intent") || params.has("boundary") || params.has("route") || params.has("trust");
    if (!shouldStart) return false;

    const intent = params.get("intent")?.replace(/\s+/g, " ").trim();
    if (intent) mirrorIntent.value = intent.slice(0, 1000);

    const boundary = params.get("boundary");
    if (boundaryCopy[boundary] && selectHasValue(mirrorBoundary, boundary)) mirrorBoundary.value = boundary;

    const route = params.get("route");
    if ((route === "auto" || workspaceRoutes[route]) && selectHasValue(mirrorRoute, route)) mirrorRoute.value = route;

    const trust = params.get("trust");
    if (trustModes[trust] && selectHasValue(mirrorTrust, trust)) {
      mirrorTrust.value = trust;
    } else if (mirrorTrust) {
      mirrorTrust.value = "local";
    }

    return true;
  };

  const startedFromPublicLink = applyMirrorStartParams();

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
  mirrorCreateSummary?.addEventListener("click", () => {
    renderSummary(buildSessionSummary(mirrorSummaryType?.value || "decision"));
    animateElements(Array.from(document.querySelectorAll(".summary-output, .memory-candidate")), {
      y: 8,
      duration: 0.34,
    });
  });
  mirrorExportMarkdown?.addEventListener("click", () => exportSummary("markdown"));
  mirrorExportJson?.addEventListener("click", () => exportSummary("json"));
  mirrorMemoryCandidates?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-memory-candidate][data-memory-action]");
    if (!button) return;
    setFutureContextDecision(Number(button.dataset.memoryCandidate), button.dataset.memoryAction);
  });
  mirrorFollowups?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-followup-index][data-followup-action]");
    if (!button) return;
    setFollowupDecision(Number(button.dataset.followupIndex), button.dataset.followupAction);
  });
  loadAuditDecisions();
  renderPrivateContext();
  initializeBrowserVault().catch(() => setVaultStatus("Storage limited", "Receipts can still be saved in this browser session."));
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
    button.textContent = action === "promote" ? "Saved" : action === "keep_out" ? "Kept out" : "Marked";
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

  if (startedFromPublicLink) {
    mirrorPacketState.textContent = "Started in browser";
    if (currentContextPacket?.local_only) {
      mirrorRun.textContent = "Browser workspace ready";
      mirrorRun.classList.add("is-complete");
    }
    window.setTimeout(() => {
      document.querySelector(".workspace-app")?.scrollIntoView({
        behavior: canAnimate ? "smooth" : "auto",
        block: "start",
      });
    }, 80);
  }
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

initMagneticControls();
initHeroParallax();
initScrollReveals();
