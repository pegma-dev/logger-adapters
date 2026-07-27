# `@pegma/logger-datadog`

A runtime-neutral Datadog Logs implementation of the
[`@pegma/spine`](https://github.com/pegma-dev/spine) `Logger` port.

The host injects transport; this package maps levels and attributes without
bundling an agent, owning credentials, or making logging a request failure
mode.

See the repository
[README](https://github.com/pegma-dev/logger-adapters) and
[adapter design](https://github.com/pegma-dev/logger-adapters/blob/main/docs/DATADOG.md)
for usage and guarantees.
