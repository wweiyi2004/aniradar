import { fetchUrl } from "@aniradar/crawler";
import { parseHtmlList } from "@aniradar/parser";
import { computeContentHash } from "@aniradar/detector";
import type { SourceAdapter, SourceLike } from "./types";
import { asSelectorConfig } from "./types";

export const HtmlListAdapter: SourceAdapter = {
  async fetch(source: SourceLike) {
    const res = await fetchUrl(source.url);
    if (res.notModified) return { items: [], notModified: true };
    const cfg = asSelectorConfig(source.selectorConfig);
    const items = parseHtmlList(res.body, cfg, source.url);
    // 列表指纹：URL 集合的 hash。未变化则跳过。
    const listHash = computeContentHash(items.map((i) => i.url).join("|"));
    if (source.lastSeenHash && source.lastSeenHash === listHash) {
      return { items: [], notModified: true };
    }
    // 用 lastModified 字段回传内容指纹，worker 落库写入 Source.lastSeenHash。
    return { items, lastModified: listHash };
  },
};
