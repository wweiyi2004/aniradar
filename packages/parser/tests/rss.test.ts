import { describe, it, expect } from "vitest";
import { parseRss } from "../src/rss";

const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
<link>https://ex.com/</link>
<item><title>アニメ化決定！</title><link>https://ex.com/a</link><pubDate>Wed, 24 Jun 2026 10:00:00 +0900</pubDate><description>本文スニペット</description>
<enclosure url="https://ex.com/cover.jpg" type="image/jpeg" />
</item>
<item><title>相対リンク</title><link>/news/b</link><description>x</description></item>
</channel></rss>`;

describe("parseRss", () => {
  it("解析 title/link/pubDate/summary", async () => {
    const items = await parseRss(xml, "https://ex.com/rss.xml");
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("アニメ化決定！");
    expect(items[0].url).toBe("https://ex.com/a");
    expect(items[0].imageUrl).toBe("https://ex.com/cover.jpg");
    expect(items[0].publishedTimePrecision).toBe("datetime");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-06-24T01:00:00.000Z");
    expect(items[1].url).toBe("https://ex.com/news/b");
  });
});
