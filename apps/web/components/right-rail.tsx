import Link from "next/link";
import { Activity, ArrowUpRight, Radio, Sparkles } from "lucide-react";
import { relTime } from "@/lib/format";

interface HeatItem {
  id: string;
  title: string;
  titleZh: string | null;
  signals: number;
}

export function RightRail({
  heatTop,
  todayCount,
  enabledSources,
  lastSuccessAt,
}: {
  heatTop: HeatItem[];
  todayCount: number;
  enabledSources: number;
  lastSuccessAt: Date | null;
}) {
  return (
    <div className="space-y-4">
      {heatTop.length > 0 && (
        <section className="anime-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Hot signals
              </p>
              <h2 className="mt-1 font-display text-lg font-bold">本周热榜</h2>
            </div>
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <ol className="space-y-1 text-sm">
            {heatTop.slice(0, 5).map((e, i) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className="group flex items-start gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-muted/70"
                >
                  <span
                    className={`w-5 shrink-0 font-display text-lg font-bold leading-5 ${i === 0 ? "text-primary" : "text-muted-foreground/50"}`}
                  >
                    {i + 1}
                  </span>
                  <span className="line-clamp-2 min-w-0 flex-1 font-medium leading-5 group-hover:text-primary">
                    {e.titleZh || e.title}
                  </span>
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="anime-card overflow-hidden">
        <div className="bg-gradient-to-br from-primary/12 via-card to-accent/10 p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Radio className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-display text-base font-bold">雷达运行中</h2>
                <span className="signal-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                持续扫描次元新信号
              </p>
            </div>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-2">
              <span className="text-muted-foreground">今日新增</span>
              <span className="font-mono font-semibold text-primary">
                {todayCount} 条
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-2">
              <span className="text-muted-foreground">监测信源</span>
              <span className="font-mono font-medium">{enabledSources} 个</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                最近同步
              </span>
              <span className="font-mono text-xs font-medium">
                {lastSuccessAt ? relTime(lastSuccessAt) : "—"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
