import Link from "next/link";
import { Radar, Search } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-baseline gap-2.5">
          <Radar className="h-5 w-5 self-center text-primary" />
          <span className="font-display text-xl font-bold tracking-tight">AniRadar</span>
          <span className="hidden text-xs text-muted-foreground sm:block">动漫新情报雷达</span>
        </Link>
        <form action="/" method="get" className="relative ml-auto shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            placeholder="搜索作品/情报"
            aria-label="搜索"
            className="h-9 w-36 rounded-full border bg-muted/60 pl-9 pr-3 text-sm transition-all focus:w-56 focus:border-ring focus:bg-card focus-visible:outline-none sm:w-48"
          />
        </form>
        <ThemeToggle />
      </div>
    </header>
  );
}
