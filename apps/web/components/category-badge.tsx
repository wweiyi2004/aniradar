import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABEL } from "@/lib/format";

export function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge className="border-[hsl(var(--accent))] text-[hsl(var(--accent))]">
      {CATEGORY_LABEL[category] ?? category}
    </Badge>
  );
}
