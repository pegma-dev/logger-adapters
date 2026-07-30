# Security Policy

Log lines are where secrets leak by accident, so please report suspected
vulnerabilities privately.

## Reporting a vulnerability

Use
[GitHub private vulnerability reporting](https://github.com/pegma-dev/logger-adapters/security/advisories/new).
Do not open a public issue.

Include, when possible:

- the affected package and version or commit;
- the expected and observed behavior;
- a minimal reproduction;
- the potential impact;
- any suggested mitigation.

Use inert connection strings, API keys, and log payloads in reports. Do not
include live instrumentation keys, Datadog keys, Cloudflare credentials, or
real log data.

We will acknowledge a complete report as soon as practical, investigate it, and
coordinate remediation and disclosure with the reporter. Please avoid accessing
data that is not yours or disrupting production systems while researching a
report.

## Supported versions

Logger Adapters is pre-release software. Until the first stable release, only
the latest commit on the default branch and the latest published version of
each `@pegma/logger-*` package are supported.

## What these adapters do not provide

These are design decisions, not gaps to be reported:

- **No field redaction or scrubbing.** `message` and `fields` are forwarded to
  the sink as given. Nothing filters keys, masks values, or truncates payloads.
  Secrets and personal data must be kept out of a `log` call by the caller.
- **No delivery guarantee.** `log` never throws: transport, mapping, and sink
  errors are swallowed so observability cannot become an outage. A missing log
  line therefore proves nothing, and these packages must not be used as the
  evidence trail for an investigation. Durable business records belong to
  [`@pegma/audit`](https://github.com/pegma-dev/audit).
- **No transport of its own.** No HTTP client, retry, buffering, batching, or
  credential handling lives here. The host injects the sink
  (`trackTrace`, a Datadog `submit`, a `console`), so the transport's TLS,
  authentication, and egress posture are the host's.
- **No traces, metrics, sampling, or alerting.** These are not APM or SIEM
  packages. A host that needs that plane uses OpenTelemetry or the vendor SDK
  beside Pegma.

## Security expectations

Applications using these adapters remain responsible for:

- keeping credentials, tokens, session identifiers, and unnecessary personal
  data out of `message` and `fields` — everything passed is written to the
  sink in plain form and is readable by anyone with access to that sink;
- owning sink configuration (Application Insights connection strings, Datadog
  API keys, Workers bindings) at the composition root and treating those
  credentials as the actual access control on log data;
- setting retention and access on the sink itself; nothing in these packages
  deletes, expires, or restricts what has already been emitted;
- noting that the Cloudflare adapter writes to the Worker's `console`, so its
  lines inherit the account's Workers Logs retention and visibility;
- knowing that a `fields` value the sink cannot represent is handled
  differently by each adapter, so neither the coercion nor the log line is
  guaranteed:
  - `@pegma/logger-datadog` passes `null`, strings, numbers, and booleans
    through and JSON-encodes anything else, falling back to `String(value)` if
    that throws — a circular object becomes `"[object Object]"`;
  - `@pegma/logger-applicationinsights` turns every value into a string via
    JSON encoding, falling back to `String(value)` if that throws — a circular
    object becomes `"[object Object]"` and the trace is still emitted;
  - `@pegma/logger-cloudflare` and `@pegma/logger-tee` hand `fields` to the
    sink untouched, so the sink's own serialization applies.

## Release integrity

Publishing is npm trusted-publisher OIDC only; no npm token exists in this
repository. Releases run from a signed annotated tag already contained in
`origin/main`, verified against an approved signer, and publish the exact
tarballs prepared and hashed by an unprivileged job. Report any path that
appears to bypass that procedure — see
[docs/RELEASING.md](docs/RELEASING.md).
