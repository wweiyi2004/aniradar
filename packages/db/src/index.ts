import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient; sqliteConfigured?: Promise<void> };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export function configureDatabase(): Promise<void> {
  if (!g.sqliteConfigured) {
    const configuring = (async () => {
      await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
      await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
      await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON");
    })();
    g.sqliteConfigured = configuring.catch((error) => {
      g.sqliteConfigured = undefined;
      throw error;
    });
  }
  return g.sqliteConfigured;
}

export * from "@prisma/client";
export * from "./jobs";
export * from "./workKey";
