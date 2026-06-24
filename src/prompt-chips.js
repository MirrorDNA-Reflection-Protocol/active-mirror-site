// Primed prompt chips — remove the blank-page problem and make the first action invite pushback.
// Clicking a chip pre-fills the reflection input and focuses it, so the user's first move is a
// challenge ("argue the other side", "what am I getting wrong") — the USP, felt not described.
function init() {
  const input = document.querySelector("#ritual-intent");
  const chips = document.querySelectorAll("[data-prompt-chip]");
  if (!input || !chips.length) return;
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.getAttribute("data-prompt-chip") || "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      // place the cursor at the end so they can finish the sentence
      const end = input.value.length;
      try { input.setSelectionRange(end, end); } catch { /* ignore */ }
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
