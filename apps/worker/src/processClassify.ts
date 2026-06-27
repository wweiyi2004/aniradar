import { prisma } from "@aniradar/db";
import { classify, summarize } from "@aniradar/ai";
import { buildEventFromSignal } from "@aniradar/detector";
import type { ClassifyJobData } from "@aniradar/shared";

export async function processClassify(data: ClassifyJobData): Promise<void> {
  const signal = await prisma.signal.findUnique({
    where: { id: data.signalId },
    include: { source: true },
  });
  if (!signal) return;

  try {
    const result = classify({
      title: signal.title,
      summary: signal.summary ?? undefined,
      rawText: signal.rawText ?? undefined,
    });

    if (!result.isAnimeNews) {
      await prisma.signal.update({ where: { id: signal.id }, data: { status: "ignored" } });
      return;
    }

    const built = buildEventFromSignal({
      title: signal.title,
      category: result.category,
      confidence: result.confidence,
      firstSeenAt: signal.firstSeenAt,
      sourceType: signal.source.type,
    });
    const { titleZh, summaryZh } = summarize({
      title: signal.title,
      summary: signal.summary ?? undefined,
    });

    const event = await prisma.event.create({
      data: {
        title: built.title,
        titleZh,
        summaryZh,
        category: built.category,
        firstSeenAt: built.firstSeenAt,
        confidence: built.confidence,
        officialConfirmed: built.officialConfirmed,
        status: built.status,
        heatScore: 1,
      },
    });
    await prisma.signal.update({
      where: { id: signal.id },
      data: { status: "classified", eventId: event.id },
    });
  } catch {
    await prisma.signal.update({ where: { id: signal.id }, data: { status: "failed" } });
  }
}
