import type { Prisma } from "@prisma/client";
import { workKeyFromFacts } from "../src/workKey";

export function prepareSourceRow(row: Record<string, unknown>): Prisma.SourceCreateManyInput {
  const prepared: Record<string, unknown> = { ...row };
  if (prepared.selectorConfig == null) delete prepared.selectorConfig;
  return prepared as Prisma.SourceCreateManyInput;
}

export function prepareEventRow(row: Record<string, unknown>): Prisma.EventCreateManyInput {
  const prepared: Record<string, unknown> = { ...row, workKey: workKeyFromFacts(row.facts) };
  if (prepared.facts == null) delete prepared.facts;
  return prepared as Prisma.EventCreateManyInput;
}
