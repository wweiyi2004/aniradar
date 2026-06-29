import Link from "next/link";
import { Radar } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <Radar className="h-12 w-12 text-[hsl(var(--muted-foreground))]" />
      <div>
        <h1 className="text-2xl font-bold">情报未找到</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          这条情报可能已被合并或撤回。
        </p>
      </div>
      <Link
        href="/"
        className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))]"
      >
        返回情报流
      </Link>
    </div>
  );
}
