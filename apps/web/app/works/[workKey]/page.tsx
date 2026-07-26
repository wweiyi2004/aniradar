import { normalizeWorkKey, prisma } from "@aniradar/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Radar } from "lucide-react";
import { EventCard } from "@/components/event-card";
import { getPublicEventStatuses } from "@/lib/public-status";

export const dynamic = "force-dynamic";

// 与首页一致的卡片字段
const SELECT = {
  id: true,
  title: true,
  titleZh: true,
  summaryZh: true,
  imageUrl: true,
  videoUrl: true,
  category: true,
  medium: true,
  facts: true,
  status: true,
  firstSeenAt: true,
  publishedAt: true,
  confidence: true,
  heatScore: true,
  officialConfirmed: true,
  _count: { select: { signals: true } },
} as const;

const MAX_EVENTS = 100;

// Next 动态段的编码行为有平台差异,统一尝试解码一次(失败回退原值)。
function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function findWorkEvents(rawKey: string) {
  const workKey = normalizeWorkKey(decodeParam(rawKey));
  if (!workKey) return { workKey: null, events: [] as const };
  const events = await prisma.event.findMany({
    where: { workKey, status: { in: [...getPublicEventStatuses()] } },
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
    take: MAX_EVENTS,
    select: SELECT,
  });
  return { workKey, events };
}

/** 展示名优先取最新事件 facts.work 的原文(workKey 已被 lowercase 归一)。 */
function displayName(events: { facts: unknown }[], workKey: string): string {
  for (const e of events) {
    const w = (e.facts as Record<string, unknown> | null)?.work;
    if (typeof w === "string" && w.trim()) return w.trim();
  }
  return workKey;
}

export async function generateMetadata({ params }: { params: Promise<{ workKey: string }> }) {
  const { workKey: raw } = await params;
  const { workKey, events } = await findWorkEvents(raw);
  if (!workKey || events.length === 0) notFound();
  const name = displayName(events, workKey);
  return {
    title: `《${name}》情报档案 · AniRadar`,
    description: `《${name}》相关的 ${events.length} 条动漫情报时间线。`,
  };
}

export default async function WorkPage({ params }: { params: Promise<{ workKey: string }> }) {
  const { workKey: raw } = await params;
  const { workKey, events } = await findWorkEvents(raw);
  if (!workKey || events.length === 0) notFound();
  const name = displayName(events, workKey);

  return (
    <div className="space-y-7">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        返回情报流
      </Link>

      <header className="anime-card relative overflow-hidden px-6 py-8 sm:px-8">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          <Radar className="h-3.5 w-3.5" />
          Work dossier
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">《{name}》</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          该作品的全部公开情报 · 共 {events.length} 条,按发布时间倒序
        </p>
      </header>

      <section className="anime-card divide-y divide-border/70 overflow-hidden px-3 sm:px-5">
        {events.map((ev) => (
          <EventCard key={ev.id} ev={ev} />
        ))}
      </section>
    </div>
  );
}
