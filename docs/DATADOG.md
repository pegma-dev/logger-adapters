# Datadog adapter: `@pegma/logger-datadog`

## Status

Planned; **implementation waits for a named host pull** (same consumer-pull
rule as mail provider adapters). This record settles the shape so a host
that wants Datadog — alone or teed with Application Insights — does not
reinvent the mapping. It does not represent a package as implemented or
published. Read `AGENTS.md` and `docs/PROJECT_PLAN.md` first; their hard
rules govern everything here.

Decided 2026-07-27 when the logger-adapters repository was stood up:
Datadog is a first-class planned sink because multi-sink composition (App
Insights **and** Datadog) was an explicit host requirement, not a
speculative vendor checklist.

## Why this adapter exists

Some hosts already standardize on Datadog for logs (or will add it beside
Application Insights). Spine still accepts one `Logger`; the tee fans out.
Without a shared Datadog adapter, every such host hand-rolls severity and
attribute mapping, and those bridges drift from the App Insights /
Cloudflare ones.

This package is the Datadog side of that joint — logs only.

## When implementation starts

Not in Phase 1–3 of `PROJECT_PLAN.md`. Phase work begins when a composition
root will import `@pegma/logger-datadog` (candidate: RetireGolden teeing
App Insights + Datadog, or another Pegma host that already runs the Datadog
Agent / intake). Until then the package directory is not scaffolded.

## Shape of the work

- New package `packages/logger-datadog` in this repository.
- Factory returns a Spine `Logger`. The host injects how log lines are
  sent (lean: a narrow function compatible with Datadog's log submit path —
  e.g. a `tracer`/`logger` log method, or a small `{ log(level, message,
  attributes) }` wrapper around `dd-trace` / `@datadog/browser-logs` /
  HTTP intake as the real consumer uses). Settle the injection shape
  against that consumer's bootstrap; do not bake in one SDK global.
- Map Spine levels to Datadog log statuses:
  - `debug` → `debug`
  - `info` → `info`
  - `warn` → `warn`
  - `error` → `error`
- Pass `message` as the log message; pass `fields` as attributes /
  properties (JSON-safe stringification for non-primitive values; never
  mutate the caller's fields object).
- `log` must not throw: wrap the submit call, swallow transport/SDK
  errors (tee continues to other sinks).

## What it refuses

- APM traces, metrics, RUM, profiling, or DogStatsD — hosts keep their
  existing Datadog (or OpenTelemetry → Datadog) setup for those planes.
- Owning agent installation, API keys as process globals, or site/intake
  URL configuration beyond what the injected client already carries.
- Becoming `@pegma/datadog` the product, or a second observability
  vocabulary beside Spine's `Logger`.
- Shipping before a named consumer will wire it (AGENTS.md consumer-pull
  rule).

## Test bar

Unit tests with a fake log-submit recorder: level → status mapping,
attribute passthrough, undefined fields, and a throwing sink that must
not escape `log`. No live Datadog account or agent required in CI.

## What it unblocks

A host can `createTeeLogger(appInsightsLogger, datadogLogger)` (or Datadog
alone) and inject one `Logger` into Pegma components — same port as every
other sink, no Spine changes.
