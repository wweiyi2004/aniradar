import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

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
    name: "Anime News Network",
    url: "https://www.animenewsnetwork.com/all/rss.xml",
    type: "media",
    level: "A",
    fetchStrategy: "rss",
    fetchIntervalSec: 600,
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
    name: "示例官网 News(HtmlList)",
    url: "https://example.com/news/",
    type: "official_news",
    level: "A",
    fetchStrategy: "html_list",
    fetchIntervalSec: 1800,
    selectorConfig: {
      listItem: ".news-list li",
      title: ".title",
      url: "a",
      date: ".date",
      summary: ".summary",
    },
  },
  {
    name: "示例公司公告(PageDiff)",
    url: "https://example.com/ir/",
    type: "company_news",
    level: "B",
    fetchStrategy: "page_diff",
    fetchIntervalSec: 3600,
  },
];

async function main() {
  for (const s of sources) {
    const exists = await prisma.source.findFirst({ where: { url: s.url } });
    if (exists) continue;
    await prisma.source.create({ data: s });
  }
  console.log("seed done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
