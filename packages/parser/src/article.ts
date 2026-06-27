import * as cheerio from "cheerio";

export interface ArticleExtract {
  imageUrl?: string;
  text?: string;
}

function abs(url: string | undefined, base: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, base).toString();
  } catch {
    return undefined;
  }
}

// 从文章详情页提取主图（og:image）与正文全文（启发式：article/main 容器内的段落）。
export function extractArticle(html: string, baseUrl: string): ArticleExtract {
  const $ = cheerio.load(html);

  const meta = (sel: string) => $(sel).attr("content")?.trim() || undefined;
  const imageUrl = abs(
    meta('meta[property="og:image"]') ||
      meta('meta[name="og:image"]') ||
      meta('meta[name="twitter:image"]') ||
      meta('meta[property="twitter:image"]'),
    baseUrl,
  );

  let container = $("article").first();
  if (!container.length) container = $("main").first();
  if (!container.length) container = $("body");

  const paras = container
    .find("p")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length > 20);

  let text = paras.join("\n");
  const ogDesc = meta('meta[property="og:description"]') || meta('meta[name="description"]');
  if (text.length < 80 && ogDesc) text = ogDesc;
  text = text.slice(0, 3000).trim();

  return { imageUrl, text: text || undefined };
}
