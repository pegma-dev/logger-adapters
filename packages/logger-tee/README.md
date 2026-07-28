# `@pegma/logger-tee`

Fan out the [`@pegma/spine`](https://github.com/pegma-dev/spine) `Logger`
port to multiple sinks in call-site order.

Sink failures are swallowed so one observability backend cannot interrupt
business work or prevent later sinks from receiving the same log entry.

See the repository [README](https://github.com/pegma-dev/logger-adapters) and
[tee design](https://github.com/pegma-dev/logger-adapters/blob/main/docs/TEE.md)
for usage and guarantees.
