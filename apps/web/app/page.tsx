import { prisma } from "@aniradar/db";
import { EventCard } from "@/components/event-card";
import { BoardTabs } from "@/components/board-tabs";
import { RightRail } from "@/components/right-rail";
import { getPublicEventStatuses } from "@/lib/public-status";
import { startOfToday } from "@/lib/today";

export const dynamic = "force-dynamic";
const SELECT = {
  id: true,
  title: true,
  titleZh: true,
  summaryZh: true,
  imageUrl: true,
  videoUrl: true,
  category: true,
  medium: true,
  facts: true,
  status: true,
  firstSeenAt: true,
  publishedAt: true,
  confidence: true,
  heatScore: true,
  officialConfirmed: true,
  _count: { select: { signals: true } },
} as const;

const PAGE_SIZE = 30;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string;
    board?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const query = await searchParams;
  const sort = query.sort === "hot" ? "hot" : "new";
  const board = query.board;
  const q = query.q?.trim() || undefined;
  const page = Math.max(1, Number(query.page) || 1);
  const mediumWhere = board ? { medium: board } : {};
  const searchWhere = q
    ? {
        OR: [{ title: { contains: q } }, { titleZh: { contains: q } }],
      }
    : {};
  const todayStart = startOfToday();
  const hotPublishedSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // 默认不含 draft_ai；PUBLIC_SHOW_DRAFT=true 时可露出草稿。
  const visible = [...getPublicEventStatuses()];

  // 信息流永远是完整的时间线（最新在前），热门事件不从流中排除；
  // hero 只是“聚光灯”，与流中条目允许重复（杂志式做法）。
  // publishedAt 可空：nulls last，避免缺发布时间的事件被 Postgres DESC 顶到最前。
  const [mainEvents, totalMain, hotEvents, todayCount, sourceAgg] = await Promise.all([
    prisma.event.findMany({
      where: { status: { in: visible }, ...mediumWhere, ...searchWhere },
      orderBy:
        sort === "hot"
          ? [{ heatScore: "desc" as const }, { publishedAt: "desc" as const }]
          : [{ publishedAt: "desc" as const }, { firstSeenAt: "desc" as const }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: SELECT,
    }),
    prisma.event.count({
      where: { status: { in: visible }, ...mediumWhere, ...searchWhere },
    }),
    // 近 7 天热门：一次查询同时供 hero（前 5 条）与右栏热度榜（6 条）。
    prisma.event.findMany({
      where: {
        status: { in: visible },
        heatScore: { gt: 1 },
        publishedAt: { gte: hotPublishedSince },
        ...mediumWhere,
      },
      orderBy: [{ heatScore: "desc" }, { publishedAt: "desc" }],
      take: 6,
      select: SELECT,
    }),
    prisma.event.count({
      where: { status: { in: visible }, publishedAt: { gte: todayStart } },
    }),
    prisma.source.aggregate({
      where: { enabled: true },
      _count: true,
      _max: { lastSuccessAt: true },
    }),
  ]);

  const heatTop = hotEvents.map((e) => ({
    id: e.id,
    title: e.title,
    titleZh: e.titleZh,
    signals: e._count.signals,
  }));
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
  const sortHref = (key: "new" | "hot") =>
    buildHref({ sort: key === "hot" ? "hot" : undefined, page: 1 });

  // hero 仅在“最新”视图的第 1 页显示：搜索是纯结果列表；
  // “热度”视图本身就是完整热度榜，再放 hero 会紧邻重复。
  const showHero = !q && page === 1 && sort === "new" && hotEvents.length > 0;

  return (
    <div className="space-y-7 sm:space-y-9">
      <BoardTabs board={board} sort={sort} />

      {q && (
        <section className="anime-card relative overflow-hidden px-5 py-6 sm:px-7">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Search result
          </p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            “{q}”
            <span className="ml-3 text-sm font-normal text-muted-foreground">
              找到 {totalMain} 条情报
            </span>
          </h1>
        </section>
      )}

      {showHero && (
        <section aria-label="热门聚合" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Spotlight</p>
              <h1 className="mt-1 font-display text-2xl font-bold">次元聚光灯</h1>
            </div>
            <span className="hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:inline-flex">
              <span className="signal-dot h-2 w-2 rounded-full bg-emerald-500" />
              热度信号实时更新
            </span>
          </div>
          {hotEvents.length > 1 && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(250px,0.7fr)]">
              <EventCard ev={hotEvents[0]} variant="hero" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {hotEvents.slice(1, 3).map((ev) => (
                  <EventCard key={ev.id} ev={ev} variant="grid" />
                ))}
              </div>
            </div>
          )}
          {hotEvents.length === 1 && <EventCard ev={hotEvents[0]} variant="hero" />}
        </section>
      )}

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                {q ? "Matched signals" : "Live feed"}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold">
                {q ? "匹配情报" : "实时情报流"}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {q ? "匹配标题/译文" : sort === "hot" ? "按热度排序" : "按发布时间排序"} · 共{" "}
                {totalMain} 条{totalPages > 1 ? ` · 第 ${page}/${totalPages} 页` : ""}
              </p>
            </div>
            {!q && (
              <div className="flex rounded-full border bg-card/70 p-1 text-sm shadow-sm">
                <a
                  href={sortHref("new")}
                  className={
                    sort === "new"
                      ? "rounded-full bg-foreground px-4 py-1.5 font-semibold text-background"
                      : "rounded-full px-4 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  最新
                </a>
                <a
                  href={sortHref("hot")}
                  className={
                    sort === "hot"
                      ? "rounded-full bg-foreground px-4 py-1.5 font-semibold text-background"
                      : "rounded-full px-4 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  热度
                </a>
              </div>
            )}
          </div>
          {mainEvents.length === 0 && (
            <div className="anime-card mt-4 px-6 py-14 text-center">
              <p className="font-display text-lg font-bold">暂时没有捕捉到信号</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {q ? "换个关键词再试试看吧。" : "雷达仍在扫描这个板块。"}
              </p>
            </div>
          )}
          {mainEvents.length > 0 && (
            <div className="anime-card mt-4 divide-y divide-border/70 overflow-hidden px-3 sm:px-5">
              {mainEvents.map((ev) => (
                <EventCard key={ev.id} ev={ev} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between text-sm">
              {page > 1 ? (
                <a
                  href={buildHref({ page: page - 1 })}
                  className="rounded-full border bg-card px-4 py-2 hover:border-primary/40 hover:text-primary"
                >
                  ← 上一页
                </a>
              ) : (
                <span className="rounded-full border bg-card px-4 py-2 text-muted-foreground opacity-50">
                  ← 上一页
                </span>
              )}
              <span className="font-mono text-xs text-muted-foreground">
                第 {page} / {totalPages} 页
              </span>
              {page < totalPages ? (
                <a
                  href={buildHref({ page: page + 1 })}
                  className="rounded-full border bg-card px-4 py-2 hover:border-primary/40 hover:text-primary"
                >
                  下一页 →
                </a>
              ) : (
                <span className="rounded-full border bg-card px-4 py-2 text-muted-foreground opacity-50">
                  下一页 →
                </span>
              )}
            </div>
          )}
        </section>

        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
          <RightRail
            heatTop={heatTop}
            todayCount={todayCount}
            enabledSources={sourceAgg._count}
            lastSuccessAt={sourceAgg._max.lastSuccessAt}
          />
        </aside>
      </div>
    </div>
  );
}
