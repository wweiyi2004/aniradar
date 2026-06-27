import { describe, it, expect } from "vitest";
import { parseHtmlList } from "../src/html";

const html = `<ul class="news-list">
<li><span class="title">アニメ化決定</span><a href="/news/1">link</a><span class="date">2026-06-24</span><p class="summary">概要</p></li>
</ul>`;

describe("parseHtmlList", () => {
  it("按 selector 解析并补全相对链接", () => {
    const items = parseHtmlList(
      html,
      { listItem: ".news-list li", title: ".title", url: "a", date: ".date", summary: ".summary" },
      "https://ex.com/news/",
    );
    expect(items[0].title).toBe("アニメ化決定");
    expect(items[0].url).toBe("https://ex.com/news/1");
    expect(items[0].summary).toBe("概要");
  });
});
