import "./cockpit.css";

const GATEWAY_ORIGIN = "https://gateway.activemirror.ai";
const LAST_RECEIPT_KEY = "activeMirrorCockpitLastReceipt";
const SESSION_KEY = "activeMirrorCockpitThread";
const productionOrigin = window.location.origin === "https://activemirror.ai";

const view = document.body.dataset.view || "chat";
const state = {
  turn: 0,
  health: null,
  lastReceipt: readJson(LAST_RECEIPT_KEY, null),
  thread: readJson(SESSION_KEY, []),
};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function setText(selector, value) {
  const node = $(selector);
  if (node) node.textContent = value == null || value === "" ? "not exposed" : String(value);
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage is optional; the cockpit still works without persistence.
  }
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

function compact(value, fallback = "not exposed") {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "none";
  if (value === false) return "false";
  if (value === true) return "true";
  if (value == null || value === "") return fallback;
  return String(value);
}

function shortHash(value) {
  if (!value) return "not exposed";
  return String(value).slice(0, 12);
}

async function loadHealth() {
  try {
    const response = await fetch(`${GATEWAY_ORIGIN}/health`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload?.ok) throw new Error("health_failed");
    state.health = payload;
    renderHealth(payload);
    return payload;
  } catch {
    renderHealth(null, productionOrigin ? "gateway unavailable" : "production origin required");
    return null;
  }
}

