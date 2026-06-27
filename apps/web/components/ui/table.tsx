import { cn } from "@/lib/utils";

export function Table({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-sm", className)} {...p} />
    </div>
  );
}

export function THead({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("text-left text-[hsl(var(--muted-foreground))]", className)} {...p} />;
}

export function TBody(p: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...p} />;
}

export function TR({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-t", className)} {...p} />;
}

export function TH({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("py-2 pr-3 font-medium", className)} {...p} />;
}

export function TD({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("py-2 pr-3 align-top", className)} {...p} />;
}
