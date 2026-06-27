import Link from "next/link";
import { MEDIUM_LABEL } from "@/lib/format";

const BOARDS = ["anime", "manga", "light_novel", "game", "film", "goods_event"] as const;

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
          "shrink-0 rounded-md px-3 py-1 text-sm " +
          (active
            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : "border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")
        }
      >
        {label}
      </Link>
    );
  };
  return (
    <div className="flex flex-wrap gap-2">
      {item(undefined, "全部")}
      {BOARDS.map((b) => item(b, MEDIUM_LABEL[b]))}
    </div>
  );
}
