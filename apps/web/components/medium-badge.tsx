import { Badge } from "@/components/ui/badge";
import { MEDIUM_LABEL } from "@/lib/format";

const COLOR: Record<string, string> = {
  anime: "bg-sky-500/10 text-sky-600 ring-sky-500/10 dark:text-sky-400",
  manga: "bg-violet-500/10 text-violet-600 ring-violet-500/10 dark:text-violet-400",
  light_novel: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/10 dark:text-emerald-400",
  game: "bg-amber-500/10 text-amber-600 ring-amber-500/10 dark:text-amber-400",
  film: "bg-rose-500/10 text-rose-600 ring-rose-500/10 dark:text-rose-400",
  goods_event: "bg-teal-500/10 text-teal-600 ring-teal-500/10 dark:text-teal-400",
  other: "bg-muted text-muted-foreground",
};

export function MediumBadge({ medium }: { medium: string | null }) {
  if (!medium) return null;
  return (
    <Badge
      className={`border-transparent px-2 py-0.5 text-[11px] ring-1 ring-inset ${COLOR[medium] ?? COLOR.other}`}
    >
      {MEDIUM_LABEL[medium] ?? medium}
    </Badge>
  );
}
