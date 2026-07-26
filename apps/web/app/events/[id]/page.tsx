import { prisma, workKeyFromFacts } from "@aniradar/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flame, PlayCircle, Sparkles } from "lucide-react";
import { CategoryBadge } from "@/components/category-badge";
import { StatusBadge } from "@/components/status-badge";
import { FactTable } from "@/components/fact-table";
import { MediumBadge } from "@/components/medium-badge";
import { YouTubeEmbed } from "@/components/youtube-embed";
import { relTime } from "@/lib/format";
import { youtubeId } from "@/lib/youtube";
import { getPublicEventStatuses } from "@/lib/public-status";

export const dynamic = "force-dynamic";

// 注：缺失事件会调 notFound() 渲染站点风格的 not-found UI；但在 Next 14 app-router
// 动态路由下，notFound() 的 HTTP 状态仍为 200（已知限制，实测 force-dynamic 与 auto 均如此）。
// 用户体验正确，仅对爬虫的状态码语义有影响，影响轻微。

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publicStatus = [...getPublicEventStatuses()];
  const ev = await prisma.event.findFirst({
    where: { id, status: { in: publicStatus } },
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

const SECTION_HEAD = "text-xs font-bold uppercase tracking-[0.18em] text-primary";

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publicStatus = [...getPublicEventStatuses()];
  const ev = await prisma.event.findFirst({
    where: { id, status: { in: publicStatus } },
    include: {
      signals: { include: { source: true }, orderBy: { firstSeenAt: "asc" } },
    },
  });
  if (!ev) notFound();

  // 同作品其他情报：按 AI 抽取的结构化作品名（facts.work）精确匹配。
  const work = (() => {
    const w = (ev.facts as Record<string, unknown> | null)?.work;
    return typeof w === "string" && w.trim() ? w.trim() : null;
  })();
  const relatedWorkKey = workKeyFromFacts(ev.facts);
  const related = work
    ? await prisma.event.findMany({
        where: {
          id: { not: ev.id },
          status: { in: publicStatus },
          workKey: relatedWorkKey,
        },
        orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
        take: 6,
        select: {
          id: true,
          title: true,
          titleZh: true,
          category: true,
          publishedAt: true,
          firstSeenAt: true,
        },
      })
    : [];

  const ytId = youtubeId(ev.videoUrl);
  const isPublic = ev.status === "published" || ev.status === "auto_published";

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
      <article className="min-w-0 max-w-3xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回情报流
        </Link>

        <header className="anime-card relative space-y-4 overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={ev.category} />
            <MediumBadge medium={ev.medium} />
            {ev.officialConfirmed && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                官方确认
              </span>
            )}
            {!isPublic && <StatusBadge status={ev.status} />}
          </div>

          <h1 className="relative font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {ev.titleZh || ev.title}
          </h1>
          {ev.titleZh && ev.title !== ev.titleZh && (
            <p className="text-sm leading-6 text-muted-foreground">原标题：{ev.title}</p>
          )}

          <p className="font-mono text-[11px] text-muted-foreground">
            发布 {relTime(ev.publishedAt ?? ev.firstSeenAt)} · {ev.signals.length} 个来源 · 置信度{" "}
            {(ev.confidence * 100).toFixed(0)}% · 热度 {ev.heatScore}
          </p>
        </header>

        {ytId ? (
          <YouTubeEmbed id={ytId} title={ev.titleZh ?? ev.title} />
        ) : (
          ev.imageUrl && (
            <figure>
              <img
                src={ev.imageUrl}
                alt={ev.titleZh || ev.title}
                referrerPolicy="no-referrer"
                className="anime-card w-full rounded-3xl object-cover"
              />
            </figure>
          )
        )}

        <p className="border-l-4 border-accent pl-5 text-lg font-medium leading-8">
          {ev.summaryZh || "（暂无导语）"}
        </p>

        <section className="anime-card space-y-4 p-5 sm:p-6">
          <h2 className={SECTION_HEAD}>情报速览</h2>
          <FactTable medium={ev.medium} category={ev.category} facts={ev.facts} />
        </section>

        {ev.bodyZh && (
          <section className="space-y-4 px-1">
            <h2 className={SECTION_HEAD}>正文 · AI 整合译文</h2>
            <div className="space-y-4 text-[17px] leading-8">
              {ev.bodyZh.split(/\n+/).map((p, i) => (p.trim() ? <p key={i}>{p.trim()}</p> : null))}
            </div>
          </section>
        )}

        <section className="anime-card space-y-5 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className={SECTION_HEAD}>来源时间线（{ev.signals.length}）</h2>
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <ol className="relative ml-2 space-y-6 border-l border-primary/20">
            {ev.signals.map((s) => (
              <li key={s.id} className="relative ml-6">
                <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{s.source.name}</span>
                  {" · "}
                  <span className="font-mono">
                    {s.publishedAt
                      ? `发布 ${new Date(s.publishedAt).toLocaleString("zh-CN")} · `
                      : ""}
                    {relTime(s.firstSeenAt)}
                  </span>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block font-medium leading-6 text-primary hover:underline"
                >
                  {s.titleZh || s.title}
                </a>
                {s.titleZh && s.titleZh !== s.title && (
                  <div className="text-xs leading-5 text-muted-foreground">{s.title}</div>
                )}
                {(s.rawText || s.summary) && (
                  <p className="mt-2 line-clamp-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {s.rawText || s.summary}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>

        {related.length > 0 && (
          <section className="anime-card space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className={SECTION_HEAD}>同作品情报 · {work}</h2>
              {relatedWorkKey && (
                <Link
                  href={`/works/${encodeURIComponent(relatedWorkKey)}`}
                  className="shrink-0 text-xs font-semibold text-primary hover:underline"
                >
                  作品档案 →
                </Link>
              )}
            </div>
            <ul className="space-y-3">
              {related.map((r) => (
                <li key={r.id}>
                  <Link href={`/events/${r.id}`} className="group flex items-baseline gap-3">
                    <CategoryBadge category={r.category} />
                    <span className="min-w-0 flex-1 truncate font-medium group-hover:text-primary">
                      {r.titleZh || r.title}
                    </span>
                    <time className="shrink-0 font-mono text-xs text-muted-foreground">
                      {relTime(r.publishedAt ?? r.firstSeenAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="anime-card overflow-hidden">
          <div className="bg-gradient-to-br from-primary/12 via-card to-accent/10 p-5">
            <h2 className={`${SECTION_HEAD} mb-4`}>Signal status</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3 rounded-xl bg-background/60 px-3 py-2">
                <span className="text-muted-foreground">热度</span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Flame className="h-3 w-3 text-orange-500" />
                  {ev.heatScore}
                </span>
              </div>
              <div className="flex justify-between gap-3 rounded-xl bg-background/60 px-3 py-2">
                <span className="text-muted-foreground">置信度</span>
                <span className="font-mono">{(ev.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between gap-3 rounded-xl bg-background/60 px-3 py-2">
                <span className="text-muted-foreground">来源</span>
                <span className="font-mono">{ev.signals.length} 个</span>
              </div>
              <div className="border-t pt-2.5 font-mono text-xs leading-5 text-muted-foreground">
                {ev.publishedAt && (
                  <div>发布 {new Date(ev.publishedAt).toLocaleString("zh-CN")}</div>
                )}
                首次发现 {new Date(ev.firstSeenAt).toLocaleString("zh-CN")}
              </div>
              {ev.videoUrl && (
                <a
                  href={ev.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <PlayCircle className="h-4 w-4" />
                  打开视频
                </a>
              )}
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
