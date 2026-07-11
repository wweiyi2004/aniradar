import { PrismaClient } from "@prisma/client";
import { deprecatedSourceUrls, seedSources } from "./seedSources";

const prisma = new PrismaClient();

async function main() {
  for (const url of deprecatedSourceUrls) {
    await prisma.source.deleteMany({ where: { url } });
  }

  for (const s of seedSources) {
    const exists = await prisma.source.findFirst({ where: { url: s.url } });
    if (exists) {
      // 幂等：已存在则更新元数据（不动抓取状态字段如 etag/lastSeenHash）
      await prisma.source.update({
        where: { id: exists.id },
        data: {
          name: s.name,
          type: s.type,
          level: s.level,
          fetchStrategy: s.fetchStrategy,
          fetchIntervalSec: s.fetchIntervalSec,
          selectorConfig: s.selectorConfig,
        },
      });
    } else {
      await prisma.source.create({ data: s });
    }
  }
  console.log("seed done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
