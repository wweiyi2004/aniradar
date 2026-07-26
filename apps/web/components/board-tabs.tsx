import Link from "next/link";
import { MEDIUM_LABEL } from "@/lib/format";

const BOARDS = [
  "anime",
  "manga",
  "light_novel",
  "game",
  "film",
  "goods_event",
] as const;
const DOT: Record<string, string> = {
  anime: "bg-sky-500",
  manga: "bg-violet-500",
  light_novel: "bg-emerald-500",
  game: "bg-amber-500",
  film: "bg-rose-500",
  goods_event: "bg-teal-500",
};

export function BoardTabs({ board, sort }: { board?: string; sort?: string }) {
  const sortQ = sort === "hot" ? "&sort=hot" : "";
  const item = (key: string | undefined, label: string) => {
    const active = (key ?? "") === (board ?? "");
    const href = key
      ? `/?board=${key}${sortQ}`
      : `/${sort === "hot" ? "?sort=hot" : ""}`;
    return (
      <Link
        key={key ?? "all"}
        href={href}
        aria-current={active ? "page" : undefined}
        className={
          "shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all " +
          (active
            ? "border-primary/20 bg-primary text-primary-foreground shadow-[0_6px_16px_hsl(var(--primary)/0.22)]"
            : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-background/70 hover:text-foreground")
        }
      >
        <span className="inline-flex items-center gap-2">
          <span
            className={
              "h-1.5 w-1.5 rounded-full " +
              (active
                ? "bg-white"
                : key
                  ? (DOT[key] ?? "bg-muted-foreground")
                  : "bg-foreground")
            }
          />
          {label}
        </span>
      </Link>
    );
  };
  return (
    <div className="anime-card flex items-center gap-2 overflow-hidden p-2">
      <span className="hidden shrink-0 pl-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground sm:block">
        Channel
      </span>
      <nav
        aria-label="板块"
        className="scrollbar-hide flex min-w-0 flex-1 gap-1 overflow-x-auto"
      >
        {item(undefined, "全部")}
        {BOARDS.map((b) => item(b, MEDIUM_LABEL[b]))}
      </nav>
    </div>
  );
}
