import { describe, it, expect } from "vitest";
import { extractWorkTitle, titleSimilarity, isSameEvent } from "../src/merge";

describe("extractWorkTitle", () => {
  it("提取首个「」作品名", () => {
    expect(extractWorkTitle("「鬼滅の刃」アニメ第2期制作決定")).toBe("鬼滅の刃");
  });
  it("支持『』", () => {
    expect(extractWorkTitle("『呪術廻戦』本PV公開")).toBe("呪術廻戦");
  });
  it("无括号返回 null", () => {
    expect(extractWorkTitle("新作アニメ制作決定")).toBeNull();
  });
});

describe("titleSimilarity", () => {
  it("相同标题相似度为 1", () => {
    expect(titleSimilarity("本PV公開", "本PV公開")).toBe(1);
  });
  it("完全不同标题相似度低", () => {
    expect(titleSimilarity("鬼滅の刃", "呪術廻戦")).toBeLessThan(0.3);
  });
});

describe("isSameEvent", () => {
  const A = { title: "「鬼滅の刃」アニメ第2期制作決定", category: "sequel_announced" };
  it("同作品同分类 → 合并", () => {
    const B = { title: "「鬼滅の刃」続編が決定！スタッフ続投", category: "sequel_announced" };
    expect(isSameEvent(A, B)).toBe(true);
  });
  it("不同作品同分类 → 不合并", () => {
    const B = { title: "「呪術廻戦」第2期制作決定", category: "sequel_announced" };
    expect(isSameEvent(A, B)).toBe(false);
  });
  it("同作品不同分类 → 不合并", () => {
    const B = { title: "「鬼滅の刃」本PV公開", category: "pv_released" };
    expect(isSameEvent(A, B)).toBe(false);
  });
  it("无括号但标题高度相似 → 合并", () => {
    const a = { title: "新作アニメ制作決定のお知らせ", category: "anime_adaptation" };
    const b = { title: "新作アニメ制作決定のお知らせ", category: "anime_adaptation" };
    expect(isSameEvent(a, b)).toBe(true);
  });
});
