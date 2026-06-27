# AniRadar MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可运行的动漫新情报雷达 MVP：管理员加源 → 定时抓取 → 去重生成 Signal → AI mock 分类 → 生成 Event → 首页按首次发现时间展示，后台可管理与手动触发。

**Architecture:** pnpm workspace monorepo。`apps/worker` 跑 BullMQ scheduler + fetch + classify 三类处理；`apps/web` 跑 Next.js 前后台并提供入队 API；8 个 packages 单一职责，经类型接口通信。Postgres + Redis 用 Docker Compose。

**Tech Stack:** Next.js (App Router) · TypeScript · TailwindCSS · shadcn/ui · Prisma · PostgreSQL · Redis · BullMQ · Cheerio · rss-parser · vitest · pnpm workspace · Docker Compose。

## Global Constraints

- 包管理一律 pnpm workspace；Node ≥ 20（本机 v24）。
- 所有 git 提交不带任何协作者署名（不加 `Co-Authored-By`）。
- TypeScript strict 模式；ESM (`"type": "module"`) 全仓统一。
- 不接真实大模型 API；`packages/ai` 仅规则 mock，但保留 `classify`/`summarize` 稳定签名。
- 不接 X API、不爬 X、无用户系统、无评论、无评分。
- 抓取不使用 Playwright；HTML 用 Cheerio。
- 每次抓取必须写一条 FetchLog；失败要 `Source.failureCount++`。
- 测试用 vitest；核心纯逻辑（parser/detector/ai）必须有单测。
- 内部包通过 workspace 引用：`"@aniradar/db": "workspace:*"` 等，包名前缀 `@aniradar/`。

---

## File Structure

```
aniradar/
├─ package.json                     # 根，scripts + devDeps（typescript, vitest, prettier）
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ docker-compose.yml               # postgres + redis
├─ .env.example
├─ README.md
├─ packages/
│  ├─ shared/    src/index.ts        # 枚举/类型/常量
│  ├─ config/    src/index.ts        # env + redis 连接 + 队列名
│  ├─ db/        prisma/schema.prisma, prisma/seed.ts, src/index.ts
│  ├─ parser/    src/{rss,youtube,html}.ts, src/index.ts, tests/*
│  ├─ crawler/   src/index.ts        # fetchUrl
│  ├─ sources/   src/{types,rss,youtube,htmlList,pageDiff,registry}.ts, tests/*
│  ├─ detector/  src/{hash,event}.ts, src/index.ts, tests/*
│  └─ ai/        src/{classify,summarize}.ts, src/index.ts, tests/*
├─ apps/
│  ├─ worker/    src/{index,queues,scheduler,processFetch,processClassify}.ts
│  └─ web/       app/..., components/..., lib/...
```

---

## Task 1: Monorepo 骨架

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `docker-compose.yml`, `.env.example`, `vitest.config.ts`

**Interfaces:**
- Produces: workspace 根配置；后续所有包用 `@aniradar/*` 名称、`workspace:*` 互引。

- [ ] **Step 1: 根 package.json**

```json
{
  "name": "aniradar",
  "private": true,
  "type": "module",
  "scripts": {
    "db:generate": "pnpm --filter @aniradar/db generate",
    "db:migrate": "pnpm --filter @aniradar/db migrate",
    "db:seed": "pnpm --filter @aniradar/db seed",
    "dev:web": "pnpm --filter @aniradar/web dev",
    "dev:worker": "pnpm --filter @aniradar/worker dev",
    "build": "pnpm -r build",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0",
    "prettier": "^3.3.0",
    "@types/node": "^22.0.0"
  },
  "packageManager": "pnpm@11.5.2"
}
```

- [ ] **Step 2: pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 3: tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "composite": false,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 4: docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: aniradar
      POSTGRES_PASSWORD: aniradar
      POSTGRES_DB: aniradar
    ports: ["5432:5432"]
    volumes: ["aniradar_pg:/var/lib/postgresql/data"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["aniradar_redis:/data"]
volumes:
  aniradar_pg:
  aniradar_redis:
```

- [ ] **Step 5: .env.example**

```
DATABASE_URL="postgresql://aniradar:aniradar@localhost:5432/aniradar?schema=public"
REDIS_URL="redis://localhost:6379"
SCHEDULER_INTERVAL_MS=30000
CRAWLER_USER_AGENT="AniRadarBot/0.1 (+https://example.com)"
CRAWLER_TIMEOUT_MS=15000
```

- [ ] **Step 6: vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["packages/**/tests/**/*.test.ts"] } });
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: monorepo 骨架与基础配置"
```

---

## Task 2: packages/shared（枚举与类型）

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`

**Interfaces:**
- Produces: 全仓共享枚举/常量与 `FetchedItem`/`FetchResult`/`ClassifyResult` 类型。供 sources/detector/ai/worker/web 引用。

- [ ] **Step 1: package.json**

```json
{
  "name": "@aniradar/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: src/index.ts**

```ts
export const SOURCE_TYPES = ["official_news","youtube_rss","press","media","company_news","publisher_news"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_LEVELS = ["S","A","B","C"] as const;
export type SourceLevel = (typeof SOURCE_LEVELS)[number];

export const FETCH_STRATEGIES = ["rss","youtube_rss","html_list","page_diff"] as const;
export type FetchStrategy = (typeof FETCH_STRATEGIES)[number];

export const PUBLISHED_TIME_PRECISION = ["datetime","date_only","unknown"] as const;
export type PublishedTimePrecision = (typeof PUBLISHED_TIME_PRECISION)[number];

export const SIGNAL_STATUS = ["raw","classified","ignored","merged","failed"] as const;
export type SignalStatus = (typeof SIGNAL_STATUS)[number];

export const EVENT_CATEGORIES = ["anime_adaptation","sequel_announced","pv_released","key_visual_released","cast_announced","staff_announced","broadcast_date_announced","delay_announced","movie_announced","theme_song_announced","event_info","merch_release","bd_release","other"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_STATUS = ["draft_ai","auto_published","published","needs_review","ignored","merged","retracted"] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];

export const FETCHLOG_STATUS = ["success","failed","skipped"] as const;
export type FetchLogStatus = (typeof FETCHLOG_STATUS)[number];

export interface FetchedItem {
  title: string;
  url: string;
  rawText?: string;
  summary?: string;
  publishedAt?: Date;
  publishedTimePrecision: PublishedTimePrecision;
  externalId?: string;
}

export interface FetchResult {
  items: FetchedItem[];
  etag?: string;
  lastModified?: string;
  notModified?: boolean;
}

export interface ClassifyResult {
  isAnimeNews: boolean;
  category: EventCategory;
  confidence: number; // 0..1
}

export const QUEUE_FETCH = "fetch-source";
export const QUEUE_CLASSIFY = "classify-signal";
export interface FetchJobData { sourceId: string; }
export interface ClassifyJobData { signalId: string; }
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared && git commit -m "feat(shared): 共享枚举与类型"
```

---

## Task 3: packages/config

**Files:**
- Create: `packages/config/package.json`, `packages/config/tsconfig.json`, `packages/config/src/index.ts`

**Interfaces:**
- Consumes: 环境变量。
- Produces: `env`（已校验配置对象）、`redisConnection`（BullMQ 用 `{host,port}` 或 url）。

- [ ] **Step 1: package.json**

```json
{
  "name": "@aniradar/config",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: src/index.ts**

```ts
function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env ${name}`);
  return v;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  schedulerIntervalMs: Number(process.env.SCHEDULER_INTERVAL_MS ?? 30000),
  userAgent: process.env.CRAWLER_USER_AGENT ?? "AniRadarBot/0.1",
  crawlerTimeoutMs: Number(process.env.CRAWLER_TIMEOUT_MS ?? 15000),
};

export const redisConnection = (() => {
  const u = new URL(env.redisUrl);
  return { host: u.hostname, port: Number(u.port || 6379) };
})();
```

- [ ] **Step 4: Commit**

```bash
git add packages/config && git commit -m "feat(config): env 与 redis 配置"
```

---

## Task 4: packages/db（Prisma schema + client + seed）

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/prisma/schema.prisma`, `packages/db/src/index.ts`, `packages/db/prisma/seed.ts`

**Interfaces:**
- Consumes: `DATABASE_URL`。
- Produces: `prisma`（PrismaClient 单例）；导出 `Prisma` 命名空间与所有模型类型。

- [ ] **Step 1: package.json**

```json
{
  "name": "@aniradar/db",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev --name init",
    "seed": "tsx prisma/seed.ts",
    "studio": "prisma studio"
  },
  "dependencies": { "@prisma/client": "^5.20.0" },
  "devDependencies": { "prisma": "^5.20.0", "tsx": "^4.19.0" }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "prisma"] }
