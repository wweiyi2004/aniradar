// 合并事实：以既有为准，仅补既有缺失/空的键（不覆盖已有非空值）。
export function mergeFacts(existing: unknown, incoming: Record<string, unknown>): Record<string, unknown> {
  const base = (existing && typeof existing === "object" && !Array.isArray(existing))
    ? { ...(existing as Record<string, unknown>) }
    : {};
  for (const [k, v] of Object.entries(incoming ?? {})) {
    const cur = base[k];
    const empty = cur == null || (typeof cur === "string" && cur.trim() === "") ||
      (Array.isArray(cur) && cur.length === 0);
    if (empty && v != null) base[k] = v;
  }
  return base;
}
