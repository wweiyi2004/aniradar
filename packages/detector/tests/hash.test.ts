import { describe, it, expect } from "vitest";
import { computeSignalHash, normalizeUrl } from "../src/hash";

describe("normalizeUrl", () => {
  it("去除追踪参数与末尾斜杠、小写域名", () => {
    expect(normalizeUrl("https://EX.com/a/?utm_source=x&id=1")).toBe("https://ex.com/a?id=1");
  });
});

describe("computeSignalHash", () => {
  it("同源同 url 同 title 稳定且去查询追踪后一致", () => {
    const a = computeSignalHash("s1", { url: "https://ex.com/a?utm_source=x", title: " アニメ化 " });
    const b = computeSignalHash("s1", { url: "https://ex.com/a", title: "アニメ化" });
    expect(a).toBe(b);
  });
  it("不同源不同 hash", () => {
    const a = computeSignalHash("s1", { url: "https://ex.com/a", title: "t" });
    const b = computeSignalHash("s2", { url: "https://ex.com/a", title: "t" });
    expect(a).not.toBe(b);
  });
});
