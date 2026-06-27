import Link from "next/link";
import { Radar } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-[hsl(var(--background))]/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Radar className="h-5 w-5 text-[hsl(var(--primary))]" />
          AniRadar
        </Link>
        <nav className="flex flex-1 items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
          <Link href="/" className="hover:text-[hsl(var(--foreground))]">
            情报流
          </Link>
          <Link href="/admin/sources" className="hover:text-[hsl(var(--foreground))]">
            资讯源
          </Link>
          <Link href="/admin/signals" className="hover:text-[hsl(var(--foreground))]">
            Signals
          </Link>
          <Link href="/admin/events" className="hover:text-[hsl(var(--foreground))]">
            Events
          </Link>
          <Link href="/admin/fetch-logs" className="hover:text-[hsl(var(--foreground))]">
            抓取日志
          </Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
