import type { LogLevel, Logger } from "@pegma/spine";

/** Minimal console surface used as the Workers Logs sink. */
export type ConsoleLike = {
  debug(...data: unknown[]): void;
  log(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
};

export type CloudflareLoggerOptions = {
  /** Defaults to the global `console`. Inject a fake for tests. */
  console?: ConsoleLike;
};

type LogPayload = {
  level: LogLevel;
  message: string;
  fields?: Readonly<Record<string, unknown>>;
};

const LEVEL_TO_METHOD = {
  debug: "debug",
  info: "log",
  warn: "warn",
  error: "error",
} as const satisfies Record<LogLevel, keyof ConsoleLike>;

/**
 * Spine `Logger` that emits one structured object per call onto Workers
 * `console` methods so lines appear in Workers Logs.
 *
 * `log` never throws: transport errors from the console sink are swallowed.
 */
export function createCloudflareLogger(
  options?: CloudflareLoggerOptions,
): Logger {
  const sink = options?.console ?? console;

  return {
    log(level, message, fields) {
      const payload: LogPayload =
        fields === undefined ? { level, message } : { level, message, fields };

      try {
        sink[LEVEL_TO_METHOD[level]](payload);
      } catch {
        // Observability must not become an outage.
      }
    },
  };
}
