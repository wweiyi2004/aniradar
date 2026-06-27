import { describe, it, expect, beforeEach } from "vitest";
import { analyze } from "../src/analyze";

describe("analyze（无 API key 时回退规则 mock）", () => {
  beforeEach(() => {
    delete process.env.AI_API_KEY;
  });

  it("回退 mock 并正确分类", async () => {
    const r = await analyze({ title: "「鬼滅の刃」アニメ第2期制作決定" });
    expect(r.source).toBe("mock");
    expect(r.isAnimeNews).toBe(true);
    expect(r.category).toBe("sequel_announced");
  });

  it("无关键词回退 mock 判为非情报", async () => {
    const r = await analyze({ title: "今日の日常ブログ" });
    expect(r.source).toBe("mock");
    expect(r.isAnimeNews).toBe(false);
  });
});
