import { prisma } from "@aniradar/db";
import { notFound } from "next/navigation";
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={ev.category} />
        <StatusBadge status={ev.status} />
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
        <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          置信度 {(ev.confidence * 100).toFixed(0)}% · 热度 {ev.heatScore}
        </div>
      </section>

      <h2 className="pt-2 font-semibold">关联情报源（{ev.signals.length}）</h2>
      <ul className="space-y-2">
        {ev.signals.map((s) => (
          <li key={s.id} className="rounded-md border p-3 text-sm">
            <div className="font-medium">{s.source.name}</div>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="text-[hsl(var(--primary))] hover:underline"
            >
              {s.title}
            </a>
            <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {s.publishedAt ? `发布 ${new Date(s.publishedAt).toLocaleString("zh-CN")} · ` : ""}
              {relTime(s.firstSeenAt)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
