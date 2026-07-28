# Working in this repository

Read this before changing anything. It is short on purpose.

## What this is part of

Logger Adapters are thin `Logger` implementations for **Pegma**, a family of
MIT-licensed packages a host application composes. The logging **port** lives
in `@pegma/spine` and stays there; this repository only maps that port onto
real sinks. One repository for the adapters, publishing under the `@pegma`
scope. Shared contracts never grow to absorb SDKs.

The governing principle, which every rule below follows from:

> **Optimize for a fresh agent context window.** How much must be read to make
> a correct change, and how does the change prove itself correct? Minimize the
> first, mechanize the second.

## Hard rules

**Implement `@pegma/spine`'s `Logger`. Nothing else.** Each package exports a
factory that returns `{ log(level, message, fields?) }`. Do not add levels,
scopes, child loggers, or fluent APIs that components would have to learn.
If the port is insufficient, the change belongs in Spine — and Spine's bar
for growth is deliberately high.

**Never put a sink SDK in Spine.** Spine has no runtime dependencies and
never will. Application Insights, Datadog, and Cloudflare bindings live only
in the adapter packages that need them (peer or optional dependencies of the
host that chooses that sink).

**This is not a logging-core, APM kit, or SIEM.** No traces, metrics,
sampling pipelines, or alert rules. A host that needs those uses
OpenTelemetry or the vendor's native SDK beside Pegma, not through it.
`@pegma/audit` owns durable business records; do not conflate the two.

**Sink failures must not take down the request.** An adapter that throws from
`log` turns observability into an outage. Swallow transport errors (and
optionally count them); document that posture. The tee continues to later
sinks if one fails.

**Adapters stay thin.** Prefer mapping `level` / `message` / `fields` onto
the vendor's structured API. Configuration the host already owns (connection
strings, `console` on Workers, sampling) is injected — adapters do not
discover secrets or own process-global singletons unless the vendor SDK
requires it and the docs say so.

**Add a sink package only when a named consumer pulls it.** Application
Insights, Cloudflare, and Datadog are justified by the two reference
environments: each site's primary cloud sink, plus Datadog as the shared
second sink on **both** via the tee. Further vendors wait for a host that
will wire them. Speculative adapters are scope creep.

## Reference points

The plan is `docs/PROJECT_PLAN.md`. The Spine `Logger` interface is the
specification; every adapter's tests assert against that shape, not against
vendor-specific surplus.

## Workflow

Work on a `claude/*` branch and open a pull request. The gate is
`npm run format:check`, `npm run check`, `npm test` on Node 22 and 24.

Publishing is trusted-publisher only; no tokens exist. Follow
`docs/RELEASING.md`: create and push a signed annotated version tag already on
`origin/main`, then publish the GitHub release for that existing tag. The
workflow prepares and verifies all public packages without OIDC, preserves the
reviewed package order, and gives OIDC only to the minimal environment-scoped
job that publishes the exact prepared tarballs. Never add a token fallback or
an unprotected manual publish path.
