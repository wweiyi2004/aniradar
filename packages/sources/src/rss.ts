import { fetchUrl } from "@aniradar/crawler";
import { parseRss } from "@aniradar/parser";
import type { SourceAdapter, SourceLike } from "./types";

export const RssAdapter: SourceAdapter = {
  async fetch(source: SourceLike) {
    const res = await fetchUrl(source.url, {
      etag: source.etag ?? undefined,
      lastModified: source.lastModified ?? undefined,
    });
    if (res.notModified) return { items: [], notModified: true };
    const items = await parseRss(res.body);
    return { items, etag: res.etag, lastModified: res.lastModified };
  },
};
