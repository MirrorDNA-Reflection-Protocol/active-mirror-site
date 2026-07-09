import "./cockpit.css";

const GATEWAY_ORIGIN = "https://gateway.activemirror.ai";
const LOCAL_BRIDGE_ORIGIN = "http://127.0.0.1:8766";
const LAST_RECEIPT_KEY = "activeMirrorCockpitLastReceipt";
const SESSION_KEY = "activeMirrorCockpitThread";
const productionOrigin = window.location.origin === "https://activemirror.ai";

const view = document.body.dataset.view || "chat";
const state = {
  turn: 0,
  health: null,
  localBridge: null,
  localBridgeError: null,
  pendingApproval: null,
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

function lineBreaks(value) {
  return escapeHtml(value || "").replace(/\n/g, "<br>");
}

function listItems(values) {
  const items = Array.isArray(values) ? values : values ? [values] : [];
  return items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>None exposed.</li>";
}

async function loadHealth() {
  if (!productionOrigin) {
    renderHealth(null, "production origin required");
    return null;
  }
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

async function requestLocalBridge(path, options = {}) {
  const response = await fetch(`${LOCAL_BRIDGE_ORIGIN}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(payload?.error || `local_bridge_${response.status}`);
  }
  return payload;
}

async function loadLocalBridge() {
  try {
    const payload = await requestLocalBridge("/api/health", { method: "GET", headers: {} });
    if (!payload?.ok) throw new Error(payload?.status || "local_bridge_unhealthy");
    state.localBridge = payload;
    state.localBridgeError = null;
    renderLocalBridge(payload);
    return payload;
  } catch (error) {
    state.localBridge = null;
    state.localBridgeError = error instanceof Error ? error.message : String(error);
    renderLocalBridge(null);
    return null;
  }
}

function renderLocalBridge(payload) {
  const attached = Boolean(payload?.ok);
  const dot = $("#local-bridge-dot");
  const opsDot = $("#ops-local-dot");
  const card = $("#local-bridge-card");
  const status = $("#local-bridge-status");
  const detail = $("#local-bridge-detail");
  if (dot) dot.classList.toggle("warn", !attached);
  if (opsDot) opsDot.classList.toggle("warn", !attached);
  if (card) card.classList.toggle("is-attached", attached);
  if (status) status.textContent = attached ? "Local Harness Console attached." : "Local bridge not reachable from this browser.";
  if (detail) {
    detail.textContent = attached
      ? `${payload.chat_mode || "local_cockpit"} · ${payload.approved_action_count || 0} reviewed actions · broad tools ${payload.can_execute_tools ? "enabled" : "blocked"}`
      : `Expected ${LOCAL_BRIDGE_ORIGIN}. ${state.localBridgeError || "No health payload."}`;
  }

  setText("#ops-local-status", attached ? "attached" : "not reachable");
  setText("#ops-local-mode", payload?.chat_mode || state.localBridgeError || "not attached");
  setText("#ops-local-actions", attached ? `${payload.approved_action_count || 0} reviewed` : "0");
  setText("#ops-local-memory", payload?.memory_write_mode || "not exposed");
  setText(
    "#computer-status",
    attached
      ? "Local bridge can plan fixed reviewed actions with approval; arbitrary computer control is still blocked."
      : "No computer-use tool was invoked for this turn."
  );
  setText(
    "#filesystem-status",
    attached
      ? "Filesystem writes require reviewed action specs and allow-once approval."
      : "No local files are exposed to the gateway."
  );
  renderLocalPermission();
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

function updateGlassFromLocal(payload) {
  const route = payload?.route || {};
  const worker = payload?.worker || {};
  const actionPlan = payload?.action_plan || {};
  const tools = route.tools_used || actionPlan.results?.map((result) => result.id) || [];
  const receiptId = payload?.receipt?.receipt_id || payload?.action_receipt?.receipt_id || "pending";

  setText("#glass-provider", "local harness");
  setText("#glass-model", route.model_worker_id || worker.model || "deterministic_harness");
  setText("#glass-route", route.selected_lane || route.route_decision || "local");
  setText("#glass-truth", payload?.status || "not exposed");
  setText("#glass-memory", payload?.bootloader?.ref_count ? `${payload.bootloader.ref_count} boot refs` : "boot refs not exposed");
  setText("#glass-tools", tools.length ? compact(tools) : "none");
  setText("#glass-prompt", payload?.receipt?.generated_at ? "local receipt" : "hash not exposed");
  setText("#glass-receipt", receiptId);

  if (view === "ops") {
    setText("#ops-last-receipt", receiptId);
    setText("#ops-provider", "local harness");
    setText("#ops-model", route.model_worker_id || worker.model || "deterministic_harness");
    setText("#ops-truth", payload?.status || "none");
    setText("#ops-memory", payload?.bootloader?.ref_count ? `${payload.bootloader.ref_count} boot refs` : "none");
    setText("#ops-prompt", "local receipt");
    setText("#ops-tools", tools.length ? compact(tools) : "none");
  }
}

function renderLocalActionPlan(plan) {
  if (!plan?.requested) return "";
  const packet = plan.approval_packet || {};
  return `
    <section class="answer-block local-action-block">
      <span>Action gate</span>
      <strong>${escapeHtml(plan.decision || "unknown")}</strong>
      <p>${escapeHtml(plan.required_next || "No next step exposed.")}</p>
      ${plan.bad_news?.length ? `<ul>${listItems(plan.bad_news)}</ul>` : ""}
      ${
        packet.approval_id
          ? `<p class="small-note">Permission card: ${escapeHtml(packet.label || packet.approval_id)}</p>`
          : ""
      }
    </section>
  `;
}

function renderLocalEnvelope(payload) {
  const answer = payload?.answer || "Local bridge returned no answer.";
  const receipt = payload?.receipt || payload?.action_receipt || {};
  const truth = payload?.truth || {};
  const badNews = truth.bad_news || payload?.bad_news || [];
  return `
    <div class="local-answer">${lineBreaks(answer)}</div>
    ${renderLocalActionPlan(payload?.action_plan)}
    <details class="receipt-details" open>
      <summary>Local receipt</summary>
      <dl>
        <div><dt>Status</dt><dd>${escapeHtml(payload?.status || "unknown")}</dd></div>
        <div><dt>Receipt</dt><dd>${escapeHtml(receipt.receipt_id || "not exposed")}</dd></div>
        <div><dt>Route</dt><dd>${escapeHtml(payload?.route?.selected_lane || payload?.route?.route_decision || "not exposed")}</dd></div>
        <div><dt>Worker</dt><dd>${escapeHtml(payload?.route?.model_worker_id || payload?.worker?.model || "deterministic_harness")}</dd></div>
      </dl>
    </details>
    <div class="truth-strip ${payload?.ok ? "" : "warn"}">
      <span class="status-dot ${payload?.ok ? "" : "warn"}"></span>
      ${escapeHtml(badNews[0] || "Local bridge response was receipt-backed.")}
    </div>
  `;
}

function renderLocalPermission(result = null) {
  const node = $("#local-permission");
  if (!node) return;
  if (result) {
    node.className = `permission-mini ${result.ok ? "pass" : "blocked"}`;
    node.innerHTML = `
      <strong>${escapeHtml(result.status || "permission result")}</strong>
      <p>${escapeHtml(result.answer || result.required_next || result.bad_news?.[0] || "Receipt returned.")}</p>
      <code>${escapeHtml(result.receipt?.receipt_id || "no receipt")}</code>
    `;
    return;
  }
  const packet = state.pendingApproval;
  if (!packet) {
    node.className = "permission-mini empty";
    node.innerHTML = `<strong>No action waiting</strong><p>Reviewed actions appear here before execution.</p>`;
    return;
  }
  if (!packet.executable) {
    node.className = "permission-mini blocked";
    node.innerHTML = `
      <strong>${escapeHtml(packet.decision || "blocked")}</strong>
      <p>${escapeHtml(packet.reason || packet.required_next || "No reviewed backend action matched this request.")}</p>
    `;
    return;
  }
  node.className = "permission-mini waiting";
  node.innerHTML = `
    <strong>${escapeHtml(packet.label || "Permission required")}</strong>
    <p>${escapeHtml(packet.effect || "Review before execution.")}</p>
    <dl>
      <div><dt>Risk</dt><dd>${escapeHtml(packet.risk || "unknown")}</dd></div>
      <div><dt>Command</dt><dd><code>${escapeHtml(packet.command || "not exposed")}</code></dd></div>
    </dl>
    <div class="bridge-actions">
      <button type="button" data-approval="allow_once">Approve once</button>
      <button type="button" data-approval="deny">Deny</button>
    </div>
  `;
  node.querySelectorAll("[data-approval]").forEach((button) => {
    button.addEventListener("click", () => {
      void handleLocalApproval(button.getAttribute("data-approval") || "deny");
    });
  });
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
  const pending = appendTurn("mirror", `<p class="pending">routing through ${route === "local" ? "local harness" : "gateway"}...</p>`);
  if (send) send.disabled = true;

  if (route === "local") {
    try {
      const payload = await requestLocalBridge("/api/chat/route", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          selected_surface: "active_mirror_cockpit",
        }),
      });
      state.pendingApproval = payload?.action_plan?.approval_packet?.approval_id ? payload.action_plan.approval_packet : null;
      if (pending) {
        pending.innerHTML = `<div class="speaker">Active Mirror</div>${renderLocalEnvelope(payload)}`;
      }
      updateGlassFromLocal(payload);
      renderLocalPermission();
      state.thread.push({ role: "user", text, at: new Date().toISOString(), route: "local" });
      writeJson(SESSION_KEY, state.thread.slice(-8));
    } catch (error) {
      if (pending) {
        pending.innerHTML = `
          <div class="speaker">Active Mirror</div>
          <p>I could not reach the local Harness Console bridge.</p>
          <section class="answer-block move-block">
            <span>One move</span>
            <strong>Open ${LOCAL_BRIDGE_ORIGIN} locally or use the gateway route until the local listener is reachable.</strong>
          </section>
          <div class="truth-strip warn"><span class="status-dot warn"></span>${escapeHtml(error instanceof Error ? error.message : String(error))}</div>
        `;
      }
      await loadLocalBridge();
    } finally {
      if (send) send.disabled = false;
      $("#prompt")?.focus();
    }
    return;
  }

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

async function planLocalAction() {
  const prompt = $("#prompt");
  const text = prompt?.value.trim() || state.thread.at(-1)?.text || "What can this cockpit actually control today?";
  const node = $("#local-permission");
  if (node) {
    node.className = "permission-mini waiting";
    node.innerHTML = `<strong>Planning</strong><p>Checking the reviewed local action allowlist.</p>`;
  }
  try {
    const payload = await requestLocalBridge("/api/action/plan", {
      method: "POST",
      body: JSON.stringify({
        message: text,
        selected_surface: "active_mirror_cockpit",
      }),
    });
    state.pendingApproval = payload?.action_plan?.approval_packet?.approval_id ? payload.action_plan.approval_packet : null;
    updateGlassFromLocal(payload);
    if (!state.pendingApproval && node) {
      node.className = payload?.ok ? "permission-mini pass" : "permission-mini blocked";
      node.innerHTML = `
        <strong>${escapeHtml(payload?.action_plan?.decision || payload?.status || "planned")}</strong>
        <p>${escapeHtml(payload?.action_plan?.required_next || payload?.answer || "No executable permission card was created.")}</p>
        <code>${escapeHtml(payload?.receipt?.receipt_id || payload?.action_receipt?.receipt_id || "no receipt")}</code>
      `;
    } else {
      renderLocalPermission();
    }
  } catch (error) {
    state.pendingApproval = null;
    if (node) {
      node.className = "permission-mini blocked";
      node.innerHTML = `<strong>Bridge error</strong><p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
    }
    await loadLocalBridge();
  }
}

async function handleLocalApproval(decision) {
  const packet = state.pendingApproval;
  if (!packet?.approval_id || !packet?.approval_token) return;
  const node = $("#local-permission");
  if (node) {
    node.className = "permission-mini waiting";
    node.innerHTML = `<strong>Submitting</strong><p>${escapeHtml(decision)} for ${escapeHtml(packet.label || packet.approval_id)}.</p>`;
  }
  try {
    const payload = await requestLocalBridge("/api/action/approve", {
      method: "POST",
      body: JSON.stringify({
        approval_id: packet.approval_id,
        approval_token: packet.approval_token,
        decision,
      }),
    });
    state.pendingApproval = null;
    renderLocalPermission(payload);
    updateGlassFromLocal(payload);
  } catch (error) {
    if (node) {
      node.className = "permission-mini blocked";
      node.innerHTML = `<strong>Approval error</strong><p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
    }
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
  $("#plan-local-action")?.addEventListener("click", () => {
    void planLocalAction();
  });
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
    void loadLocalBridge();
    renderSavedOpsReceipt();
  });
}

void loadHealth();
void loadLocalBridge();
if (view === "chat") initChat();
if (view === "ops") initOps();
