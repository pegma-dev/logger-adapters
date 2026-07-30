import { describe, expect, it, vi } from "vitest";

import {
  createApplicationInsightsLogger,
  type TrackTrace,
  type TrackTraceInput,
} from "./index.js";

function recordingTrackTrace(): {
  trackTrace: TrackTrace;
  calls: TrackTraceInput[];
} {
  const calls: TrackTraceInput[] = [];
  return {
    calls,
    trackTrace: (input) => {
      calls.push(input);
    },
  };
}

describe("createApplicationInsightsLogger", () => {
  it("maps Spine levels to Application Insights severities", () => {
    const { trackTrace, calls } = recordingTrackTrace();
    const logger = createApplicationInsightsLogger(trackTrace);

    logger.log("debug", "d");
    logger.log("info", "i");
    logger.log("warn", "w");
    logger.log("error", "e");

    expect(calls).toEqual([
      { message: "d", severity: 0 },
      { message: "i", severity: 1 },
      { message: "w", severity: 2 },
      { message: "e", severity: 3 },
    ]);
  });

  it("passes string fields through and stringifies non-primitives", () => {
    const { trackTrace, calls } = recordingTrackTrace();
    const logger = createApplicationInsightsLogger(trackTrace);
    const fields = {
      requestId: "abc",
      count: 3,
      ok: true,
      nested: { a: 1 },
      tags: ["x", "y"],
      empty: null,
    };

    logger.log("info", "hello", fields);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      message: "hello",
      severity: 1,
      properties: {
        requestId: "abc",
        count: "3",
        ok: "true",
        nested: '{"a":1}',
        tags: '["x","y"]',
        empty: "null",
      },
    });
    // Caller fields must not be mutated.
    expect(fields).toEqual({
      requestId: "abc",
      count: 3,
      ok: true,
      nested: { a: 1 },
      tags: ["x", "y"],
      empty: null,
    });
  });

  it("degrades an unserializable field without dropping the trace", () => {
    const { trackTrace, calls } = recordingTrackTrace();
    const logger = createApplicationInsightsLogger(trackTrace);
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    logger.log("info", "hello", { requestId: "abc", circular });

    expect(calls).toEqual([
      {
        message: "hello",
        severity: 1,
        properties: { requestId: "abc", circular: "[object Object]" },
      },
    ]);
  });

  it("omits properties when fields are undefined", () => {
    const { trackTrace, calls } = recordingTrackTrace();
    const logger = createApplicationInsightsLogger(trackTrace);

    logger.log("warn", "no fields");

    expect(calls).toEqual([{ message: "no fields", severity: 2 }]);
    expect(calls[0]).not.toHaveProperty("properties");
  });

  it("does not let a throwing trackTrace escape log", () => {
    const trackTrace = vi.fn(() => {
      throw new Error("telemetry down");
    });
    const logger = createApplicationInsightsLogger(trackTrace);

    expect(() => logger.log("error", "boom", { x: 1 })).not.toThrow();
    expect(trackTrace).toHaveBeenCalledOnce();
  });
});
