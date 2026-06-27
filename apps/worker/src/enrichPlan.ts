import type { FetchedItem } from "@aniradar/shared";

export interface FreshEntry {
  item: FetchedItem;
  hash: string;
}

// 按 publishedAt 倒序（无日期排末尾）稳定排序后，切出需增强的前 max 条与其余。
export function pickToEnrich(
  fresh: FreshEntry[],
  max: number,
): { toEnrich: FreshEntry[]; rest: FreshEntry[] } {
  const sorted = [...fresh].sort((a, b) => {
    const ta = a.item.publishedAt ? a.item.publishedAt.getTime() : -Infinity;
    const tb = b.item.publishedAt ? b.item.publishedAt.getTime() : -Infinity;
    return tb - ta;
  });
  const cap = Math.max(0, max);
  return { toEnrich: sorted.slice(0, cap), rest: sorted.slice(cap) };
}
