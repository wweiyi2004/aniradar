import { describe, expect, it } from "vitest";
import { buildRssXml, escapeXml } from "../lib/rss";

describe("escapeXml", () => {
  it("escapes the five XML entities", () => {
    expect(escapeXml(`<a href="x">&'b'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&apos;b&apos;&lt;/a&gt;",
    );
  });

  it("strips control characters illegal in XML 1.0", () => {
    const dirty = ["a", "b", "c", "d", "e"].join(String.fromCharCode(0));
    expect(escapeXml(dirty)).toBe("abcde");
    expect(escapeXml(`x${String.fromCharCode(8, 11, 31)}y`)).toBe("xy");
    // 合法空白保留
    expect(escapeXml("a\tb\nc\rd")).toBe("a\tb\nc\rd");
  });
});

describe("buildRssXml", () => {
  const channel = {
    title: "AniRadar",
    link: "https://example.com",
    feedUrl: "https://example.com/feed.xml",
    description: "情报流",
    language: "zh-cn",
    lastBuildDate: new Date("2026-07-26T00:00:00Z"),
    items: [
      {
        title: "《测试&作品》动画化",
        link: "https://example.com/events/e1",
        description: "摘要<b>富文本</b>",
        pubDate: new Date("2026-07-25T12:34:56Z"),
        category: "动画化",
      },
      {
        title: "无摘要条目",
        link: "https://example.com/events/e2",
      },
    ],
  };

  it("renders a valid RSS 2.0 skeleton with self link", () => {
    const xml = buildRssXml(channel);
    expect(xml).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
    expect(xml).toContain(`<rss version="2.0"`);
    expect(xml).toContain("<title>AniRadar</title>");
    expect(xml).toContain(
      `<atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml"/>`,
    );
    expect(xml).toContain("<language>zh-cn</language>");
    expect(xml).toContain("<lastBuildDate>Sun, 26 Jul 2026 00:00:00 GMT</lastBuildDate>");
  });

  it("escapes item content and renders permalink guid + RFC822 pubDate", () => {
    const xml = buildRssXml(channel);
    expect(xml).toContain("<title>《测试&amp;作品》动画化</title>");
    expect(xml).toContain("<description>摘要&lt;b&gt;富文本&lt;/b&gt;</description>");
    expect(xml).toContain(`<guid isPermaLink="true">https://example.com/events/e1</guid>`);
    expect(xml).toContain("<pubDate>Sat, 25 Jul 2026 12:34:56 GMT</pubDate>");
    expect(xml).toContain("<category>动画化</category>");
  });

  it("omits optional tags when absent", () => {
    const xml = buildRssXml(channel);
    const second = xml.slice(xml.indexOf("events/e2"));
    expect(second).not.toContain("<description>");
    expect(second).not.toContain("<pubDate>");
    expect(second).not.toContain("<category>");
  });

  it("renders an empty channel without items", () => {
    const xml = buildRssXml({ ...channel, items: [] });
    expect(xml).toContain("</channel>");
    expect(xml).not.toContain("<item>");
  });
});
