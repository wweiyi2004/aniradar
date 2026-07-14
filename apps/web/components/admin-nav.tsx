import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "待审" },
  { href: "/admin/events", label: "事件" },
  { href: "/admin/signals", label: "信号" },
  { href: "/admin/sources", label: "源" },
  { href: "/admin/fetch-logs", label: "日志" },
] as const;

export function AdminNav({ active }: { active?: (typeof LINKS)[number]["href"] }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b pb-3 text-sm">
      {LINKS.map((link) => {
        const isActive = active === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              isActive
                ? "rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
                : "rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
