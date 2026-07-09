# Active Mirror Cloud-Primary Gateway Failover Receipt - 2026-07-09

Status: `PARTIAL`.

Class: `deploy`.

Scope:

- Repo: `/Users/mirror-pro/repos/active-mirror-site`
- Service: `active-mirror-site-gateway`
- Live route: `https://gateway.activemirror.ai`
- Runtime policy: temporary cloud-primary failover for reflection and chat.

Commit:

- `0d8f07e Fail over gateway routes to OpenAI primary`

Deploy:

- Command: `npm run worker:deploy`
- Worker: `active-mirror-site-gateway`
- Version ID: `d3aea219-e33d-4c69-976c-566e744e72b2`
- Custom domain: `gateway.activemirror.ai`

Changed scope:

- `worker/wrangler.jsonc`
  - `MIRROR_REFLECTION_PRIMARY`: `bridge` -> `openai`
  - `MIRROR_CHAT_PRIMARY`: `bridge` -> `openai`
- `MIRROR_BRIDGE_URL` remains configured as `https://bridge.activemirror.ai`
  for rollback to bridge-primary.

Preflight:

- `npm run worker:test`: pass.
- `npm run cf:whoami`: pass; Wrangler OAuth account has Workers write
  permissions.
- `node scripts/cloudflare-wrangler.mjs deploy --config worker/wrangler.jsonc --dry-run`:
  pass; dry-run showed reflection/chat primary set to `openai`.

Post-deploy checks:

- `ACTIVE_MIRROR_REQUIRE_BRIDGE_HEALTH=0 ACTIVE_MIRROR_EXPECTED_REFLECTION_PRIMARY=openai ACTIVE_MIRROR_EXPECTED_REFLECTION_PROVIDER=openai ACTIVE_MIRROR_EXPECTED_CHAT_PRIMARY=openai ACTIVE_MIRROR_EXPECTED_CHAT_PROVIDER=openai npm run monitor:gateway`:
  pass.
- `ACTIVE_MIRROR_EXPECTED_REFLECTION_PRIMARY=openai ACTIVE_MIRROR_EXPECTED_REFLECTION_PROVIDER=openai npm run canary:prod`:
  pass, `21/21`.
- Direct debug smoke:
  - `fallback`: `false`
  - `route.primary`: `openai`
  - `route.provider`: `openai`
  - `route.model`: `gpt-5.5`
  - `route.upstream_host`: `null`
  - receipt ID: `01cca0b9286f82790e3905af`

Final monitor proof:

- Run ID: `mrdfe82z-3xudtb`
- Mirror receipt: `c4b0775fe1c9cb6df384526d`
- Chat receipt: `389907a44142d0853bb14585`
- Oversized payload rejection: `413 payload_too_large`
- Alerts: none.

Bad news:

- This did not repair the Mini bridge.
- `mirror-admins-mac-mini` remained unreachable on Tailscale during the final
  check: `tailscale ping 100.114.247.53` timed out.
- Earlier live checks showed:
  - `https://bridge.activemirror.ai/health`: Cloudflare `530` / `1033` class
    failure.
  - `https://proxy.activemirror.ai/health`: `502` or timeout.
- Bridge health is intentionally optional only in explicit failover mode. The
  default bridge-primary monitor should fail until the Mini bridge/proxy path is
  restored.

Rollback path:

1. Change `worker/wrangler.jsonc`:
   - `MIRROR_REFLECTION_PRIMARY`: `openai` -> `bridge`
   - `MIRROR_CHAT_PRIMARY`: `openai` -> `bridge`
2. Run `npm run worker:test`.
3. Run `npm run worker:deploy`.
4. Run default `npm run monitor:gateway`.
5. Run `npm run canary:prod`.

Remaining risk:

- Live gateway is recovered through OpenAI primary, not through the intended
  Mini bridge.
- The Mini control-plane outage is still open runtime debt.
- Source-check, media, artifact, and identity routes were covered by the
  production canary, but this receipt is specifically about reflection/chat
  primary routing.

Next:

- Restore the Mini bridge/proxy path when the Mini is reachable, then roll
  reflection/chat primary back to `bridge` and prove the default monitor.
