import { describe, expect, it, vi } from "vitest";

import { createCloudflareLogger, type ConsoleLike } from "./index.js";

function createRecordingConsole(): ConsoleLike & {
  calls: Array<{ method: keyof ConsoleLike; arg: unknown }>;
} {
  const calls: Array<{ method: keyof ConsoleLike; arg: unknown }> = [];
  const record =
    (method: keyof ConsoleLike) =>
    (arg: unknown): void => {
      calls.push({ method, arg });
    };

  return {
    calls,
    debug: record("debug"),
    log: record("log"),
    warn: record("warn"),
    error: record("error"),
  };
}

describe("createCloudflareLogger", () => {
  it("maps Spine levels to distinct console methods", () => {
    const sink = createRecordingConsole();
    const logger = createCloudflareLogger({ console: sink });

    logger.log("debug", "d");
    logger.log("info", "i");
    logger.log("warn", "w");
    logger.log("error", "e");

    expect(sink.calls.map((c) => c.method)).toEqual([
      "debug",
      "log",
      "warn",
      "error",
    ]);
    expect(sink.calls.map((c) => (c.arg as { level: string }).level)).toEqual([
      "debug",
      "info",
      "warn",
      "error",
    ]);
  });

  it("includes fields when provided and omits them when undefined", () => {
    const sink = createRecordingConsole();
    const logger = createCloudflareLogger({ console: sink });
    const fields = { requestId: "r1", count: 2 };

    logger.log("info", "with fields", fields);
    logger.log("info", "without fields");

    expect(sink.calls[0]?.arg).toEqual({
      level: "info",
      message: "with fields",
      fields,
    });
    expect(sink.calls[1]?.arg).toEqual({
      level: "info",
      message: "without fields",
    });
    expect(sink.calls[1]?.arg).not.toHaveProperty("fields");
  });

  it("does not mutate caller fields", () => {
    const sink = createRecordingConsole();
    const logger = createCloudflareLogger({ console: sink });
    const fields = { a: 1 };

    logger.log("warn", "msg", fields);

    expect(fields).toEqual({ a: 1 });
    expect((sink.calls[0]?.arg as { fields: unknown }).fields).toBe(fields);
  });

  it("swallows errors thrown by the console sink", () => {
    const sink: ConsoleLike = {
      debug: () => {
        throw new Error("debug boom");
      },
      log: () => {
        throw new Error("log boom");
      },
      warn: () => {
        throw new Error("warn boom");
      },
      error: () => {
        throw new Error("error boom");
      },
    };
    const logger = createCloudflareLogger({ console: sink });

    expect(() => logger.log("debug", "d")).not.toThrow();
    expect(() => logger.log("info", "i")).not.toThrow();
    expect(() => logger.log("warn", "w")).not.toThrow();
    expect(() => logger.log("error", "e")).not.toThrow();
  });

  it("defaults to the global console when no sink is injected", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const logger = createCloudflareLogger();
      logger.log("warn", "via global");
      expect(spy).toHaveBeenCalledWith({
        level: "warn",
        message: "via global",
      });
    } finally {
      spy.mockRestore();
    }
  });
});
