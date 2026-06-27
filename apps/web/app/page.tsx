import { prisma } from "@aniradar/db";
import { EventCard } from "@/components/event-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const events = await prisma.event.findMany({
    where: { status: { in: ["auto_published", "published", "draft_ai"] } },
    orderBy: { firstSeenAt: "desc" },
    take: 50,
    include: { _count: { select: { signals: true } } },
  });

  return (
    <div className="space-y-3">
      <div className="mb-2">
        <h1 className="text-xl font-bold">实时情报流</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          按首次发现时间排序 · 共 {events.length} 条
        </p>
      </div>
      {events.length === 0 && (
        <p className="text-[hsl(var(--muted-foreground))]">暂无情报，等待 worker 抓取…</p>
      )}
      {events.map((ev) => (
        <EventCard key={ev.id} ev={ev} />
      ))}
    </div>
  );
}
