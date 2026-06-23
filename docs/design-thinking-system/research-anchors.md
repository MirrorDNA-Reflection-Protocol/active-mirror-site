# Research Anchors

Last verified: 2026-06-23.

## CritiqueCrew

Source: [CritiqueCrew: Orchestrating Multi-Perspective Conversational Design Critique](https://arxiv.org/html/2602.01796v1)

Relevant signal:

- The system runs inside Figma and uses multiple expert roles, including UX, PM, and Engineer.
- It turns critique into an interactive remediation loop instead of a static problem list.
- Its studies found better design quality and better subjective experience than a static checker.
- The important trust mechanism is structured role orchestration, not one all-purpose model.

Active Mirror implication:

```text
One model is not enough.
Serious agent work needs roles, critique, repair paths, and evidence.
```

AMOS design response:

- Use a role critique panel before promoting a design, workflow, memory, or tool.
- Split generated work into role findings: UX, PM, Engineer, Privacy, QA.
- Every finding must include impact, evidence, repair path, and receipt status.

## Figma2Code

Source: [Figma2Code: Automating Multimodal Design to Code in the Wild](https://arxiv.org/html/2604.13648v1)

Relevant signal:

- Real Figma files contain richer information than screenshots: metadata, assets, hierarchy, and rendered views.
- Metadata can improve visual fidelity.
- Current model-generated UI code still struggles with responsiveness and maintainability.
- Direct Figma-to-production is not the safe pipeline.

Active Mirror implication:

```text
Figma can workshop and prototype.
Production still needs component contracts, coded implementation, QA, and receipts.
```

AMOS design response:

- Treat Figma as a design-thinking input, not a deployable source of truth.
- Require responsive checks before a design-generated page ships.
- Require maintainability checks: semantic structure, reusable components, stable layout, token discipline.
- Keep screenshots, Figma metadata, and generated code as separate evidence items.

## Human-on-the-Bridge

Source: [Human-on-the-Bridge: Scalable Evaluation for AI Agents](https://arxiv.org/abs/2606.16871)

Relevant signal:

- Human expertise is encoded upstream as reusable evaluator intelligence.
- The evaluator includes domain context, red-team traps, juror personas, scoring guidelines, audit rules, and fallback policies.
- It produces evidence-linked reports and catches failures missed by static benchmarks or single judges.

Active Mirror implication:

```text
Evaluation should be designed before the agent acts.
The user should approve the rules, not clean up vague output afterward.
```

AMOS design response:

- MirrorEval v0 must include jurors, traps, scoring, source rules, and fallback rules.
- Evaluation receipts should include both accepted and rejected evidence.
- Agent claims about tool calls, sources, memory, and actions must be checked against traces.

## Agent Orchestration Is Becoming Infrastructure

Sources:

- [Sakana Fugu](https://sakana.ai/fugu/)
- [Gemini Enterprise Agent Platform](https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform)
- [Microsoft Copilot Studio security and governance](https://learn.microsoft.com/en-us/microsoft-copilot-studio/security-and-governance)
- [OpenAI AgentKit update](https://openai.com/index/introducing-agentkit/)

Relevant signal:

- Sakana is packaging multi-agent coordination behind an OpenAI-compatible model/API.
- Google positions Gemini Enterprise Agent Platform around building, scaling, governing, and optimizing agents.
- Microsoft emphasizes governance, data residency, DLP, compliance, and security controls for agents.
- OpenAI is moving some builder/eval surfaces toward Agents SDK and Workspace Agents.

Active Mirror implication:

```text
Do not compete as "an orchestrator."
Compete as the trust/control plane above orchestrators.
```

AMOS design response:

- ToolGraph owns tool identity, permissions, fallback, tests, cost, and owner.
- MirrorEval owns evaluation and evidence.
- Default Ledger owns visible memory defaults.
- Somatic Reset owns drift recovery.
- Receipts own traceability.

## Enterprise Agent Evaluation

Sources:

- [EnterpriseClawBench](https://arxiv.org/abs/2606.23654)
- [PlanBench-XL](https://huggingface.co/papers/2606.22388)
- [CLI-Universe](https://arxiv.org/abs/2606.22883)
- [Skill-MAS](https://arxiv.org/abs/2606.18837)

Relevant signal:

- EnterpriseClawBench uses real workplace sessions to construct reproducible tasks and reports harness-model combinations, artifact delivery, visual quality, cost, runtime, and skill transfer.
- PlanBench-XL stresses long-horizon planning across large tool ecosystems with missing, failing, or distracting tools.
- CLI-Universe builds terminal-agent tasks through capability taxonomy, technical evidence, Dockerized environments, and fail-to-pass verification.
- Skill-MAS treats orchestration experience as an evolvable meta-skill instead of a weight update.

Active Mirror implication:

```text
Our product primitive is reusable judgment plus verified action.
```

AMOS design response:

- MirrorBench v0 converts real sessions into fail-to-pass task capsules.
- MirrorSkills v0 should evolve from successful/repeated task capsules, not vibes.
- Tool routes must include blocked-tool fallback and trace checks.
- Reports must include cost, runtime, deliverables, evidence, and failure modes where available.

## Local-First Memory And Memory Security

Sources:

- [PROJECTMEM](https://arxiv.org/abs/2606.12329)
- [SuperLocalMemory](https://arxiv.org/abs/2603.02240)
- [MemX](https://arxiv.org/abs/2603.16171)
- [OWASP GenAI Security Project](https://genai.owasp.org/)
- [NSA MCP security guidance](https://www.nsa.gov/Portals/75/documents/Cybersecurity/CSI_MCP_SECURITY.pdf)

Relevant signal:

- ProjectMem frames memory as governance for coding agents through append-only local logs, MCP summaries, and pre-action warnings.
- SuperLocalMemory frames local-first multi-agent memory around architectural isolation, provenance, and trust scoring against memory poisoning.
- MemX emphasizes explainable local-first retrieval and low-confidence rejection.
- OWASP treats memory and context as an AI security attack surface.
- NSA MCP guidance flags tool invocation path confusion and related risks around tool resolution and execution.

Active Mirror implication:

```text
Persistent memory without write control is a vulnerability.
```

AMOS design response:

- Every memory needs provenance, trust score, scope, expiry, user visibility, deletion path, and reset path.
- Memory use should be disclosed before action.
- Tool invocation must be registered, named, scoped, and logged.
- Low-confidence memory retrieval should reject instead of guessing.

## Artifact And Design Execution Surfaces

Sources:

- [Claude Cowork safety guidance](https://support.claude.com/en/articles/13364135-use-claude-cowork-safely)
- [Open Design](https://open-design.ai/)
- [Comfy](https://comfy.org/)
- [Figma Design Agent](https://www.figma.com/blog/the-figma-agent-is-here/)

Relevant signal:

- Claude Cowork makes file/app/browser task assignment visible to mainstream users, while its own safety guidance warns about file access and monitoring tasks.
- Open Design turns coding agents into a local-first design workspace using skills and portable design systems.
- Comfy remains a visible workflow engine for multimodal generation pipelines.
- Figma is moving toward agent-native design exploration and collaboration.

Active Mirror implication:

```text
Do not build another design tool.
Govern design tools and receipt their outputs.
```

AMOS design response:

- Treat Open Design, Figma, Comfy, and similar systems as artifact engines.
- Active Mirror supplies memory, rules, approval, evaluation, and receipts around them.
