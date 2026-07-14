// 宽松日期解析：处理日文「YYYY年M月D日（曜）HH:MM」、YYYY.M.D / YYYY/M/D / YYYY-MM-DD。
// 无时区信息时按日本时间（Asia/Tokyo, +09:00）解释；无法解析或非法日历日返回 undefined。

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

/** 构造 JST 绝对时间；非法日期（如 2/31）返回 undefined。 */
function makeJst(y: number, month: number, day: number, hour = 0, minute = 0): Date | undefined {
  if (
    !Number.isInteger(y) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return undefined;
  }
  const iso = `${y}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return undefined;

  // 拒绝 Date 对非法日的滚动（2026-02-31 → 3 月）
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(dt)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;

  if (
    parts.year !== y ||
    parts.month !== month ||
    parts.day !== day ||
    parts.hour !== hour ||
    parts.minute !== minute
  ) {
    return undefined;
  }
  return dt;
}

export function parseLooseDate(text: string | null | undefined): Date | undefined {
  const t = (text ?? "").trim();
  if (!t) return undefined;

  // 日文：2026年6月28日（可带 22:00）
  const jp = t.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:[^\d]*?(\d{1,2})[:：](\d{2}))?/);
  if (jp) {
    const dt = makeJst(
      Number(jp[1]),
      Number(jp[2]),
      Number(jp[3]),
      jp[4] ? Number(jp[4]) : 0,
      jp[5] ? Number(jp[5]) : 0,
    );
    if (dt) return dt;
  }

  // 通用数字日期：2026.6.28 / 2026/6/28 / 2026-06-28（按 JST 00:00）
  // 一旦匹配到 Y-M-D 形态就不再 fallback，避免 new Date 把 2/31 滚动成 3 月
  const ymd = t.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymd) {
    return makeJst(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }
  // 文中嵌套的日期（非整串）也尝试 JST
  const ymdEmbedded = t.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ymdEmbedded) {
    const dt = makeJst(Number(ymdEmbedded[1]), Number(ymdEmbedded[2]), Number(ymdEmbedded[3]));
    if (dt) return dt;
  }

  // 带显式时区的 ISO / RFC 等交给原生解析（须含时区或时间，避免裸 Y-M-D 滚动）
  if (/[TtZz]|[+-]\d{2}:?\d{2}|GMT|UTC/.test(t) || /\d{1,2}:\d{2}/.test(t)) {
    const fallback = new Date(t);
    return isNaN(fallback.getTime()) ? undefined : fallback;
  }
  return undefined;
}
