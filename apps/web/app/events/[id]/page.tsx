import { prisma } from "@aniradar/db";
import { notFound } from "next/navigation";
import { Flame, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/category-badge";
import { StatusBadge } from "@/components/status-badge";
import { FactTable } from "@/components/fact-table";
import { MediumBadge } from "@/components/medium-badge";
import { YouTubeEmbed } from "@/components/youtube-embed";
import { relTime } from "@/lib/format";
import { youtubeId } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const ev = await prisma.event.findUnique({
    where: { id: params.id },
    select: { title: true, titleZh: true, summaryZh: true, imageUrl: true },
  });
  if (!ev) notFound();
  const title = `${ev.titleZh || ev.title} · AniRadar`;
  const description = (ev.summaryZh || ev.titleZh || ev.title).slice(0, 120);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: ev.imageUrl ? [{ url: ev.imageUrl }] : undefined,
    },
    twitter: {
      card: ev.imageUrl ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function EventDetail({ params }: { params: { id: string } }) {
  const ev = await prisma.event.findUnique({
    where: { id: params.id },
    include: { signals: { include: { source: true }, orderBy: { firstSeenAt: "asc" } } },
  });
  if (!ev) notFound();

  const multiSource = ev.signals.length > 1;
  const ytId = youtubeId(ev.videoUrl);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="min-w-0 space-y-5">
        {ytId && <YouTubeEmbed id={ytId} title={ev.titleZh ?? ev.title} />}
        <div className="space-y-3 border-b pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <MediumBadge medium={ev.medium} />
            <CategoryBadge category={ev.category} />
            <StatusBadge status={ev.status} />
            {multiSource && (
              <Badge className="gap-1 border-orange-500 text-orange-500">
                <Flame className="h-3 w-3" />
                {ev.signals.length} 源聚合
              </Badge>
            )}
            <span className="text-xs text-[hsl(var(--primary))]">{relTime(ev.publishedAt ?? ev.firstSeenAt)}</span>
            {ev.officialConfirmed && <span className="text-xs text-emerald-500">官方确认</span>}
          </div>

          <h1 className="text-2xl font-bold leading-9 tracking-normal sm:text-3xl sm:leading-10">
            {ev.titleZh || ev.title}
          </h1>
          {ev.titleZh && ev.title !== ev.titleZh && (
            <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">原标题：{ev.title}</p>
          )}
        </div>

        <section className="space-y-4 rounded-md border bg-[hsl(var(--card))] p-4">
          <p className="leading-7">{ev.summaryZh || "（暂无导语）"}</p>
          <FactTable medium={ev.medium} category={ev.category} facts={ev.facts} />
        </section>

        {ev.bodyZh && (
          <section className="space-y-2 rounded-md border bg-[hsl(var(--card))] p-4">
            <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">正文 · AI 整合译文</h2>
            <div className="space-y-2 leading-7">
              {ev.bodyZh
                .split(/\n+/)
                .map((p, i) => (p.trim() ? <p key={i}>{p.trim()}</p> : null))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-semibold">来源时间线（{ev.signals.length}）</h2>
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
                  className="mt-1 block font-medium leading-6 text-[hsl(var(--primary))] hover:underline"
                >
                  {s.titleZh || s.title}
                </a>
                {s.titleZh && s.titleZh !== s.title && (
                  <div className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">{s.title}</div>
                )}
                {(s.rawText || s.summary) && (
                  <p className="mt-2 line-clamp-4 max-w-3xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                    {s.rawText || s.summary}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      </article>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {ev.imageUrl && !ytId && (
          <div className="overflow-hidden rounded-md border bg-[hsl(var(--muted))]">
            <img src={ev.imageUrl} alt={ev.titleZh || ev.title} className="aspect-[16/10] h-auto w-full object-cover" />
          </div>
        )}
        <section className="rounded-md border bg-[hsl(var(--card))] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--muted-foreground))]">情报状态</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-[hsl(var(--muted-foreground))]">热度</span>
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-500" />
                {ev.heatScore}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[hsl(var(--muted-foreground))]">置信度</span>
              <span>{(ev.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[hsl(var(--muted-foreground))]">来源</span>
              <span>{ev.signals.length} 个</span>
            </div>
            <div className="border-t pt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              {ev.publishedAt && <div>发布 {new Date(ev.publishedAt).toLocaleString("zh-CN")}</div>}
              首次发现 {new Date(ev.firstSeenAt).toLocaleString("zh-CN")}
            </div>
            {ev.videoUrl && (
              <a
                href={ev.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[hsl(var(--primary))] hover:underline"
              >
                <PlayCircle className="h-4 w-4" />
                打开视频
              </a>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
