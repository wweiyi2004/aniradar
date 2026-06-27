import type { FetchStrategy } from "@aniradar/shared";
import type { SourceAdapter } from "./types";
import { RssAdapter } from "./rss";
import { YouTubeRssAdapter } from "./youtube";
import { HtmlListAdapter } from "./htmlList";
import { PageDiffAdapter } from "./pageDiff";

const map: Record<FetchStrategy, SourceAdapter> = {
  rss: RssAdapter,
  youtube_rss: YouTubeRssAdapter,
  html_list: HtmlListAdapter,
  page_diff: PageDiffAdapter,
};

export function getAdapter(strategy: FetchStrategy): SourceAdapter {
  const a = map[strategy];
  if (!a) throw new Error(`No adapter for strategy ${strategy}`);
  return a;
}