function renderHealth(payload, unavailableLabel = "gateway unavailable") {
  const pill = $("#gateway-pill");
  const label = $("#gateway-label");
  const version = payload?.version || unavailableLabel;
  if (pill) pill.classList.toggle("is-warn", !payload);
  if (label) label.textContent = payload ? "gateway online" : unavailableLabel;
  setText("#gateway-version", version);

  if (view !== "ops") return;

  setText("#ops-version", version);
  setText("#ops-identity", payload?.identity?.source_contract ? `Identity: ${payload.identity.source_contract}` : "Identity contract not exposed.");
  setText("#ops-route-count", String(Object.keys(payload?.routes || {}).length));
  setText("#ops-guardrail-count", String(Object.keys(payload?.guardrails || {}).length));
  setText("#ops-updated", new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  renderRouteTable(payload?.routes || {});
  renderGateList(payload?.guardrails || {});
}

function renderRouteTable(routes) {
  const table = $("#route-table");
  if (!table) return;
  const rows = Object.entries(routes);
  table.innerHTML = rows.length
    ? rows
        .map(
          ([key, route]) => `
            <div class="route-row">
              <span class="status-dot"></span>
              <strong>${escapeHtml(key)}</strong>
              <span>${escapeHtml(route.status || "unknown")}</span>
              <p>${escapeHtml(route.purpose || route.label || "No purpose exposed.")}</p>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">No routes exposed.</div>`;
}

function renderGateList(guardrails) {
  const list = $("#gate-list");
  if (!list) return;
  const preferred = [
    "truth_state",
    "volunteer_bad_news",
    "source_backed_or_labeled",
    "no_conflating",
    "prompt_plus_gates",
    "trust_by_design",
    "anti_sycophancy",
    "router_transparency",
    "mirrordash_glass",
    "current_facts_require_source_check",
    "failsafe",
    "resolution_contract",
  ];
  const rows = preferred
    .filter((key) => key in guardrails)
    .map((key) => [key, guardrails[key]]);
  list.innerHTML = rows.length
    ? rows
        .map(
          ([key, value]) => `
            <div class="gate-row">
              <span class="status-dot"></span>
              <strong>${escapeHtml(key.replaceAll("_", " "))}</strong>
              <span>${escapeHtml(compact(value))}</span>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">No guardrails exposed.</div>`;
}

function updateGlass(payload) {
  const glass = payload?.glass || {};
  const route = payload?.route || glass.router || {};
  const memory = glass.memory || {};
  const prompt = glass.prompt || {};
  const tools = glass.tools || {};
  const truth = payload?.truth_state || {};
  const receiptId = payload?.receipt_id || state.lastReceipt?.receipt_id;

  setText("#glass-provider", route.provider || route.answered_provider || route.primary || "not exposed");
  setText("#glass-model", route.model || route.answered_model || "not exposed");
  setText("#glass-route", route.capability || route.selected_capability || route.label || "not exposed");
  setText("#glass-truth", truth.status || glass.gates?.truth_state || "not exposed");
  setText("#glass-memory", memory.mode ? `${memory.mode}: ${compact(memory.used)}` : "scoped only after response");
  setText("#glass-tools", tools.used ? compact(tools.used) : "none");
  setText("#glass-prompt", prompt.prompt_hash ? `hash ${shortHash(prompt.prompt_hash)}` : "hash not exposed");
  setText("#glass-receipt", receiptId || "pending");

  setText("#computer-status", glass.tools?.used?.length ? `Tools used: ${compact(glass.tools.used)}` : "No computer-use tool was invoked for this turn.");
  setText("#filesystem-status", glass.memory?.excluded ? `Excluded: ${compact(glass.memory.excluded)}` : "No local files were exposed to the gateway.");

  if (view === "ops") {
    setText("#ops-last-receipt", receiptId || "none");
    setText("#ops-provider", route.provider || route.answered_provider || "none");
    setText("#ops-model", route.model || route.answered_model || "none");
    setText("#ops-truth", truth.status || glass.gates?.truth_state || "none");
    setText("#ops-memory", memory.mode ? `${memory.mode}: ${compact(memory.used)}` : "none");
    setText("#ops-prompt", prompt.prompt_hash ? shortHash(prompt.prompt_hash) : "none");
    setText("#ops-tools", tools.used ? compact(tools.used) : "none");
  }
}

function saveLastReceipt(payload) {
  const receipt = {
    saved_at: new Date().toISOString(),
    receipt_id: payload?.receipt_id || null,
    route: payload?.route || null,
    truth_state: payload?.truth_state || null,
    glass: payload?.glass || null,
    mirror_receipt: payload?.mirror?.receipt || null,
  };
  state.lastReceipt = receipt;
  writeJson(LAST_RECEIPT_KEY, receipt);
  updateGlass(payload);
}

function renderSavedOpsReceipt() {
  if (!state.lastReceipt) return;
  updateGlass({
    receipt_id: state.lastReceipt.receipt_id,
    route: state.lastReceipt.route,
    truth_state: state.lastReceipt.truth_state,
    glass: state.lastReceipt.glass,
  });
}

function appendTurn(role, body) {
  const thread = $("#thread");
  if (!thread) return null;
  const article = document.createElement("article");
  article.className = `turn ${role === "user" ? "user-turn" : "mirror-turn"}`;
  article.innerHTML = `
    <div class="speaker">${role === "user" ? "You" : "Active Mirror"}</div>
    ${body}
  `;
  thread.append(article);
  article.scrollIntoView({ behavior: "smooth", block: "end" });
  return article;
}

function renderMirrorPayload(payload) {
  const mirror = payload?.mirror || {};
  const receipt = mirror.receipt || {};
  const visual = mirror.visual || {};
  const truth = payload?.truth_state || {};
  const truthClass = truth.status && truth.status !== "checked" ? "warn" : "";
  return `
    <p>${escapeHtml(mirror.reflection || "No reflection returned.")}</p>
    <section class="answer-block">
      <span>Better question</span>
      <strong>${escapeHtml(mirror.question || visual.right || "No question returned.")}</strong>
    </section>
    <section class="answer-block move-block">
      <span>One move</span>
      <strong>${escapeHtml(mirror.move || "No move returned.")}</strong>
    </section>
    <details class="receipt-details" open>
      <summary>Receipt</summary>
      <dl>
        <div><dt>Why</dt><dd>${escapeHtml(receipt.why || "not exposed")}</dd></div>
        <div><dt>Used</dt><dd>${escapeHtml(receipt.context_used || "not exposed")}</dd></div>
        <div><dt>Excluded</dt><dd>${escapeHtml(receipt.context_excluded || "not exposed")}</dd></div>
        <div><dt>Memory</dt><dd>${escapeHtml(receipt.memory_decision || "not exposed")}</dd></div>
      </dl>
    </details>
    <div class="truth-strip ${truthClass}">
      <span class="status-dot ${truthClass}"></span>
      ${escapeHtml(truth.label || truth.status || "Truth state not exposed.")}
    </div>
  `;
}

async function sendPrompt(text) {
  const route = $("#route-select")?.value || "reflection";
  const boundary = $("#boundary-select")?.value || "personal";
  const send = $("#send");
  state.turn += 1;
  appendTurn("user", `<p>${escapeHtml(text)}</p>`);
  const pending = appendTurn("mirror", `<p class="pending">routing through gateway...</p>`);
  if (send) send.disabled = true;

  try {
    const response = await fetch(`${GATEWAY_ORIGIN}/v1/mirror/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Active-Mirror-Debug": "1",
      },
      body: JSON.stringify({
        intent: text,
        boundary,
        route,
        turn: state.turn,
        trust_mode: "approved",
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "gateway_unavailable");
    }
    if (pending) {
      pending.innerHTML = `<div class="speaker">Active Mirror</div>${renderMirrorPayload(payload)}`;
    }
    saveLastReceipt(payload);
    state.thread.push({ role: "user", text, at: new Date().toISOString() });
    writeJson(SESSION_KEY, state.thread.slice(-8));
  } catch {
    if (pending) {
      pending.innerHTML = `
        <div class="speaker">Active Mirror</div>
        <p>I could not reach the gateway for this turn.</p>
        <section class="answer-block move-block">
          <span>One move</span>
          <strong>${productionOrigin ? "Keep the request local and try again after checking gateway health." : "Use the production origin for live model routing, or keep this local preview as UI-only."}</strong>
        </section>
        <div class="truth-strip warn"><span class="status-dot warn"></span>Gateway call failed; no model answer was produced.</div>
      `;
    }
  } finally {
    if (send) send.disabled = false;
    $("#prompt")?.focus();
  }
}

function hydratePromptFromUrl() {
  const prompt = $("#prompt");
  if (!prompt) return;
  const params = new URLSearchParams(window.location.search);
  const text = params.get("prompt");
  if (text) prompt.value = text;
}

function initChat() {
  hydratePromptFromUrl();
  renderSavedOpsReceipt();
  $("#composer")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const prompt = $("#prompt");
    const text = prompt?.value.trim() || "";
    if (text.length < 8) {
      prompt?.focus();
      return;
    }
    prompt.value = "";
    void sendPrompt(text);
  });
  $("#prompt")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("#composer")?.requestSubmit();
    }
  });
  document.querySelectorAll("[data-starter]").forEach((button) => {
    button.addEventListener("click", () => {
      const text = button.getAttribute("data-starter") || "";
      const prompt = $("#prompt");
      if (prompt) {
        prompt.value = text;
        prompt.focus();
      }
    });
  });
}

function initOps() {
  renderSavedOpsReceipt();
  $("#refresh-ops")?.addEventListener("click", () => {
    void loadHealth();
    renderSavedOpsReceipt();
  });
}

void loadHealth();
if (view === "chat") initChat();
if (view === "ops") initOps();
