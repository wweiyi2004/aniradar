export type FactRow =
  | { label: string; value: string }
  | { label: string; list: { sub: string; value: string }[] };

// [key, label] 有序数组
const MEDIUM_BASE: Record<string, [string, string][]> = {
  anime: [["work", "作品"], ["original", "原作"], ["studio", "制作"], ["director", "监督"]],
  manga: [["work", "作品"], ["author", "作者"], ["magazine", "连载"], ["publisher", "出版社"]],
  light_novel: [["work", "作品"], ["author", "作者"], ["illustrator", "插画"], ["label", "文库"]],
  game: [["work", "作品"], ["platform", "平台"], ["developer", "开发/发行"], ["genre", "类型"]],
  film: [["work", "作品"], ["releaseDate", "上映日"], ["distributor", "发行/院线"], ["director", "监督"]],
  goods_event: [["work", "作品"], ["itemName", "名称"], ["date", "日期"], ["place", "地点"]],
  other: [["work", "作品"], ["note", "说明"]],
};

const CATEGORY_FIELDS: Record<string, [string, string][]> = {
  anime_adaptation: [["studio", "制作"], ["expectedAir", "开播预定"]],
  sequel_announced: [["season", "季数/续作"]],
  pv_released: [["pvType", "PV类型"], ["duration", "时长"], ["pvUrl", "链接"]],
  key_visual_released: [["kvDate", "公开日"]],
  cast_announced: [["cast", "声优"]],
  staff_announced: [["staff", "STAFF"]],
  broadcast_date_announced: [["airDate", "开播日"], ["broadcaster", "放送平台"], ["streaming", "配信"]],
  delay_announced: [["originalDate", "原定"], ["newDate", "延期至"], ["reason", "原因"]],
  movie_announced: [["releaseDate", "上映日"], ["theaters", "院线"]],
  theme_song_announced: [["songType", "OP/ED"], ["songTitle", "曲名"], ["artist", "艺人"]],
  event_info: [["eventName", "活动"], ["eventDate", "日期"], ["venue", "地点"]],
  merch_release: [["itemName", "商品"], ["releaseDate", "发售日"], ["price", "价格"], ["spec", "规格"]],
  bd_release: [["volume", "卷/话"], ["releaseDate", "发售日"], ["price", "价格"], ["spec", "规格"]],
  other: [],
};

const LIST_KEYS = new Set(["cast", "staff"]);

export function buildFactRows(medium: string | null, category: string, facts: unknown): FactRow[] {
  const obj = (facts && typeof facts === "object" && !Array.isArray(facts))
    ? (facts as Record<string, unknown>)
    : {};
  const pairs = [...(MEDIUM_BASE[medium ?? "other"] ?? []), ...(CATEGORY_FIELDS[category] ?? [])];
  const seen = new Set<string>();
  const rows: FactRow[] = [];
  for (const [key, label] of pairs) {
    if (seen.has(key)) continue;
    seen.add(key);
    const v = obj[key];
    if (LIST_KEYS.has(key)) {
      if (Array.isArray(v) && v.length) {
        const list = v
          .map((e) => {
            const o = (e && typeof e === "object") ? (e as Record<string, unknown>) : {};
            return { sub: String(o.role ?? "").trim(), value: String(o.name ?? "").trim() };
          })
          .filter((x) => x.value);
        if (list.length) rows.push({ label, list });
      }
      continue;
    }
    if (v != null && String(v).trim() !== "") rows.push({ label, value: String(v) });
  }
  return rows;
}
