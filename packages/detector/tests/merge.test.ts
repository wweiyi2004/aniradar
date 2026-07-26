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
  it("作品名子变体（前缀）同分类 → 合并", () => {
    const a = { title: "「鬼滅の刃」キービジュアル公開", category: "key_visual_released" };
    const b = { title: "「鬼滅の刃 柱稽古編」キービジュアル解禁", category: "key_visual_released" };
    expect(isSameEvent(a, b)).toBe(true);
  });
  it("一侧带「」、另一侧不带但标题含作品名 → 合并", () => {
    const a = { title: "「呪術廻戦」本PV公開", category: "pv_released" };
    const b = { title: "呪術廻戦 第2期 本PVが公開された", category: "pv_released" };
    expect(isSameEvent(a, b)).toBe(true);
  });
  it("不同作品（前缀守卫不误伤短名）→ 不合并", () => {
    const a = { title: "「PV」特集", category: "pv_released" };
    const b = { title: "「PVアニメ大全」特集", category: "pv_released" };
    expect(isSameEvent(a, b)).toBe(false);
  });
});

describe("isSameEvent · facts.work 强键", () => {
  it("同 work 同分类、标题措辞完全不同 → 合并（修复小圆 3 条 PV 拆分）", () => {
    const a = {
      title: "劇場版「魔法少女まどか☆マギカ」新PVがお披露目",
      category: "pv_released",
      work: "劇場版 魔法少女まどか☆マギカ〈ワルプルギスの廻天〉",
    };
    const b = {
      title: "ワルプルギスの廻天、最新映像が解禁に",
      category: "pv_released",
      work: "劇場版 魔法少女まどか☆マギカ〈ワルプルギスの廻天〉",
    };
    expect(isSameEvent(a, b)).toBe(true);
  });
  it("同 work、other ↔ 具体分类 → 合并（修复世界在舞蹈跨分类拆分）", () => {
    const a = {
      title: "第1話放送を記念して祝賀イラスト公開",
      category: "other",
      work: "ワールド イズ ダンシング",
    };
    const b = { title: "OP映像が公開", category: "pv_released", work: "ワールド イズ ダンシング" };
    expect(isSameEvent(a, b)).toBe(true);
  });
  it("同 work、pv ↔ key_visual（兼容组内）→ 合并", () => {
    const a = { title: "キービジュアル公開", category: "key_visual_released", work: "鬼滅の刃" };
    const b = { title: "最新PV公開", category: "pv_released", work: "鬼滅の刃" };
    expect(isSameEvent(a, b)).toBe(true);
  });
  it("同 work 但分类不兼容（pv ↔ cast）→ 不合并（玩具总动员式的多事件是合法的）", () => {
    const a = { title: "本PV公開", category: "pv_released", work: "作品A" };
    const b = { title: "追加キャスト解禁", category: "cast_announced", work: "作品A" };
    expect(isSameEvent(a, b)).toBe(false);
  });
  it("不同 work → 回退标题逻辑，不因分类兼容而合并", () => {
    const a = { title: "祝賀イラスト公開", category: "other", work: "作品A" };
    const b = { title: "OP映像公開", category: "pv_released", work: "作品B" };
    expect(isSameEvent(a, b)).toBe(false);
  });
  it("work 前缀变体（劇場版 X vs X）→ 同作品", () => {
    const a = { title: "上映決定", category: "movie_announced", work: "るすばん" };
    const b = { title: "劇場公開へ", category: "movie_announced", work: "るすばん（短編）" };
    expect(isSameEvent(a, b)).toBe(true);
  });
  it("周边类不走 work 强键：同作品两款不同周边 → 不合并", () => {
    const a = { title: "五条悟エコバッグ発売", category: "merch_release", work: "呪術廻戦" };
    const b = {
      title: "乙骨vs虎杖アパレルグッズ登場",
      category: "merch_release",
      work: "呪術廻戦",
    };
    expect(isSameEvent(a, b)).toBe(false);
  });
  it("活动类不走 work 强键：同作品两场不同活动 → 不合并", () => {
    const a = { title: "先行上映会開催決定", category: "event_info", work: "作品X" };
    const b = { title: "コラボカフェ開催", category: "event_info", work: "作品X" };
    expect(isSameEvent(a, b)).toBe(false);
  });
});
