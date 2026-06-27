import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryBadge } from "./category-badge";
import { StatusBadge } from "./status-badge";
import { relTime } from "@/lib/format";

export interface EventCardData {
  id: string;
  title: string;
  titleZh: string | null;
  summaryZh: string | null;
  category: string;
  status: string;
  firstSeenAt: Date;
  confidence: number;
  officialConfirmed: boolean;
  _count: { signals: number };
}

export function EventCard({ ev }: { ev: EventCardData }) {
  return (
    <Link href={`/events/${ev.id}`}>
      <Card className="transition-colors hover:border-[hsl(var(--primary))]">
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[hsl(var(--primary))]">{relTime(ev.firstSeenAt)}</span>
            <CategoryBadge category={ev.category} />
            <StatusBadge status={ev.status} />
            {ev.officialConfirmed && <span className="text-xs text-emerald-500">官方</span>}
          </div>
          <h3 className="font-semibold">{ev.titleZh || ev.title}</h3>
          {ev.summaryZh && (
            <p className="line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">{ev.summaryZh}</p>
          )}
          <div className="flex gap-3 text-xs text-[hsl(var(--muted-foreground))]">
            <span>置信度 {(ev.confidence * 100).toFixed(0)}%</span>
            <span>来源 {ev._count.signals}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
