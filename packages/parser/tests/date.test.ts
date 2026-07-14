import { describe, it, expect } from "vitest";
import { parseLooseDate } from "../src/date";

describe("parseLooseDate", () => {
  it("解析日文 YYYY年M月D日（曜）HH:MM 为 JST", () => {
    const d = parseLooseDate("2026年6月28日（日）22:00");
    // 2026-06-28 22:00 JST = 13:00 UTC
    expect(d?.toISOString()).toBe("2026-06-28T13:00:00.000Z");
  });
  it("解析日文不带时间（JST 00:00）", () => {
    const d = parseLooseDate("2025年12月1日");
    expect(d?.toISOString()).toBe("2025-11-30T15:00:00.000Z");
  });
  it("解析点分/斜杠日期为 JST 00:00", () => {
    expect(parseLooseDate("2026.5.29")?.toISOString()).toBe("2026-05-28T15:00:00.000Z");
    expect(parseLooseDate("2026/05/07")?.toISOString()).toBe("2026-05-06T15:00:00.000Z");
  });
  it("拒绝非法日历日", () => {
    expect(parseLooseDate("2026年2月31日")).toBeUndefined();
    expect(parseLooseDate("2026-02-31")).toBeUndefined();
  });
  it("无法解析返回 undefined", () => {
    expect(parseLooseDate("近日公開")).toBeUndefined();
    expect(parseLooseDate("")).toBeUndefined();
    expect(parseLooseDate(null)).toBeUndefined();
  });
});
