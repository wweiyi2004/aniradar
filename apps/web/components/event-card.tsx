import Link from "next/link";
import { Flame } from "lucide-react";
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
  const showBoth =
    published !== null && Math.abs(discovered - published) > 60 * 60 * 1000;

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
      <Link href={href} className="group grid gap-5">
        {ev.imageUrl ? (
          <>
            <img
              src={ev.imageUrl}
              alt=""
              className="aspect-[16/9] w-full rounded-xl object-cover"
            />
            <div className="space-y-3">
              <Kicker ev={ev} />
              <h2 className="font-display text-2xl font-bold leading-tight group-hover:text-primary sm:text-3xl lg:text-4xl">
                {title}
              </h2>
              {ev.summaryZh && (
                <p className="line-clamp-3 max-w-2xl text-base leading-7 text-muted-foreground">
                  {ev.summaryZh}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3 border-l-4 border-primary pl-5">
            <Kicker ev={ev} />
            <h2 className="font-display text-3xl font-bold leading-tight group-hover:text-primary sm:text-4xl">
              {title}
            </h2>
            {ev.summaryZh && (
              <p className="line-clamp-3 max-w-2xl text-base leading-7 text-muted-foreground">
                {ev.summaryZh}
              </p>
            )}
          </div>
        )}
      </Link>
    );
  }

  if (variant === "grid") {
    return (
      <Link href={href} className="group flex flex-col gap-3">
        {ev.imageUrl ? (
          <img
            src={ev.imageUrl}
            alt=""
            className="aspect-[16/10] w-full rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div className="relative flex aspect-[16/10] w-full items-end overflow-hidden rounded-lg bg-muted p-4">
            <span
              className={`absolute inset-x-0 top-0 h-[3px] ${MEDIUM_BAR[ev.medium ?? "other"] ?? MEDIUM_BAR.other}`}
            />
            <span className="font-display text-2xl font-bold text-muted-foreground/40">
              {CATEGORY_LABEL[ev.category] ?? ev.category}
            </span>
          </div>
        )}
        <div className="space-y-2">
          <Kicker ev={ev} />
          <h3 className="line-clamp-2 text-base font-bold leading-snug group-hover:text-primary">
            {title}
          </h3>
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
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-5"
    >
      <div className="min-w-0 space-y-2">
        <Kicker ev={ev} />
        <h3 className="line-clamp-2 text-lg font-bold leading-snug group-hover:text-primary sm:text-xl">
          {title}
        </h3>
        {ev.summaryZh && (
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{ev.summaryZh}</p>
        )}
        {keyFact && (
          <p className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs">
            <span className="shrink-0 text-muted-foreground">{keyFact.label}</span>
            <span className="truncate">{keyFact.value}</span>
          </p>
        )}
      </div>
      {ev.imageUrl && (
        <img
          src={ev.imageUrl}
          alt=""
          className="hidden h-24 w-40 rounded-md object-cover sm:block"
          loading="lazy"
        />
      )}
    </Link>
  );
}
