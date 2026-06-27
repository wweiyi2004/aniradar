import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// 全部为实测可达、返回有效 XML 的真实源（2026-06 验证）。
const sources: Prisma.SourceCreateInput[] = [
  {
    name: "アニメ！アニメ！",
    url: "https://animeanime.jp/rss/index.rdf",
    type: "media",
    level: "A",
    fetchStrategy: "rss",
    fetchIntervalSec: 600,
  },
  {
    name: "コミックナタリー",
    url: "https://natalie.mu/comic/feed/news",
    type: "media",
    level: "A",
    fetchStrategy: "rss",
    fetchIntervalSec: 600,
  },
  {
    name: "映画ナタリー",
    url: "https://natalie.mu/eiga/feed/news",
    type: "media",
    level: "B",
    fetchStrategy: "rss",
    fetchIntervalSec: 900,
  },
  {
    name: "音楽ナタリー",
    url: "https://natalie.mu/music/feed/news",
    type: "media",
    level: "B",
    fetchStrategy: "rss",
    fetchIntervalSec: 900,
  },
  {
    name: "アニプレックス YouTube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCp6993wxpyDPHUpavwDFqgg",
    type: "youtube_rss",
    level: "S",
    fetchStrategy: "youtube_rss",
    fetchIntervalSec: 900,
  },
  {
    // 映画.com アニメ News：服务端渲染列表页，selector 已实测可抽 20 条
    name: "映画.com アニメ (HTML)",
    url: "https://anime.eiga.com/news/",
    type: "media",
    level: "B",
    fetchStrategy: "html_list",
    fetchIntervalSec: 1800,
    selectorConfig: {
      listItem: "li.clearfix",
      title: ".boxTtl",
      url: ".boxTtl a",
      date: ".boxDate span",
      summary: ".boxText",
    },
  },
];

// 早期占位/被反爬拦截的源，重新 seed 时清理掉。
const deprecatedUrls = [
  "https://www.animenewsnetwork.com/all/rss.xml",
  "https://example.com/news/",
  "https://example.com/ir/",
];

async function main() {
  for (const url of deprecatedUrls) {
    await prisma.source.deleteMany({ where: { url } });
  }

  for (const s of sources) {
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
