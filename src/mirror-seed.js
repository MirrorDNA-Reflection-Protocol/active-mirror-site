// Mirror Seed — a portable, user-controlled AI identity + public-safe boot packet, minted in the browser.
// Deterministic by design: the same answers always produce the same Seed.
// Nothing leaves the browser unless the user exports it. ("memory you control" pillar.)
//
// Honest scope (Mode A): the Seed carries the PUBLIC-SAFE boot packet — sanitized bootloader
// doctrine + the contracts the user accepts. Real ENFORCEMENT happens on our rail (the gateway).
// Injected into a third-party model it is a nudge, not deterministic control.

const SEED_KEY = "activeMirrorSeed";
const SEED_VERSION = "seed.v2";

// Big-Five-anchored BrainScan. Each question nudges one trait. Probabilistic, not a fixed type.
// Traits: O openness, C conscientiousness, E extraversion, A agreeableness, S stability.
const QUESTIONS = [
  { q: "When you hit a hard problem, you reach first for…", a: { label: "A new angle nobody's tried", trait: "O" }, b: { label: "A proven method that works", trait: "C" } },
  { q: "Your draft work tends to be…", a: { label: "Fast and rough — fix it later", trait: "O" }, b: { label: "Slow and finished — get it right", trait: "C" } },
  { q: "You think best…", a: { label: "Out loud, with people", trait: "E" }, b: { label: "Alone, in your head", trait: "S" } },
  { q: "When someone's plan is weak, you…", a: { label: "Say it straight, even if it stings", trait: "C" }, b: { label: "Soften it so they can hear it", trait: "A" } },
  { q: "Under pressure you…", a: { label: "Stay level and keep moving", trait: "S" }, b: { label: "Feel it hard, then channel it", trait: "E" } },
  { q: "What you want from an AI is…", a: { label: "A sparring partner that pushes back", trait: "C" }, b: { label: "A thinking partner that opens things up", trait: "O" } },
];

const ARCHETYPES = {
  O: { name: "Explorer", line: "Challenge my assumptions and stop me over-exploring — make me choose." },
  C: { name: "Architect", line: "Push me on rigor and follow-through — don't let me hand-wave." },
  E: { name: "Catalyst", line: "Match my energy, but tell me when I'm moving too fast." },
  A: { name: "Connector", line: "Be direct with me — I default to keeping the peace." },
  S: { name: "Anchor", line: "Surface the risk I'm calmly ignoring." },
};

// Public-safe boot packet — the sanitized bootloader + contracts the Seed carries and injects.
// Mirrors the body's ACTIVE_MIRROR bootloader/contracts, PUBLIC-SAFE tier only.
const BOOT_PACKET = {
  version: "boot.v1",
  doctrine: "Accuracy without fabrication. If proof, memory, or certainty is missing, name the gap and return the next safe step.",
  sequence: ["load boot packet", "apply accepted contracts", "reflect before predicting", "name the weak assumption + next safe step", "leave a receipt"],
  contracts: [
    { id: "reflection", title: "Reflection (anti-sycophancy)", clause: "Reflect before predicting. Match my directness, name the weak assumption, never flatter." },
    { id: "accuracy", title: "Accuracy", clause: "Do not fabricate. Where proof or certainty is missing, say so and give the next safe step." },
    { id: "consent", title: "Consent / memory", clause: "Nothing becomes saved memory or proof without my consent and a receipt." },
    { id: "boundary", title: "Boundary", clause: "Keep my private context out of the request unless I approve it." },
  ],
};

function scoreAnswers(answers) {
  const scores = { O: 0, C: 0, E: 0, A: 0, S: 0 };
  answers.forEach((choice, i) => {
    const pick = QUESTIONS[i][choice];
    if (pick) scores[pick.trait] += 1;
  });
  return scores;
}

function mintSeed(answers) {
  const scores = scoreAnswers(answers);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, v]) => s + v, 0) || 1;
  const [t0, s0] = ranked[0];
  const [t1, s1] = ranked[1];
  const blended = s1 === s0 && s0 > 0; // honest: a tie is a blend, not a forced single type
  const archetype = blended
    ? { key: `${t0}${t1}`, name: `${ARCHETYPES[t0].name} / ${ARCHETYPES[t1].name} blend`, confidence: Math.round(((s0 + s1) / total) * 100) }
    : { key: t0, name: ARCHETYPES[t0].name, confidence: Math.round((s0 / total) * 100) };
  return {
    version: SEED_VERSION,
    created: new Date().toISOString(),
    traits: scores,
    archetype,
    reflectionStyle: (ARCHETYPES[t0] || ARCHETYPES.C).line,
    note: "",
    boot: { version: BOOT_PACKET.version, doctrine: BOOT_PACKET.doctrine, sequence: BOOT_PACKET.sequence.slice() },
    contracts: BOOT_PACKET.contracts.map((c) => ({ ...c, accepted: true })),
  };
}

