import { describe, it, expect } from "vitest";
import { looksNonNews } from "../src/prefilter";

describe("looksNonNews（招聘/HR 预过滤，高精度负向）", () => {
  it("招聘类标题判为非情报", () => {
    expect(looksNonNews("2027年度新卒採用【仕上げ・美術・作画】エントリー受付終了")).toBe(true);
    expect(looksNonNews("A-1 Pictures オープンカンパニー開催のお知らせ")).toBe(true);
    expect(looksNonNews("中途採用 制作進行 募集")).toBe(true);
  });

  it("真情报不被误杀（即使含'採用'字样）", () => {
    expect(looksNonNews("TVアニメ「推しの子」主題歌にYOASOBIを採用決定")).toBe(false);
    expect(looksNonNews("「鬼滅の刃」アニメ第2期制作決定")).toBe(false);
    expect(looksNonNews("劇場版 公開日決定")).toBe(false);
  });
});
