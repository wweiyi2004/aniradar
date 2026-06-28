import { prisma } from "@aniradar/db";
import { EventCard } from "@/components/event-card";
import { BoardTabs } from "@/components/board-tabs";
import { RightRail } from "@/components/right-rail";
import { Flame } from "lucide-react";

export const dynamic = "force-dynamic";

const VISIBLE = ["auto_published", "published", "draft_ai"] as const;
const SELECT = {
  id: true, title: true, titleZh: true, summaryZh: true, imageUrl: true, videoUrl: true,
  category: true, medium: true, facts: true, status: true, firstSeenAt: true, publishedAt: true, confidence: true,
  heatScore: true, officialConfirmed: true, _count: { select: { signals: true } },
} as const;

const MEDIUM_ORDER = ["anime", "manga", "light_novel", "game", "film", "goods_event", "other"];

const PAGE_SIZE = 30;

export default async function Home({
  searchParams,
}: {
  searchParams: { sort?: string; board?: string; q?: string; page?: string };
}) {
  const sort = searchParams.sort === "hot" ? "hot" : "new";
  const board = searchParams.board;
  const q = searchParams.q?.trim() || undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const mediumWhere = board ? { medium: board } : {};
  const searchWhere = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { titleZh: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // 搜索态下不显示“热门置顶”，结果即纯搜索列表。
  const hotEvents = q
    ? []
    : await prisma.event.findMany({
        where: { status: { in: [...VISIBLE] }, heatScore: { gt: 1 }, ...mediumWhere },
        orderBy: [{ heatScore: "desc" }, { publishedAt: "desc" }],
        take: 4,
        select: SELECT,
      });
  const hotIds = hotEvents.map((e) => e.id);

  const [mainEvents, totalMain, heatTopRaw, mediumGroups, todayCount, sourceAgg] = await Promise.all([
    prisma.event.findMany({
      where: { status: { in: [...VISIBLE] }, id: { notIn: hotIds }, ...mediumWhere, ...searchWhere },
      orderBy:
        sort === "hot"
          ? [{ heatScore: "desc" }, { publishedAt: "desc" }]
          : [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: SELECT,
    }),
    prisma.event.count({
      where: { status: { in: [...VISIBLE] }, id: { notIn: hotIds }, ...mediumWhere, ...searchWhere },
    }),
    prisma.event.findMany({
      where: { status: { in: [...VISIBLE] }, heatScore: { gt: 1 }, ...mediumWhere },
      orderBy: [{ heatScore: "desc" }, { publishedAt: "desc" }],
      take: 6,
      select: { id: true, title: true, titleZh: true, _count: { select: { signals: true } } },
    }),
    prisma.event.groupBy({
      by: ["medium"],
      where: { status: { in: [...VISIBLE] } },
      _count: true,
    }),
    prisma.event.count({
      where: { status: { in: [...VISIBLE] }, publishedAt: { gte: startOfToday } },
    }),
    prisma.source.aggregate({ where: { enabled: true }, _count: true, _max: { lastSuccessAt: true } }),
  ]);

  const heatTop = heatTopRaw.map((e) => ({
    id: e.id,
    title: e.title,
    titleZh: e.titleZh,
    signals: e._count.signals,
  }));
  const mediumCounts = mediumGroups
    .filter((g) => g.medium)
    .map((g) => ({ medium: g.medium as string, count: g._count }))
    .sort((a, b) => MEDIUM_ORDER.indexOf(a.medium) - MEDIUM_ORDER.indexOf(b.medium));

  const totalPages = Math.max(1, Math.ceil(totalMain / PAGE_SIZE));
  const buildHref = (over: { sort?: string; page?: number }) => {
    const p = new URLSearchParams();
    if (board) p.set("board", board);
    if (q) p.set("q", q);
    const s = over.sort ?? (sort === "hot" ? "hot" : undefined);
    if (s) p.set("sort", s);
    const pg = over.page ?? page;
    if (pg > 1) p.set("page", String(pg));
    const qs = p.toString();
    return qs ? `/?${qs}` : "/";
  };
  const sortHref = (key: "new" | "hot") => buildHref({ sort: key === "hot" ? "hot" : undefined, page: 1 });

  return (
    <div className="grid gap-6 lg:grid-cols-[170px_minmax(0,1fr)_280px]">
      {/* 左：板块导航（lg+） */}
      <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
        <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          板块
        </h2>
        <BoardTabs board={board} sort={sort} vertical />
      </aside>

      {/* 中：信息流 */}
      <div className="min-w-0 space-y-6">
        <div className="lg:hidden">
          <BoardTabs board={board} sort={sort} />
        </div>

        {hotEvents.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Flame className="h-5 w-5 text-orange-500" />
              热门聚合
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {hotEvents.map((ev) => (
                <EventCard key={ev.id} ev={ev} highlight />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
            <div>
              <h1 className="text-2xl font-bold">{q ? `搜索：${q}` : "实时情报流"}</h1>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {q ? "匹配标题/译文" : sort === "hot" ? "按热度排序" : "按发布时间排序"} · 共 {totalMain} 条
                {totalPages > 1 ? ` · 第 ${page}/${totalPages} 页` : ""}
              </p>
            </div>
            {!q && (
              <div className="flex gap-2">
                <a href={sortHref("new")} className={"rounded-md px-3 py-1 text-sm " + (sort === "new" ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")}>最新</a>
                <a href={sortHref("hot")} className={"rounded-md px-3 py-1 text-sm " + (sort === "hot" ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")}>热度</a>
              </div>
            )}
          </div>
          {mainEvents.length === 0 && (
            <p className="text-[hsl(var(--muted-foreground))]">
              {q ? "没有匹配的情报。" : "该板块暂无情报。"}
            </p>
          )}
          {mainEvents.map((ev) => (
            <EventCard key={ev.id} ev={ev} />
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4 text-sm">
              {page > 1 ? (
                <a href={buildHref({ page: page - 1 })} className="rounded-md border px-3 py-1.5 hover:bg-[hsl(var(--muted))]">← 上一页</a>
              ) : (
                <span className="rounded-md border px-3 py-1.5 text-[hsl(var(--muted-foreground))] opacity-50">← 上一页</span>
              )}
              <span className="text-[hsl(var(--muted-foreground))]">第 {page} / {totalPages} 页</span>
              {page < totalPages ? (
                <a href={buildHref({ page: page + 1 })} className="rounded-md border px-3 py-1.5 hover:bg-[hsl(var(--muted))]">下一页 →</a>
              ) : (
                <span className="rounded-md border px-3 py-1.5 text-[hsl(var(--muted-foreground))] opacity-50">下一页 →</span>
              )}
            </div>
          )}
        </section>
      </div>

      {/* 右：小部件（lg+） */}
      <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
        <RightRail
          heatTop={heatTop}
          mediumCounts={mediumCounts}
          todayCount={todayCount}
          enabledSources={sourceAgg._count}
          lastSuccessAt={sourceAgg._max.lastSuccessAt}
        />
      </aside>
    </div>
  );
}
