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
}

// 判定两条情报是否同一事件：必须同分类；优先用作品名精确/高相似匹配，否则用整体标题相似度。
export function isSameEvent(
  a: EventLike,
  b: EventLike,
  opts: { titleThreshold?: number; workThreshold?: number } = {},
): boolean {
  const titleThreshold = opts.titleThreshold ?? 0.6;
  const workThreshold = opts.workThreshold ?? 0.85;
  if (a.category !== b.category) return false;
  const wa = extractWorkTitle(a.title);
  const wb = extractWorkTitle(b.title);
  if (wa && wb) {
    if (normalize(wa) === normalize(wb)) return true;
    return titleSimilarity(wa, wb) >= workThreshold;
  }
  return titleSimilarity(a.title, b.title) >= titleThreshold;
}
