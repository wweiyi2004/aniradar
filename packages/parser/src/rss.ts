import Parser from "rss-parser";
import type { FetchedItem } from "@aniradar/shared";

const parser = new Parser();

export async function parseRss(xml: string): Promise<FetchedItem[]> {
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).flatMap((it) => {
    const url = (it.link ?? "").trim();
    const title = (it.title ?? "").trim();
    if (!url || !title) return [];
    const pub = it.isoDate ?? it.pubDate;
    const d = pub ? new Date(pub) : undefined;
    const valid = d && !isNaN(d.getTime());
    return [
      {
        title,
        url,
        summary: (it.contentSnippet ?? it.content ?? "").trim() || undefined,
        rawText: (it.content ?? it.contentSnippet ?? "").trim() || undefined,
        publishedAt: valid ? d : undefined,
        publishedTimePrecision: valid ? "datetime" : "unknown",
      } satisfies FetchedItem,
    ];
  });
}
