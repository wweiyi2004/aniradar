import type { EventCategory } from "@aniradar/shared";

// 提取日文标题里首个「」或『』中的作品名——同主题情报合并的强信号。
export function extractWorkTitle(title: string): string | null {
  const m = title.match(/[「『]([^」』]+)[」』]/);
  return m ? m[1].trim() : null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[、。！？!?.,…・〜~\-—「」『』（）()【】\[\]]/g, "");
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

// 字符二元组 Dice 系数，0..1。
export function titleSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na && !nb) return 1;
  if (na === nb) return 1;
  const ga = bigrams(na);
  const gb = bigrams(nb);
  if (ga.length === 0 || gb.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const g of ga) counts.set(g, (counts.get(g) ?? 0) + 1);
  let overlap = 0;
  for (const g of gb) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      overlap++;
      counts.set(g, c - 1);
    }
  }
  return (2 * overlap) / (ga.length + gb.length);
}

export interface EventLike {
  title: string;
  category: EventCategory | string;
  /** AI 抽取的结构化作品名（facts.work）——比标题括号提取可靠得多的合并强键 */
  work?: string | null;
}

// 分类兼容组：不同源对同一条新闻常给出组内不同的分类（如贺图+OP影像被分别判为
// key_visual 和 pv），在 facts.work 强键匹配时允许组内合并；"other" 是弱标签，与任何分类兼容。
const RELATED_CATEGORY_GROUPS: EventCategory[][] = [["pv_released", "key_visual_released"]];

// 这两类是"同一作品短期内多条独立情报"的常态（同一作品一周发两款周边、办两场活动），
// 同作品≠同事件，不适用 work 强键，只按标题相似度判重。
const WORK_KEY_EXCLUDED = new Set<string>(["merch_release", "event_info"]);

export function categoriesCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (a === "other" || b === "other") return true;
  return RELATED_CATEGORY_GROUPS.some(
    (g) => g.includes(a as EventCategory) && g.includes(b as EventCategory),
  );
}

// 供合并候选查询用：与 cat 兼容的具体分类列表；cat 为 other 时返回 null（不限制分类）。
export function compatibleCategories(cat: EventCategory): EventCategory[] | null {
  if (cat === "other") return null;
  const set = new Set<EventCategory>([cat, "other"]);
  for (const g of RELATED_CATEGORY_GROUPS) {
    if (g.includes(cat)) g.forEach((c) => set.add(c));
  }
  return [...set];
}

function sameWorkName(a: string, b: string, workThreshold: number): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // 子标题变体（"X" vs "X 第2期/柱稽古編"）：较短者是较长者前缀 → 同作品。
  if (na.length >= 3 && nb.length >= 3 && (na.startsWith(nb) || nb.startsWith(na))) return true;
  return titleSimilarity(a, b) >= workThreshold;
}

// 判定两条情报是否同一事件：
// 1) 双方都有结构化作品名（facts.work）时用强键：同作品 + 分类兼容 → 合并；
// 2) 否则回退标题逻辑：必须同分类，优先标题内作品名匹配，再整体标题相似度。
export function isSameEvent(
  a: EventLike,
  b: EventLike,
  opts: { titleThreshold?: number; workThreshold?: number } = {},
): boolean {
  const titleThreshold = opts.titleThreshold ?? 0.6;
  const workThreshold = opts.workThreshold ?? 0.85;
  const workKeyApplies =
    !WORK_KEY_EXCLUDED.has(String(a.category)) && !WORK_KEY_EXCLUDED.has(String(b.category));
  if (workKeyApplies && a.work && b.work && sameWorkName(a.work, b.work, workThreshold)) {
    if (categoriesCompatible(String(a.category), String(b.category))) return true;
  }
  if (a.category !== b.category) return false;
  const wa = extractWorkTitle(a.title);
  const wb = extractWorkTitle(b.title);
  if (wa && wb) {
    const na = normalize(wa);
    const nb = normalize(wb);
    if (na === nb) return true;
    // 子标题变体（「X」vs「X 第2期/柱稽古編」）：较短者是较长者前缀 → 同作品。
    if (na.length >= 3 && nb.length >= 3 && (na.startsWith(nb) || nb.startsWith(na))) return true;
    return titleSimilarity(wa, wb) >= workThreshold;
  }
  // 仅一侧带「」作品名：若另一侧整标题包含该作品名，视为同作品（应对一源加括号、一源不加）。
  const oneWork = wa ?? wb;
  if (oneWork) {
    const nw = normalize(oneWork);
    const other = wa ? b.title : a.title;
    if (nw.length >= 3 && normalize(other).includes(nw)) return true;
  }
  return titleSimilarity(a.title, b.title) >= titleThreshold;
}
