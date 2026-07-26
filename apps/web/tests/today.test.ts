import { describe, expect, it } from "vitest";
import { startOfToday } from "../lib/today";

describe("startOfToday (UTC+8 口径)", () => {
  it("returns Beijing midnight regardless of server timezone", () => {
    // UTC 2026-07-26 10:00 = 北京 18:00 → 今天从 UTC 前一日 16:00 开始
    expect(startOfToday(new Date("2026-07-26T10:00:00Z")).toISOString()).toBe(
      "2026-07-25T16:00:00.000Z",
    );
  });

  it("rolls over exactly at Beijing midnight", () => {
    // UTC 15:59 = 北京 23:59,仍属当日
    expect(startOfToday(new Date("2026-07-26T15:59:59Z")).toISOString()).toBe(
      "2026-07-25T16:00:00.000Z",
    );
    // UTC 16:00 = 北京次日 00:00,进入新的一天
    expect(startOfToday(new Date("2026-07-26T16:00:00Z")).toISOString()).toBe(
      "2026-07-26T16:00:00.000Z",
    );
  });

  it("handles month boundaries", () => {
    // UTC 7-31 17:00 = 北京 8-1 01:00 → 8-1 零点 = UTC 7-31 16:00
    expect(startOfToday(new Date("2026-07-31T17:00:00Z")).toISOString()).toBe(
      "2026-07-31T16:00:00.000Z",
    );
  });
});
