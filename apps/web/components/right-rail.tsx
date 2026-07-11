import Link from "next/link";
import { MEDIUM_LABEL, relTime } from "@/lib/format";

interface HeatItem {
  id: string;
  title: string;
  titleZh: string | null;
  signals: number;
}

const HEAD = "mb-3 border-b pb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground";

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
  return (
    <div className="space-y-8">
      {heatTop.length > 0 && (
        <section>
          <h2 className={HEAD}>最热 · Most Read</h2>
          <ol className="space-y-3 text-sm">
            {heatTop.map((e, i) => (
              <li key={e.id} className="flex items-start gap-3">
                <span className="w-6 shrink-0 font-display text-2xl font-bold leading-6 text-muted-foreground/50">
                  {i + 1}
                </span>
                <Link
                  href={`/events/${e.id}`}
                  className="line-clamp-2 min-w-0 flex-1 font-medium leading-5 hover:text-primary"
                >
                  {e.titleZh || e.title}
                </Link>
                <span className="ml-auto shrink-0 font-mono text-xs text-orange-600 dark:text-orange-400">
                  {e.signals}源
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {mediumCounts.length > 0 && (
        <section>
          <h2 className={HEAD}>板块分布</h2>
          <ul className="space-y-1 text-sm">
            {mediumCounts.map((m) => (
              <li key={m.medium}>
                <Link
                  href={`/?board=${m.medium}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted hover:text-primary"
                >
                  <span>{MEDIUM_LABEL[m.medium] ?? m.medium}</span>
                  <span className="font-mono text-xs text-muted-foreground">{m.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className={HEAD}>数据状态</h2>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">今日新增</span>
            <span className="font-mono font-medium">{todayCount} 条</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">在抓源</span>
            <span className="font-mono font-medium">{enabledSources} 个</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">最近更新</span>
            <span className="font-mono font-medium">{lastSuccessAt ? relTime(lastSuccessAt) : "—"}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
