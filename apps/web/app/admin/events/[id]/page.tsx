import { prisma } from "@aniradar/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CategoryBadge } from "@/components/category-badge";
import { StatusBadge } from "@/components/status-badge";
import { FactTable } from "@/components/fact-table";
import { MediumBadge } from "@/components/medium-badge";
import { AdminNav } from "@/components/admin-nav";
import { relTime } from "@/lib/format";
import { EventActions } from "../event-actions";

export const dynamic = "force-dynamic";

export default async function AdminEventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ev = await prisma.event.findUnique({
    where: { id },
    include: { signals: { include: { source: true }, orderBy: { firstSeenAt: "asc" } } },
  });
  if (!ev) notFound();

  const isPublic = ev.status === "published" || ev.status === "auto_published";

  return (
    <div className="space-y-6">
      <AdminNav active="/admin/events" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link href="/admin" className="text-xs text-muted-foreground hover:underline">
            ← 待审
          </Link>
          <h1 className="text-xl font-bold">{ev.titleZh || ev.title}</h1>
          {ev.titleZh && ev.title !== ev.titleZh && (
            <p className="text-sm text-muted-foreground">原标题：{ev.title}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPublic && (
            <Link href={`/events/${ev.id}`} className="text-sm text-primary hover:underline">
              公开页
            </Link>
          )}
          <EventActions id={ev.id} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <CategoryBadge category={ev.category} />
        <MediumBadge medium={ev.medium} />
        <StatusBadge status={ev.status} />
        <span className="font-mono text-xs text-muted-foreground">
          置信 {(ev.confidence * 100).toFixed(0)}% · 热度 {ev.heatScore} · {relTime(ev.publishedAt ?? ev.firstSeenAt)}
        </span>
      </div>

      <p className="text-base leading-7">{ev.summaryZh || "（暂无导语）"}</p>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Facts</h2>
        <FactTable medium={ev.medium} category={ev.category} facts={ev.facts} />
      </section>

      {ev.bodyZh && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Body</h2>
          <div className="space-y-3 text-sm leading-7">
            {ev.bodyZh.split(/\n+/).map((p, i) => (p.trim() ? <p key={i}>{p.trim()}</p> : null))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Signals（{ev.signals.length}）
        </h2>
        <ul className="space-y-3">
          {ev.signals.map((s) => (
            <li key={s.id} className="rounded-md border p-3 text-sm">
              <div className="text-xs text-muted-foreground">
                {s.source.name} · {s.status} · {relTime(s.firstSeenAt)}
              </div>
              <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                {s.titleZh || s.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
