/** RSS 2.0 XML 构建(纯函数,便于测试)。内容来自抓取数据,输出前统一转义。 */

export interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: Date;
  category?: string;
}

export interface RssChannel {
  title: string;
  /** 频道对应的站内页面 */
  link: string;
  /** feed 自身地址(atom:link rel=self) */
  feedUrl: string;
  description: string;
  language?: string;
  lastBuildDate?: Date;
  items: RssItem[];
}

/** 去掉 XML 1.0 不允许的控制字符(保留 \t \n \r),抓取标题偶见。 */
function stripIllegalXmlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    const illegal = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    if (!illegal) out += ch;
  }
  return out;
}

/** 先滤非法控制字符,再转义五个 XML 实体。 */
export function escapeXml(value: string): string {
  return stripIllegalXmlChars(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssXml(channel: RssChannel): string {
  const items = channel.items
    .map((item) => {
      const lines = [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(item.link)}</guid>`,
      ];
      if (item.pubDate) {
        lines.push(`      <pubDate>${item.pubDate.toUTCString()}</pubDate>`);
      }
      if (item.category) {
        lines.push(`      <category>${escapeXml(item.category)}</category>`);
      }
      if (item.description) {
        lines.push(
          `      <description>${escapeXml(item.description)}</description>`,
        );
      }
      lines.push("    </item>");
      return lines.join("\n");
    })
    .join("\n");

  const head = [
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.link)}</link>`,
    `    <atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml"/>`,
    `    <description>${escapeXml(channel.description)}</description>`,
  ];
  if (channel.language) {
    head.push(`    <language>${escapeXml(channel.language)}</language>`);
  }
  if (channel.lastBuildDate) {
    head.push(
      `    <lastBuildDate>${channel.lastBuildDate.toUTCString()}</lastBuildDate>`,
    );
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    head.join("\n"),
    items,
    `  </channel>`,
    `</rss>`,
  ]
    .filter((part) => part !== "")
    .join("\n");
}
