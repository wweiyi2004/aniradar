import { fetchUrl } from "@aniradar/crawler";
import { computeContentHash } from "@aniradar/detector";
import type { SourceAdapter, SourceLike } from "./types";

export const PageDiffAdapter: SourceAdapter = {
  async fetch(source: SourceLike) {
    const res = await fetchUrl(source.url);
    if (res.notModified) return { items: [], notModified: true };
    const text = res.body
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const hash = computeContentHash(text);
    if (source.lastSeenHash && source.lastSeenHash === hash) {
      return { items: [], notModified: true };
    }
    return {
      items: [
        {
          title: `页面更新: ${source.url}`,
          url: source.url,
          rawText: text.slice(0, 2000),
          publishedTimePrecision: "unknown" as const,
        },
      ],
      lastModified: hash,
    };
  },
};
