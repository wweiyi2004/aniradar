import { describe, it, expect } from "vitest";
import { buildEventFromSignal, MIN_PUBLIC_CONFIDENCE } from "../src/event";

const base = {
  title: "「作品」本PV公開",
  category: "pv_released" as const,
  firstSeenAt: new Date("2026-07-01T00:00:00Z"),
};

describe("buildEventFromSignal · 状态判定", () => {
  it("官方源 + 高置信 → auto_published", () => {
    const ev = buildEventFromSignal({ ...base, confidence: 0.95, sourceType: "official_news" });
    expect(ev.status).toBe("auto_published");
    expect(ev.officialConfirmed).toBe(true);
  });
  it("媒体源 + 中等置信 → draft_ai", () => {
    const ev = buildEventFromSignal({ ...base, confidence: 0.8, sourceType: "media" });
    expect(ev.status).toBe("draft_ai");
    expect(ev.officialConfirmed).toBe(false);
  });
  it("低置信 → needs_review（不公开）", () => {
    const ev = buildEventFromSignal({ ...base, confidence: MIN_PUBLIC_CONFIDENCE - 0.01, sourceType: "media" });
    expect(ev.status).toBe("needs_review");
  });
  it("官方源低置信也进 needs_review", () => {
    const ev = buildEventFromSignal({ ...base, confidence: 0.4, sourceType: "official_news" });
    expect(ev.status).toBe("needs_review");
  });
});
