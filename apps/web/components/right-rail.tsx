import Link from "next/link";
import { Flame } from "lucide-react";
import { MEDIUM_LABEL, relTime } from "@/lib/format";

interface HeatItem {
  id: string;
  title: string;
  titleZh: string | null;
  signals: number;
}

export function RightRail({
  heatTop,
  mediumCounts,
  todayCount,
  enabledSources,
  lastSuccessAt,
}: {
  heatTop: HeatItem[];
  mediumCounts: { medium: string; count: number }[];
  todayCount: number;
  enabledSources: number;
  lastSuccessAt: Date | null;
}) {
  const card = "rounded-md border bg-[hsl(var(--card))] p-3";
  const head = "mb-2 flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--muted-foreground))]";
  return (
    <div className="space-y-4">
      {heatTop.length > 0 && (
        <section className={card}>
          <h2 className={head}>
            <Flame className="h-4 w-4 text-orange-500" />
            热度榜
          </h2>
          <ol className="space-y-1.5 text-sm">
            {heatTop.map((e, i) => (
              <li key={e.id} className="flex items-baseline gap-2">
                <span className="w-4 shrink-0 text-right text-[hsl(var(--muted-foreground))]">{i + 1}</span>
                <Link
                  href={`/events/${e.id}`}
                  className="line-clamp-1 hover:text-[hsl(var(--primary))]"
                >
                  {e.titleZh || e.title}
                </Link>
                <span className="ml-auto shrink-0 text-xs text-orange-500">{e.signals}源</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {mediumCounts.length > 0 && (
        <section className={card}>
          <h2 className={head}>板块分布</h2>
          <ul className="space-y-1 text-sm">
            {mediumCounts.map((m) => (
              <li key={m.medium}>
                <Link
                  href={`/?board=${m.medium}`}
                  className="flex justify-between hover:text-[hsl(var(--primary))]"
                >
                  <span>{MEDIUM_LABEL[m.medium] ?? m.medium}</span>
                  <span className="text-[hsl(var(--muted-foreground))]">{m.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <h2 className={head}>数据状态</h2>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">今日新增</span>
            <span>{todayCount} 条</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">在抓源</span>
            <span>{enabledSources} 个</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">最近更新</span>
            <span>{lastSuccessAt ? relTime(lastSuccessAt) : "—"}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
