import { CATEGORY_LABEL } from "@/lib/format";

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary">
      {CATEGORY_LABEL[category] ?? category}
    </span>
  );
}
