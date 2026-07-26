import Link from "next/link";
import { WORKER_LEASE_NAME, prisma } from "@aniradar/db";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { AdminNav } from "@/components/admin-nav";
import { StatusBadge } from "@/components/status-badge";
import { relTime } from "@/lib/format";
import { startOfToday } from "@/lib/today";
import { EventActions } from "./events/event-actions";

export const dynamic = "force-dynamic";

const REVIEW_STATUSES = ["needs_review", "draft_ai"] as const;

export default async function AdminHomePage() {
  const todayStart = startOfToday();

  const [queue, reviewCount, todayPublic, failingSources, pendingJobs, failedJobs, workerLease] =
    await Promise.all([
      prisma.event.findMany({
        where: { status: { in: [...REVIEW_STATUSES] } },
        orderBy: { firstSeenAt: "desc" },
        take: 50,
        include: { _count: { select: { signals: true } } },
      }),
      prisma.event.count({ where: { status: { in: [...REVIEW_STATUSES] } } }),
      prisma.event.count({
        where: {
          status: { in: ["published", "auto_published"] },
          publishedAt: { gte: todayStart },
        },
      }),
      prisma.source.count({ where: { enabled: true, failureCount: { gt: 0 } } }),
      prisma.job.count({ where: { status: "pending" } }),
      prisma.job.count({ where: { status: "failed" } }),
      prisma.runtimeLease.findUnique({ where: { name: WORKER_LEASE_NAME } }),
    ]);

  // 租约未过期 = worker 在线;掉线或从未启动都要醒目提示。
  const workerOnline = !!workerLease && workerLease.expiresAt.getTime() > Date.now();

  return (
    <div className="space-y-6">
      <AdminNav active="/admin" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">待审工作台</h1>
          <p className="text-sm text-muted-foreground">
            优先处理 needs_review / draft_ai，一键发布或忽略。
          </p>
        </div>
        <Link href="/admin/events?status=all" className="text-sm text-primary hover:underline">
          全部事件 →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Worker"
          value={
            workerOnline ? (
              <span className="text-emerald-600 dark:text-emerald-400">在线</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">离线</span>
            )
          }
          hint={workerLease ? `心跳 ${relTime(workerLease.updatedAt)}` : "从未启动"}
        />
        <StatCard label="待审" value={reviewCount} />
        <StatCard label="今日公开" value={todayPublic} />
        <StatCard label="失败源" value={failingSources} />
        <StatCard label="排队任务" value={pendingJobs} />
        <StatCard
          label="失败任务"
          value={
            failedJobs > 0 ? (
              <span className="text-red-600 dark:text-red-400">{failedJobs}</span>
            ) : (
              failedJobs
            )
          }
        />
      </div>

      {queue.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          暂无待审事件。抓取与 AI 分类后会出现在这里。
        </p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>标题</TH>
              <TH>状态</TH>
              <TH>置信度</TH>
              <TH>发现</TH>
              <TH>源</TH>
              <TH>操作</TH>
            </TR>
          </THead>
          <TBody>
            {queue.map((e) => (
              <TR key={e.id}>
                <TD className="max-w-md">
                  <Link href={`/admin/events/${e.id}`} className="font-medium hover:underline">
                    {e.titleZh || e.title}
                  </Link>
                  {e.summaryZh && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {e.summaryZh}
                    </p>
                  )}
                </TD>
                <TD>
                  <StatusBadge status={e.status} />
                </TD>
                <TD className="font-mono text-xs">{(e.confidence * 100).toFixed(0)}%</TD>
                <TD className="font-mono text-xs text-muted-foreground">
                  {relTime(e.firstSeenAt)}
                </TD>
                <TD>{e._count.signals}</TD>
                <TD>
                  <EventActions id={e.id} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
