import { describe, it, expect } from "vitest";
import { parseLooseDate } from "../src/date";

describe("parseLooseDate", () => {
  it("解析日文 YYYY年M月D日（曜）HH:MM", () => {
    const d = parseLooseDate("2026年6月28日（日）22:00");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(5); // 6月 → 索引 5
    expect(d?.getDate()).toBe(28);
    expect(d?.getHours()).toBe(22);
  });
  it("解析日文不带时间", () => {
    const d = parseLooseDate("2025年12月1日");
    expect(d?.getFullYear()).toBe(2025);
    expect(d?.getMonth()).toBe(11);
    expect(d?.getDate()).toBe(1);
  });
  it("解析点分/斜杠日期", () => {
    expect(parseLooseDate("2026.5.29")?.getDate()).toBe(29);
    expect(parseLooseDate("2026/05/07")?.getMonth()).toBe(4);
  });
  it("无法解析返回 undefined", () => {
    expect(parseLooseDate("近日公開")).toBeUndefined();
    expect(parseLooseDate("")).toBeUndefined();
    expect(parseLooseDate(null)).toBeUndefined();
  });
});
