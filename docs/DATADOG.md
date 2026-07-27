# Datadog adapter: `@pegma/logger-datadog`

## Status

Planned. **First consumers (already named):** both Pegma reference
environments, each via `@pegma/logger-tee`:

1. **RetireGolden** — `createTeeLogger(applicationInsights, datadog)`
2. **pegma.dev** — `createTeeLogger(cloudflare, datadog)` (Workers
   composition root, with the site's Phase 4 consumer)

This record does not represent a package as implemented or published.
Read `AGENTS.md` and `docs/PROJECT_PLAN.md` first; their hard rules
govern everything here.

Decided 2026-07-27: Datadog is not a speculative third vendor — it is the
shared second sink on **both** reference hosts, which is why the tee
exists as Phase 1 rather than as an afterthought.

## Why this adapter exists

RetireGolden's primary cloud sink is Application Insights; pegma.dev's is
Cloudflare Workers Logs. Operators also want those lines in Datadog so
one log product can see both environments. Spine still accepts one
`Logger`; the tee fans out. Without a shared Datadog adapter, each site
hand-rolls severity and attribute mapping and the two bridges drift.

This package is the Datadog side of that joint — logs only. The tee is
what makes "both sites" one consumer story instead of two one-offs.

## When implementation starts

After the tee (Phase 1) and in parallel with or immediately after the
primary-sink adapters (Phases 2–3): both composition roots need Datadog
as the *second* arm of the tee, so `@pegma/logger-datadog` is on the
critical path for "dual environment, one Datadog view," not a later
wave waiting for an unnamed host. See `PROJECT_PLAN.md` Phase 4.

## Shape of the work

- New package `packages/logger-datadog` in this repository.
- Factory returns a Spine `Logger`. The host injects how log lines are
  sent (lean: a narrow function compatible with Datadog's log submit path —
  e.g. a small `{ log(level, message, attributes) }` wrapper around
  whatever each host already uses for intake — Node agent / `dd-trace`
  on Azure, HTTP intake or Workers-compatible client on Cloudflare).
  Settle injection against **both** bootstraps; do not bake in one SDK
  global that only works on one runtime.
- Map Spine levels to Datadog log statuses:
  - `debug` → `debug`
  - `info` → `info`
  - `warn` → `warn`
  - `error` → `error`
- Pass `message` as the log message; pass `fields` as attributes /
  properties (JSON-safe stringification for non-primitive values; never
  mutate the caller's fields object). Prefer a stable attribute for
  environment / host name so RetireGolden and pegma.dev lines are
  filterable in one Datadog org (host supplies the value; adapter does
  not invent tagging policy beyond passthrough).
- `log` must not throw: wrap the submit call, swallow transport/SDK
  errors (tee continues to the primary sink).

## What it refuses

- APM traces, metrics, RUM, profiling, or DogStatsD — hosts keep their
  existing Datadog (or OpenTelemetry → Datadog) setup for those planes.
- Owning agent installation, API keys as process globals, or site/intake
  URL configuration beyond what the injected client already carries.
- Becoming `@pegma/datadog` the product, or a second observability
  vocabulary beside Spine's `Logger`.
- Replacing App Insights or Cloudflare Logs — Datadog is the teed
  second sink on both sites, not the sole sink.

## Test bar

Unit tests with a fake log-submit recorder: level → status mapping,
attribute passthrough, undefined fields, and a throwing sink that must
not escape `log`. No live Datadog account or agent required in CI.
Optional note in the package README for verifying lines from each host's
staging tee.

## What it unblocks

Both reference composition roots inject one `Logger`:

```ts
// RetireGolden
createTeeLogger(appInsightsLogger, datadogLogger);

// pegma.dev (Workers)
createTeeLogger(cloudflareLogger, datadogLogger);
```

Same Datadog adapter, two primary sinks, one Spine port — the
portability claim for logging.
