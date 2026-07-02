# AMOS Spec v0.1 Intake

Source document: `/Users/mirror-pro/Downloads/Active_MirrorOS_AMOS_Spec_v0.1.docx`

Date received: 2026-07-02

Status: accepted as AMOS architecture input, not public homepage copy.

## Core Definition

Active MirrorOS is the local-first, trust-governed operating layer that decides which memory, skill, model, connector, and action is allowed in each context.

It is not the chatbot. It is the layer behind the mirror that controls:

- memory scope;
- skill execution;
- tool and connector permissions;
- model escalation;
- evidence checks;
- consent and approval;
- audit trail;
- failure repair.

## Architecture Accepted

| Module | Accepted v0 role |
| --- | --- |
| MirrorGraph | Explicit graph workflows for tasks, tools, approvals, and state transitions |
| MirrorTrust | Runtime gate for memory, tools, connectors, exports, actions, model escalation, and skill promotion |
| MirrorMemory v2 | Typed, scoped, evidence-aware memory with freshness and client boundaries |
| MirrorSkills | Reusable executable procedures with contracts, consent policies, evals, and provenance |
| MirrorHub | Private registry for skills, connectors, graph nodes, policies, and pinned installs |
| MirrorVerifier | Schema, tests, evidence, trust, memory-scope, leakage, calibration, and approval checks |
| MirrorEngine | Trace mining, failure clustering, repair proposals, regression evals, and recurring-failure reopening |
| MirrorWiki | Evidence-first documentation with redaction, snapshots, and audit logs |
| MirrorTunnel Gateway | Policy-wrapped bridge from local/private tools to hosted agent surfaces |
| MirrorMobile | Phone-based approval, capture, notification, and kill-switch surface |

## Current Boundary Decision

The source spec proposes the first AMOS MVP as an SWFI Campaign Approval Workflow.

Current lane rule: do not touch SWFI in this thread.

Decision: preserve the workflow shape, but use a non-client fixture first.

First demo becomes:

```text
Generic Campaign Approval Workflow
  -> load only demo-approved context
  -> generate campaign draft and approval packet
  -> run claim/evidence verifier
  -> run boundary gate
  -> queue approval before external send/share
  -> write SCD state
  -> write GlyphTrail event
  -> display result in MirrorConsole or browser artifact card
```

This proves the same AMOS primitives without crossing a client boundary.

## Schemas To Promote First

### Trust Gate Verdict

```json
{
  "verdict": "allow | warn | block | review",
  "risk_type": "privacy | client_boundary | hallucination | legal | financial | security | reputation | irreversible_action",
  "reason": "Short explanation grounded in policy.",
  "safe_alternative": "Optional safer action.",
  "requires_user_approval": true,
  "glyphtrail_event": "trust_gate_event_id"
}
```

### Memory Record

```json
{
  "id": "mem_001",
  "content": "Paul prefers short, practical outputs.",
  "type": "user_preference | fact | source_excerpt | task_state | hypothesis | approval | trace",
  "scope": ["assistant_response_style"],
  "client_scope": "global_user | active_mirror | swfi | client_id",
  "source": "explicit_user_memory | document | trace | imported_file",
  "freshness": "stable | stale | time_bound | unknown",
  "valid_as_evidence": false,
  "may_override_external_facts": false,
  "may_cross_client_boundary": false,
  "requires_consent_for_export": true
}
```

## Build Order Adjustment

The DOCX build order is accepted with one practical addition: the first implementation must be a small runnable slice, not a whole workspace tree.

1. MirrorTrust verdict schema and deterministic gate.
2. SCD state schema.
3. GlyphTrail append-only event log.
4. Generic campaign approval workflow fixture.
5. MirrorVerifier basic checks: schema, evidence, boundary, anti-sycophancy, leak guard.
6. MirrorSkills folder standard.
7. MirrorConsole or browser artifact display.
8. MirrorMemory v2.
9. MirrorTunnel Gateway.
10. MirrorMobile approvals.

## v0.1 Acceptance Criteria

- A skill can be registered with `SKILL.md`, contract, consent policy, and evals.
- A graph workflow can run with typed inputs and outputs.
- A risky action is blocked or sent to approval.
- A safe draft action proceeds and writes SCD plus GlyphTrail.
- A memory item is retrieved only when scope, freshness, and permission allow it.
- A verifier report explains why an output was accepted, rejected, or sent to approval.
- The user sees the result as a useful output, not as internal architecture.

## Public Copy Boundary

Do not put these terms on the consumer homepage by default:

- AMOS
- MirrorGraph
- MirrorTrust
- MirrorTunnel
- SCD
- GlyphTrail
- runtime topology
- Mac Mini / OnePlus / Pixel device roles

Public translation:

```text
Active Mirror helps you turn one real thing into a useful output, with privacy and approval built in.
```

Enterprise translation:

```text
Active Mirror gives AI agents memory, permissions, evaluation, approval, and receipts before they act.
```

## Immediate Next Slice

Create a tiny AMOS fixture under docs or tests:

```text
campaign-approval-demo
  input: one demo campaign brief
  output: draft, claim list, approval state, SCD state, GlyphTrail event
  gates: privacy, client boundary, evidence, action approval
  pass: safe draft allowed, external send blocked pending approval
```

No SWFI data, names, client files, or client claims are used in this fixture.
