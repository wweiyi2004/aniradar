import { Badge } from "@/components/ui/badge";
import { MEDIUM_LABEL } from "@/lib/format";

const COLOR: Record<string, string> = {
  anime: "border-sky-500 text-sky-500",
  manga: "border-violet-500 text-violet-500",
  light_novel: "border-emerald-500 text-emerald-500",
  game: "border-amber-500 text-amber-500",
  film: "border-rose-500 text-rose-500",
  goods_event: "border-teal-500 text-teal-500",
  other: "border-[hsl(var(--muted-foreground))] text-[hsl(var(--muted-foreground))]",
};

export function MediumBadge({ medium }: { medium: string | null }) {
  if (!medium) return null;
  return <Badge className={COLOR[medium] ?? COLOR.other}>{MEDIUM_LABEL[medium] ?? medium}</Badge>;
}
