const goal = document.querySelector("#goal");
const audience = document.querySelector("#audience");
const source = document.querySelector("#source");
const language = document.querySelector("#language");
const guardrails = document.querySelector("#guardrails");
const formatButtons = Array.from(document.querySelectorAll(".format-button"));
const emailBrief = document.querySelector("#emailBrief");
const copyBrief = document.querySelector("#copyBrief");
const copyStatus = document.querySelector("#copyStatus");
const preview = {
  goal: document.querySelector("#previewGoal"),
  audience: document.querySelector("#previewAudience"),
  source: document.querySelector("#previewSource"),
  format: document.querySelector("#previewFormat"),
  script: document.querySelector("#previewScript"),
};

let selectedFormat = "Starter reel";

function currentBrief() {
  return {
    goal: goal.value.trim() || "Define the business goal",
    audience: audience.value.trim() || "Define the audience",
    source: source.value.trim() || "List available source material",
    language: language.value,
    guardrails: guardrails.value.trim() || "No special guardrails listed",
    format: selectedFormat,
  };
}

function briefText(brief) {
  return [
    "MirrorProd India brief",
    "",
    `Goal: ${brief.goal}`,
    `Audience: ${brief.audience}`,
    `Source material: ${brief.source}`,
    `Format: ${brief.format}`,
    `Language: ${brief.language}`,
    `Guardrails: ${brief.guardrails}`,
  ].join("\n");
}

function updateBrief() {
  const brief = currentBrief();
  preview.goal.textContent = brief.goal;
  preview.audience.textContent = brief.audience;
  preview.source.textContent = brief.source;
  preview.format.textContent = `${brief.format} in ${brief.language}`;
  preview.script.textContent =
    `Make a short business video for ${brief.audience.toLowerCase()} that helps ${brief.goal.toLowerCase()}, using ${brief.source.toLowerCase()}. Keep the delivery clean and respect these guardrails: ${brief.guardrails}.`;
  emailBrief.href =
    "mailto:hello@activemirror.ai?subject=MirrorProd%20India%20brief&body=" +
    encodeURIComponent(briefText(brief));
}

formatButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedFormat = button.dataset.format;
    formatButtons.forEach((item) => item.classList.toggle("is-selected", item === button));
    updateBrief();
  });
});

[goal, audience, source, language, guardrails].forEach((field) => {
  field.addEventListener("input", updateBrief);
});

copyBrief.addEventListener("click", async () => {
  const text = briefText(currentBrief());
  try {
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = "Copied";
  } catch {
    copyStatus.textContent = "Select text";
  }
  window.setTimeout(() => {
    copyStatus.textContent = "Ready";
  }, 1800);
});

updateBrief();
