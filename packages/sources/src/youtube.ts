import { fetchUrl } from "@aniradar/crawler";
import { parseYouTubeRss, isRelevantYouTube } from "@aniradar/parser";
import type { SourceAdapter, SourceLike } from "./types";

export const YouTubeRssAdapter: SourceAdapter = {
  async fetch(source: SourceLike) {
    const res = await fetchUrl(source.url, {
      etag: source.etag ?? undefined,
      lastModified: source.lastModified ?? undefined,
    });
    if (res.notModified) return { items: [], notModified: true };
    const all = await parseYouTubeRss(res.body);
    return {
      items: all.filter((i) => isRelevantYouTube(i.title)),
      etag: res.etag,
      lastModified: res.lastModified,
    };
  },
};
