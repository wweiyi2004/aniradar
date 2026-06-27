import Parser from "rss-parser";
import type { FetchedItem } from "@aniradar/shared";

const parser = new Parser({
  customFields: {
    item: [
      ["yt:videoId", "videoId"],
      ["media:group", "mediaGroup"],
    ],
  },
});

export async function parseYouTubeRss(xml: string): Promise<FetchedItem[]> {
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).flatMap((it) => {
    const url = String(it.link ?? "").trim();
    const title = String(it.title ?? "").trim();
    if (!url || !title) return [];
    const iso = it.isoDate ? String(it.isoDate) : undefined;
    const d = iso ? new Date(iso) : undefined;
    const valid = d && !isNaN(d.getTime());
    const videoId = it.videoId ? String(it.videoId) : undefined;
    return [
      {
        title,
        url,
        externalId: videoId,
        // YouTube 缩略图与观看链接可直接由 videoId 推导，无需额外请求
        imageUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
        videoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : url,
        publishedAt: valid ? d : undefined,
        publishedTimePrecision: valid ? "datetime" : "unknown",
      } satisfies FetchedItem,
    ];
  });
}

export const YT_KEYWORDS = [
  "PV",
  "ティザー",
  "本PV",
  "特報",
  "予告",
  "CM",
  "ノンクレジットOP",
  "ノンクレジットED",
  "制作決定",
  "放送決定",
];

export function isRelevantYouTube(title: string): boolean {
  return YT_KEYWORDS.some((k) => title.includes(k));
}
