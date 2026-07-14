import { prisma } from "@aniradar/db";
import { EVENT_STATUS, EVENT_CATEGORIES } from "@aniradar/shared";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { AdminNav } from "@/components/admin-nav";
import { EventActions } from "./event-actions";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  const query = await searchParams;
  // 默认只看待审 needs_review；?status=all 看全部
  const effectiveStatus =
    query.status === undefined ? "needs_review" : query.status === "all" ? "" : query.status;

  const where: { status?: string; category?: string } = {};
  if (effectiveStatus) where.status = effectiveStatus;
  if (query.category) where.category = query.category;

  const events = await prisma.event.findMany({
    where: where as never,
    orderBy: { firstSeenAt: "desc" },
    take: 100,
    include: { _count: { select: { signals: true } } },
  });

  return (
    <div className="space-y-4">
      <AdminNav active="/admin/events" />
      <h1 className="text-xl font-bold">Events</h1>
      <form className="flex flex-wrap gap-2 text-sm">
        <Select name="status" defaultValue={effectiveStatus || "all"}>
          <option value="all">全部状态</option>
          {EVENT_STATUS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select name="category" defaultValue={query.category ?? ""}>
          <option value="">全部分类</option>
          {EVENT_CATEGORIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <button className="rounded-md border px-3">筛选</button>
      </form>
      <Table>
        <THead>
          <TR>
            <TH>标题</TH>
            <TH>分类</TH>
            <TH>状态</TH>
            <TH>置信度</TH>
            <TH>来源</TH>
            <TH>操作</TH>
          </TR>
        </THead>
        <TBody>
          {events.map((e) => (
            <TR key={e.id}>
              <TD className="max-w-md">
                <a
                  href={
                    e.status === "published" || e.status === "auto_published"
                      ? `/events/${e.id}`
                      : `/admin/events/${e.id}`
                  }
                  className="hover:underline"
                >
                  {e.titleZh || e.title}
                </a>
              </TD>
              <TD>{e.category}</TD>
              <TD>{e.status}</TD>
              <TD>{(e.confidence * 100).toFixed(0)}%</TD>
              <TD>{e._count.signals}</TD>
              <TD>
                <EventActions id={e.id} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {events.length === 0 && (
        <p className="text-sm text-muted-foreground">
          当前筛选无结果。
          {effectiveStatus === "needs_review" && (
            <>
              {" "}
              <a href="/admin/events?status=all" className="text-primary hover:underline">
                查看全部
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
