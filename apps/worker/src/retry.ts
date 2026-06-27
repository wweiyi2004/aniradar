export interface RetryCtx {
  attemptsMade: number;
  maxAttempts: number;
}

const TRANSIENT_NET_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"]);

// 瞬时错误：值得重试。Prisma 连接/初始化类（code P1*）或常见网络错误，或无 code 的未知错误。
// 永久错误：Prisma 数据/约束类（P2*）及其它已知 code，不重试。
export function isTransientError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === "string") {
    if (code.startsWith("P1")) return true;
    if (code.startsWith("P2")) return false;
    if (TRANSIENT_NET_CODES.has(code)) return true;
    return false;
  }
  return true;
}

export function shouldRetry(e: unknown, ctx: RetryCtx | undefined): boolean {
  if (!ctx) return false;
  return isTransientError(e) && ctx.attemptsMade + 1 < ctx.maxAttempts;
}
