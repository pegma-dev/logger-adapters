# Tee adapter: `@pegma/logger-tee`

## Status

Planned. First phase of this repository — no vendor SDK, depends only on
`@pegma/spine`. Read `AGENTS.md` and `docs/PROJECT_PLAN.md` first.

## Why a tee exists

Spine's `EventBus` and every component that accepts logging take **one**
`Logger`. Both Pegma reference hosts tee Datadog beside their primary
sink (RetireGolden: Application Insights + Datadog; pegma.dev: Cloudflare
Logs + Datadog). They must not fork Spine or teach every component about
fan-out.

`createTeeLogger(...sinks)` is that composition helper: still one
`Logger` at the injection site, N sinks behind it.

## Shape of the work

- New package `packages/logger-tee` in this repository.
- `createTeeLogger(...sinks: readonly Logger[]): Logger`
- Call sinks in argument order.
- If a sink throws, catch and continue to the remaining sinks (default).
  Do not rethrow to the caller.
- Zero sinks → behavior identical to Spine's `noopLogger`.
- Do not dedupe sinks; do not prioritize; do not inspect messages.

## What it refuses

- Sampling, filtering, or level overrides (hosts wrap individual sinks).
- Async batching or queues (keeps `log` synchronous like the Spine port).
- Knowing about Application Insights, Cloudflare, or Datadog.

## Test bar

Unit tests with fake sinks: order, empty tee, one throwing sink with
others still receiving the call, fields object identity preserved
(adapters downstream must not rely on mutation — tee must not mutate
either).

## What it unblocks

Both reference composition roots (and any multi-sink host) inject one
`Logger` built with `createTeeLogger`. Phase 1 of `docs/PROJECT_PLAN.md`
ships this before vendor adapters so RetireGolden and pegma.dev can tee
Datadog beside App Insights and Cloudflare Logs without growing Spine.
