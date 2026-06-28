import Link from "next/link";
import { Radar } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-[hsl(var(--background))]/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <Radar className="h-5 w-5 text-[hsl(var(--primary))]" />
          AniRadar
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm text-[hsl(var(--muted-foreground))]">
          <Link href="/" className="shrink-0 rounded-md px-2 py-1 hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
            情报流
          </Link>
          <Link href="/admin/sources" className="shrink-0 rounded-md px-2 py-1 hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
            资讯源
          </Link>
          <Link href="/admin/signals" className="shrink-0 rounded-md px-2 py-1 hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
            Signals
          </Link>
          <Link href="/admin/events" className="shrink-0 rounded-md px-2 py-1 hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
            Events
          </Link>
          <Link href="/admin/fetch-logs" className="shrink-0 rounded-md px-2 py-1 hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
            抓取日志
          </Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
