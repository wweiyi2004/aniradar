import { prisma } from "@aniradar/db";
import { EventCard } from "@/components/event-card";
import { BoardTabs } from "@/components/board-tabs";
import { Flame } from "lucide-react";

export const dynamic = "force-dynamic";

const VISIBLE = ["auto_published", "published", "draft_ai"] as const;
const SELECT = {
  id: true, title: true, titleZh: true, summaryZh: true, imageUrl: true, videoUrl: true,
  category: true, medium: true, facts: true, status: true, firstSeenAt: true, confidence: true,
  heatScore: true, officialConfirmed: true, _count: { select: { signals: true } },
} as const;

export default async function Home({ searchParams }: { searchParams: { sort?: string; board?: string } }) {
  const sort = searchParams.sort === "hot" ? "hot" : "new";
  const board = searchParams.board;
  const mediumWhere = board ? { medium: board } : {};

  const hotEvents = await prisma.event.findMany({
    where: { status: { in: [...VISIBLE] }, heatScore: { gt: 1 }, ...mediumWhere },
    orderBy: [{ heatScore: "desc" }, { firstSeenAt: "desc" }],
    take: 4,
    select: SELECT,
  });
  const hotIds = hotEvents.map((e) => e.id);

  const mainEvents = await prisma.event.findMany({
    where: { status: { in: [...VISIBLE] }, id: { notIn: hotIds }, ...mediumWhere },
    orderBy: sort === "hot" ? [{ heatScore: "desc" }, { firstSeenAt: "desc" }] : [{ firstSeenAt: "desc" }],
    take: 50,
    select: SELECT,
  });

  const sortHref = (key: "new" | "hot") => {
    const b = board ? `board=${board}` : "";
    if (key === "new") return b ? `/?${b}` : "/";
    return b ? `/?${b}&sort=hot` : "/?sort=hot";
  };

  return (
    <div className="space-y-6">
      <BoardTabs board={board} sort={sort} />

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
            <h1 className="text-2xl font-bold">实时情报流</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              {sort === "hot" ? "按热度排序" : "按首次发现时间排序"} · 共 {mainEvents.length} 条
            </p>
          </div>
          <div className="flex gap-2">
            <a href={sortHref("new")} className={"rounded-md px-3 py-1 text-sm " + (sort === "new" ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")}>最新发现</a>
            <a href={sortHref("hot")} className={"rounded-md px-3 py-1 text-sm " + (sort === "hot" ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")}>热度</a>
          </div>
        </div>
        {mainEvents.length === 0 && (
          <p className="text-[hsl(var(--muted-foreground))]">该板块暂无情报。</p>
        )}
        {mainEvents.map((ev) => (
          <EventCard key={ev.id} ev={ev} />
        ))}
      </section>
    </div>
  );
}
