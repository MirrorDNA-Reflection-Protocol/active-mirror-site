# Gateway Monitoring

Active Mirror's public model path is `gateway.activemirror.ai`. The Worker runs on Cloudflare; the Mini should run the always-on monitor because it is the control plane.

## Probe The Live Gateway

```sh
npm run monitor:gateway
```

The probe checks:

- `/health` reports live guardrails.
- `/v1/mirror/create` returns a governed non-fallback turn.
- Oversized payloads are rejected with `payload_too_large`.

## Watch Worker Logs

```sh
npx wrangler tail --config worker/wrangler.jsonc --format=json \
  | ACTIVE_MIRROR_MONITOR_LOGS=1 npm run monitor:gateway
```

Log mode reads structured Worker logs from stdin and alerts on:

- `active_mirror_rate_limited`
- `active_mirror_provider_fallback`
- `active_mirror_source_check_fallback`
- `active_mirror_guardrail_degraded`

The Worker log events are metadata-only. They do not include user prompts, private context, or provider output.

## Thresholds

```sh
ACTIVE_MIRROR_RATE_LIMIT_ALERT_COUNT=5
ACTIVE_MIRROR_FALLBACK_ALERT_COUNT=2
ACTIVE_MIRROR_DEGRADED_ALERT_COUNT=1
ACTIVE_MIRROR_ALERT_WEBHOOK=https://...
```

If `ACTIVE_MIRROR_ALERT_WEBHOOK` is set, failing summaries are posted as JSON.

## Mini Placement

Keep this script in the repo and schedule it from the Mini after the repo is available there. The Worker stays on Cloudflare; the Mini only watches, alerts, and keeps receipts.

Suggested cadence:

```sh
cd /path/to/active-mirror-site && npm run monitor:gateway
```

For continuous log watching, run the `wrangler tail` pipeline under the Mini's service manager or tmux chamber. Do not put provider secrets in logs, packets, or cron command lines.
