import Link from "next/link";
import { MEDIUM_LABEL } from "@/lib/format";

const BOARDS = ["anime", "manga", "light_novel", "game", "film", "goods_event"] as const;

export function BoardTabs({
  board,
  sort,
  vertical = false,
}: {
  board?: string;
  sort?: string;
  vertical?: boolean;
}) {
  const sortQ = sort === "hot" ? "&sort=hot" : "";
  const item = (key: string | undefined, label: string) => {
    const active = (key ?? "") === (board ?? "");
    const href = key ? `/?board=${key}${sortQ}` : `/${sort === "hot" ? "?sort=hot" : ""}`;
    return (
      <Link
        key={key ?? "all"}
        href={href}
        className={
          (vertical ? "block w-full " : "shrink-0 ") +
          "rounded-md px-3 py-1.5 text-sm transition-colors " +
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
    <div className={vertical ? "flex flex-col gap-1" : "flex flex-wrap gap-2"}>
      {item(undefined, "全部")}
      {BOARDS.map((b) => item(b, MEDIUM_LABEL[b]))}
    </div>
  );
}
