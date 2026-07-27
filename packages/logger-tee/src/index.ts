import type { Logger, LogLevel } from "@pegma/spine";

/**
 * Fan-out `Logger` that forwards each call to every sink in argument order.
 * A sink that throws is swallowed so later sinks still run.
 */
export function createTeeLogger(...sinks: readonly Logger[]): Logger {
  return {
    log(
      level: LogLevel,
      message: string,
      fields?: Readonly<Record<string, unknown>>,
    ): void {
      for (const sink of sinks) {
        try {
          sink.log(level, message, fields);
        } catch {
          // Sink failures must not take down the request.
        }
      }
    },
  };
}
