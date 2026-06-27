import { describe, it, expect } from "vitest";
import { parseYouTubeRss, isRelevantYouTube } from "../src/youtube";

const xml = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
<entry><yt:videoId>abc123</yt:videoId><title>本PV公開！</title>
<link rel="alternate" href="https://youtu.be/abc123"/><published>2026-06-24T10:00:00+00:00</published></entry>
</feed>`;

describe("parseYouTubeRss", () => {
  it("解析 videoId/title/link", async () => {
    const items = await parseYouTubeRss(xml);
    expect(items[0].externalId).toBe("abc123");
    expect(items[0].title).toBe("本PV公開！");
  });
  it("关键词过滤", () => {
    expect(isRelevantYouTube("本PV公開！")).toBe(true);
    expect(isRelevantYouTube("日常 vlog")).toBe(false);
  });
});
