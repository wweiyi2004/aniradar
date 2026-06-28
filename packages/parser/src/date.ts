// 宽松日期解析：处理日文「YYYY年M月D日（曜）HH:MM」、YYYY.M.D / YYYY/M/D / YYYY-MM-DD，
// 以及可被 new Date 直接解析的格式。无法解析返回 undefined。
export function parseLooseDate(text: string | null | undefined): Date | undefined {
  const t = (text ?? "").trim();
  if (!t) return undefined;

  // 日文：2026年6月28日（可带 22:00）
  const jp = t.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:[^\d]*?(\d{1,2})[:：](\d{2}))?/);
  if (jp) {
    const dt = new Date(
      Number(jp[1]),
      Number(jp[2]) - 1,
      Number(jp[3]),
      jp[4] ? Number(jp[4]) : 0,
      jp[5] ? Number(jp[5]) : 0,
    );
    if (!isNaN(dt.getTime())) return dt;
  }

  // 通用数字日期：2026.6.28 / 2026/6/28 / 2026-06-28
  const ymd = t.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ymd) {
    const dt = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    if (!isNaN(dt.getTime())) return dt;
  }

  const fallback = new Date(t);
  return isNaN(fallback.getTime()) ? undefined : fallback;
}
