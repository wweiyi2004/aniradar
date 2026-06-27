import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 rounded-md border bg-transparent px-2 py-1 text-sm outline-none focus:border-[hsl(var(--primary))]",
        className,
      )}
      {...props}
    />
  );
}
