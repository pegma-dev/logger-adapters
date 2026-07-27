# Logger Adapters

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Thin implementations of the [`@pegma/spine`](https://github.com/pegma-dev/spine)
`Logger` port for real sinks — Application Insights, Cloudflare Workers Logs,
and (later) Datadog — plus a small tee for multi-sink wiring.

> [!IMPORTANT]
> Logger Adapters is in early `0.x` planning. Its public API is not stable,
> its packages are not published, and it is not ready for production use.
> See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

## What this is (and is not)

Spine already defines logging: a one-method structured port
(`log(level, message, fields?)`) and `noopLogger`. Components take a
`Logger`; hosts supply one at the composition root. **This repository does
not invent a logging core.** It publishes the boring adapters that map that
port onto the two reference environments Pegma already runs in:

- **RetireGolden** (Azure) → Application Insights
- **pegma.dev** (Cloudflare) → Workers structured logs

Not here, on purpose: traces, metrics, APM agents, SIEM pipelines, or a
Pegma-owned observability model. Those belong to OpenTelemetry (or the
host) — not a second vocabulary beside Spine's `Logger`. Audit records are
[`@pegma/audit`](https://github.com/pegma-dev/audit); they are not log
lines.

## Multi-sink

Spine accepts one `Logger`. Fan-out is composition: `@pegma/logger-tee`
forwards each call to every sink. A host that wants Application Insights
*and* Datadog wires both through the tee at the composition root — Spine
never learns about either.

## License

MIT © RetireGolden, LLC
