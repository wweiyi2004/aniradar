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
  "キービジュアル",
  "キャスト",
  "スタッフ",
  "第2期",
  "第二期",
  "続編",
  "劇場版",
  "主題歌",
];

export function isRelevantYouTube(title: string): boolean {
  return YT_KEYWORDS.some((k) => {
    // 短拉丁词（PV/CM/OP/ED）避免命中单词内部
    if (/^[A-Z]{1,3}$/i.test(k)) {
      const re = new RegExp(`(?:^|[^A-Za-z0-9])${k}(?:[^A-Za-z0-9]|$)`, "i");
      return re.test(title);
    }
    return title.includes(k);
  });
}
