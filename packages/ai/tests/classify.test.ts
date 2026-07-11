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
  it("OP/ED 不命中英文单词内部（OPAQUE 不算主题歌）", () => {
    const r = classify({ title: "「OPAQUE.CLIP」コラボ全10型登場" });
    expect(r.isAnimeNews).toBe(false);
  });
  it("标准 OP 主题歌仍能命中", () => {
    expect(classify({ title: "ノンクレジットOP 公開" }).category).toBe("theme_song_announced");
  });
});

describe("classify · media/press 源要求动漫语境词", () => {
  it("media 源纯 J-pop 新曲 MV → 非情报（无动漫语境词）", () => {
    const r = classify({ title: "新曲「Blue Shining Star」ミュージックビデオ公開", sourceType: "media" });
    expect(r.isAnimeNews).toBe(false);
  });
  it("media 源真人电影放送 → 非情报", () => {
    const r = classify({ title: "主演映画「黒蜥蜴」がNHKで放送", sourceType: "media" });
    expect(r.isAnimeNews).toBe(false);
  });
  it("media 源动画主题歌（含アニメ语境词）→ 情报", () => {
    const r = classify({ title: "TVアニメ「落第賢者」OP主題歌が配信リリース", sourceType: "media" });
    expect(r.isAnimeNews).toBe(true);
    expect(r.category).toBe("theme_song_announced");
  });
  it("官方源（official_news）无语境词也放行", () => {
    const r = classify({ title: "本PV公開", sourceType: "official_news" });
    expect(r.isAnimeNews).toBe(true);
    expect(r.category).toBe("pv_released");
  });
  it("不带 sourceType（旧调用）保持原行为", () => {
    expect(classify({ title: "第2期制作決定" }).isAnimeNews).toBe(true);
  });
});
