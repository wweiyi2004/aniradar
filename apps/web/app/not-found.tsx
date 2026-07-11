import Link from "next/link";
import { Radar } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="font-display text-8xl font-bold leading-none text-muted-foreground/25">404</p>
      <Radar className="h-10 w-10 text-muted-foreground" />
      <div>
        <h1 className="font-display text-3xl font-bold">情报未找到</h1>
        <p className="mt-2 text-sm text-muted-foreground">这条情报可能已被合并或撤回。</p>
      </div>
      <Link
        href="/"
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        返回情报流
      </Link>
    </div>
  );
}
