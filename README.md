# AniRadar · 动漫新情报雷达

一个关注**时效性**的动漫新情报监测网站。它不做 Bangumi 式的条目库/评分/收藏，而是监控官方 News、官方 YouTube RSS、PR/媒体 News 等来源，按"首次发现时间"整理成实时情报流。

第一阶段不接 X(Twitter)、无用户系统、无评论、无评分。AI 模块为规则版 mock，保留接口以便后续替换真实模型。

---

## 架构

pnpm workspace monorepo。抓取链路运行在独立的 `apps/worker`（BullMQ）；`apps/web`（Next.js）负责展示与"手动触发抓取"的入队 API。Postgres + Redis 用 Docker Compose 启动。

```
scheduler(每30s) ──fetch-source job──▶ BullMQ ──▶ fetch worker
  fetch worker: 选 Adapter → 抓取 → hash 去重 → 入库 Signal → 投递 classify-signal job
  classify worker: AI mock 分类 → 生成/更新 Event → 写状态
  全过程写 FetchLog
web: 读 DB 展示首页/详情/后台；POST /api/admin/sources/[id]/fetch → 入队
```

### 目录结构

```
aniradar/
├─ apps/
│  ├─ web/        # Next.js 前台 + 后台
│  └─ worker/     # scheduler + fetch + classify worker
├─ packages/
│  ├─ shared/     # 共享枚举/类型/常量
│  ├─ config/     # env、redis 连接、队列名
│  ├─ db/         # Prisma schema + client 单例 + seed
│  ├─ parser/     # RSS / YouTube RSS / HTML 解析（纯函数）
│  ├─ crawler/    # HTTP 抓取层（超时/UA/etag 条件请求）
│  ├─ sources/    # SourceAdapter 接口 + 4 个实现
│  ├─ detector/   # hash 去重 + Event 生成规则（合并留接口）
│  └─ ai/         # 规则版 classify/summarize mock
├─ docker-compose.yml
└─ ...
```

### 各 package 职责

| 包 | 职责 |
| --- | --- |
| `@aniradar/shared` | 全仓共享的枚举（SourceType/EventCategory/…）、类型（FetchedItem/FetchResult/ClassifyResult）、队列名常量 |
| `@aniradar/config` | 惰性读取 env、Redis 连接配置 |
| `@aniradar/db` | Prisma schema、PrismaClient 单例、seed |
| `@aniradar/parser` | `parseRss` / `parseYouTubeRss` / `parseHtmlList` 纯解析函数 |
| `@aniradar/crawler` | `fetchUrl`：超时、自定义 UA、etag/last-modified 条件请求、304 处理 |
| `@aniradar/sources` | `SourceAdapter` 接口 + `RssAdapter`/`YouTubeRssAdapter`/`HtmlListAdapter`/`PageDiffAdapter` + `getAdapter` |
| `@aniradar/detector` | `computeSignalHash`/`normalizeUrl`/`computeContentHash`、`buildEventFromSignal`（自动发布规则） |
| `@aniradar/ai` | `classify`（关键词规则）、`summarize`（占位中文摘要），mock，接口稳定 |

---

## 前置要求

- Node ≥ 20（开发用 v24）
- pnpm（仓库锁定 11.5.2）
- Docker Desktop（提供 PostgreSQL + Redis）

---

## 快速开始

```bash
# 1) 安装依赖
pnpm install

# 2) 准备环境变量
cp .env.example .env

# 3) 启动 PostgreSQL + Redis
docker compose up -d

# 4) 生成 Prisma client、建表、写入示例 Source
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5) 启动 worker（终端 A）—— 负责定时抓取与分类
pnpm dev:worker

# 6) 启动 web（终端 B）—— http://localhost:3000
pnpm dev:web
```

> 说明：`docker-compose.yml` 中 PostgreSQL 映射到主机 **5433** 端口（避免与其它本地 Postgres 冲突），`.env` 已对应。如需改回 5432，同时改 `docker-compose.yml` 与 `.env` 的 `DATABASE_URL`。

> **代理（国内/受限网络）**：worker 抓取国际源（YouTube、部分 CDN 站点如 映画.com）需要代理。crawler 会自动读取 `HTTPS_PROXY` / `HTTP_PROXY` 环境变量并经其转发（Node 全局 fetch 默认不读这些变量，故 crawler 用 undici `ProxyAgent` 显式处理）。例如启动 worker 前：`export HTTPS_PROXY=http://127.0.0.1:7890`。国内可直连的源（animeanime、natalie 等）无代理也可。

启动后：
- 前台首页 `http://localhost:3000/` —— 实时情报流（按首次发现时间倒序）
- 事件详情 `http://localhost:3000/events/[id]`
- 后台：`/admin/sources`、`/admin/signals`、`/admin/events`、`/admin/fetch-logs`

