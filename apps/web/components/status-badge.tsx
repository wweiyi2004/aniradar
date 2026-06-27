import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/format";

const tone: Record<string, string> = {
  auto_published: "text-emerald-500 border-emerald-500",
  published: "text-emerald-500 border-emerald-500",
  draft_ai: "text-amber-500 border-amber-500",
  needs_review: "text-amber-500 border-amber-500",
  ignored: "text-zinc-500 border-zinc-500",
  retracted: "text-red-500 border-red-500",
  merged: "text-zinc-500 border-zinc-500",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={tone[status] ?? ""}>{STATUS_LABEL[status] ?? status}</Badge>;
}
