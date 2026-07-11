import { CATEGORY_LABEL } from "@/lib/format";

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="text-xs font-semibold tracking-wide text-primary">
      {CATEGORY_LABEL[category] ?? category}
    </span>
  );
}
