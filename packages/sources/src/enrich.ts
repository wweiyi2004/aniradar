import { fetchUrl } from "@aniradar/crawler";
import { extractArticle } from "@aniradar/parser";
import type { FetchedItem, FetchStrategy } from "@aniradar/shared";

// 对单条新条目做详情增强：rss/html_list 抓详情页提取正文全文+主图；
// youtube 已在解析阶段带好缩略图/视频链接；page_diff 不增强。失败则保持原样不抛错。
export async function enrichItem(item: FetchedItem, strategy: FetchStrategy): Promise<FetchedItem> {
  if (strategy !== "rss" && strategy !== "html_list") return item;
  try {
    const res = await fetchUrl(item.url, { timeoutMs: 12_000 });
    if (res.notModified || !res.body) return item;
    const { imageUrl, text } = extractArticle(res.body, item.url);
    return {
      ...item,
      rawText: text && text.length > (item.rawText?.length ?? 0) ? text : item.rawText,
      imageUrl: item.imageUrl ?? imageUrl,
    };
  } catch {
    return item;
  }
}

// 有限并发地增强一批条目。
export async function enrichItems(
  items: FetchedItem[],
  strategy: FetchStrategy,
  concurrency = 5,
): Promise<FetchedItem[]> {
  const out: FetchedItem[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await enrichItem(items[i], strategy);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}
