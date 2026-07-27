import { describe, expect, it, vi } from "vitest";

import {
  createDatadogLogger,
  type DatadogSubmit,
  type DatadogSubmitInput,
} from "./index.js";

function recordingSubmit(): {
  submit: DatadogSubmit;
  calls: DatadogSubmitInput[];
} {
  const calls: DatadogSubmitInput[] = [];
  return {
    calls,
    submit: (input) => {
      calls.push(input);
    },
  };
}

describe("createDatadogLogger", () => {
  it("maps Spine levels to Datadog statuses one-to-one", () => {
    const { submit, calls } = recordingSubmit();
    const logger = createDatadogLogger(submit);

    logger.log("debug", "d");
    logger.log("info", "i");
    logger.log("warn", "w");
    logger.log("error", "e");

    expect(calls).toEqual([
      { status: "debug", message: "d" },
      { status: "info", message: "i" },
      { status: "warn", message: "w" },
      { status: "error", message: "e" },
    ]);
  });

  it("passes attributes through and stringifies non-primitives", () => {
    const { submit, calls } = recordingSubmit();
    const logger = createDatadogLogger(submit);
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
      status: "info",
      message: "hello",
      attributes: {
        requestId: "abc",
        count: 3,
        ok: true,
        nested: '{"a":1}',
        tags: '["x","y"]',
        empty: null,
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
    expect(calls[0]?.attributes).not.toBe(fields);
  });

  it("omits attributes when fields are undefined", () => {
    const { submit, calls } = recordingSubmit();
    const logger = createDatadogLogger(submit);

    logger.log("warn", "no fields");

    expect(calls).toEqual([{ status: "warn", message: "no fields" }]);
    expect(calls[0]).not.toHaveProperty("attributes");
  });

  it("does not let a throwing submit escape log", () => {
    const submit = vi.fn(() => {
      throw new Error("intake down");
    });
    const logger = createDatadogLogger(submit);

    expect(() => logger.log("error", "boom", { x: 1 })).not.toThrow();
    expect(submit).toHaveBeenCalledOnce();
  });
});
