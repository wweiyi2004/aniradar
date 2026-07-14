import { configureDatabase, prisma } from "../src/index";
import { deprecatedSourceUrls, seedSources } from "./seedSources";

async function main() {
  await configureDatabase();
  for (const url of deprecatedSourceUrls) {
    await prisma.source.deleteMany({ where: { url } });
  }

  for (const s of seedSources) {
    // url 唯一：按 url upsert，已存在则更新元数据（不动 etag/lastSeenHash）
    await prisma.source.upsert({
      where: { url: s.url },
      create: s,
      update: {
        name: s.name,
        type: s.type,
        level: s.level,
        fetchStrategy: s.fetchStrategy,
        fetchIntervalSec: s.fetchIntervalSec,
        selectorConfig: s.selectorConfig,
      },
    });
  }
  console.log("seed done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
