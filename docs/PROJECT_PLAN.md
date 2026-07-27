# Logger Adapters Project Plan

## Status

**Stage:** planning; packages unpublished
(`0.x`, public API unstable)

**Named consumers (the extraction trigger, already fired):**

1. **RetireGolden** — Azure reference application; Spine `Logger` →
   **Application Insights**, teed with **Datadog**.
2. **pegma.dev** — Cloudflare second reference environment; Spine
   `Logger` → **Cloudflare Workers Logs**, teed with **Datadog**, for
   the Phase 4 Workers consumer.

Both hosts share Datadog as the second sink via `@pegma/logger-tee`.
That pair is Pegma's dual-environment claim for logging: two primary
cloud sinks, one common Datadog view. Waiting for a *third* site before
publishing adapters would strand both reference environments on one-off
composition-root code — the opposite of the portability story.

**License:** MIT

**What this repository is not:** a logging framework, an observability
platform, or growth of `@pegma/spine`. Spine owns the port
(`Logger`, `LogLevel`, `noopLogger`) and refuses sink implementations.
This repository owns only the adapters.

Per-adapter assignment records:

- [Application Insights](APPLICATION_INSIGHTS.md)
- [Cloudflare Workers Logs](CLOUDFLARE.md)
- [Datadog](DATADOG.md)
- [Tee (multi-sink)](TEE.md)

## Vision

Every Pegma component that reports operational lines already depends on
Spine's one-method `Logger`. Hosts must supply a real one at the
composition root or they get `noopLogger`. The failure mode today is each
host hand-rolling a 30-line bridge that drifts in field naming, error
handling, and level mapping — two reference environments, two slightly
different bridges, no shared tests.

One thin adapter per sink, same `Logger` shape, same refusal to throw on
transport failure, and a tee so a host that wants two sinks writes that
once at the composition root instead of teaching Spine about fan-out.

## Problem statement

1. **The port exists; the sinks do not.** Spine's design is correct
   ("hosts supply real ones") but leaves RetireGolden and pegma.dev to
   reimplement the same mapping. Adapters are the missing joint, not a
   new component tier.
2. **Two clouds, two vendors.** Application Insights and Cloudflare Logs
   are not interchangeable SDKs. Each adapter isolates vendor types so
   components never import them.
3. **Multi-sink is a host choice.** Some hosts will want App Insights and
   Datadog together. Spine takes one `Logger`; fan-out must be a
   composable adapter, not a Spine feature and not vendor-specific.
4. **Observability sprawl is a trap.** The moment this repo grows traces,
   metrics, or sampling policy, it becomes a competing product beside
   OpenTelemetry and beside Audit. The plan refuses that growth path.

## Core model

### The only contract

```ts
import type { Logger } from "@pegma/spine";
// every package here: (...host-injected vendor bits) => Logger
```

`log(level, message, fields?)` maps to the sink. Levels are Spine's
`debug | info | warn | error`. Fields are a readonly string-keyed bag;
adapters JSON-safe what the vendor will not accept and must not mutate
the caller's object.

### Packages

| Package | Role | First consumer |
| --------------------------------------- | ------------------------------------------- | -------------- |
| `@pegma/logger-tee` | Fan-out `Logger` over N sinks | both reference hosts (required for Datadog) |
| `@pegma/logger-applicationinsights` | Spine `Logger` → Application Insights | RetireGolden (teed with Datadog) |
| `@pegma/logger-cloudflare` | Spine `Logger` → Workers structured logs | pegma.dev (teed with Datadog) |
| `@pegma/logger-datadog` | Spine `Logger` → Datadog logs | **both** sites, always via the tee |

No `@pegma/logging-core`. Shared helpers (safe field scrubbing, level
maps), if any, stay private to the repo or live as non-exported modules —
not a public core that invites expansion.

### Tee semantics

`createTeeLogger(...sinks: Logger[]): Logger` calls each sink in order.
A sink that throws is caught, optionally reported to a fallback (default:
swallow), and later sinks still run. Empty tee is equivalent to
`noopLogger`. Order is call-site order; no prioritization API.

## Design decisions

### Adapters live here, not in Spine

Spine is dependency-free and close to frozen. Vendor SDKs would churn
every component. The storage-core precedent (adapters beside the port they
implement, in the repo that owns that concern) maps here as: Spine owns
the port; this repository owns sink implementations that depend on Spine.

### One repo, multiple packages

Same layout as `storage-core` (`@pegma/storage-core` +
`@pegma/storage-azure-tables`) and authorization-core's provider packages.
Separate GitHub repositories per sink would multiply CI and AGENTS
identical twins for ~50-line factories.

### Cloudflare means Workers Logs, honestly

The Cloudflare adapter targets structured logging available to a Worker
(`console` with JSON-friendly fields, consistent with Workers Logs /
observability). It does not wrap Logpush pipelines, Tail Workers as a
product, or Analytics Engine. Those are host/ops choices; the adapter's
job is "Spine `Logger` lines appear in the Worker's log stream."

### Application Insights is logs, not the whole SDK surface

