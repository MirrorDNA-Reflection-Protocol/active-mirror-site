# Active Mirror Mini Bridge Restore Kit Receipt - 2026-07-09

Status: `PARTIAL`.

Class: `repair`.

Scope:

- Repo: `/Users/mirror-pro/repos/active-mirror-site`
- Live gateway: `https://gateway.activemirror.ai`
- Current runtime policy: cloud-primary failover for reflection/chat.
- Intended restored policy: bridge-primary after the Mini bridge is reachable.

Changed scope:

- Added `scripts/gateway-bridge-readiness.mjs`.
- Added `scripts/gateway-bridge-restore.mjs`.
- Added package scripts:
  - `npm run monitor:gateway:failover`
  - `npm run bridge:ready`
  - `npm run bridge:restore`
- Updated `docs/GATEWAY_MONITORING.md` with the turn-on restore path.

What the new commands do:

- `npm run bridge:ready`
  - checks Tailscale reachability for `100.114.247.53`
  - checks SSH to `mirror-admin@mirror-admins-mac-mini`
  - checks Mini bridge tunnel metrics
  - checks public `bridge.activemirror.ai/health`
  - checks public `proxy.activemirror.ai/health`
- `npm run bridge:restore`
  - refuses to continue unless `bridge:ready` passes
  - switches reflection/chat primary back to `bridge`
  - updates the Worker version to `2026-07-09-bridge-primary-restored-v1`
  - runs `npm run worker:test`
  - deploys the Worker
  - runs the default bridge-primary monitor
  - runs the production canary

Checked scope:

- `node --check scripts/gateway-bridge-readiness.mjs && node --check scripts/gateway-bridge-restore.mjs`:
  pass.
- `npm run bridge:ready`: fail-closed as expected while the Mini is
  off/unreachable.
  - `mini tailscale ping`: fail, no reply from `100.114.247.53`
  - `mini ssh`: fail, operation timed out
  - `mini bridge tunnel service`: fail, operation timed out
  - `public bridge health`: fail, `https://bridge.activemirror.ai/health`
    returned `530`
  - `public proxy health`: fail, request aborted
- `npm run bridge:restore -- --dry-run`: fail-closed before edits or deploy
  because `bridge:ready` failed.
- `npm run monitor:gateway:failover`: pass while cloud-primary is the active
  policy.
  - Run ID: `mrdfyvrg-jxpbe8`
  - Mirror receipt: `5f172d679b934e175e014035`
  - Chat receipt: `4d9aaf1327283a01f77337f2`

Bad news:

- This does not turn on the Mini.
- This does not repair `bridge.activemirror.ai` while the Mini is unreachable.
- This does not roll gateway reflection/chat back to bridge-primary.
- The restore command is intentionally fail-closed until the Mini path proves
  healthy.

Next:

- When the Mini is powered on: run `npm run bridge:ready`.
- If that passes: run `npm run bridge:restore`.
- Commit the bridge-primary restore diff and its post-deploy receipt.
