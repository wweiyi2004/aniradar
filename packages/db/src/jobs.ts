import type { Job, JobType, Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface EnqueueJobSpec {
  type: JobType;
  dedupeKey: string;
  payload: Prisma.InputJsonObject;
  runAt?: Date;
  maxAttempts?: number;
}

/** Worker 单实例运行租约名;后台用它读取 worker 心跳状态。 */
export const WORKER_LEASE_NAME = "aniradar-worker";

const POLICY: Record<JobType, { maxAttempts: number; backoffMs: number }> = {
  fetch: { maxAttempts: 3, backoffMs: 5000 },
  classify: { maxAttempts: 3, backoffMs: 2000 },
  reanalyze: { maxAttempts: 2, backoffMs: 5000 },
  compose: { maxAttempts: 2, backoffMs: 5000 },
};

export const jobKeys = {
  fetch: (sourceId: string) => `fetch-${sourceId}`,
  classify: (signalId: string) => `classify-${signalId}`,
  reanalyze: (signalId: string, bucket: number) => `reanalyze-${signalId}-${bucket}`,
  compose: (eventId: string, signalId: string) => `compose-${eventId}-${signalId}`,
};

export async function enqueueJob(client: DbClient, spec: EnqueueJobSpec): Promise<Job> {
  const existing = await client.job.findUnique({ where: { dedupeKey: spec.dedupeKey } });
  if (existing) {
    if (existing.status === "failed") {
      return client.job.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          runAt: spec.runAt ?? new Date(),
          attempts: 0,
          maxAttempts: spec.maxAttempts ?? POLICY[spec.type].maxAttempts,
          payload: spec.payload,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
      });
    }
    return existing;
  }

  try {
    return await client.job.create({
      data: {
        type: spec.type,
        dedupeKey: spec.dedupeKey,
        payload: spec.payload,
        runAt: spec.runAt ?? new Date(),
        maxAttempts: spec.maxAttempts ?? POLICY[spec.type].maxAttempts,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const raced = await client.job.findUnique({ where: { dedupeKey: spec.dedupeKey } });
    if (!raced) throw error;
    return raced;
  }
}

export async function claimJob(type: JobType, workerId: string, now = new Date()): Promise<Job | null> {
  const { prisma } = await import("./index");
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.job.findFirst({
      where: { type, status: "pending", runAt: { lte: now } },
      orderBy: [{ runAt: "asc" }, { createdAt: "asc" }],
    });
    if (!candidate) return null;
    const claimed = await tx.job.updateMany({
      where: { id: candidate.id, status: "pending", runAt: { lte: now } },
      data: { status: "running", lockedAt: now, lockedBy: workerId, attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) return null;
    return tx.job.findUnique({ where: { id: candidate.id } });
  });
}

export async function completeJob(jobId: string, workerId: string): Promise<boolean> {
  const { prisma } = await import("./index");
  const deleted = await prisma.job.deleteMany({ where: { id: jobId, status: "running", lockedBy: workerId } });
  return deleted.count === 1;
}

export async function heartbeatJob(jobId: string, workerId: string, now = new Date()): Promise<boolean> {
  const { prisma } = await import("./index");
  const result = await prisma.job.updateMany({
    where: { id: jobId, status: "running", lockedBy: workerId },
    data: { lockedAt: now },
  });
  return result.count === 1;
}

export async function retryOrFailJob(
  job: Job,
  workerId: string,
  error: unknown,
): Promise<"pending" | "failed" | "lost"> {
  const { prisma } = await import("./index");
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
  if (job.attempts < job.maxAttempts) {
    const delay = POLICY[job.type].backoffMs * 2 ** Math.max(0, job.attempts - 1);
    const result = await prisma.job.updateMany({
      where: { id: job.id, status: "running", lockedBy: workerId },
      data: {
        status: "pending",
        runAt: new Date(Date.now() + delay),
        lockedAt: null,
        lockedBy: null,
        lastError: message,
      },
    });
    return result.count === 1 ? "pending" : "lost";
  }
  const result = await prisma.job.updateMany({
    where: { id: job.id, status: "running", lockedBy: workerId },
    data: { status: "failed", lockedAt: null, lockedBy: null, lastError: message },
  });
  return result.count === 1 ? "failed" : "lost";
}

export async function recoverStaleJobs(lockTimeoutMs: number, now = new Date()): Promise<number> {
  const { prisma } = await import("./index");
  const stale = await prisma.job.findMany({
    where: { status: "running", lockedAt: { lt: new Date(now.getTime() - lockTimeoutMs) } },
  });
  let recovered = 0;
  for (const job of stale) {
    const finalAttempt = job.attempts >= job.maxAttempts;
    const result = await prisma.job.updateMany({
      where: { id: job.id, status: "running", lockedAt: job.lockedAt },
      data: finalAttempt
        ? { status: "failed", lockedAt: null, lockedBy: null, lastError: "worker lease expired after final attempt" }
        : { status: "pending", runAt: now, lockedAt: null, lockedBy: null, lastError: "recovered stale worker lock" },
    });
    recovered += result.count;
  }
  return recovered;
}

export async function acquireLease(name: string, ownerId: string, ttlMs: number, now = new Date()): Promise<boolean> {
  const { prisma } = await import("./index");
  const expiresAt = new Date(now.getTime() + ttlMs);
  return prisma.$transaction(async (tx) => {
    // 先尝试创建；并发下唯一键冲突再 CAS 抢过期租约
    try {
      await tx.runtimeLease.create({ data: { name, ownerId, expiresAt } });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
    // 本人续约，或抢过期租约（expiresAt <= now）
    const claimed = await tx.runtimeLease.updateMany({
      where: {
        name,
        OR: [{ ownerId }, { expiresAt: { lte: now } }],
      },
      data: { ownerId, expiresAt },
    });
    return claimed.count === 1;
  });
}

export async function renewLease(name: string, ownerId: string, ttlMs: number): Promise<boolean> {
  const { prisma } = await import("./index");
  const result = await prisma.runtimeLease.updateMany({
    where: { name, ownerId },
    data: { expiresAt: new Date(Date.now() + ttlMs) },
  });
  return result.count === 1;
}

export async function releaseLease(name: string, ownerId: string): Promise<void> {
  const { prisma } = await import("./index");
  await prisma.runtimeLease.deleteMany({ where: { name, ownerId } });
}
