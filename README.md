# Logger Adapters

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Thin implementations of the [`@pegma/spine`](https://github.com/pegma-dev/spine)
`Logger` port for real sinks — Application Insights, Cloudflare Workers Logs,
and Datadog — plus a small tee for multi-sink wiring.

> [!IMPORTANT]
> Logger Adapters is in early `0.x` development. Its packages are
> implemented and tested but not published, and the public API is not
> stable. See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

## What this is (and is not)

Spine already defines logging: a one-method structured port
(`log(level, message, fields?)`) and `noopLogger`. Components take a
`Logger`; hosts supply one at the composition root. **This repository does
not invent a logging core.** It publishes the boring adapters that map that
port onto real sinks. Named consumers:

- **RetireGolden** (Azure) → Application Insights **and** Datadog (via tee)
- **pegma.dev** (Cloudflare) → Workers structured logs **and** Datadog
  (via tee)

See [docs/DATADOG.md](docs/DATADOG.md): both sites are Datadog's first
consumers; the primary cloud sink differs, the Datadog arm does not.

Not here, on purpose: traces, metrics, APM agents, SIEM pipelines, or a
Pegma-owned observability model. Those belong to OpenTelemetry (or the
host) — not a second vocabulary beside Spine's `Logger`. Audit records are
[`@pegma/audit`](https://github.com/pegma-dev/audit); they are not log
lines.

## Multi-sink

Spine accepts one `Logger`. Fan-out is composition: `@pegma/logger-tee`
forwards each call to every sink. Both reference hosts tee Datadog beside
their primary sink (App Insights on RetireGolden, Cloudflare Logs on
pegma.dev) — Spine never learns about either vendor.

## License

MIT © RetireGolden, LLC
