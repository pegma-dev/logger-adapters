# Cloudflare adapter: `@pegma/logger-cloudflare`

## Status

Planned. First named consumer: **pegma.dev** (Cloudflare second reference
environment), timed with the site's Phase 4 Workers consumer. This record
does not represent a package as implemented or published. Read `AGENTS.md`
and `docs/PROJECT_PLAN.md` first; their hard rules govern everything here.

Decided 2026-07-27 alongside the Application Insights adapter: two clouds,
one Spine `Logger` port, thin adapters in this repository — mirroring
storage-core's dual-adapter portability claim without putting SDKs in
Spine.

## Why this adapter exists

pegma.dev deploys on Cloudflare Pages today and will run a real Pegma
consumer on Workers (see pegma-dev/pegma.dev `docs/PROJECT_PLAN.md`, Phase
4). That consumer needs a `Logger`. Cloudflare's log surface for Workers is
not Application Insights; inventing a RetireGolden-shaped bridge here would
lie about the environment.

This package maps Spine's port onto Workers Logs honestly.

## The backend decision

- **Structured `console` — chosen (lean).** Emit one JSON-friendly object
  per `log` call (`level`, `message`, `fields`) via `console.log` /
  `console.warn` / `console.error` as appropriate so lines appear in
  Workers Logs / the dashboard observability view without extra bindings.
- **Logpush / Tail Workers / Analytics Engine — out of scope.** Those are
  pipeline and product choices for the host's ops surface. The adapter's
  job is "component `Logger` calls show up in the Worker log stream."
- **No Cloudflare npm logging SDK required** for the lean path — keeps the
  package Workers-thin and dependency-light beside `@pegma/spine`.

## Shape of the work

- New package `packages/logger-cloudflare` in this repository.
- Factory returns a Spine `Logger`. Optional inject of the console-like
  sink for tests (default: global `console`).
- Level → console method (or a single `console.log` with a level field —
  pick one in implementation and pin it with tests; lean distinct methods
  for warn/error so severity survives dumb log viewers).
- `log` must not throw: if `console` itself throws (hostile test double),
  swallow.

## What it refuses

- Pretending to be Datadog, App Insights, or a Logpush shipper.
- Wrapping Tail Workers as a Pegma runtime.
- Growing into general Workers observability (metrics, Analytics Engine
  writes).

## Test bar

Unit tests with a fake console recorder: level mapping, field inclusion,
undefined fields, throwing console. No live Cloudflare account required
in CI. Optional note in the package README for verifying lines in `wrangler
tail` during host integration.

## What it unblocks

pegma.dev Phase 4: inject this `Logger` beside `@pegma/storage-cloudflare-d1`
in the Workers composition root so operational lines from Pegma components
land in the same place operators already look for Worker output.