function loadSeed() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEED_KEY) || "null");
    return raw && raw.version === SEED_VERSION ? raw : null;
  } catch {
    return null;
  }
}
function saveSeed(seed) {
  try { localStorage.setItem(SEED_KEY, JSON.stringify(seed)); return true; } catch { return false; }
}
function clearSeed() {
  try { localStorage.removeItem(SEED_KEY); } catch { /* ignore */ }
}

// Compact, model-ready boot packet the reflection injects (Phase-2 personalization).
// Carries identity + doctrine + the contracts the user accepted. Public-safe only.
export function seedSummary(seed = loadSeed()) {
  if (!seed) return "";
  const accepted = (seed.contracts || []).filter((c) => c.accepted).map((c) => c.clause);
  const parts = [
    `About me: I lean ${seed.archetype.name} (${seed.archetype.confidence}%).`,
    `How to reflect with me: ${seed.reflectionStyle}`,
  ];
  if (seed.boot?.doctrine) parts.push(`Doctrine: ${seed.boot.doctrine}`);
  if (accepted.length) parts.push(`Contracts I accept: ${accepted.join(" ")}`);
  return parts.join(" ").slice(0, 520);
}

export function getSeed() {
  return loadSeed();
}

// --- Self-sovereign signing key for the Mirror Seed (ECDSA P-256, Web Crypto) ---
// The private key is NON-extractable and lives only in this browser (IndexedDB).
// Receipts signed with it can be verified by anyone holding the Seed's public key.
const IDB_NAME = "activeMirrorKeys";
const IDB_STORE = "keys";

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key, val) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const r = tx.objectStore(IDB_STORE).get(key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// Generate the Seed's keypair: export the public JWK (carried in the Seed), re-import the
// private key as NON-extractable, and store only that CryptoKey — raw private bytes never persist.
async function attachSeedKey(seed) {
  try {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const pubJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
    const privJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
    const privKey = await crypto.subtle.importKey("jwk", privJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const keyId = toB64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(pubJwk)))).slice(0, 16);
    await idbPut(keyId, privKey);
    seed.pubKey = pubJwk;
    seed.keyId = keyId;
  } catch {
    // Signing is an enhancement; the Seed still works without a key.
  }
  return seed;
}

export async function signWithSeed(text, seed = loadSeed()) {
  try {
    if (!seed?.keyId) return null;
    const privKey = await idbGet(seed.keyId);
    if (!privKey) return null;
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privKey, new TextEncoder().encode(text));
    return { sig: toB64(sig), keyId: seed.keyId };
  } catch {
    return null;
  }
}

export async function verifyWithSeed(text, sigB64, pubJwk) {
  try {
    if (!pubJwk || !sigB64) return false;
    const pubKey = await crypto.subtle.importKey("jwk", pubJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pubKey, fromB64(sigB64), new TextEncoder().encode(text));
  } catch {
    return false;
  }
}

export function getSeedPublicKey(seed = loadSeed()) {
  return seed?.pubKey || null;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) node.append(c?.nodeType ? c : document.createTextNode(c));
  return node;
}

function render(mount) {
  const seed = loadSeed();
  mount.innerHTML = "";
  mount.append(seed ? renderMinted(mount, seed) : renderScan(mount));
  document.dispatchEvent(new CustomEvent("mirror-seed-change", { detail: { seed } }));
}

function renderScan(mount) {
  const answers = new Array(QUESTIONS.length).fill(null);
  const wrap = el("div", { class: "seed-scan" });
  wrap.append(
    el("div", { class: "seed-eyebrow" }, "BrainScan · 6 questions · private"),
    el("h2", { class: "seed-title" }, "Mint your Mirror Seed."),
    el("p", { class: "seed-sub" }, "Six questions map how you think. Your Seed lives in this browser — you own it, edit it, export it. It carries a boot packet: how your AI should reflect with you, and the contracts it must keep. A starting hypothesis your reflection refines, not a fixed type.")
  );
  const qList = el("div", { class: "seed-q-list" });
  QUESTIONS.forEach((item, i) => {
    const row = el("div", { class: "seed-q", "data-q": String(i) });
    const pickBtn = (choice) =>
      el("button", {
        type: "button", class: "seed-opt", "data-choice": choice, "aria-pressed": "false",
        onclick: () => {
          answers[i] = choice;
          row.querySelectorAll(".seed-opt").forEach((b) => b.setAttribute("aria-pressed", "false"));
          row.querySelector(`[data-choice="${choice}"]`).setAttribute("aria-pressed", "true");
          mintBtn.disabled = answers.includes(null);
          mintBtn.textContent = answers.includes(null) ? `Answer all 6 (${answers.filter(Boolean).length}/6)` : "Mint my Mirror Seed";
        },
      }, item[choice].label);
    row.append(el("p", { class: "seed-q-text" }, `${i + 1}. ${item.q}`), el("div", { class: "seed-opts" }, [pickBtn("a"), pickBtn("b")]));
    qList.append(row);
  });
  const mintBtn = el("button", {
    type: "button", class: "seed-mint", disabled: "true",
    onclick: async () => {
      if (answers.includes(null)) return;
      mintBtn.disabled = true;
      mintBtn.textContent = "Minting your Seed…";
      const seed = mintSeed(answers);
      await attachSeedKey(seed); // generate the Seed's signing key
      saveSeed(seed);
      render(mount);
    },
  }, "Answer all 6 (0/6)");
  wrap.append(qList, mintBtn);
  return wrap;
}