```

- [ ] **Step 3: prisma/schema.prisma**

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum SourceType { official_news youtube_rss press media company_news publisher_news }
enum SourceLevel { S A B C }
enum FetchStrategy { rss youtube_rss html_list page_diff }
enum PublishedTimePrecision { datetime date_only unknown }
enum SignalStatus { raw classified ignored merged failed }
enum EventCategory { anime_adaptation sequel_announced pv_released key_visual_released cast_announced staff_announced broadcast_date_announced delay_announced movie_announced theme_song_announced event_info merch_release bd_release other }
enum EventStatus { draft_ai auto_published published needs_review ignored merged retracted }
enum FetchLogStatus { success failed skipped }

model Source {
  id              String        @id @default(cuid())
  name            String
  url             String
  type            SourceType
  level           SourceLevel   @default(B)
  fetchStrategy   FetchStrategy
  enabled         Boolean       @default(true)
  fetchIntervalSec Int          @default(900)
  lastCheckedAt   DateTime?
  lastSuccessAt   DateTime?
  failureCount    Int           @default(0)
  etag            String?
  lastModified    String?
  lastSeenHash    String?
  selectorConfig  Json?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  signals         Signal[]
  fetchLogs       FetchLog[]
}

model Signal {
  id                     String   @id @default(cuid())
  sourceId               String
  source                 Source   @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  title                  String
  url                    String
  rawText                String?
  summary                String?
  publishedAt            DateTime?
  publishedTimePrecision PublishedTimePrecision @default(unknown)
  firstSeenAt            DateTime @default(now())
  hash                   String   @unique
  language               String?
  status                 SignalStatus @default(raw)
  eventId                String?
  event                  Event?   @relation(fields: [eventId], references: [id])
  createdAt              DateTime @default(now())
  @@index([sourceId])
  @@index([status])
}

model Event {
  id               String   @id @default(cuid())
  title            String
  titleZh          String?
  summaryZh        String?
  category         EventCategory
  firstSeenAt      DateTime @default(now())
  confidence       Float    @default(0)
  heatScore        Float    @default(0)
  officialConfirmed Boolean @default(false)
  status           EventStatus @default(draft_ai)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  signals          Signal[]
  @@index([status])
  @@index([category])
  @@index([firstSeenAt])
}

model FetchLog {
  id           String   @id @default(cuid())
  sourceId     String
  source       Source   @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  status       FetchLogStatus
  message      String?
  fetchedCount Int      @default(0)
  newCount     Int      @default(0)
  startedAt    DateTime @default(now())
  endedAt      DateTime?
  @@index([sourceId])
}
```

- [ ] **Step 4: src/index.ts（client 单例）**

```ts
import { PrismaClient } from "@prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
export * from "@prisma/client";
```

