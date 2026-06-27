import { prisma } from "@aniradar/db";
import { EVENT_STATUS, EVENT_CATEGORIES } from "@aniradar/shared";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { EventActions } from "./event-actions";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { status?: string; category?: string };
}) {
  const where: { status?: string; category?: string } = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.category) where.category = searchParams.category;

  const events = await prisma.event.findMany({
    where: where as never,
    orderBy: { firstSeenAt: "desc" },
    take: 100,
    include: { _count: { select: { signals: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Events</h1>
      <form className="flex flex-wrap gap-2 text-sm">
        <Select name="status" defaultValue={searchParams.status ?? ""}>
          <option value="">全部状态</option>
          {EVENT_STATUS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select name="category" defaultValue={searchParams.category ?? ""}>
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
                <a href={`/events/${e.id}`} className="hover:underline">
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
    </div>
  );
}
