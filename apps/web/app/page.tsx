import Link from "next/link";
import { Flame } from "lucide-react";
import { prisma } from "@aniradar/db";
import { EventCard } from "@/components/event-card";

export const dynamic = "force-dynamic";

const VISIBLE = ["auto_published", "published", "draft_ai"] as const;

export default async function Home({ searchParams }: { searchParams: { sort?: string } }) {
  const sort = searchParams.sort === "hot" ? "hot" : "new";

  // 置顶热门：多源聚合（heatScore>1）按热度降序。
  const hotEvents = await prisma.event.findMany({
    where: { status: { in: [...VISIBLE] }, heatScore: { gt: 1 } },
    orderBy: [{ heatScore: "desc" }, { firstSeenAt: "desc" }],
    take: 5,
    include: { _count: { select: { signals: true } } },
  });
  const hotIds = hotEvents.map((e) => e.id);

  // 主情报流：排除已置顶项，按所选排序。
  const mainEvents = await prisma.event.findMany({
    where: { status: { in: [...VISIBLE] }, id: { notIn: hotIds } },
    orderBy:
      sort === "hot"
        ? [{ heatScore: "desc" }, { firstSeenAt: "desc" }]
        : [{ firstSeenAt: "desc" }],
    take: 50,
    include: { _count: { select: { signals: true } } },
  });

  const tab = (key: "new" | "hot", label: string) => {
    const active = sort === key;
    return (
      <Link
        href={key === "new" ? "/" : "/?sort=hot"}
        className={
          "rounded-md px-3 py-1 text-sm " +
          (active
            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : "border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      {hotEvents.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Flame className="h-5 w-5 text-orange-500" />
                热门聚合
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">多源报道同一情报</p>
            </div>
          </div>
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
            <h1 className="text-2xl font-bold tracking-normal">实时情报流</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              {sort === "hot" ? "按热度排序" : "按首次发现时间排序"} · 共 {mainEvents.length} 条
            </p>
          </div>
          <div className="flex gap-2">
            {tab("new", "最新发现")}
            {tab("hot", "热度")}
          </div>
        </div>
        {mainEvents.length === 0 && (
          <p className="text-[hsl(var(--muted-foreground))]">暂无情报，等待 worker 抓取…</p>
        )}
        {mainEvents.map((ev) => (
          <EventCard key={ev.id} ev={ev} />
        ))}
      </section>
    </div>
  );
}
