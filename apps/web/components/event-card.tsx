import Link from "next/link";
import { ArrowUpRight, Flame, Radio, Sparkles } from "lucide-react";
import { CategoryBadge } from "./category-badge";
import { MediumBadge } from "./medium-badge";
import { relTime, CATEGORY_LABEL } from "@/lib/format";
import { buildFactRows } from "@/lib/facts";

export interface EventCardData {
  id: string;
  title: string;
  titleZh: string | null;
  summaryZh: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  category: string;
  medium: string | null;
  facts: unknown;
  status: string;
  firstSeenAt: Date;
  publishedAt: Date | null;
  confidence: number;
  heatScore: number;
  officialConfirmed: boolean;
  _count: { signals: number };
}

const MEDIUM_BAR: Record<string, string> = {
  anime: "bg-sky-500",
  manga: "bg-violet-500",
  light_novel: "bg-emerald-500",
  game: "bg-amber-500",
  film: "bg-rose-500",
  goods_event: "bg-teal-500",
  other: "bg-muted-foreground",
};

function TimeKicker({ ev }: { ev: EventCardData }) {
  const discovered = new Date(ev.firstSeenAt).getTime();
  const published = ev.publishedAt ? new Date(ev.publishedAt).getTime() : null;
  // 雷达感：默认展示「发现」时间；与源发布时间差 >1h 时再补发布时刻
  const showBoth = published !== null && Math.abs(discovered - published) > 60 * 60 * 1000;

  if (showBoth && published !== null) {
    return (
      <>
        <time className="font-mono">发现 {relTime(ev.firstSeenAt)}</time>
        <time className="font-mono">发布 {relTime(ev.publishedAt!)}</time>
      </>
    );
  }
  return <time className="font-mono">发现 {relTime(ev.firstSeenAt)}</time>;
}

function Kicker({ ev }: { ev: EventCardData }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <CategoryBadge category={ev.category} />
      <MediumBadge medium={ev.medium} />
      <TimeKicker ev={ev} />
      {ev._count.signals > 1 && (
        <span className="inline-flex items-center gap-0.5 font-medium text-orange-600 dark:text-orange-400">
          <Flame className="h-3 w-3" />
          {ev._count.signals} 源
        </span>
      )}
      {ev.officialConfirmed && (
        <span className="font-medium text-emerald-600 dark:text-emerald-400">官方</span>
      )}
      {ev.status === "draft_ai" && (
        <span className="text-amber-600 dark:text-amber-400">AI 草稿</span>
      )}
    </div>
  );
}

export function EventCard({
  ev,
  variant = "row",
}: {
  ev: EventCardData;
  variant?: "hero" | "grid" | "row";
}) {
  const href = `/events/${ev.id}`;
  const title = ev.titleZh || ev.title;

  if (variant === "hero") {
    return (
      <Link
        href={href}
        className="anime-card group relative grid min-h-[350px] overflow-hidden md:grid-cols-[1.05fr_0.95fr]"
      >
        <div className="relative z-10 flex flex-col justify-between gap-8 p-6 sm:p-8">
          <div>
            <div className="mb-5 inline-flex rotate-[-2deg] items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              今日焦点
            </div>
            <Kicker ev={ev} />
            <h2 className="mt-4 font-display text-3xl font-bold leading-[1.15] tracking-tight transition-colors group-hover:text-primary sm:text-4xl">
              {title}
            </h2>
            {ev.summaryZh && (
              <p className="mt-4 line-clamp-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {ev.summaryZh}
              </p>
            )}
          </div>
          <span className="inline-flex w-fit items-center gap-2 text-sm font-bold text-primary">
            查看完整情报
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:translate-x-1">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </span>
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative min-h-64 overflow-hidden bg-muted md:min-h-full">
          {ev.imageUrl ? (
            <img
              src={ev.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 via-accent/10 to-sky-400/20">
              <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-primary/20 bg-background/50 shadow-inner">
                <Radio className="h-14 w-14 text-primary/70" />
                <span className="signal-dot absolute right-7 top-7 h-3 w-3 rounded-full bg-accent" />
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/15 to-transparent md:bg-gradient-to-r md:from-card/25 md:to-transparent" />
          <span className="absolute right-4 top-4 rounded-full border border-white/30 bg-black/35 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur-md">
            radar pick
          </span>
        </div>
      </Link>
    );
  }

  if (variant === "grid") {
    return (
      <Link
        href={href}
        className="anime-card group grid min-h-36 grid-cols-[112px_minmax(0,1fr)] overflow-hidden"
      >
        <div className="relative overflow-hidden bg-muted">
          {ev.imageUrl ? (
            <img
              src={ev.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/15">
              <span
                className={`absolute inset-y-0 left-0 w-1 ${MEDIUM_BAR[ev.medium ?? "other"] ?? MEDIUM_BAR.other}`}
              />
              <span className="font-display text-2xl font-bold text-primary/30">
                {CATEGORY_LABEL[ev.category] ?? ev.category}
              </span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-center p-4">
          <Kicker ev={ev} />
          <h3 className="mt-2 line-clamp-3 text-sm font-bold leading-snug transition-colors group-hover:text-primary sm:text-base">
            {title}
          </h3>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            继续阅读 <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    );
  }

  const keyFact = buildFactRows(ev.medium, ev.category, ev.facts).find((r) => "value" in r) as
    | { label: string; value: string }
    | undefined;

  return (
    <Link
      href={href}
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl px-1 py-5 transition-colors hover:bg-muted/45 sm:px-2"
    >
      <div className="min-w-0 space-y-2">
        <Kicker ev={ev} />
        <h3 className="line-clamp-2 text-lg font-bold leading-snug transition-colors group-hover:text-primary sm:text-xl">
          {title}
        </h3>
        {ev.summaryZh && (
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{ev.summaryZh}</p>
        )}
        {keyFact && (
          <p className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs">
            <span className="shrink-0 font-medium text-primary">{keyFact.label}</span>
            <span className="truncate text-muted-foreground">{keyFact.value}</span>
          </p>
        )}
      </div>
      {ev.imageUrl ? (
        <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-muted sm:h-24 sm:w-36">
          <img
            src={ev.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <span className="absolute inset-0 ring-1 ring-inset ring-black/5" />
        </div>
      ) : (
        <span className="mt-1 hidden h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      )}
    </Link>
  );
}