function renderMinted(mount, seed) {
  const wrap = el("div", { class: "seed-card" });
  const note = el("span", { class: "seed-note" }, "");

  const traitBars = el("div", { class: "seed-traits" },
    [["O", "Openness"], ["C", "Conscientiousness"], ["E", "Extraversion"], ["A", "Agreeableness"], ["S", "Stability"]].map(([k, label]) => {
      const pct = Math.round(((seed.traits[k] || 0) / Math.max(1, QUESTIONS.length)) * 100);
      return el("div", { class: "seed-trait" }, [
        el("span", { class: "seed-trait-k" }, label),
        el("span", { class: "seed-trait-bar" }, [el("span", { class: "seed-trait-fill", style: `width:${pct}%` })]),
      ]);
    })
  );

  const styleInput = el("textarea", { class: "seed-style", rows: "2", maxlength: "180", "aria-label": "How you want your AI to reflect with you" });
  styleInput.value = seed.reflectionStyle;

  // Boot packet + injectable contracts
  const contractRows = el("div", { class: "seed-contracts" },
    (seed.contracts || []).map((c, i) => {
      const cb = el("input", { type: "checkbox", class: "seed-contract-cb", id: `contract-${c.id}` });
      cb.checked = !!c.accepted;
      cb.addEventListener("change", () => {
        seed.contracts[i].accepted = cb.checked;
        saveSeed(seed);
        document.dispatchEvent(new CustomEvent("mirror-seed-change", { detail: { seed } }));
        note.textContent = cb.checked ? `Injecting "${c.title}".` : `Removed "${c.title}" from your boot packet.`;
      });
      return el("label", { class: "seed-contract", for: `contract-${c.id}` }, [
        cb,
        el("span", { class: "seed-contract-body" }, [
          el("strong", { class: "seed-contract-title" }, c.title),
          el("span", { class: "seed-contract-clause" }, c.clause),
        ]),
      ]);
    })
  );

  wrap.append(
    el("div", { class: "seed-card-head" }, [
      el("span", { class: "seed-eyebrow" }, "Your Mirror Seed · boot packet · in this browser"),
      el("strong", { class: "seed-archetype" }, `You lean ${seed.archetype.name} · ${seed.archetype.confidence}%`),
    ]),
    traitBars,
    el("label", { class: "seed-style-label" }, "How you want your AI to push back on you (edit freely):"),
    styleInput,
    el("div", { class: "seed-boot" }, [
      el("span", { class: "seed-boot-doctrine" }, seed.boot?.doctrine || BOOT_PACKET.doctrine),
      el("span", { class: "seed-contracts-label" }, "Contracts your Seed injects:"),
      contractRows,
    ]),
    el("div", { class: "seed-actions" }, [
      el("button", { type: "button", class: "seed-btn seed-btn-primary", onclick: () => {
        seed.reflectionStyle = styleInput.value.trim() || seed.reflectionStyle;
        saveSeed(seed);
        note.textContent = "Saved. Your reflection will use this boot packet.";
        document.dispatchEvent(new CustomEvent("mirror-seed-change", { detail: { seed } }));
      } }, "Save"),
      el("button", { type: "button", class: "seed-btn", onclick: () => {
        const blob = new Blob([JSON.stringify(seed, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = el("a", { href: url, download: "mirror-seed.json" });
        document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        note.textContent = "Exported mirror-seed.json — your boot packet, yours to carry.";
      } }, "Export"),
      el("button", { type: "button", class: "seed-btn", onclick: async () => {
        try { await navigator.clipboard.writeText(JSON.stringify(seed)); note.textContent = "Copied to clipboard."; }
        catch { note.textContent = "Copy unavailable — use Export."; }
      } }, "Copy"),
      el("button", { type: "button", class: "seed-btn seed-btn-ghost", onclick: () => { clearSeed(); render(mount); } }, "Reset"),
    ]),
    note
  );
  return wrap;
}

function init() {
  const mount = document.querySelector("#mirror-seed");
  if (!mount) return;
  render(mount);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
