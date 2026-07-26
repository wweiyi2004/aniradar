import { Prisma, prisma } from "@aniradar/db";

/**
 * 把用户查询转为 FTS5 MATCH 表达式(词组 AND 连接)。
 * trigram tokenizer 要求词组 >= 3 个字符才能命中,任一词更短时返回 null,
 * 由调用方回退 LIKE 子串匹配。
 */
export function toFtsQuery(q: string): string | null {
  const terms = q
    .split(/\s+/)
    .map((t) => t.replace(/"/g, "").trim())
    .filter(Boolean);
  if (terms.length === 0) return null;
  if (terms.some((t) => [...t].length < 3)) return null;
  return terms.map((t) => `"${t}"`).join(" AND ");
}

export interface FtsSearchArgs {
  match: string;
  statuses: readonly string[];
  medium?: string;
  sort: "new" | "hot";
  limit: number;
  offset: number;
}

/** FTS5 检索:返回按排序分页后的事件 id 列表与总命中数。 */
export async function searchEventIdsByFts({
  match,
  statuses,
  medium,
  sort,
  limit,
  offset,
}: FtsSearchArgs): Promise<{ ids: string[]; total: number }> {
  const statusList = Prisma.join([...statuses]);
  const mediumSql = medium ? Prisma.sql`AND e.medium = ${medium}` : Prisma.empty;
  const orderSql =
    sort === "hot"
      ? Prisma.sql`ORDER BY e.heatScore DESC, e.publishedAt DESC`
      : Prisma.sql`ORDER BY e.publishedAt DESC NULLS LAST, e.firstSeenAt DESC`;

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT e.id
    FROM "Event" e
    WHERE e.rowid IN (SELECT rowid FROM "EventFts" WHERE "EventFts" MATCH ${match})
      AND e.status IN (${statusList})
      ${mediumSql}
    ${orderSql}
    LIMIT ${limit} OFFSET ${offset}
  `);
  const totalRows = await prisma.$queryRaw<Array<{ n: number | bigint }>>(Prisma.sql`
    SELECT count(*) AS n
    FROM "Event" e
    WHERE e.rowid IN (SELECT rowid FROM "EventFts" WHERE "EventFts" MATCH ${match})
      AND e.status IN (${statusList})
      ${mediumSql}
  `);
  return { ids: rows.map((r) => r.id), total: Number(totalRows[0]?.n ?? 0) };
}
