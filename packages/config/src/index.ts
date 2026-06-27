function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env ${name}`);
  return v;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  schedulerIntervalMs: Number(process.env.SCHEDULER_INTERVAL_MS ?? 30000),
  userAgent: process.env.CRAWLER_USER_AGENT ?? "AniRadarBot/0.1",
  crawlerTimeoutMs: Number(process.env.CRAWLER_TIMEOUT_MS ?? 15000),
};

export const redisConnection = (() => {
  const u = new URL(env.redisUrl);
  return { host: u.hostname, port: Number(u.port || 6379) };
})();
