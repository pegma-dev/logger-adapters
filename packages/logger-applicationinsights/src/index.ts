import type { LogLevel, Logger } from "@pegma/spine";

/**
 * Application Insights {@link https://github.com/microsoft/ApplicationInsights-JS | SeverityLevel}
 * values used for traces: Verbose, Information, Warning, Error.
 */
export type ApplicationInsightsSeverity = 0 | 1 | 2 | 3;

/** Narrow input matching Application Insights `trackTrace` telemetry. */
export interface TrackTraceInput {
  readonly message: string;
  readonly severity: ApplicationInsightsSeverity;
  readonly properties?: Readonly<Record<string, string>>;
}

/**
 * Host-injected trace sink. Typically a bound `TelemetryClient.trackTrace`
 * or a thin wrapper around it — the adapter never imports the AI SDK.
 */
export type TrackTrace = (input: TrackTraceInput) => void;

const severityByLevel: Record<LogLevel, ApplicationInsightsSeverity> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function toPropertyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json;
}

function toProperties(
  fields: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const properties: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    properties[key] = toPropertyValue(value);
  }
  return properties;
}

/**
 * Spine {@link Logger} that maps levels and fields onto Application Insights
 * traces via a host-injected {@link TrackTrace} function.
 *
 * `log` never throws: transport and mapping failures are swallowed.
 */
export function createApplicationInsightsLogger(
  trackTrace: TrackTrace,
): Logger {
  return {
    log(level, message, fields) {
      try {
        const input: {
          message: string;
          severity: ApplicationInsightsSeverity;
          properties?: Record<string, string>;
        } = {
          message,
          severity: severityByLevel[level],
        };
        if (fields !== undefined) {
          input.properties = toProperties(fields);
        }
        trackTrace(input);
      } catch {
        // Logging must not become a failure mode for the request.
      }
    },
  };
}
