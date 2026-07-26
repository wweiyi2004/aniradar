/**
 * 搜索输入清洗:Prisma SQLite 的 contains 走 LIKE 且不带 ESCAPE 子句,
 * % 与 _ 无法字面转义(搜「100%」会意外全匹配),先中和为空格。
 * FTS5 落地后此处继续承担 MATCH 语法字符的清洗职责。
 */
export function sanitizeSearchQuery(raw: string): string {
  return raw.replace(/[%_]/g, " ").replace(/\s+/g, " ").trim();
}