- [ ] **Step 5: prisma/seed.ts**

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const sources = [
  { name: "アニメ！アニメ！", url: "https://animeanime.jp/rss/index.rdf", type: "media", level: "A", fetchStrategy: "rss", fetchIntervalSec: 600 },
  { name: "Anime News Network", url: "https://www.animenewsnetwork.com/all/rss.xml", type: "media", level: "A", fetchStrategy: "rss", fetchIntervalSec: 600 },
  { name: "アニプレックス YouTube", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCp6993wxpyDPHUpavwDFqgg", type: "youtube_rss", level: "S", fetchStrategy: "youtube_rss", fetchIntervalSec: 900 },
  { name: "示例官网 News(HtmlList)", url: "https://example.com/news/", type: "official_news", level: "A", fetchStrategy: "html_list", fetchIntervalSec: 1800,
    selectorConfig: { listItem: ".news-list li", title: ".title", url: "a", date: ".date", summary: ".summary" } },
  { name: "示例公司公告(PageDiff)", url: "https://example.com/ir/", type: "company_news", level: "B", fetchStrategy: "page_diff", fetchIntervalSec: 3600 },
] as const;

async function main() {
  for (const s of sources) {
    const exists = await prisma.source.findFirst({ where: { url: s.url } });
    if (exists) continue;
    await prisma.source.create({ data: s as any });
  }
  console.log("seed done");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

- [ ] **Step 6: 生成 client + 起 DB + migrate + seed**

```bash
cp .env.example .env
docker compose up -d postgres redis
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```
Expected: migrate 成功创建表；seed 打印 `seed done`。

- [ ] **Step 7: Commit**

```bash
git add packages/db && git commit -m "feat(db): Prisma schema、client 单例与 seed"
```

---

## Task 5: packages/parser（RSS / YouTube / HTML 纯解析）+ 单测

**Files:**
- Create: `packages/parser/package.json`, `tsconfig.json`, `src/{rss,youtube,html}.ts`, `src/index.ts`
- Test: `packages/parser/tests/{rss,youtube,html}.test.ts`, `packages/parser/tests/fixtures/*`

**Interfaces:**
- Consumes: `FetchedItem` from `@aniradar/shared`。
- Produces:
  - `parseRss(xml: string): FetchedItem[]`
  - `parseYouTubeRss(xml: string): FetchedItem[]`（含 videoId externalId）
  - `parseHtmlList(html: string, cfg: SelectorConfig, baseUrl: string): FetchedItem[]`
  - `type SelectorConfig = { listItem: string; title: string; url: string; date?: string; summary?: string }`

- [ ] **Step 1: package.json**

```json
{
  "name": "@aniradar/parser",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@aniradar/shared": "workspace:*",
    "rss-parser": "^3.13.0",
    "cheerio": "^1.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "tests"] }
```

- [ ] **Step 3: 写失败测试 tests/rss.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { parseRss } from "../src/rss";

const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>アニメ化決定！</title><link>https://ex.com/a</link><pubDate>Wed, 24 Jun 2026 10:00:00 +0900</pubDate><description>本文スニペット</description></item>
</channel></rss>`;

describe("parseRss", () => {
  it("解析 title/link/pubDate/summary", async () => {
    const items = await parseRss(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("アニメ化決定！");
    expect(items[0].url).toBe("https://ex.com/a");
    expect(items[0].publishedTimePrecision).toBe("datetime");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-06-24T01:00:00.000Z");
  });
});
```

- [ ] **Step 4: 运行确认失败**

Run: `pnpm vitest run packages/parser/tests/rss.test.ts`
Expected: FAIL（模块/函数不存在）。

- [ ] **Step 5: src/rss.ts**

```ts
import Parser from "rss-parser";
import type { FetchedItem } from "@aniradar/shared";

const parser = new Parser();

export async function parseRss(xml: string): Promise<FetchedItem[]> {
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).flatMap((it) => {
    const url = (it.link ?? "").trim();
    const title = (it.title ?? "").trim();
    if (!url || !title) return [];
    const pub = it.isoDate ?? it.pubDate;
    const d = pub ? new Date(pub) : undefined;
    return [{
      title,
      url,
      summary: (it.contentSnippet ?? it.content ?? "").trim() || undefined,
      rawText: (it.content ?? it.contentSnippet ?? "").trim() || undefined,
      publishedAt: d && !isNaN(d.getTime()) ? d : undefined,
      publishedTimePrecision: d && !isNaN(d.getTime()) ? "datetime" : "unknown",
    }];
  });
}
```

- [ ] **Step 6: src/youtube.ts**

```ts
import Parser from "rss-parser";
import type { FetchedItem } from "@aniradar/shared";

const parser = new Parser({
  customFields: { item: [["yt:videoId", "videoId"], ["media:group", "mediaGroup"]] },
});

export async function parseYouTubeRss(xml: string): Promise<FetchedItem[]> {
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).flatMap((it: any) => {
    const url = (it.link ?? "").trim();
    const title = (it.title ?? "").trim();
    if (!url || !title) return [];
    const d = it.isoDate ? new Date(it.isoDate) : undefined;
    return [{
      title, url,
      externalId: it.videoId,
      publishedAt: d && !isNaN(d.getTime()) ? d : undefined,
      publishedTimePrecision: d && !isNaN(d.getTime()) ? "datetime" : "unknown",
    }];
  });
}

export const YT_KEYWORDS = ["PV","ティザー","本PV","特報","予告","CM","ノンクレジットOP","ノンクレジットED","制作決定","放送決定"];
export function isRelevantYouTube(title: string): boolean {
  return YT_KEYWORDS.some((k) => title.includes(k));
}
```

- [ ] **Step 7: src/html.ts**

```ts
import * as cheerio from "cheerio";
import type { FetchedItem } from "@aniradar/shared";

export interface SelectorConfig {
  listItem: string; title: string; url: string; date?: string; summary?: string;
}

export function parseHtmlList(html: string, cfg: SelectorConfig, baseUrl: string): FetchedItem[] {
  const $ = cheerio.load(html);
  const out: FetchedItem[] = [];
  $(cfg.listItem).each((_, el) => {
    const node = $(el);
    const title = node.find(cfg.title).first().text().trim();
    const href = node.find(cfg.url).first().attr("href") ?? "";
    if (!title || !href) return;
    let url: string;
    try { url = new URL(href, baseUrl).toString(); } catch { return; }
    const dateText = cfg.date ? node.find(cfg.date).first().text().trim() : "";
    const d = dateText ? new Date(dateText) : undefined;
    out.push({
      title, url,
      summary: cfg.summary ? node.find(cfg.summary).first().text().trim() || undefined : undefined,
      publishedAt: d && !isNaN(d.getTime()) ? d : undefined,
      publishedTimePrecision: d && !isNaN(d.getTime()) ? "date_only" : "unknown",
    });
  });
  return out;
}
```

- [ ] **Step 8: src/index.ts**

```ts
export { parseRss } from "./rss";
export { parseYouTubeRss, isRelevantYouTube, YT_KEYWORDS } from "./youtube";
export { parseHtmlList } from "./html";
export type { SelectorConfig } from "./html";
```

- [ ] **Step 9: 写 youtube 与 html 测试**

`tests/youtube.test.ts`：
```ts
import { describe, it, expect } from "vitest";
import { parseYouTubeRss, isRelevantYouTube } from "../src/youtube";

const xml = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
<entry><yt:videoId>abc123</yt:videoId><title>本PV公開！</title>
<link rel="alternate" href="https://youtu.be/abc123"/><published>2026-06-24T10:00:00+00:00</published></entry>
</feed>`;

describe("parseYouTubeRss", () => {
  it("解析 videoId/title/link", async () => {
    const items = await parseYouTubeRss(xml);
    expect(items[0].externalId).toBe("abc123");
    expect(items[0].title).toBe("本PV公開！");
  });
  it("关键词过滤", () => {
    expect(isRelevantYouTube("本PV公開！")).toBe(true);
    expect(isRelevantYouTube("日常 vlog")).toBe(false);
  });
});
```

`tests/html.test.ts`：
```ts
import { describe, it, expect } from "vitest";
import { parseHtmlList } from "../src/html";

const html = `<ul class="news-list">
<li><span class="title">アニメ化決定</span><a href="/news/1">link</a><span class="date">2026-06-24</span><p class="summary">概要</p></li>
</ul>`;

describe("parseHtmlList", () => {
  it("按 selector 解析并补全相对链接", () => {
    const items = parseHtmlList(html, { listItem: ".news-list li", title: ".title", url: "a", date: ".date", summary: ".summary" }, "https://ex.com/news/");
    expect(items[0].title).toBe("アニメ化決定");
    expect(items[0].url).toBe("https://ex.com/news/1");
    expect(items[0].summary).toBe("概要");
  });
});
```

- [ ] **Step 10: 运行全部 parser 测试**

Run: `pnpm vitest run packages/parser`
Expected: PASS（5 个用例）。

- [ ] **Step 11: Commit**

```bash
git add packages/parser && git commit -m "feat(parser): RSS/YouTube/HTML 解析与单测"
```

---

## Task 6: packages/crawler（HTTP 抓取层）

**Files:**
- Create: `packages/crawler/package.json`, `tsconfig.json`, `src/index.ts`

**Interfaces:**
- Consumes: `env` from `@aniradar/config`。
- Produces: `fetchUrl(url, opts?): Promise<{ status:number; body:string; etag?:string; lastModified?:string; notModified:boolean }>`，`opts = { etag?, lastModified? }`。

- [ ] **Step 1: package.json**

```json
{
  "name": "@aniradar/crawler",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@aniradar/config": "workspace:*" }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: src/index.ts**

```ts
import { env } from "@aniradar/config";

export interface FetchUrlResult {
  status: number; body: string;
  etag?: string; lastModified?: string; notModified: boolean;
}

export async function fetchUrl(
  url: string,
  opts: { etag?: string; lastModified?: string } = {},
): Promise<FetchUrlResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.crawlerTimeoutMs);
  try {
    const headers: Record<string, string> = { "user-agent": env.userAgent };
    if (opts.etag) headers["if-none-match"] = opts.etag;
    if (opts.lastModified) headers["if-modified-since"] = opts.lastModified;
    const res = await fetch(url, { headers, signal: controller.signal, redirect: "follow" });
    if (res.status === 304) return { status: 304, body: "", notModified: true };
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const body = await res.text();
    return {
      status: res.status, body, notModified: false,
      etag: res.headers.get("etag") ?? undefined,
      lastModified: res.headers.get("last-modified") ?? undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/crawler && git commit -m "feat(crawler): 条件请求 HTTP 抓取层"
```

---

## Task 7: packages/sources（Adapter 接口 + 4 实现）+ 单测

**Files:**
- Create: `packages/sources/package.json`, `tsconfig.json`, `src/{types,rss,youtube,htmlList,pageDiff,registry}.ts`, `src/index.ts`
- Test: `packages/sources/tests/youtube.test.ts`（关键词过滤行为）

**Interfaces:**
- Consumes: `fetchUrl`、parser 函数、`FetchResult`/`FetchedItem`、Prisma `Source` 类型。
- Produces:
  - `interface SourceAdapter { fetch(source: SourceLike): Promise<FetchResult> }`
  - `type SourceLike`（fetch 所需字段子集：url, fetchStrategy, etag, lastModified, lastSeenHash, selectorConfig）
  - `getAdapter(strategy: FetchStrategy): SourceAdapter`

- [ ] **Step 1: package.json**

```json
{
  "name": "@aniradar/sources",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@aniradar/shared": "workspace:*",
    "@aniradar/crawler": "workspace:*",
    "@aniradar/parser": "workspace:*",
    "@aniradar/detector": "workspace:*"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "tests"] }
```

- [ ] **Step 3: src/types.ts**

```ts
import type { FetchResult, FetchStrategy } from "@aniradar/shared";
import type { SelectorConfig } from "@aniradar/parser";

export interface SourceLike {
  url: string;
  fetchStrategy: FetchStrategy;
  etag?: string | null;
  lastModified?: string | null;
  lastSeenHash?: string | null;
  selectorConfig?: unknown;
}

export interface SourceAdapter {
  fetch(source: SourceLike): Promise<FetchResult>;
}

export function asSelectorConfig(v: unknown): SelectorConfig {
  const c = (v ?? {}) as Partial<SelectorConfig>;
  if (!c.listItem || !c.title || !c.url) throw new Error("selectorConfig 缺少 listItem/title/url");
  return c as SelectorConfig;
}
```

- [ ] **Step 4: src/rss.ts**

```ts
import { fetchUrl } from "@aniradar/crawler";
import { parseRss } from "@aniradar/parser";
import type { SourceAdapter, SourceLike } from "./types";

export const RssAdapter: SourceAdapter = {
  async fetch(source: SourceLike) {
    const res = await fetchUrl(source.url, { etag: source.etag ?? undefined, lastModified: source.lastModified ?? undefined });
    if (res.notModified) return { items: [], notModified: true };
    const items = await parseRss(res.body);
    return { items, etag: res.etag, lastModified: res.lastModified };
  },
};
```

- [ ] **Step 5: src/youtube.ts**

```ts
import { fetchUrl } from "@aniradar/crawler";
import { parseYouTubeRss, isRelevantYouTube } from "@aniradar/parser";
import type { SourceAdapter, SourceLike } from "./types";

export const YouTubeRssAdapter: SourceAdapter = {
  async fetch(source: SourceLike) {
    const res = await fetchUrl(source.url, { etag: source.etag ?? undefined, lastModified: source.lastModified ?? undefined });
    if (res.notModified) return { items: [], notModified: true };
    const all = await parseYouTubeRss(res.body);
    return { items: all.filter((i) => isRelevantYouTube(i.title)), etag: res.etag, lastModified: res.lastModified };
  },
};
```

- [ ] **Step 6: src/htmlList.ts**

```ts
import { fetchUrl } from "@aniradar/crawler";
import { parseHtmlList } from "@aniradar/parser";
import { computeContentHash } from "@aniradar/detector";
import type { SourceAdapter, SourceLike } from "./types";
import { asSelectorConfig } from "./types";

export const HtmlListAdapter: SourceAdapter = {
  async fetch(source: SourceLike) {
    const res = await fetchUrl(source.url);
    if (res.notModified) return { items: [], notModified: true };
    const cfg = asSelectorConfig(source.selectorConfig);
    const items = parseHtmlList(res.body, cfg, source.url);
    const listHash = computeContentHash(items.map((i) => i.url).join("|"));
    if (source.lastSeenHash && source.lastSeenHash === listHash) {
      return { items: [], notModified: true };
    }
    return { items, lastModified: listHash };
  },
};
```
注：`htmlList` 把列表指纹放在 `FetchResult.lastModified` 字段回传，worker 落库时写入 `Source.lastSeenHash`（见 Task 10）。

- [ ] **Step 7: src/pageDiff.ts**

```ts
import { fetchUrl } from "@aniradar/crawler";
import { computeContentHash } from "@aniradar/detector";
import type { SourceAdapter, SourceLike } from "./types";

export const PageDiffAdapter: SourceAdapter = {
  async fetch(source: SourceLike) {
    const res = await fetchUrl(source.url);
    if (res.notModified) return { items: [], notModified: true };
    const text = res.body.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const hash = computeContentHash(text);
    if (source.lastSeenHash && source.lastSeenHash === hash) {
      return { items: [], notModified: true };
    }
    return {
      items: [{
        title: `页面更新: ${source.url}`,
        url: source.url,
        rawText: text.slice(0, 2000),
        publishedTimePrecision: "unknown" as const,
      }],
      lastModified: hash,
    };
  },
};
```

- [ ] **Step 8: src/registry.ts + src/index.ts**

`registry.ts`：
```ts
import type { FetchStrategy } from "@aniradar/shared";
import type { SourceAdapter } from "./types";
import { RssAdapter } from "./rss";
import { YouTubeRssAdapter } from "./youtube";
import { HtmlListAdapter } from "./htmlList";
import { PageDiffAdapter } from "./pageDiff";

const map: Record<FetchStrategy, SourceAdapter> = {
  rss: RssAdapter,
  youtube_rss: YouTubeRssAdapter,
  html_list: HtmlListAdapter,
  page_diff: PageDiffAdapter,
};

export function getAdapter(strategy: FetchStrategy): SourceAdapter {
  const a = map[strategy];
  if (!a) throw new Error(`No adapter for strategy ${strategy}`);
  return a;
}
```

`index.ts`：
```ts
export * from "./types";
export { getAdapter } from "./registry";
export { RssAdapter } from "./rss";
export { YouTubeRssAdapter } from "./youtube";
export { HtmlListAdapter } from "./htmlList";
export { PageDiffAdapter } from "./pageDiff";
```

- [ ] **Step 9: 测试 tests/youtube.test.ts（仅验证过滤逻辑，已在 parser 覆盖网络；这里冒烟 registry）**

```ts
import { describe, it, expect } from "vitest";
import { getAdapter } from "../src/registry";

describe("getAdapter", () => {
  it("按 strategy 返回 adapter", () => {
    expect(getAdapter("rss")).toBeDefined();
    expect(getAdapter("youtube_rss")).toBeDefined();
    expect(getAdapter("html_list")).toBeDefined();
    expect(getAdapter("page_diff")).toBeDefined();
  });
});
```

- [ ] **Step 10: 运行测试**

Run: `pnpm vitest run packages/sources`
Expected: PASS。（注意：本任务依赖 Task 8 的 `computeContentHash`，故实际实现顺序为 Task 8 先于本任务的 Step 6/7；如先做本任务，请先完成 Task 8。）

- [ ] **Step 11: Commit**

```bash
git add packages/sources && git commit -m "feat(sources): SourceAdapter 接口与 4 个实现"
```

---

## Task 8: packages/detector（hash / 去重 / Event 生成）+ 单测

> 实现顺序提示：本任务的 `computeContentHash` 被 Task 7 的 htmlList/pageDiff 引用，建议先做本任务再做 Task 7 的 Step 6-7。

**Files:**
- Create: `packages/detector/package.json`, `tsconfig.json`, `src/{hash,event}.ts`, `src/index.ts`
- Test: `packages/detector/tests/hash.test.ts`

**Interfaces:**
- Consumes: `FetchedItem`、`EventCategory`。
- Produces:
  - `computeSignalHash(sourceId: string, item: { url:string; title:string }): string`
  - `computeContentHash(text: string): string`
  - `normalizeUrl(url: string): string`
  - `buildEventFromSignal(input): { title; category; firstSeenAt; confidence; status }`（决定 draft_ai / auto_published）

- [ ] **Step 1: package.json**

```json
{
  "name": "@aniradar/detector",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@aniradar/shared": "workspace:*" }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "tests"] }
```

- [ ] **Step 3: 写失败测试 tests/hash.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { computeSignalHash, normalizeUrl } from "../src/hash";

describe("normalizeUrl", () => {
  it("去除追踪参数与末尾斜杠、小写域名", () => {
    expect(normalizeUrl("https://EX.com/a/?utm_source=x&id=1"))
      .toBe("https://ex.com/a?id=1");
  });
});

describe("computeSignalHash", () => {
  it("同源同 url 同 title 稳定且去查询追踪后一致", () => {
    const a = computeSignalHash("s1", { url: "https://ex.com/a?utm_source=x", title: " アニメ化 " });
    const b = computeSignalHash("s1", { url: "https://ex.com/a", title: "アニメ化" });
    expect(a).toBe(b);
  });
  it("不同源不同 hash", () => {
    const a = computeSignalHash("s1", { url: "https://ex.com/a", title: "t" });
    const b = computeSignalHash("s2", { url: "https://ex.com/a", title: "t" });
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 4: 运行确认失败**

Run: `pnpm vitest run packages/detector`
Expected: FAIL。

- [ ] **Step 5: src/hash.ts**

```ts
import { createHash } from "node:crypto";

const TRACKING = /^(utm_|fbclid|gclid|ref|spm)/i;

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hostname = u.hostname.toLowerCase();
    const keep = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k));
    u.search = "";
    for (const [k, v] of keep) u.searchParams.append(k, v);
    let s = u.toString();
    s = s.replace(/\/(?=$|\?)/, ""); // 去末尾斜杠
    return s;
  } catch {
    return raw.trim();
  }
}

export function computeSignalHash(sourceId: string, item: { url: string; title: string }): string {
  const key = `${sourceId}|${normalizeUrl(item.url)}|${item.title.trim()}`;
  return createHash("sha256").update(key).digest("hex");
}

export function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
```

- [ ] **Step 6: src/event.ts**

```ts
import type { EventCategory, EventStatus, SourceType } from "@aniradar/shared";

export interface BuildEventInput {
  title: string;
  category: EventCategory;
  confidence: number;
  firstSeenAt: Date;
  sourceType: SourceType;
}

export interface BuiltEvent {
  title: string;
  category: EventCategory;
  confidence: number;
  firstSeenAt: Date;
  officialConfirmed: boolean;
  status: EventStatus;
}

const AUTO_PUBLISH_TYPES: SourceType[] = ["official_news", "youtube_rss"];

export function buildEventFromSignal(input: BuildEventInput): BuiltEvent {
  const official = input.sourceType === "official_news" || input.sourceType === "youtube_rss";
  const autoPublish = AUTO_PUBLISH_TYPES.includes(input.sourceType) && input.confidence >= 0.9;
  return {
    title: input.title,
    category: input.category,
    confidence: input.confidence,
    firstSeenAt: input.firstSeenAt,
    officialConfirmed: official,
    status: autoPublish ? "auto_published" : "draft_ai",
  };
}
```

- [ ] **Step 7: src/index.ts**

```ts
export { normalizeUrl, computeSignalHash, computeContentHash } from "./hash";
export { buildEventFromSignal } from "./event";
export type { BuildEventInput, BuiltEvent } from "./event";
```

- [ ] **Step 8: 运行测试**

Run: `pnpm vitest run packages/detector`
Expected: PASS。

- [ ] **Step 9: Commit**

```bash
git add packages/detector && git commit -m "feat(detector): hash 去重与 Event 生成规则"
```

---

## Task 9: packages/ai（规则 mock classify + summarize）+ 单测

**Files:**
- Create: `packages/ai/package.json`, `tsconfig.json`, `src/{classify,summarize}.ts`, `src/index.ts`
- Test: `packages/ai/tests/classify.test.ts`

**Interfaces:**
- Consumes: `ClassifyResult`、`EventCategory`。
- Produces:
  - `classify(input: { title: string; summary?: string; rawText?: string }): ClassifyResult`
  - `summarize(input: { title: string; summary?: string }): { titleZh: string; summaryZh: string }`

- [ ] **Step 1: package.json**

```json
{
  "name": "@aniradar/ai",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@aniradar/shared": "workspace:*" }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "tests"] }
```

- [ ] **Step 3: 写失败测试 tests/classify.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { classify } from "../src/classify";

describe("classify", () => {
  it("アニメ化 → anime_adaptation", () => {
    const r = classify({ title: "人気漫画がアニメ化決定！" });
    expect(r.isAnimeNews).toBe(true);
    expect(r.category).toBe("anime_adaptation");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });
  it("第2期 → sequel_announced", () => {
    expect(classify({ title: "第2期制作決定" }).category).toBe("sequel_announced");
  });
  it("本PV → pv_released", () => {
    expect(classify({ title: "本PV公開" }).category).toBe("pv_released");
  });
  it("延期 → delay_announced 优先于 放送", () => {
    expect(classify({ title: "放送延期のお知らせ" }).category).toBe("delay_announced");
  });
  it("无关键词 → 非情报", () => {
    const r = classify({ title: "今日の日常ブログ" });
    expect(r.isAnimeNews).toBe(false);
  });
});
```

- [ ] **Step 4: 运行确认失败**

Run: `pnpm vitest run packages/ai`
Expected: FAIL。

- [ ] **Step 5: src/classify.ts**

```ts
import type { ClassifyResult, EventCategory } from "@aniradar/shared";

// 规则：按优先级匹配，先判定特殊类（延期、续期）再判定通用。
const RULES: { keywords: string[]; category: EventCategory; confidence: number }[] = [
  { keywords: ["放送延期", "延期"], category: "delay_announced", confidence: 0.92 },
  { keywords: ["第2期", "第二期", "続編", "2期"], category: "sequel_announced", confidence: 0.92 },
  { keywords: ["アニメ化", "制作決定", "新作アニメ"], category: "anime_adaptation", confidence: 0.93 },
  { keywords: ["劇場版", "映画化"], category: "movie_announced", confidence: 0.9 },
  { keywords: ["本PV", "ティザーPV", "ティザー", "特報", "予告", "PV公開", "PV"], category: "pv_released", confidence: 0.88 },
  { keywords: ["キービジュアル", "ビジュアル公開", "ビジュアル"], category: "key_visual_released", confidence: 0.85 },
  { keywords: ["キャスト解禁", "キャスト"], category: "cast_announced", confidence: 0.85 },
  { keywords: ["スタッフ解禁", "スタッフ"], category: "staff_announced", confidence: 0.82 },
  { keywords: ["放送開始", "放送決定", "配信決定", "放送"], category: "broadcast_date_announced", confidence: 0.85 },
  { keywords: ["主題歌", "OP", "ED"], category: "theme_song_announced", confidence: 0.8 },
];

export function classify(input: { title: string; summary?: string; rawText?: string }): ClassifyResult {
  const text = `${input.title}\n${input.summary ?? ""}\n${input.rawText ?? ""}`;
  for (const rule of RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      return { isAnimeNews: true, category: rule.category, confidence: rule.confidence };
    }
  }
  return { isAnimeNews: false, category: "other", confidence: 0.2 };
}
```

- [ ] **Step 6: src/summarize.ts**

```ts
export function summarize(input: { title: string; summary?: string }): { titleZh: string; summaryZh: string } {
  // 第一版 mock：不翻译，回填占位中文摘要，保留接口供后续接真实模型。
  const base = input.summary?.trim() || input.title.trim();
  return {
    titleZh: input.title.trim(),
    summaryZh: base.length > 120 ? base.slice(0, 120) + "…" : base,
  };
}
```

- [ ] **Step 7: src/index.ts**

```ts
export { classify } from "./classify";
export { summarize } from "./summarize";
```

- [ ] **Step 8: 运行测试**

Run: `pnpm vitest run packages/ai`
Expected: PASS。

- [ ] **Step 9: Commit**

```bash
git add packages/ai && git commit -m "feat(ai): 规则版 classify/summarize mock 与单测"
```

---

## Task 10: apps/worker（scheduler + fetch + classify 闭环）

**Files:**
- Create: `apps/worker/package.json`, `tsconfig.json`, `src/{index,queues,scheduler,processFetch,processClassify}.ts`

**Interfaces:**
- Consumes: `prisma`、`redisConnection`、`env`、`getAdapter`、`computeSignalHash`、`buildEventFromSignal`、`classify`、`summarize`、队列名/JobData 常量。
- Produces: 可运行 worker 进程（`pnpm dev:worker`），处理 `fetch-source` 与 `classify-signal`，并周期入队。

- [ ] **Step 1: package.json**

```json
{
  "name": "@aniradar/worker",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "dev": "tsx watch src/index.ts", "start": "tsx src/index.ts" },
  "dependencies": {
    "@aniradar/shared": "workspace:*",
    "@aniradar/config": "workspace:*",
    "@aniradar/db": "workspace:*",
    "@aniradar/sources": "workspace:*",
    "@aniradar/detector": "workspace:*",
    "@aniradar/ai": "workspace:*",
    "bullmq": "^5.21.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": { "tsx": "^4.19.0" }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: src/queues.ts**

```ts
import { Queue } from "bullmq";
import { redisConnection } from "@aniradar/config";
import { QUEUE_FETCH, QUEUE_CLASSIFY } from "@aniradar/shared";

export const fetchQueue = new Queue(QUEUE_FETCH, { connection: redisConnection });
export const classifyQueue = new Queue(QUEUE_CLASSIFY, { connection: redisConnection });
```

- [ ] **Step 4: src/processFetch.ts**

```ts
import { prisma } from "@aniradar/db";
import { getAdapter } from "@aniradar/sources";
import { computeSignalHash } from "@aniradar/detector";
import type { FetchJobData } from "@aniradar/shared";
import { classifyQueue } from "./queues";

export async function processFetch(data: FetchJobData): Promise<void> {
  const source = await prisma.source.findUnique({ where: { id: data.sourceId } });
  if (!source || !source.enabled) return;

  const log = await prisma.fetchLog.create({
    data: { sourceId: source.id, status: "skipped", startedAt: new Date() },
  });

  try {
    const adapter = getAdapter(source.fetchStrategy);
    const result = await adapter.fetch(source);

    if (result.notModified) {
      await prisma.source.update({ where: { id: source.id }, data: { lastCheckedAt: new Date(), lastSuccessAt: new Date() } });
      await prisma.fetchLog.update({ where: { id: log.id }, data: { status: "skipped", message: "not modified", endedAt: new Date() } });
      return;
    }

    let newCount = 0;
    for (const item of result.items) {
      const hash = computeSignalHash(source.id, item);
      try {
        const signal = await prisma.signal.create({
          data: {
            sourceId: source.id, title: item.title, url: item.url,
            rawText: item.rawText, summary: item.summary,
            publishedAt: item.publishedAt, publishedTimePrecision: item.publishedTimePrecision,
            hash, status: "raw",
          },
        });
        newCount++;
        await classifyQueue.add("classify", { signalId: signal.id });
      } catch (e: any) {
        if (e?.code === "P2002") continue; // 唯一约束=重复，跳过
        throw e;
      }
    }

    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(), lastSuccessAt: new Date(), failureCount: 0,
        etag: result.etag ?? source.etag,
        // htmlList/pageDiff 用 lastModified 回传内容指纹 → 写 lastSeenHash
        lastSeenHash: (source.fetchStrategy === "html_list" || source.fetchStrategy === "page_diff") ? (result.lastModified ?? source.lastSeenHash) : source.lastSeenHash,
        lastModified: (source.fetchStrategy === "rss" || source.fetchStrategy === "youtube_rss") ? (result.lastModified ?? source.lastModified) : source.lastModified,
      },
    });

    await prisma.fetchLog.update({
      where: { id: log.id },
      data: { status: "success", fetchedCount: result.items.length, newCount, endedAt: new Date() },
    });
  } catch (e: any) {
    await prisma.source.update({ where: { id: source.id }, data: { lastCheckedAt: new Date(), failureCount: { increment: 1 } } });
    await prisma.fetchLog.update({ where: { id: log.id }, data: { status: "failed", message: String(e?.message ?? e), endedAt: new Date() } });
  }
}
```

- [ ] **Step 5: src/processClassify.ts**

```ts
import { prisma } from "@aniradar/db";
import { classify, summarize } from "@aniradar/ai";
import { buildEventFromSignal } from "@aniradar/detector";
import type { ClassifyJobData } from "@aniradar/shared";

export async function processClassify(data: ClassifyJobData): Promise<void> {
  const signal = await prisma.signal.findUnique({ where: { id: data.signalId }, include: { source: true } });
  if (!signal) return;

  try {
    const result = classify({ title: signal.title, summary: signal.summary ?? undefined, rawText: signal.rawText ?? undefined });

    if (!result.isAnimeNews) {
      await prisma.signal.update({ where: { id: signal.id }, data: { status: "ignored" } });
      return;
    }

    const built = buildEventFromSignal({
      title: signal.title, category: result.category, confidence: result.confidence,
      firstSeenAt: signal.firstSeenAt, sourceType: signal.source.type,
    });
    const { titleZh, summaryZh } = summarize({ title: signal.title, summary: signal.summary ?? undefined });

    const event = await prisma.event.create({
      data: {
        title: built.title, titleZh, summaryZh, category: built.category,
        firstSeenAt: built.firstSeenAt, confidence: built.confidence,
        officialConfirmed: built.officialConfirmed, status: built.status, heatScore: 1,
      },
    });
    await prisma.signal.update({ where: { id: signal.id }, data: { status: "classified", eventId: event.id } });
  } catch (e) {
    await prisma.signal.update({ where: { id: signal.id }, data: { status: "failed" } });
  }
}
```

- [ ] **Step 6: src/scheduler.ts**

```ts
import { prisma } from "@aniradar/db";
import { env } from "@aniradar/config";
import { fetchQueue } from "./queues";

export async function tick(): Promise<void> {
  const now = Date.now();
  const sources = await prisma.source.findMany({ where: { enabled: true } });
  for (const s of sources) {
    const due = !s.lastCheckedAt || now - new Date(s.lastCheckedAt).getTime() >= s.fetchIntervalSec * 1000;
    if (due) await fetchQueue.add("fetch", { sourceId: s.id }, { removeOnComplete: 100, removeOnFail: 100 });
  }
}

export function startScheduler(): NodeJS.Timeout {
  tick().catch((e) => console.error("scheduler tick error", e));
  return setInterval(() => { tick().catch((e) => console.error("scheduler tick error", e)); }, env.schedulerIntervalMs);
}
```

- [ ] **Step 7: src/index.ts**

```ts
import "dotenv/config";
import { Worker } from "bullmq";
import { redisConnection } from "@aniradar/config";
import { QUEUE_FETCH, QUEUE_CLASSIFY } from "@aniradar/shared";
import { processFetch } from "./processFetch";
import { processClassify } from "./processClassify";
import { startScheduler } from "./scheduler";

const fetchWorker = new Worker(QUEUE_FETCH, async (job) => processFetch(job.data), { connection: redisConnection, concurrency: 4 });
const classifyWorker = new Worker(QUEUE_CLASSIFY, async (job) => processClassify(job.data), { connection: redisConnection, concurrency: 8 });

fetchWorker.on("failed", (j, e) => console.error("fetch failed", j?.id, e?.message));
classifyWorker.on("failed", (j, e) => console.error("classify failed", j?.id, e?.message));

const timer = startScheduler();
console.log("AniRadar worker started");

async function shutdown() { clearInterval(timer); await fetchWorker.close(); await classifyWorker.close(); process.exit(0); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

- [ ] **Step 8: 冒烟运行**

```bash
docker compose up -d
pnpm dev:worker
```
Expected: 打印 `AniRadar worker started`；约 30s 内对 seed 的两个公开 RSS 源产生 FetchLog 与 Signal（可在下一步用 web 或 prisma studio 验证）。Ctrl+C 退出。

- [ ] **Step 9: Commit**

```bash
git add apps/worker && git commit -m "feat(worker): scheduler + fetch + classify 抓取闭环"
```

---

## Task 11: apps/web 脚手架（Next.js + Tailwind + shadcn + 主题）

**Files:**
- Create: `apps/web/package.json`, `apps/web/next.config.mjs`, `apps/web/tsconfig.json`, `apps/web/postcss.config.mjs`, `apps/web/tailwind.config.ts`, `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`(占位), `apps/web/lib/utils.ts`, `apps/web/lib/queue.ts`, `apps/web/components/ui/*`(shadcn 基础), `apps/web/components/theme-provider.tsx`, `apps/web/components/site-header.tsx`

**Interfaces:**
- Consumes: `prisma`、`@aniradar/shared` 枚举、`redisConnection`/队列名（web 端入队用）。
- Produces: 可 `pnpm dev:web` 起的 Next.js 应用，深色模式 + 站点头部 + shadcn 基础组件（button/badge/card/table/input/select）。

- [ ] **Step 1: package.json**

```json
{
  "name": "@aniradar/web",
  "version": "0.0.0",
  "type": "module",
  "scripts": { "dev": "next dev -p 3000", "build": "next build", "start": "next start -p 3000" },
  "dependencies": {
    "@aniradar/db": "workspace:*",
    "@aniradar/shared": "workspace:*",
    "@aniradar/config": "workspace:*",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "bullmq": "^5.21.0",
    "next-themes": "^0.3.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "lucide-react": "^0.445.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/node": "^22.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "tailwindcss-animate": "^1.0.7"
  }
}
```

- [ ] **Step 2: next.config.mjs（transpile workspace 包）**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@aniradar/db", "@aniradar/shared", "@aniradar/config"],
  experimental: { serverComponentsExternalPackages: ["@prisma/client", "bullmq"] },
};
export default nextConfig;
```

- [ ] **Step 3: tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve", "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "plugins": [{ "name": "next" }], "paths": { "@/*": ["./*"] }, "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

- [ ] **Step 4: postcss + tailwind 配置**

`postcss.config.mjs`：
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`tailwind.config.ts`：
```ts
import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      border: "hsl(var(--border))", background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
      card: "hsl(var(--card))", muted: "hsl(var(--muted))", "muted-foreground": "hsl(var(--muted-foreground))",
      primary: "hsl(var(--primary))", "primary-foreground": "hsl(var(--primary-foreground))",
      accent: "hsl(var(--accent))",
    },
    borderRadius: { lg: "0.5rem", md: "0.375rem", sm: "0.25rem" },
  } },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

- [ ] **Step 5: app/globals.css（冷色雷达主题，深色优先）**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 210 40% 98%; --foreground: 222 47% 11%;
  --card: 0 0% 100%; --muted: 210 40% 96%; --muted-foreground: 215 16% 47%;
  --border: 214 32% 91%; --primary: 199 89% 48%; --primary-foreground: 0 0% 100%;
  --accent: 173 80% 40%;
}
.dark {
  --background: 222 47% 7%; --foreground: 210 40% 96%;
  --card: 222 40% 11%; --muted: 217 33% 17%; --muted-foreground: 215 20% 65%;
  --border: 217 33% 20%; --primary: 199 89% 55%; --primary-foreground: 222 47% 7%;
  --accent: 173 80% 45%;
}
* { border-color: hsl(var(--border)); }
body { background: hsl(var(--background)); color: hsl(var(--foreground)); }
```

- [ ] **Step 6: lib/utils.ts**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

- [ ] **Step 7: lib/queue.ts（web 端入队，复用同一 Redis）**

```ts
import { Queue } from "bullmq";
import { redisConnection } from "@aniradar/config";
import { QUEUE_FETCH } from "@aniradar/shared";
let q: Queue | null = null;
export function getFetchQueue(): Queue {
  if (!q) q = new Queue(QUEUE_FETCH, { connection: redisConnection });
  return q;
}
```

- [ ] **Step 8: shadcn 基础组件**（手写最小实现，避免 CLI 交互）

`components/ui/badge.tsx`：
```tsx
import { cn } from "@/lib/utils";
export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", className)} {...props} />;
}
```

`components/ui/card.tsx`：
```tsx
import { cn } from "@/lib/utils";
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border bg-[hsl(var(--card))] shadow-sm", className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pb-2", className)} {...p} />;
}
export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-2", className)} {...p} />;
}
```

`components/ui/button.tsx`：
```tsx
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
  { variants: {
      variant: {
        default: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90",
        outline: "border bg-transparent hover:bg-[hsl(var(--muted))]",
        ghost: "hover:bg-[hsl(var(--muted))]",
        destructive: "bg-red-600 text-white hover:bg-red-700",
      },
      size: { default: "h-9 px-4 py-2", sm: "h-8 px-3 text-xs" },
    }, defaultVariants: { variant: "default", size: "default" } },
);
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
export { buttonVariants };
```

`components/ui/table.tsx`、`input.tsx`、`select.tsx`（原生 `<table>/<input>/<select>` + cn 样式，最小实现，结构同上）。

- [ ] **Step 9: components/theme-provider.tsx + site-header.tsx**

`theme-provider.tsx`：
```tsx
"use client";
import { ThemeProvider as NextThemes } from "next-themes";
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <NextThemes attribute="class" defaultTheme="dark" enableSystem>{children}</NextThemes>;
}
```

`site-header.tsx`：
```tsx
import Link from "next/link";
import { Radar } from "lucide-react";
export function SiteHeader() {
  return (
    <header className="border-b sticky top-0 z-10 bg-[hsl(var(--background))]/80 backdrop-blur">
      <div className="mx-auto max-w-5xl flex items-center gap-6 px-4 h-14">
        <Link href="/" className="flex items-center gap-2 font-semibold"><Radar className="h-5 w-5 text-[hsl(var(--primary))]" />AniRadar</Link>
        <nav className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
          <Link href="/">情报流</Link>
          <Link href="/admin/sources">资讯源</Link>
          <Link href="/admin/signals">Signals</Link>
          <Link href="/admin/events">Events</Link>
          <Link href="/admin/fetch-logs">抓取日志</Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 10: app/layout.tsx + 占位 app/page.tsx**

`layout.tsx`：
```tsx
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
export const metadata = { title: "AniRadar", description: "动漫新情报雷达" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SiteHeader />
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

`page.tsx`（占位，Task 12 替换）：
```tsx
export default function Home() { return <div>AniRadar 情报流（待实现）</div>; }
```

- [ ] **Step 11: 起服务确认**

```bash
pnpm --filter @aniradar/web exec next telemetry disable || true
pnpm dev:web
```
Expected: http://localhost:3000 显示头部导航与占位文案，深色模式生效。

- [ ] **Step 12: Commit**

```bash
git add apps/web && git commit -m "feat(web): Next.js 脚手架、主题与 shadcn 基础组件"
```

---

## Task 12: 前台首页与事件详情

**Files:**
- Create: `apps/web/app/page.tsx`(覆盖), `apps/web/app/events/[id]/page.tsx`, `apps/web/lib/format.ts`, `apps/web/components/category-badge.tsx`, `apps/web/components/status-badge.tsx`, `apps/web/components/event-card.tsx`

**Interfaces:**
- Consumes: `prisma`、`EventCategory`/`EventStatus`。
- Produces: 首页 server component（按 firstSeenAt DESC，含"刚刚/几分钟前发现"相对时间）、详情页（含关联 Signal 列表）。

- [ ] **Step 1: lib/format.ts（相对时间 + 标签字典）**

```ts
import { formatDistanceToNowStrict } from "date-fns";
import { zhCN } from "date-fns/locale";

export function relTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60_000) return "刚刚发现";
  return formatDistanceToNowStrict(new Date(d), { locale: zhCN, addSuffix: true }) + "发现";
}

export const CATEGORY_LABEL: Record<string, string> = {
  anime_adaptation: "动画化", sequel_announced: "续作", pv_released: "PV公开",
  key_visual_released: "主视觉", cast_announced: "声优", staff_announced: "STAFF",
  broadcast_date_announced: "放送", delay_announced: "延期", movie_announced: "剧场版",
  theme_song_announced: "主题歌", event_info: "活动", merch_release: "周边",
  bd_release: "BD/DVD", other: "其他",
};

export const STATUS_LABEL: Record<string, string> = {
  draft_ai: "AI草稿", auto_published: "自动发布", published: "已发布",
  needs_review: "待审核", ignored: "已忽略", merged: "已合并", retracted: "已撤回",
};
```

- [ ] **Step 2: components/category-badge.tsx + status-badge.tsx**

```tsx
// category-badge.tsx
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABEL } from "@/lib/format";
export function CategoryBadge({ category }: { category: string }) {
  return <Badge className="border-[hsl(var(--accent))] text-[hsl(var(--accent))]">{CATEGORY_LABEL[category] ?? category}</Badge>;
}
```
```tsx
// status-badge.tsx
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/format";
const tone: Record<string,string> = {
  auto_published: "text-emerald-500 border-emerald-500", published: "text-emerald-500 border-emerald-500",
  draft_ai: "text-amber-500 border-amber-500", needs_review: "text-amber-500 border-amber-500",
  ignored: "text-zinc-500 border-zinc-500", retracted: "text-red-500 border-red-500", merged: "text-zinc-500 border-zinc-500",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge className={tone[status] ?? ""}>{STATUS_LABEL[status] ?? status}</Badge>;
}
```

- [ ] **Step 3: components/event-card.tsx**

```tsx
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryBadge } from "./category-badge";
import { StatusBadge } from "./status-badge";
import { relTime } from "@/lib/format";

export function EventCard({ ev }: { ev: {
  id: string; title: string; titleZh: string | null; summaryZh: string | null;
  category: string; status: string; firstSeenAt: Date; confidence: number;
  officialConfirmed: boolean; _count: { signals: number };
} }) {
  return (
    <Link href={`/events/${ev.id}`}>
      <Card className="hover:border-[hsl(var(--primary))] transition-colors">
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[hsl(var(--primary))] font-medium">{relTime(ev.firstSeenAt)}</span>
            <CategoryBadge category={ev.category} />
            <StatusBadge status={ev.status} />
            {ev.officialConfirmed && <span className="text-xs text-emerald-500">官方</span>}
          </div>
          <h3 className="font-semibold">{ev.titleZh || ev.title}</h3>
          {ev.summaryZh && <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">{ev.summaryZh}</p>}
          <div className="text-xs text-[hsl(var(--muted-foreground))] flex gap-3">
            <span>置信度 {(ev.confidence * 100).toFixed(0)}%</span>
            <span>来源 {ev._count.signals}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 4: app/page.tsx（首页，server component）**

```tsx
import { prisma } from "@aniradar/db";
import { EventCard } from "@/components/event-card";
export const dynamic = "force-dynamic";

export default async function Home() {
  const events = await prisma.event.findMany({
    where: { status: { in: ["auto_published", "published", "draft_ai"] } },
    orderBy: { firstSeenAt: "desc" }, take: 50,
    include: { _count: { select: { signals: true } } },
  });
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold mb-2">实时情报流</h1>
      {events.length === 0 && <p className="text-[hsl(var(--muted-foreground))]">暂无情报，等待 worker 抓取…</p>}
      {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
    </div>
  );
}
```

- [ ] **Step 5: app/events/[id]/page.tsx**

```tsx
import { prisma } from "@aniradar/db";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/category-badge";
import { StatusBadge } from "@/components/status-badge";
import { relTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventDetail({ params }: { params: { id: string } }) {
  const ev = await prisma.event.findUnique({
    where: { id: params.id },
    include: { signals: { include: { source: true }, orderBy: { firstSeenAt: "asc" } } },
  });
  if (!ev) notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <CategoryBadge category={ev.category} /><StatusBadge status={ev.status} />
        <span className="text-xs text-[hsl(var(--primary))]">{relTime(ev.firstSeenAt)}</span>
      </div>
      <h1 className="text-2xl font-bold">{ev.titleZh || ev.title}</h1>
      {ev.summaryZh && <p className="text-[hsl(var(--muted-foreground))]">{ev.summaryZh}</p>}
      <h2 className="font-semibold pt-4">关联情报源（{ev.signals.length}）</h2>
      <ul className="space-y-2">
        {ev.signals.map((s) => (
          <li key={s.id} className="border rounded-md p-3 text-sm">
            <div className="font-medium">{s.source.name}</div>
            <a href={s.url} target="_blank" rel="noreferrer" className="text-[hsl(var(--primary))] hover:underline">{s.title}</a>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              {s.publishedAt ? `发布 ${new Date(s.publishedAt).toLocaleString("zh-CN")} · ` : ""}{relTime(s.firstSeenAt)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: 验证**

确保 worker 已跑出数据后访问 `/`，应见情报卡片按时间倒序；点击进入 `/events/[id]` 见关联 Signal。
Run（如无数据可手动触发）：`pnpm dev:web` 后浏览器访问。

- [ ] **Step 7: Commit**

```bash
git add apps/web && git commit -m "feat(web): 首页情报流与事件详情页"
```

---

## Task 13: 后台页面 + API routes

**Files:**
- Create:
  - `apps/web/app/admin/sources/page.tsx`, `apps/web/app/admin/sources/source-form.tsx`(client), `apps/web/app/admin/sources/actions.tsx`(client 触发/启停)
  - `apps/web/app/admin/signals/page.tsx`
  - `apps/web/app/admin/events/page.tsx`
  - `apps/web/app/admin/fetch-logs/page.tsx`
  - `apps/web/app/api/admin/sources/route.ts`(POST 新增), `apps/web/app/api/admin/sources/[id]/route.ts`(PATCH 编辑/启停)
  - `apps/web/app/api/admin/sources/[id]/fetch/route.ts`(POST 入队)
  - `apps/web/app/api/admin/signals/[id]/route.ts`(PATCH 忽略)
  - `apps/web/app/api/admin/events/[id]/route.ts`(PATCH 发布/忽略/撤回)

**Interfaces:**
- Consumes: `prisma`、`getFetchQueue`、`SOURCE_TYPES`/`FETCH_STRATEGIES`/`SOURCE_LEVELS`/`EVENT_CATEGORIES`/`EVENT_STATUS`/`SIGNAL_STATUS`。
- Produces: 4 个后台列表页与对应 REST 路由。

- [ ] **Step 1: API — sources 增 / 改 / 触发**

`app/api/admin/sources/route.ts`：
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aniradar/db";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const src = await prisma.source.create({
      data: {
        name: b.name, url: b.url, type: b.type, level: b.level ?? "B",
        fetchStrategy: b.fetchStrategy, fetchIntervalSec: Number(b.fetchIntervalSec ?? 900),
        enabled: b.enabled ?? true,
        selectorConfig: b.selectorConfig ? JSON.parse(b.selectorConfig) : undefined,
      },
    });
    return NextResponse.json(src);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 });
  }
}
```

`app/api/admin/sources/[id]/route.ts`：
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aniradar/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await req.json();
    const data: any = {};
    for (const k of ["name","url","type","level","fetchStrategy","enabled"]) if (k in b) data[k] = b[k];
    if ("fetchIntervalSec" in b) data.fetchIntervalSec = Number(b.fetchIntervalSec);
    if ("selectorConfig" in b) data.selectorConfig = b.selectorConfig ? JSON.parse(b.selectorConfig) : null;
    const src = await prisma.source.update({ where: { id: params.id }, data });
    return NextResponse.json(src);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 });
  }
}
```

`app/api/admin/sources/[id]/fetch/route.ts`：
```ts
import { NextResponse } from "next/server";
import { getFetchQueue } from "@/lib/queue";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await getFetchQueue().add("fetch", { sourceId: params.id });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: API — signals 忽略 / events 状态变更**

`app/api/admin/signals/[id]/route.ts`：
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aniradar/db";
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json();
  const s = await prisma.signal.update({ where: { id: params.id }, data: { status: b.status } });
  return NextResponse.json(s);
}
```

`app/api/admin/events/[id]/route.ts`：
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aniradar/db";
const ALLOWED = ["published","ignored","retracted","needs_review","auto_published","draft_ai"];
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json();
  if (!ALLOWED.includes(b.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
  const ev = await prisma.event.update({ where: { id: params.id }, data: { status: b.status } });
  return NextResponse.json(ev);
}
```

- [ ] **Step 3: admin/sources 页面 + 表单 + 行操作（client）**

`source-form.tsx`（client，POST 新增后 `location.reload()`）：
```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SOURCE_TYPES, FETCH_STRATEGIES, SOURCE_LEVELS } from "@aniradar/shared";

export function SourceForm() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", url: "", type: "media", level: "B", fetchStrategy: "rss", fetchIntervalSec: 900, selectorConfig: "" });
  async function submit() {
    const res = await fetch("/api/admin/sources", { method: "POST", body: JSON.stringify(f) });
    if (res.ok) location.reload(); else alert((await res.json()).error);
  }
  if (!open) return <Button onClick={() => setOpen(true)}>新增资讯源</Button>;
  return (
    <div className="border rounded-md p-4 space-y-2">
      <input className="border rounded px-2 py-1 w-full bg-transparent" placeholder="名称" value={f.name} onChange={(e)=>setF({...f,name:e.target.value})}/>
      <input className="border rounded px-2 py-1 w-full bg-transparent" placeholder="URL" value={f.url} onChange={(e)=>setF({...f,url:e.target.value})}/>
      <div className="flex gap-2">
        <select className="border rounded px-2 py-1 bg-transparent" value={f.type} onChange={(e)=>setF({...f,type:e.target.value})}>{SOURCE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
        <select className="border rounded px-2 py-1 bg-transparent" value={f.fetchStrategy} onChange={(e)=>setF({...f,fetchStrategy:e.target.value})}>{FETCH_STRATEGIES.map(t=><option key={t} value={t}>{t}</option>)}</select>
        <select className="border rounded px-2 py-1 bg-transparent" value={f.level} onChange={(e)=>setF({...f,level:e.target.value})}>{SOURCE_LEVELS.map(t=><option key={t} value={t}>{t}</option>)}</select>
        <input type="number" className="border rounded px-2 py-1 w-28 bg-transparent" value={f.fetchIntervalSec} onChange={(e)=>setF({...f,fetchIntervalSec:Number(e.target.value)})}/>
      </div>
      <textarea className="border rounded px-2 py-1 w-full bg-transparent text-xs font-mono" placeholder='selectorConfig JSON（html_list 用）' value={f.selectorConfig} onChange={(e)=>setF({...f,selectorConfig:e.target.value})}/>
      <div className="flex gap-2"><Button onClick={submit}>保存</Button><Button variant="ghost" onClick={()=>setOpen(false)}>取消</Button></div>
    </div>
  );
}
```

`actions.tsx`（client，行内启停/触发）：
```tsx
"use client";
import { Button } from "@/components/ui/button";
export function SourceRowActions({ id, enabled }: { id: string; enabled: boolean }) {
  async function toggle() { await fetch(`/api/admin/sources/${id}`, { method: "PATCH", body: JSON.stringify({ enabled: !enabled }) }); location.reload(); }
  async function trigger() { const r = await fetch(`/api/admin/sources/${id}/fetch`, { method: "POST" }); alert(r.ok ? "已触发抓取" : "触发失败"); }
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={toggle}>{enabled ? "禁用" : "启用"}</Button>
      <Button size="sm" onClick={trigger}>抓取</Button>
    </div>
  );
}
```

`app/admin/sources/page.tsx`：
```tsx
import { prisma } from "@aniradar/db";
import { SourceForm } from "./source-form";
import { SourceRowActions } from "./actions";
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const sources = await prisma.source.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-bold">资讯源</h1></div>
      <SourceForm />
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[hsl(var(--muted-foreground))]"><th className="py-2">名称</th><th>类型/策略</th><th>启用</th><th>lastChecked</th><th>lastSuccess</th><th>失败</th><th>操作</th></tr></thead>
        <tbody>
          {sources.map((s)=>(
            <tr key={s.id} className="border-t">
              <td className="py-2"><div className="font-medium">{s.name}</div><div className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-xs">{s.url}</div></td>
              <td>{s.type}<br/><span className="text-xs">{s.fetchStrategy}</span></td>
              <td>{s.enabled ? "✓" : "—"}</td>
              <td className="text-xs">{s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString("zh-CN") : "—"}</td>
              <td className="text-xs">{s.lastSuccessAt ? new Date(s.lastSuccessAt).toLocaleString("zh-CN") : "—"}</td>
              <td>{s.failureCount}</td>
              <td><SourceRowActions id={s.id} enabled={s.enabled} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: admin/signals 页面（筛选 + 忽略）**

`app/admin/signals/page.tsx`（用 searchParams 筛选 source/status，行内忽略按钮做成小 client 组件或用 `<form>`，此处用 link 切状态 + 简单 client 忽略）：
```tsx
import { prisma } from "@aniradar/db";
import { SIGNAL_STATUS } from "@aniradar/shared";
import { IgnoreButton } from "./ignore-button";
export const dynamic = "force-dynamic";

export default async function SignalsPage({ searchParams }: { searchParams: { status?: string; sourceId?: string } }) {
  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.sourceId) where.sourceId = searchParams.sourceId;
  const [signals, sources] = await Promise.all([
    prisma.signal.findMany({ where, include: { source: true }, orderBy: { firstSeenAt: "desc" }, take: 100 }),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Signals</h1>
      <form className="flex gap-2 text-sm">
        <select name="status" defaultValue={searchParams.status ?? ""} className="border rounded px-2 py-1 bg-transparent"><option value="">全部状态</option>{SIGNAL_STATUS.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <select name="sourceId" defaultValue={searchParams.sourceId ?? ""} className="border rounded px-2 py-1 bg-transparent"><option value="">全部来源</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button className="border rounded px-3">筛选</button>
      </form>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[hsl(var(--muted-foreground))]"><th className="py-2">标题</th><th>来源</th><th>状态</th><th>firstSeenAt</th><th>操作</th></tr></thead>
        <tbody>
          {signals.map((s)=>(
            <tr key={s.id} className="border-t">
              <td className="py-2 max-w-md"><a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">{s.title}</a></td>
              <td>{s.source.name}</td><td>{s.status}</td>
              <td className="text-xs">{new Date(s.firstSeenAt).toLocaleString("zh-CN")}</td>
              <td>{s.status !== "ignored" && <IgnoreButton id={s.id} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```
`app/admin/signals/ignore-button.tsx`：
```tsx
"use client";
import { Button } from "@/components/ui/button";
export function IgnoreButton({ id }: { id: string }) {
  async function go() { await fetch(`/api/admin/signals/${id}`, { method: "PATCH", body: JSON.stringify({ status: "ignored" }) }); location.reload(); }
  return <Button size="sm" variant="outline" onClick={go}>忽略</Button>;
}
```

- [ ] **Step 5: admin/events 页面（筛选 + 发布/忽略/撤回）**

`app/admin/events/page.tsx`（结构同 signals：searchParams 过滤 status/category，行内 client 按钮组）：
```tsx
import { prisma } from "@aniradar/db";
import { EVENT_STATUS, EVENT_CATEGORIES } from "@aniradar/shared";
import { EventActions } from "./event-actions";
export const dynamic = "force-dynamic";

export default async function EventsPage({ searchParams }: { searchParams: { status?: string; category?: string } }) {
  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.category) where.category = searchParams.category;
  const events = await prisma.event.findMany({ where, orderBy: { firstSeenAt: "desc" }, take: 100, include: { _count: { select: { signals: true } } } });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Events</h1>
      <form className="flex gap-2 text-sm">
        <select name="status" defaultValue={searchParams.status ?? ""} className="border rounded px-2 py-1 bg-transparent"><option value="">全部状态</option>{EVENT_STATUS.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <select name="category" defaultValue={searchParams.category ?? ""} className="border rounded px-2 py-1 bg-transparent"><option value="">全部分类</option>{EVENT_CATEGORIES.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <button className="border rounded px-3">筛选</button>
      </form>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[hsl(var(--muted-foreground))]"><th className="py-2">标题</th><th>分类</th><th>状态</th><th>置信度</th><th>来源</th><th>操作</th></tr></thead>
        <tbody>
          {events.map((e)=>(
            <tr key={e.id} className="border-t">
              <td className="py-2 max-w-md"><a href={`/events/${e.id}`} className="hover:underline">{e.titleZh || e.title}</a></td>
              <td>{e.category}</td><td>{e.status}</td><td>{(e.confidence*100).toFixed(0)}%</td><td>{e._count.signals}</td>
              <td><EventActions id={e.id} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```
`app/admin/events/event-actions.tsx`：
```tsx
"use client";
import { Button } from "@/components/ui/button";
export function EventActions({ id }: { id: string }) {
  async function set(status: string) { await fetch(`/api/admin/events/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); location.reload(); }
  return (
    <div className="flex gap-1">
      <Button size="sm" onClick={()=>set("published")}>发布</Button>
      <Button size="sm" variant="outline" onClick={()=>set("ignored")}>忽略</Button>
      <Button size="sm" variant="destructive" onClick={()=>set("retracted")}>撤回</Button>
    </div>
  );
}
```

- [ ] **Step 6: admin/fetch-logs 页面**

`app/admin/fetch-logs/page.tsx`：
```tsx
import { prisma } from "@aniradar/db";
export const dynamic = "force-dynamic";
export default async function FetchLogsPage() {
  const logs = await prisma.fetchLog.findMany({ include: { source: true }, orderBy: { startedAt: "desc" }, take: 150 });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">抓取日志</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[hsl(var(--muted-foreground))]"><th className="py-2">来源</th><th>状态</th><th>fetched</th><th>new</th><th>message</th><th>started</th><th>ended</th></tr></thead>
        <tbody>
          {logs.map((l)=>(
            <tr key={l.id} className="border-t">
              <td className="py-2">{l.source.name}</td>
              <td className={l.status==="failed"?"text-red-500":l.status==="success"?"text-emerald-500":""}>{l.status}</td>
              <td>{l.fetchedCount}</td><td>{l.newCount}</td>
              <td className="max-w-xs truncate text-xs">{l.message}</td>
              <td className="text-xs">{new Date(l.startedAt).toLocaleString("zh-CN")}</td>
              <td className="text-xs">{l.endedAt ? new Date(l.endedAt).toLocaleString("zh-CN") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: 验证全后台**

`pnpm dev:web`，逐页访问 `/admin/sources`（新增/启停/触发）、`/admin/signals`（筛选/忽略）、`/admin/events`（筛选/发布/忽略/撤回）、`/admin/fetch-logs`。触发抓取后回 fetch-logs 看到新日志。

- [ ] **Step 8: Commit**

```bash
git add apps/web && git commit -m "feat(web): 后台 sources/signals/events/fetch-logs 与 API"
```

---

## Task 14: 集成冒烟 + README + .env.example 收尾

**Files:**
- Create: `README.md`
- Verify: 全链路端到端

**Interfaces:**
- Consumes: 全部已实现模块。
- Produces: 文档与一次端到端验证记录。

- [ ] **Step 1: 端到端冒烟**

```bash
docker compose up -d
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev:worker   # 终端A
pnpm dev:web      # 终端B
```
在 `/admin/sources` 对 "アニメ！アニメ！" 点"抓取"，30s 内 `/admin/fetch-logs` 出现 success 日志，`/admin/signals` 出现新 Signal，`/`(首页)出现 Event 卡片。
Expected: 闭环成立（fetch→signal→classify→event→首页）。

- [ ] **Step 2: 写 README.md**

包含：项目简介、架构图、前置要求（Node/pnpm/Docker）、安装（`pnpm install`）、起 DB/Redis（`docker compose up -d`）、迁移与 seed（`pnpm db:generate/migrate/seed`）、启动 web（`pnpm dev:web`）、启动 worker（`pnpm dev:worker`）、如何添加 Source（后台或直接改 seed）、如何手动触发抓取（后台按钮 / API `POST /api/admin/sources/[id]/fetch`）、各 package 职责、下一步建议接的真实 News 源清单、AI/事件合并/YouTube 的扩展点。

- [ ] **Step 3: Commit**

```bash
git add README.md && git commit -m "docs: README 与运行说明"
```

---

## Self-Review

**Spec coverage 核对：**
- 管理员加 Source → Task 13（表单+API）✓
- 定时抓取 → Task 10 scheduler ✓
- 抓到新内容生成 Signal → Task 10 processFetch ✓
- AI mock 判断 → Task 9 + Task 10 processClassify ✓
- 生成 Event → Task 8 + Task 10 ✓
- 首页按 firstSeenAt → Task 12 ✓
- 后台查看 Source/Signal/Event/FetchLog → Task 13 ✓
- 手动触发抓取 → Task 13 fetch route ✓
- 4 个 Adapter → Task 7 ✓
- AI mock 关键词与分类 → Task 9 ✓
- 自动发布规则（official/youtube + conf≥0.9）→ Task 8 buildEventFromSignal ✓
- seed 示例源 → Task 4 ✓
- .env.example / README / docker-compose → Task 1 / Task 14 ✓
- 错误处理 + FetchLog → Task 10 ✓
- 深色模式/卡片/badge/时间线 → Task 11/12 ✓

**实现顺序说明：** Task 8(detector) 的 `computeContentHash` 被 Task 7(sources) 引用，执行时建议顺序为 1→2→3→4→5→6→8→7→9→10→11→12→13→14（即 detector 在 sources 之前）。

**Placeholder 扫描：** 仅 Task 11 的 table/input/select 标注"最小实现，结构同上"——这是有意简化的样式封装，执行时按 badge/card 同款 `cn()` 包装即可，非逻辑占位。其余均为完整代码。

**类型一致性：** `FetchResult`/`FetchedItem`/`ClassifyResult`/`SourceAdapter`/`SourceLike` 全程一致；`computeSignalHash`/`computeContentHash`/`buildEventFromSignal`/`classify`/`summarize`/`getAdapter`/`getFetchQueue` 命名前后统一。
