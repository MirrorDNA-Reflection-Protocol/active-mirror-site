# Active Mirror Site Agent Guard

## Active Lane

This repository is the canonical Active Mirror public site and browser workspace.

- Lane: Active Mirror
- Canonical repo: `/Users/mirror-pro/Documents/active-mirror-site`
- Primary surface: `activemirror.ai` and `/mirror/`

## Pre-Action Lane Gate

Before acting on any attachment, pasted text, file path, or task packet, classify:

1. Current lane.
2. Current repository.
3. Newest user intent.
4. Attachment or pasted-text domain.

Proceed only when all four agree.

If an attachment or pasted request appears to belong to SWFI, GreatX, Mailchimp, or any other non-Active-Mirror lane, stop before reading deeply or editing files and ask for explicit confirmation:

```text
This appears to be <lane>, but the active lane is Active Mirror. Do you want to switch lanes?
```

Do not silently switch from Active Mirror to SWFI or any other client/product lane.

## Active Mirror Scope Guard

Keep Active Mirror public-site work grounded in:

- browser-native reflective workspace;
- context packet preview;
- boundaries and trust modes;
- generated viewport;
- route truth;
- receipts;
- memory decisions;
- Mirror Audit.

Do not drift into full OS replacement, broad sovereignty claims, per-user model training, or unrelated client dashboard work unless the user explicitly changes the lane.
