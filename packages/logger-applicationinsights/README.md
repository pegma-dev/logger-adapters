# `@pegma/logger-applicationinsights`

An Azure Application Insights implementation of the
[`@pegma/spine`](https://github.com/pegma-dev/spine) `Logger` port.

The host injects its trace sender; this package maps Pegma levels and structured
fields without owning Application Insights bootstrap or process-global state.

See the repository
[README](https://github.com/pegma-dev/logger-adapters) and
[adapter design](https://github.com/pegma-dev/logger-adapters/blob/main/docs/APPLICATION_INSIGHTS.md)
for usage and guarantees.
