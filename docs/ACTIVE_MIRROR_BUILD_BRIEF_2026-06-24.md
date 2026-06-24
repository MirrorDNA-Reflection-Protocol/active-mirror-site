# Active Mirror — Build Brief (what we want done)
_2026-06-24 · grounded in field observation + cited research, not our preferences_

## THE ONE LINE
**"An AI that tells you when you're wrong — then actually finishes the work. Your memory, your reasoning, yours to verify. Not a yes-man. Not a demo."**

Short form: **ChatGPT answers. Active Mirror gets the work moving — and tells you the truth.**

## THE USER (who we build for, in order)
- **Sell to first: founders / indie hackers.** Most viral, they pay, and they feel the two biggest pains hardest (yes-man + doesn't-finish-work). Where: Indie Hackers, r/SaaS, Product Hunt, build-in-public X.
- **Earn credibility from: researchers.** They have the sharpest, best-evidenced anti-sycophancy proof. Use their voice in messaging.
- **Not first (but real): ADHD/neurodivergent** — highest emotion, but ethically fraught (don't monetize attachment); treat as values-led community.
- **Separate track: India** — pain is cost + language, NOT sycophancy. Different message; don't blend.

## WHAT ACTIVE MIRROR IS (one breath)
A frustrated AI user does a short **BrainScan** → gets a **Mirror Seed** (a portable AI identity they own and control) → Active Mirror **reflects with them**: pushes back (anti-sycophant), produces a **finished, usable artifact** (closes the last mile), remembers them **on their terms**, and lets them **verify** the reasoning.

## BUILD THIS (ranked by what users actually want)
1. **Anti-sycophantic reflection — THE HERO.** The loop must visibly push back / surface the weak assumption / say "this is wrong because…". This is the #1 user demand and our strongest fit. It is the homepage centerpiece.
2. **Finish-the-work artifact — THE PROOF.** Output is a finished, **exportable** artifact + the one next move — not a wall of text. The bar is "didn't create rework." Named enemy in copy: **"workslop."**
3. **Mirror Seed = user-controlled memory.** Portable identity the user owns; with **visible "what your AI knows / edit / decay" controls**. One-click "load my Mirror into ChatGPT/Claude" via MCP. Home: `id.activemirror.ai`.
4. **BrainScan = the front door.** ~8 questions → archetype, but **Big-Five-anchored, probabilistic ("you lean Architect · 72%"), and LIVING (recalibrates from real usage).** Output a shareable, Wrapped-style **cognitive-fingerprint card.** Tone: "a starting hypothesis your Twin refines," never "find your true self."
5. **Verify / receipt = trust strip (demoted).** Keep the cryptographic receipt as a **calm, glanceable trust signal** + the **enterprise** proof artifact. It is NOT the consumer hero.

## CUT / DEMOTE
- **Demote** the dark cryptographic receipt from homepage centerpiece → quiet trust strip (DOI/verify on demand).
- **Drop** "it sounds like you / sounds like me" as a headline claim.
- **Cut** generic "governed AI · receipt-backed" as the lead message.

## NEVER SHIP (the landmines — non-negotiable)
- **Anti-sycophancy as a system prompt only.** Researchers proved you can't prompt your way out of it; prompt-only = parity = collapses. It must be **architectural / governed**.
- **A fixed MBTI-style type.** 8Q→1-of-8 rigid box = horoscope = kills a trust brand. Must be Big-Five, probabilistic, living.
- **Static memory.** A frozen Mirror Seed inherits "context rot" — the exact thing users are fleeing. Memory must be visible, editable, and decay-aware.
- **Over-claiming personalization.** "Sounds like me" is the weakest-proven claim; do not lead with it.

## PHASE 1 — first shippable (active-mirror-site homepage)
Re-aim the homepage on a branch:
- **Hero copy** = THE ONE LINE (anti-sycophant + finish-the-work). Named enemies: "yes-man / glazing" and "workslop."
- **The stage (empty → result):** result = the **pushback** (what's wrong / the weak assumption) + the **finished artifact** + the one next move. Receipt → calm trust strip with verify/DOI on demand (reuse what we already built, demoted).
- **BrainScan entry point:** "Build your Mirror" → `/scan` (reframed, Big-Five).
- No new backend required for copy/layout; anti-sycophancy depends on Open Decision #1.

## DONE WHEN (success criteria)
A founder lands and, in one screen: gets **pushed back on** (not flattered) → gets a **finished artifact + next move** → sees **"your memory, you control it"** → can **verify** — with the receipt as a quiet signal, not a control panel.
- **Behavioral proof:** the "pause" converts to **engagement** (types again / saves / shares), not a bounce.

## OPEN DECISIONS (only Paul can answer — block parts of the build)
1. **Anti-sycophancy:** can the gateway push back **architecturally** today, or must we build it? (Decides whether the Phase-1 hero is real or aspirational.)
2. **BrainScan:** revive the existing `/scan` React SPA (re-anchor to Big Five) or rebuild it?
3. **Mirror Seed:** where does the identity live and how does "load into ChatGPT" work (MCP)? `id.activemirror.ai` is the home — what's its job?

## EVIDENCE (receipts)
- Sycophancy is #1, viral, forced an OpenAI rollback: [HN "shit on a stick"](https://news.ycombinator.com/item?id=43840842) · [OpenAI postmortem](https://openai.com/index/sycophancy-in-gpt-4o/). Can't be prompted away: [MIT/CAIS](https://arxiv.org/pdf/2602.19141).
- "Workslop" quantified — ~40% of workers, ~2 hrs rework, ~$9M/yr per 10k: [HBR](https://hbr.org/2025/09/ai-generated-workslop-is-destroying-productivity) · [Entrepreneur](https://www.entrepreneur.com/business-news/ai-workslop-is-a-9-million-issue-stanford-betterup-study/497483).
- Memory: control is the unmet need; static memory rots: [Every](https://every.to/also-true-for-humans/why-i-turned-off-chatgpt-s-memory) · [Yale SOM "who owns your AI memory"](https://som.yale.edu/story/2026/who-owns-your-ai-memory). Consumer-owned identity is open white space; infra is funded B2B (Mem0 $24M).
- Prompt-personalization still sounds like AI: [HN](https://news.ycombinator.com/item?id=47624687).
- BrainScan as growth: typing quizzes are the highest-converting/most-shared format ([16Personalities #3,692 globally](https://www.similarweb.com/website/16personalities.com/)); credibility risk = MBTI "widely regarded as pseudoscience" ([Wikipedia](https://en.wikipedia.org/wiki/Myers%E2%80%93Briggs_Type_Indicator)).
- Artifact-as-format is commoditizing (Claude Artifacts 500M+); the open space is the **last mile**: [claude.com](https://claude.com/blog/build-artifacts).

_Sourcing honesty: quiz-conversion & Wrapped figures are vendor/agency-sourced (directional); several user quotes are journalism-corroborated (Reddit was crawler-blocked); "archetype sustains retention" is a hypothesis to test, not a proven fact._
