import type { LogLevel, Logger } from "@pegma/spine";

/** Datadog log status — mirrors Spine {@link LogLevel} one-to-one. */
export type DatadogStatus = LogLevel;

/** Narrow input matching a Datadog log submit path. */
export type DatadogSubmitInput = {
  status: DatadogStatus;
  message: string;
  attributes?: Readonly<Record<string, unknown>>;
};

/**
 * Host-injected log sink. Typically a thin wrapper around Node agent /
 * `dd-trace` intake or an HTTP / Workers-compatible client — the adapter
 * never imports a Datadog SDK.
 */
export type DatadogSubmit = (input: DatadogSubmitInput) => void;

function toAttributeValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  try {
    const json = JSON.stringify(value);
    if (json !== undefined) {
      return json;
    }
  } catch {
    // Fall through to String coercion below.
  }
  try {
    return String(value);
  } catch {
    return "[unserializable]";
  }
}

function toAttributes(
  fields: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    attributes[key] = toAttributeValue(value);
  }
  return attributes;
}

/**
 * Spine {@link Logger} that maps levels and fields onto Datadog logs via a
 * host-injected {@link DatadogSubmit} function.
 *
 * `log` never throws: transport and mapping failures are swallowed.
 */
export function createDatadogLogger(submit: DatadogSubmit): Logger {
  return {
    log(level, message, fields) {
      try {
        const input: DatadogSubmitInput =
          fields === undefined
            ? { status: level, message }
            : {
                status: level,
                message,
                attributes: toAttributes(fields),
              };
        submit(input);
      } catch {
        // Logging must not become a failure mode for the request.
      }
    },
  };
}