The App Insights adapter tracks traces as log telemetry (severity +
properties), not requests, dependencies, or metrics. Hosts that already
bootstrap the Application Insights SDK pass the client (or a narrow
track-trace function) in; the adapter does not own instrumentation keys
as globals unless unavoidable and documented.

### Datadog is the shared second sink on both sites

The assignment record is [DATADOG.md](DATADOG.md). First consumers are
**RetireGolden and pegma.dev together**, each wiring Datadog through the
tee beside their primary sink (App Insights and Cloudflare Logs
respectively). That is the consumer pull — not a later unnamed host.
Package work follows the tee and lands with (or immediately after) the
primary-sink adapters so both composition roots can go multi-sink in one
season.

### Failures stay in the adapter

`log` never rejects and never throws to the caller. Transport errors are
swallowed (tee continues). This matches Spine's EventBus posture: logging
must not become a failure mode for business operations.

## Scope

### In scope

- `logger-tee`, `logger-applicationinsights`, `logger-cloudflare`.
- Level and field mapping tests (pure, no live vendor required for unit
  tests); optional integration notes for hosts.
- README and package docs that lead with refusals (not APM, not Audit).

### Non-goals

- **A Pegma logging vocabulary beyond Spine's `Logger`.**
- **Traces, metrics, profiling, RUM, or OpenTelemetry exporters** as Pegma
  packages — hosts adopt OTel directly if they need that plane.
- **SIEM, retention, alert rules, PII redaction frameworks.** Field
  scrubbing, if offered, is minimal and opt-in; hosts own compliance.
- **Framework middleware** (Express/Hono request loggers). Hosts bind HTTP
  themselves.
- **Growing Spine** to know about sinks or tees.

## Package architecture

Monorepo under `packages/`:

- `packages/logger-tee` → `@pegma/logger-tee` (depends only on
  `@pegma/spine`)
- `packages/logger-applicationinsights` → `@pegma/logger-applicationinsights`
  (`@pegma/spine` + Application Insights types/SDK as peer)
- `packages/logger-cloudflare` → `@pegma/logger-cloudflare` (`@pegma/spine`;
  no Cloudflare npm SDK required if mapping to `console`)
- `packages/logger-datadog` → `@pegma/logger-datadog`
  (`@pegma/spine` + host-injected Datadog submit; peer SDK as the two
  runtimes require)

TypeScript, vitest, ecosystem-standard layout, SHA-pinned CI, publish via
OIDC after the npm bootstrap publish rule (npm/cli#8544).

## Delivery phases

### Phase 1 — tee + repository scaffolding

Ecosystem layout (package workspaces, tsconfig, vitest, SHA-pinned CI).
Ship `@pegma/logger-tee` with unit tests for order, empty tee, and
swallowed sink errors. Exit: tee usable against hand-written fake sinks.

### Phase 2 — Application Insights adapter

`@pegma/logger-applicationinsights` mapping Spine levels to AI severities
and fields to properties. Exit: RetireGolden can inject the package as
one arm of `createTeeLogger(appInsights, datadog)` (Datadog arm may land
in Phase 4 in the same wiring PR).

### Phase 3 — Cloudflare adapter

`@pegma/logger-cloudflare` emitting structured lines suitable for Workers
Logs. Exit: pegma.dev's Workers slice (Phase 4 of the site plan) can
inject the adapter as one arm of `createTeeLogger(cloudflare, datadog)`.

### Phase 4 — Datadog adapter + publish

`@pegma/logger-datadog` per [DATADOG.md](DATADOG.md). Exit: **both**
reference composition roots tee Datadog beside their primary sink
(RetireGolden: App Insights + Datadog; pegma.dev: Cloudflare + Datadog),
and the four packages publish as public `0.x` pinned to the Spine version
verified in CI. Datadog is not a later wave — both sites are its first
consumers.

## Open questions

**AI client injection shape.** Pass the full `TelemetryClient` vs. a
narrow `trackTrace`-compatible function. Lean narrow function — easier to
test and less coupling to SDK major versions. Decide in Phase 2 against
RetireGolden's real bootstrap.

**Workers `console` vs. `ctx.exports` / tail.** Lean `console` with a
single JSON object (level, message, fields) so Logs parsing stays boring.
Revisit only if a Workers observability feature requires a different
channel for structured fields.

**Workers Datadog intake.** pegma.dev on Workers may not run the Node
Datadog agent. Lean: host injects an HTTP intake (or Workers-compatible)
submit function; the adapter stays runtime-agnostic. Confirm in Phase 4
against the real Workers composition root.

**PII.** Should adapters offer a denylist of field keys? Lean **no** in
v1 — hosts scrub before `log` or at the vendor. A denylist invites false
confidence.

## Near-term backlog

1. Repository scaffolding to the ecosystem standard (workspaces, CI,
   publish.yml).
2. Phase 1 tee — required before either site can wire Datadog as a
   second sink.
3. Phase 2 Application Insights (RetireGolden primary arm).
4. Phase 3 Cloudflare (pegma.dev primary arm).
5. Phase 4 Datadog + both sites' tee wiring + publish.
