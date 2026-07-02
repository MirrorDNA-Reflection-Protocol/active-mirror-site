# Campaign Approval Demo

This is the first runnable AMOS slice from the v0.1 spec intake.

It is deliberately non-client and non-SWFI. It proves the workflow shape only:

```text
demo brief
  -> ToolGraph route check
  -> safe draft
  -> approval gate
  -> verifier
  -> SCD state
  -> GlyphTrail event log
  -> receipt
```

## Command

```bash
npm run amos:demo
```

By default, the command writes generated proof files under:

```text
/tmp/active-mirror-site/amos-campaign-approval-demo
```

The output directory can be changed with:

```bash
AMOS_DEMO_OUTPUT_DIR=/tmp/my-amos-demo npm run amos:demo
```

## What It Proves

- Safe local drafting can proceed.
- External send/share actions are held for approval.
- Every action must have a ToolGraph record.
- Demo context is checked for client-boundary leakage.
- Claims must carry local evidence.
- Approval packets are emitted as JSON, Markdown, and HTML.
- SCD state and GlyphTrail events are emitted.
- Memory candidates remain unpromoted unless approved.

## What It Does Not Prove

- It does not execute a real campaign.
- It does not connect to email, CRM, calendar, or publishing tools.
- It does not touch SWFI or any client data.
- It does not prove production deployment or public-site behavior.

## Output Files

- `receipt.json`
- `SCD.json`
- `GlyphTrail.log`
- `verifier-report.json`
- `approval-packet.json`
- `approval-packet.md`
- `approval-packet.html`

## Promotion Rule

This demo can become a real MirrorSkill only after:

1. The ToolGraph record exists.
2. The consent policy is explicit.
3. The verifier has negative tests.
4. The approval surface is connected.
5. A receipt is produced for a real, approved workflow.
