# Application Insights adapter: `@pegma/logger-applicationinsights`

## Status

Planned. First named consumer: **RetireGolden** (Azure reference
application). This record does not represent a package as implemented or
published. Read `AGENTS.md` and `docs/PROJECT_PLAN.md` first; their hard
rules govern everything here.

Decided 2026-07-27 as part of standing up the logger-adapters repository:
the dual-environment pair (RetireGolden + pegma.dev) is the extraction
trigger for thin Spine `Logger` sinks.

## Why this adapter exists

RetireGolden already runs on Azure and uses Application Insights for
operational telemetry. Pegma components there will call Spine's `Logger`.
Without a shared adapter, the composition root grows a one-off bridge that
pegma.dev cannot reuse and that drifts from whatever Cloudflare mapping
the site invents later.

This package is that bridge — nothing more.

## Shape of the work

- New package `packages/logger-applicationinsights` in this repository.
- Factory returns a Spine `Logger`. The host injects how traces are sent
  (lean: a narrow `trackTrace`-compatible function; settle against
  RetireGolden's real AI bootstrap in implementation — see open questions
  in `PROJECT_PLAN.md`).
- Map Spine levels to Application Insights severities:
  - `debug` → Verbose
  - `info` → Information
  - `warn` → Warning
  - `error` → Error
- Pass `message` as the trace message; pass `fields` as custom properties
  (stringified values the SDK will not accept; never mutate the caller's
  fields object).
- `log` must not throw: wrap the track call, swallow transport/SDK errors.

## What it refuses

- Request / dependency / metric / exception autopilot — hosts keep their
  existing AI (or OpenTelemetry) setup for those planes.
- Owning the instrumentation key or global `appInsights.setup()` lifecycle
  unless RetireGolden's bootstrap proves a singleton is unavoidable — and
  then document it as a host-shaped concession, not the default API.
- Becoming `@pegma/applicationinsights` the product.

## Test bar

Unit tests with a fake `trackTrace` recorder: level mapping, property
passthrough, undefined fields, and a throwing sink that must not escape
`log`. No live Application Insights resource required in CI.

## What it unblocks

RetireGolden can wire Pegma components to the same App Insights resource
the rest of the application already uses, through one injected `Logger`.
