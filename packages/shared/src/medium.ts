import type { EventCategory } from "./index";
import type { Medium } from "./index";

// mock 无 AI key 时的兜底：仅能从情报类型推断媒介。
// manga/light_novel/game 无法由 category 判断（情报类型与媒介正交），故只在 AI 路径产出。
const GOODS = new Set<EventCategory>(["bd_release", "merch_release", "event_info"]);

export function mediumFromCategory(category: EventCategory): Medium {
  if (category === "movie_announced") return "film";
  if (GOODS.has(category)) return "goods_event";
  if (category === "other") return "other";
  return "anime";
}