---

## 常用操作

### 添加 Source
- **方式一（推荐）**：后台 `/admin/sources` → "新增资讯源"，填名称/URL/类型/抓取策略/间隔。`html_list` 策略需在 selectorConfig 填 JSON，例如：
  ```json
  { "listItem": ".news-list li", "title": ".title", "url": "a", "date": ".date", "summary": ".summary" }
  ```
- **方式二**：编辑 `packages/db/prisma/seed.ts` 后 `pnpm db:seed`（按 URL 去重，不会重复插入）。

### 手动触发抓取
- 后台 `/admin/sources` 对某行点"抓取"。
- 或调用 API：`POST /api/admin/sources/[id]/fetch`（向 BullMQ 投递一个 fetch-source job，由 worker 处理）。

### 抓取策略与 Adapter
| fetchStrategy | Adapter | 说明 |
| --- | --- | --- |
| `rss` | RssAdapter | rss-parser 解析 title/link/pubDate/contentSnippet |
| `youtube_rss` | YouTubeRssAdapter | 解析 videoId/title/link，并按关键词（PV/特報/制作決定…）过滤 |
| `html_list` | HtmlListAdapter | 按 selectorConfig 用 Cheerio 解析 News 列表，列表指纹变化才生成 Signal |
| `page_diff` | PageDiffAdapter | 兜底：抓正文计算 hash，hash 变化才生成 Signal |

### 自动发布规则
来源类型为 `official_news` 或 `youtube_rss`，且 AI 置信度 ≥ 0.9 → Event 直接 `auto_published`；否则 `draft_ai` 等待后台审核。

---

## 数据模型

`Source`（资讯源）、`Signal`（单条抓取到的原始情报）、`Event`（聚合后的情报事件）、`FetchLog`（抓取日志）。详见 `packages/db/prisma/schema.prisma`。

- 去重：`Signal.hash = sha256(sourceId + 归一化url + 归一化title)`，唯一约束，重复即跳过。
- 排序核心：`Event.firstSeenAt` = 首个关联 Signal 的入库时间（"首次发现时间"）。
- 事件合并：分类时在最近 72h 同分类 Event 中按"作品名（标题「」内）相同或标题相似度达阈值"寻找同一事件，命中则把新 Signal 挂到既有 Event 并累加 `heatScore`，否则新建。多源报道同一作品 → 聚合成一条（首页"来源 N">1）。

---

## 测试

```bash
pnpm test    # 运行 parser / detector / ai 等纯逻辑单测（vitest）
```

---

## 下一步建议接入的真实 News 源

已内置并实测可用的真实源：`アニメ！アニメ！`、`コミックナタリー`、`映画ナタリー`、`音楽ナタリー`（RSS）+ `アニプレックス`（YouTube RSS）+ `映画.com アニメ`（**html_list**，selector 已实测可抽 20 条）。建议后续按"官方/高时效"继续扩充：

**RSS / 官方新闻（最易接、时效高）**
- アニメ！アニメ！(animeanime.jp) — 已内置，稳定可用
- コミックナタリー / 映画ナタリー（natalie.mu）RSS
- アニメイトタイムズ、PR TIMES（アニメカテゴリ）RSS
- 各制作公司/发行商官网 News（多数提供 RSS 或可用 html_list）

**官方 YouTube 频道 RSS（`youtube_rss`）**
- アニプレックス、東宝アニメーション、KADOKAWAanime、バンダイナムコ、各作品官方频道
- 用 `https://www.youtube.com/feeds/videos.xml?channel_id=频道ID`，靠关键词过滤 PV/特報/制作決定

**官网 News 列表（`html_list`，需配 selectorConfig）**
- 各 TV 动画官网 / 制作委员会官网的「NEWS」「お知らせ」列表页

> 注意：部分站点（如 Anime News Network）会按 User-Agent 拦截（返回 403），接入前需确认抓取策略与频率合规；高价值官方源建议设较短 `fetchIntervalSec`。

---

## 已实现的进阶能力

- **事件合并**：见 `packages/detector/src/merge.ts`（`isSameEvent`/`extractWorkTitle`/`titleSimilarity`）+ `apps/worker/src/processClassify.ts`。同主题多源 Signal 合并为单 Event 并累加 heatScore（classify worker 并发设为 1 以避免合并竞态）。

## 后续扩展点

- **真实 AI**：替换 `packages/ai/src/classify.ts`、`summarize.ts` 内部实现（接口签名不变）即可接入大模型做分类与中文摘要/翻译。
- **更多解析器**：官网 News 详情页结构化、html_list/page_diff 真实站点接入、X 监控、用户系统/评分（后续阶段）。
