import Parser from "rss-parser";
import type { FetchedItem } from "@aniradar/shared";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["enclosure", "enclosure"],
    ],
  },
});

function resolveUrl(raw: string, base?: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return base ? new URL(trimmed, base).href : new URL(trimmed).href;
  } catch {
    return null;
  }
}

function pickImage(it: Record<string, unknown>, base?: string): string | undefined {
  const enclosure = it.enclosure as { url?: string; type?: string } | undefined;
  if (enclosure?.url && (!enclosure.type || enclosure.type.startsWith("image/"))) {
    const u = resolveUrl(enclosure.url, base);
    if (u) return u;
  }
  const mediaContent = it.mediaContent as
    | Array<{ $?: { url?: string; medium?: string; type?: string } }>
    | undefined;
  if (Array.isArray(mediaContent)) {
    for (const m of mediaContent) {
      const url = m?.$?.url;
      const medium = m?.$?.medium ?? "";
      const type = m?.$?.type ?? "";
      if (url && (medium === "image" || type.startsWith("image/") || !medium)) {
        const u = resolveUrl(url, base);
        if (u) return u;
      }
    }
  }
  const thumbs = it.mediaThumbnail as Array<{ $?: { url?: string } }> | undefined;
  if (Array.isArray(thumbs)) {
    for (const t of thumbs) {
      if (t?.$?.url) {
        const u = resolveUrl(t.$.url, base);
        if (u) return u;
      }
    }
  }
  return undefined;
}

export async function parseRss(xml: string, feedUrl?: string): Promise<FetchedItem[]> {
  const feed = await parser.parseString(xml);
  const base = feedUrl || (feed.link ? String(feed.link) : undefined);
  return (feed.items ?? []).flatMap((it) => {
    const raw = it as unknown as Record<string, unknown>;
    const url = resolveUrl(String(it.link ?? ""), base);
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
        imageUrl: pickImage(raw, base),
        publishedAt: valid ? d : undefined,
        publishedTimePrecision: valid ? "datetime" : "unknown",
      } satisfies FetchedItem,
    ];
  });
}
