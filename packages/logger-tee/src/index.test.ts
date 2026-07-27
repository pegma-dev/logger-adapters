import { describe, expect, it } from "vitest";
import type { Logger, LogLevel } from "@pegma/spine";
import { createTeeLogger } from "./index.js";

type LogCall = {
  level: LogLevel;
  message: string;
  fields?: Readonly<Record<string, unknown>>;
};

function recordingSink(calls: LogCall[]): Logger {
  return {
    log(level, message, fields) {
      if (fields === undefined) {
        calls.push({ level, message });
      } else {
        calls.push({ level, message, fields });
      }
    },
  };
}

describe("createTeeLogger", () => {
  it("calls sinks in argument order", () => {
    const order: string[] = [];
    const first: Logger = {
      log() {
        order.push("first");
      },
    };
    const second: Logger = {
      log() {
        order.push("second");
      },
    };

    createTeeLogger(first, second).log("info", "hello");

    expect(order).toEqual(["first", "second"]);
  });

  it("is a no-op when given zero sinks", () => {
    expect(() => createTeeLogger().log("debug", "nothing")).not.toThrow();
  });

  it("continues to later sinks when one throws", () => {
    const calls: LogCall[] = [];
    const throwing: Logger = {
      log() {
        throw new Error("sink failed");
      },
    };

    expect(() =>
      createTeeLogger(throwing, recordingSink(calls)).log("error", "boom", {
        code: 1,
      }),
    ).not.toThrow();

    expect(calls).toEqual([
      { level: "error", message: "boom", fields: { code: 1 } },
    ]);
  });

  it("preserves fields object identity and does not mutate it", () => {
    const fields = { requestId: "abc" };
    const received: unknown[] = [];
    const sink: Logger = {
      log(_level, _message, f) {
        received.push(f);
      },
    };

    createTeeLogger(sink, sink).log("info", "msg", fields);

    expect(received).toHaveLength(2);
    expect(received[0]).toBe(fields);
    expect(received[1]).toBe(fields);
    expect(fields).toEqual({ requestId: "abc" });
  });
});
