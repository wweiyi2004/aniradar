import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  acquireLease,
  claimJob,
  completeJob,
  configureDatabase,
  enqueueJob,
  jobKeys,
  prisma,
  recoverStaleJobs,
  releaseLease,
  retryOrFailJob,
} from "../src/index";

describe.sequential("SQLite job queue", () => {
  beforeEach(async () => {
    await configureDatabase();
    await prisma.job.deleteMany();
    await prisma.runtimeLease.deleteMany();
  });

  afterAll(async () => {
    await prisma.job.deleteMany();
    await prisma.runtimeLease.deleteMany();
    await prisma.$disconnect();
  });

  it("deduplicates active jobs and allows another job after completion", async () => {
    const first = await enqueueJob(prisma, {
      type: "fetch",
      dedupeKey: jobKeys.fetch("source-1"),
      payload: { sourceId: "source-1" },
    });
    const duplicate = await enqueueJob(prisma, {
      type: "fetch",
      dedupeKey: jobKeys.fetch("source-1"),
      payload: { sourceId: "source-1" },
    });
    expect(duplicate.id).toBe(first.id);

    const claimed = await claimJob("fetch", "worker-1");
    expect(claimed?.attempts).toBe(1);
    expect(await completeJob(claimed!.id, "worker-1")).toBe(true);

    const next = await enqueueJob(prisma, {
      type: "fetch",
      dedupeKey: jobKeys.fetch("source-1"),
      payload: { sourceId: "source-1" },
    });
    expect(next.id).not.toBe(first.id);
  });

  it("atomically lets only one runner claim a job", async () => {
    await enqueueJob(prisma, {
      type: "classify",
      dedupeKey: jobKeys.classify("signal-1"),
      payload: { signalId: "signal-1" },
    });
    const claims = await Promise.all([
      claimJob("classify", "worker-a"),
      claimJob("classify", "worker-b"),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("requeues transient failures and marks the final attempt failed", async () => {
    await enqueueJob(prisma, {
      type: "reanalyze",
      dedupeKey: jobKeys.reanalyze("signal-1", 1),
      payload: { signalId: "signal-1" },
    });
    const first = await claimJob("reanalyze", "worker-1");
    expect(await retryOrFailJob(first!, "worker-1", new Error("temporary"))).toBe("pending");
    await prisma.job.update({ where: { id: first!.id }, data: { runAt: new Date(0) } });
    const second = await claimJob("reanalyze", "worker-1");
    expect(await retryOrFailJob(second!, "worker-1", new Error("final"))).toBe("failed");
    expect((await prisma.job.findUnique({ where: { id: second!.id } }))?.lastError).toBe("final");
  });

  it("recovers stale locks without exceeding max attempts", async () => {
    await enqueueJob(prisma, {
      type: "compose",
      dedupeKey: jobKeys.compose("event-1", "signal-1"),
      payload: { eventId: "event-1" },
      maxAttempts: 2,
    });
    const job = await claimJob("compose", "dead-worker");
    await prisma.job.update({ where: { id: job!.id }, data: { lockedAt: new Date(0) } });
    expect(await recoverStaleJobs(1000, new Date(5000))).toBe(1);
    expect((await prisma.job.findUnique({ where: { id: job!.id } }))?.status).toBe("pending");
  });

  it("enforces a singleton worker lease", async () => {
    expect(await acquireLease("worker", "owner-a", 30_000, new Date(0))).toBe(true);
    expect(await acquireLease("worker", "owner-b", 30_000, new Date(1000))).toBe(false);
    await releaseLease("worker", "owner-a");
    expect(await acquireLease("worker", "owner-b", 30_000, new Date(1000))).toBe(true);
  });

  it("only one concurrent acquireLease wins when lease is free", async () => {
    const results = await Promise.all([
      acquireLease("worker", "owner-a", 30_000, new Date(0)),
      acquireLease("worker", "owner-b", 30_000, new Date(0)),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("allows reclaiming an expired lease", async () => {
    expect(await acquireLease("worker", "owner-a", 1000, new Date(0))).toBe(true);
    expect(await acquireLease("worker", "owner-b", 1000, new Date(2000))).toBe(true);
  });
});
