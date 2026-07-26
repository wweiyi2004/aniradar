function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env ${name}`);
  return v;
}

function numberEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: expected integer ${min}..${max}`);
  }
  return value;
}

// 惰性求值：仅在真正访问某个配置时才校验，避免纯逻辑/测试导入链触发 DATABASE_URL 校验。
export const env = {
  get databaseUrl() {
    return required("DATABASE_URL", "file:../../../data/aniradar.db");
  },
  get schedulerIntervalMs() {
    return numberEnv("SCHEDULER_INTERVAL_MS", 30000, 1000, 86_400_000);
  },
  get userAgent() {
    return process.env.CRAWLER_USER_AGENT ?? "AniRadarBot/0.1";
  },
  get crawlerTimeoutMs() {
    return numberEnv("CRAWLER_TIMEOUT_MS", 15000, 1000, 300_000);
  },
  get crawlerMaxResponseBytes() {
    return numberEnv("CRAWLER_MAX_RESPONSE_BYTES", 5 * 1024 * 1024, 1024, 50 * 1024 * 1024);
  },
  get enrichMaxPerCycle() {
    return numberEnv("ENRICH_MAX_PER_CYCLE", 12, 0, 1000);
  },
  get reanalyzeIntervalMs() {
    return numberEnv("REANALYZE_INTERVAL_MS", 600000, 1000, 86_400_000);
  },
  get reanalyzeWindowHours() {
    return numberEnv("REANALYZE_WINDOW_HOURS", 168, 1, 24 * 365);
  },
  get reanalyzeBatch() {
    return numberEnv("REANALYZE_BATCH", 20, 1, 1000);
  },
  get jobPollIntervalMs() {
    return numberEnv("JOB_POLL_INTERVAL_MS", 500, 50, 60_000);
  },
  get jobLockTimeoutMs() {
    return numberEnv("JOB_LOCK_TIMEOUT_MS", 300_000, 10_000, 3_600_000);
  },
  get workerLeaseTtlMs() {
    return numberEnv("WORKER_LEASE_TTL_MS", 30_000, 5000, 300_000);
  },
  get fetchLogRetentionDays() {
    return numberEnv("FETCH_LOG_RETENTION_DAYS", 30, 1, 3650);
  },
  get backupKeep() {
    return numberEnv("BACKUP_KEEP", 7, 0, 365);
  },
};
