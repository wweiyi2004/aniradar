import Link from "next/link";
import { MEDIUM_LABEL } from "@/lib/format";

const BOARDS = ["anime", "manga", "light_novel", "game", "film", "goods_event"] as const;
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
    const href = key ? `/?board=${key}${sortQ}` : `/${sort === "hot" ? "?sort=hot" : ""}`;
    return (
      <Link
        key={key ?? "all"}
        href={href}
        className={
          "shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors " +
          (active
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground")
        }
      >
        <span className="inline-flex items-center gap-2">
          <span
            className={
              "h-1.5 w-1.5 rounded-full " +
              (key ? DOT[key] ?? "bg-muted-foreground" : "bg-foreground")
            }
          />
          {label}
        </span>
      </Link>
    );
  };
  return (
    <nav aria-label="板块" className="flex gap-1 overflow-x-auto border-b">
      {item(undefined, "全部")}
      {BOARDS.map((b) => item(b, MEDIUM_LABEL[b]))}
    </nav>
  );
}
