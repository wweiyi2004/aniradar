// 站点面向中文用户,"今日"统计统一按北京时间(UTC+8,无夏令时)计算,
// 避免部署到 UTC 服务器后口径漂移 8 小时。
const SITE_UTC_OFFSET_HOURS = 8;

/** 站点时区下"今天 00:00"对应的时刻。 */
export function startOfToday(now = new Date()): Date {
  const offsetMs = SITE_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + offsetMs);
  const dayStartUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  return new Date(dayStartUtc - offsetMs);
}
