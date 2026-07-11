import { Badge } from "@/components/ui/badge";
import { MEDIUM_LABEL } from "@/lib/format";

const COLOR: Record<string, string> = {
  anime: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  manga: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  light_novel: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  game: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  film: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  goods_event: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  other: "bg-muted text-muted-foreground",
};

export function MediumBadge({ medium }: { medium: string | null }) {
  if (!medium) return null;
  return (
    <Badge className={`border-transparent ${COLOR[medium] ?? COLOR.other}`}>
      {MEDIUM_LABEL[medium] ?? medium}
    </Badge>
  );
}
