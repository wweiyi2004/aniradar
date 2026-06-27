function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env ${name}`);
  return v;
}

// 惰性求值：仅在真正访问某个配置时才校验，避免纯逻辑/测试导入链触发 DATABASE_URL 校验。
export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get redisUrl() {
    return required("REDIS_URL", "redis://localhost:6379");
  },
  get schedulerIntervalMs() {
    return Number(process.env.SCHEDULER_INTERVAL_MS ?? 30000);
  },
  get userAgent() {
    return process.env.CRAWLER_USER_AGENT ?? "AniRadarBot/0.1";
  },
  get crawlerTimeoutMs() {
    return Number(process.env.CRAWLER_TIMEOUT_MS ?? 15000);
  },
  get enrichMaxPerCycle() {
    return Number(process.env.ENRICH_MAX_PER_CYCLE ?? 12);
  },
};

export function getRedisConnection(): { host: string; port: number } {
  const u = new URL(env.redisUrl);
  return { host: u.hostname, port: Number(u.port || 6379) };
}

// 兼容旧导入名：保持惰性，仅在被使用时解析。
export const redisConnection = getRedisConnection();
