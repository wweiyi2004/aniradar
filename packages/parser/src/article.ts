import * as cheerio from "cheerio";

export interface ArticleExtract {
  imageUrl?: string;
  videoUrl?: string;
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

const YT_EMBED_RE = /(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/)([\w-]{6,})/;
const YT_LINK_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/;

// 文章内嵌的 YouTube 视频（多为 PV/预告）。iframe 嵌入最可靠；正文内指向
// YouTube 的链接次之（限定在文章容器内，避免命中页脚的频道链接）。
function extractYouTube($: cheerio.CheerioAPI, container: cheerio.Cheerio<never>, isArticleNode: boolean): string | undefined {
  let id: string | undefined;
  container.find("iframe[src]").each((_, el) => {
    if (id) return;
    const m = ($(el).attr("src") ?? "").match(YT_EMBED_RE);
    if (m) id = m[1];
  });
  if (!id && isArticleNode) {
    container.find("a[href]").each((_, el) => {
      if (id) return;
      const m = ($(el).attr("href") ?? "").match(YT_LINK_RE);
      if (m) id = m[1];
    });
  }
  return id ? `https://www.youtube.com/watch?v=${id}` : undefined;
}

// 从文章详情页提取主图（og:image）、内嵌 YouTube 视频与正文全文
// （启发式：article/main 容器内的段落）。
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

  let isArticleNode = true;
  let container = $("article").first();
  if (!container.length) container = $("main").first();
  if (!container.length) {
    container = $("body");
    isArticleNode = false;
  }

  const videoUrl = extractYouTube($, container as cheerio.Cheerio<never>, isArticleNode);

  const paras = container
    .find("p")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length > 20);

  let text = paras.join("\n");
  const ogDesc = meta('meta[property="og:description"]') || meta('meta[name="description"]');
  if (text.length < 80 && ogDesc) text = ogDesc;
  text = text.slice(0, 3000).trim();

  return { imageUrl, videoUrl, text: text || undefined };
}
