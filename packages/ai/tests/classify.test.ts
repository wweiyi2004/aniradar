import { describe, it, expect } from "vitest";
import { classify } from "../src/classify";

describe("classify", () => {
  it("アニメ化 → anime_adaptation", () => {
    const r = classify({ title: "人気漫画がアニメ化決定！" });
    expect(r.isAnimeNews).toBe(true);
    expect(r.category).toBe("anime_adaptation");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });
  it("第2期 → sequel_announced", () => {
    expect(classify({ title: "第2期制作決定" }).category).toBe("sequel_announced");
  });
  it("本PV → pv_released", () => {
    expect(classify({ title: "本PV公開" }).category).toBe("pv_released");
  });
  it("延期 → delay_announced 优先于 放送", () => {
    expect(classify({ title: "放送延期のお知らせ" }).category).toBe("delay_announced");
  });
  it("无关键词 → 非情报", () => {
    const r = classify({ title: "今日の日常ブログ" });
    expect(r.isAnimeNews).toBe(false);
  });
});
