import { prisma } from "@aniradar/db";
import { notFound } from "next/navigation";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/category-badge";
import { StatusBadge } from "@/components/status-badge";
import { relTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventDetail({ params }: { params: { id: string } }) {
  const ev = await prisma.event.findUnique({
    where: { id: params.id },
    include: { signals: { include: { source: true }, orderBy: { firstSeenAt: "asc" } } },
  });
  if (!ev) notFound();

  const multiSource = ev.signals.length > 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={ev.category} />
        <StatusBadge status={ev.status} />
        {multiSource && (
          <Badge className="gap-1 border-orange-500 text-orange-500">
            <Flame className="h-3 w-3" />
            {ev.signals.length} 源聚合
          </Badge>
        )}
        <span className="text-xs text-[hsl(var(--primary))]">{relTime(ev.firstSeenAt)}</span>
        {ev.officialConfirmed && <span className="text-xs text-emerald-500">官方确认</span>}
      </div>

      <h1 className="text-2xl font-bold">{ev.titleZh || ev.title}</h1>
      {ev.titleZh && ev.title !== ev.titleZh && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">原标题：{ev.title}</p>
      )}

      <section className="rounded-lg border bg-[hsl(var(--card))] p-4">
        <h2 className="mb-1 text-sm font-semibold text-[hsl(var(--muted-foreground))]">AI 摘要</h2>
        <p>{ev.summaryZh || "（暂无摘要）"}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[hsl(var(--muted-foreground))]">
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3 w-3 text-orange-500" />
            热度 {ev.heatScore}
          </span>
          <span>置信度 {(ev.confidence * 100).toFixed(0)}%</span>
          <span>{ev.signals.length} 个来源</span>
          <span>首次发现 {new Date(ev.firstSeenAt).toLocaleString("zh-CN")}</span>
        </div>
      </section>

      <h2 className="pt-2 font-semibold">来源时间线（{ev.signals.length}）</h2>
      <ol className="relative ml-2 space-y-5 border-l border-[hsl(var(--border))]">
        {ev.signals.map((s) => (
          <li key={s.id} className="relative ml-5">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--primary))]" />
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              <span className="font-medium text-[hsl(var(--foreground))]">{s.source.name}</span>
              {" · "}
              {s.publishedAt ? `发布 ${new Date(s.publishedAt).toLocaleString("zh-CN")} · ` : ""}
              {relTime(s.firstSeenAt)}
            </div>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[hsl(var(--primary))] hover:underline"
            >
              {s.titleZh || s.title}
            </a>
            {s.titleZh && s.titleZh !== s.title && (
              <div className="text-xs text-[hsl(var(--muted-foreground))]">{s.title}</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
