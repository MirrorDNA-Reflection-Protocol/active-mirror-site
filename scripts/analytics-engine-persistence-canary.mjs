#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

const ACCOUNT_ID = 'c67a8591dff0a1b3681da50540530fc3';
const DATASET = 'Active_Mirror';
const ORIGIN = (process.env.ACTIVE_MIRROR_ORIGIN || 'https://activemirror.ai').replace(/\/+$/, '');
const KEYCHAIN_SERVICE = 'active-mirror-cloudflare-api-token';
const KEYCHAIN_ACCOUNT = 'codex';
const ATTEMPTS = Number(process.env.ACTIVE_MIRROR_ANALYTICS_ATTEMPTS || 8);
const DELAY_MS = Number(process.env.ACTIVE_MIRROR_ANALYTICS_DELAY_MS || 5000);

function emit(payload, exitCode) {
  console.log(JSON.stringify({
    schemaVersion: 'active-mirror-analytics-persistence/v1',
    generatedAt: new Date().toISOString(),
    accountId: ACCOUNT_ID,
    dataset: DATASET,
    ...payload,
  }, null, 2));
  process.exitCode = exitCode;
}

function readToken() {
  try {
    return execFileSync('security', [
      'find-generic-password',
      '-s', KEYCHAIN_SERVICE,
      '-a', KEYCHAIN_ACCOUNT,
      '-w',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function sqlString(value) {
  return value.replaceAll("'", "''");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const token = readToken();
  if (!token) {
    emit({
      ok: false,
      status: 'BLOCKED',
      blocker: 'missing_keychain_token',
      keychainService: KEYCHAIN_SERVICE,
      keychainAccount: KEYCHAIN_ACCOUNT,
      requiredPermission: 'Account | Account Analytics | Read',
      checked: [
        'the dedicated Cloudflare Analytics API token was not present in macOS Keychain',
      ],
      unchecked: [
        'no event was emitted because persistence could not be queried',
        'Analytics Engine table existence and event persistence remain unverified',
      ],
    }, 2);
    return;
  }

  const marker = `/__proof__/analytics-engine/${randomUUID()}`;
  const eventType = 'brief_view';
  const beacon = await fetch(`${ORIGIN}/e`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ t: eventType, p: marker }),
  });
  if (beacon.status !== 204) {
    emit({
      ok: false,
      status: 'FAIL',
      blocker: 'event_route_rejected_probe',
      eventType,
      marker,
      beaconStatus: beacon.status,
      checked: ['a unique persistence probe was submitted to the live /e route'],
      unchecked: ['the event was not queried because the live route did not return 204'],
    }, 1);
    return;
  }

  const query = [
    'SELECT timestamp, blob1 AS event_type, blob2 AS path, double1 AS value',
    `FROM ${DATASET}`,
    `WHERE blob1 = '${sqlString(eventType)}' AND blob2 = '${sqlString(marker)}'`,
    'ORDER BY timestamp DESC',
    'LIMIT 1',
    'FORMAT JSON',
  ].join('\n');
  const sqlEndpoint = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/analytics_engine/sql`;
  let lastQuery = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const response = await fetch(sqlEndpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'text/plain',
      },
      body: query,
    });
    const body = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = null;
    }
    const row = Array.isArray(parsed?.data)
      ? parsed.data.find((item) => item?.event_type === eventType && item?.path === marker)
      : null;
    lastQuery = {
      attempt,
      status: response.status,
      rows: Number(parsed?.rows || 0),
      error: response.ok ? null : body.slice(0, 500),
    };
    if (response.ok && row) {
      emit({
        ok: true,
        status: 'PASS',
        eventType,
        marker,
        beaconStatus: beacon.status,
        queryAttempts: attempt,
        sqlQuerySha256: createHash('sha256').update(query).digest('hex'),
        observedRow: row,
        checked: [
          'the live /e route accepted a unique bounded event',
          'the same unique event was observed in the Active_Mirror dataset through the Analytics Engine SQL API',
        ],
        unchecked: [
          'this single event does not prove completeness for other visitors, event types, times, or edge locations',
        ],
      }, 0);
      return;
    }
    if (!response.ok && response.status !== 429 && response.status < 500) break;
    if (attempt < ATTEMPTS) await sleep(DELAY_MS);
  }

  emit({
    ok: false,
    status: 'FAIL',
    blocker: 'event_not_observed_in_sql_api',
    eventType,
    marker,
    beaconStatus: beacon.status,
    queryAttempts: lastQuery?.attempt || 0,
    lastQuery,
    sqlQuerySha256: createHash('sha256').update(query).digest('hex'),
    checked: [
      'the live /e route returned 204 for a unique bounded event',
      'the SQL API was queried without logging the bearer token',
    ],
    unchecked: [
      'event persistence is not proven because the unique row was not observed',
    ],
  }, 1);
}

main().catch((error) => {
  emit({
    ok: false,
    status: 'FAIL',
    blocker: 'canary_exception',
    error: error.message,
    checked: [],
    unchecked: ['event persistence was not proven'],
  }, 1);
});
