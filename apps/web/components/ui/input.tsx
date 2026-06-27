import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 rounded-md border bg-transparent px-3 py-1 text-sm outline-none focus:border-[hsl(var(--primary))]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))]",
        className,
      )}
      {...props}
    />
  );
}
