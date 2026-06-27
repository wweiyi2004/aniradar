import Link from "next/link";
import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "./category-badge";
import { MediumBadge } from "./medium-badge";
import { StatusBadge } from "./status-badge";
import { relTime } from "@/lib/format";
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
  confidence: number;
  heatScore: number;
  officialConfirmed: boolean;
  _count: { signals: number };
}

export function EventCard({ ev, highlight = false }: { ev: EventCardData; highlight?: boolean }) {
  const multiSource = ev._count.signals > 1;
  const keyFact = buildFactRows(ev.medium, ev.category, ev.facts).find((r) => "value" in r) as
    | { label: string; value: string }
    | undefined;
  return (
    <Link href={`/events/${ev.id}`} className="block">
      <Card
        className={
          "overflow-hidden rounded-md shadow-none transition-colors hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]/35 " +
          (highlight ? "border-orange-500/60 bg-orange-500/5" : "")
        }
      >
        <CardContent className="space-y-2.5 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-[hsl(var(--primary))]">{relTime(ev.firstSeenAt)}</span>
            <MediumBadge medium={ev.medium} />
            <CategoryBadge category={ev.category} />
            <StatusBadge status={ev.status} />
            {multiSource && (
              <Badge className="gap-1 border-orange-500 text-orange-500">
                <Flame className="h-3 w-3" />
                {ev._count.signals} 源聚合
              </Badge>
            )}
            {ev.officialConfirmed && <span className="text-xs text-emerald-500">官方</span>}
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-6">{ev.titleZh || ev.title}</h3>
          {ev.summaryZh && (
            <p className="line-clamp-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              {ev.summaryZh}
            </p>
          )}
          {keyFact && (
            <p className="text-xs text-[hsl(var(--foreground))]">
              <span className="text-[hsl(var(--muted-foreground))]">{keyFact.label}</span> {keyFact.value}
            </p>
          )}
          <div className="flex flex-wrap gap-3 border-t pt-2 text-xs text-[hsl(var(--muted-foreground))]">
            <span>置信度 {(ev.confidence * 100).toFixed(0)}%</span>
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3 w-3 text-orange-500" />
              热度 {ev.heatScore}
            </span>
            <span>来源 {ev._count.signals}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
