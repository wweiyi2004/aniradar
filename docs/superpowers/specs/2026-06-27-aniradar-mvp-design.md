# AniRadar MVP 设计文档

- 日期：2026-06-27
- 状态：已批准（待落盘后用户复审）
- 作者：Claude

## 1. 项目定位

AniRadar 是一个关注**时效性**的动漫新情报监测网站。它**不做** Bangumi 式的条目库、评分、收藏；而是监控官方 News、官方 YouTube RSS、PR/媒体 News 等来源，按"首次发现时间"整理成实时情报流。

**第一阶段明确不做**：X(Twitter) API / 爬 X、用户系统、评论区、评分系统。

### 本期交付范围（已与用户确认）

- 完整 MVP 一次到位：4 种抓取源（RSS / YouTube RSS / HTML 列表 / 页面 Diff）+ 完整前台与后台 + 定时调度 + AI mock + seed 数据，全部跑通。
- 后台 `/admin` **暂不加访问保护**（本地开发用），后续再加。

## 2. 技术栈

Next.js (App Router) · TypeScript · TailwindCSS · shadcn/ui · Prisma · PostgreSQL · Redis · BullMQ · Cheerio · rss-parser · pnpm workspace · Docker Compose。

本地环境已验证：Node v24、pnpm 11.5、Docker 27。Postgres/Redis 通过 Docker Compose 启动。

## 3. 架构总览

pnpm workspace monorepo。抓取链路全部运行在 `apps/worker`（独立 Node 进程 + BullMQ）；`apps/web`（Next.js）只负责读展示，以及提供"手动触发抓取"的入队 API。Web 与 Worker 共享 `packages/db`（Prisma client）与 `packages/shared`（类型）。

```
scheduler(每30s) ──投递 fetch-source job──▶ BullMQ ──▶ fetch worker
  fetch worker: 选 Adapter → 抓取 → hash 去重 → 入库 Signal → 投递 classify-signal job
  classify worker: AI mock 分类 → 生成/更新 Event → 写状态
  全过程写 FetchLog
web: 读 DB 展示首页/详情/后台；POST /api/admin/sources/[id]/fetch → 入队 fetch-source job
```

### monorepo 结构

```
aniradar/
├─ apps/
│  ├─ web/                    # Next.js 前台 + 后台
│  └─ worker/                 # 抓取 worker（scheduler + fetch + classify）
├─ packages/
│  ├─ db/                     # Prisma schema + db client + seed
│  ├─ sources/                # SourceAdapter 接口与 4 个实现
│  ├─ crawler/                # HTTP 抓取层（fetch/etag/超时/UA）
│  ├─ parser/                 # RSS / HTML / YouTube RSS 解析（纯函数）
│  ├─ detector/               # 去重、Event 生成、合并接口
│  ├─ ai/                     # AI 分类/摘要，第一版 mock
│  ├─ shared/                 # 公共类型/枚举/常量
│  └─ config/                 # env、Redis 配置、队列名常量
├─ docker-compose.yml
├─ package.json
├─ pnpm-workspace.yaml
└─ README.md
```

## 4. 包职责（单一职责，经类型接口通信）

- `packages/shared` — 纯类型/枚举/常量（category、status、SourceType、FetchStrategy 等），无副作用，可被任意包引用。
- `packages/config` — 读取 env、Redis 连接配置、BullMQ 队列名常量。
- `packages/db` — Prisma schema、单例 PrismaClient、seed 脚本。
- `packages/parser` — `parseRss` / `parseYouTubeRss` / `parseHtmlList` 三种底层解析函数。输入原始字符串/DOM，输出结构化 item。纯函数，易测。
- `packages/crawler` — HTTP 抓取层：`fetchUrl`（超时、自定义 UA、etag/lastModified 条件请求、返回 304 处理）。被 adapter 调用。
- `packages/sources` — 定义 `SourceAdapter` 接口与 4 个 Adapter：`RssAdapter` / `YouTubeRssAdapter` / `HtmlListAdapter` / `PageDiffAdapter`。内部组合 crawler + parser，输出 `FetchedItem[]`。
- `packages/detector` — `computeHash`、`dedupe`、`signalToEvent`（第一版"一 Signal 一 Event"）；预留 `mergeIntoEvent` 接口供后续事件合并。
- `packages/ai` — `classify(signal)` 与 `summarize(signal)`，规则版 mock 实现，保留接口签名以便后续替换真实模型，不在本期调用任何大模型 API。

### SourceAdapter 接口（核心抽象）

```ts
interface FetchedItem {
  title: string;
  url: string;
  rawText?: string;
  summary?: string;
  publishedAt?: Date;
  publishedTimePrecision: 'datetime' | 'date_only' | 'unknown';
  externalId?: string; // 如 youtube videoId
}

interface FetchResult {
  items: FetchedItem[];
  etag?: string;
  lastModified?: string;
  notModified?: boolean; // 304 / 内容未变
}

interface SourceAdapter {
  fetch(source: Source): Promise<FetchResult>;
}
```

`fetchStrategy` → Adapter 映射：`rss`→RssAdapter，`youtube_rss`→YouTubeRssAdapter，`html_list`→HtmlListAdapter，`page_diff`→PageDiffAdapter。

## 5. 数据库模型（Prisma）

枚举与字段按 spec 实现，关键模型如下（省略部分以枚举字段说明）：

- **Source**：id, name, url, type(official_news/youtube_rss/press/media/company_news/publisher_news), level(S/A/B/C), fetchStrategy(rss/youtube_rss/html_list/page_diff), enabled, fetchIntervalSec, lastCheckedAt, lastSuccessAt, failureCount, etag, lastModified, lastSeenHash, selectorConfig(Json), createdAt, updatedAt。
- **Signal**：id, sourceId, title, url, rawText, summary, publishedAt, publishedTimePrecision(datetime/date_only/unknown), firstSeenAt, hash(唯一), language, status(raw/classified/ignored/merged/failed), eventId, createdAt。
- **Event**：id, title, titleZh, summaryZh, category(14 类), firstSeenAt, confidence, heatScore, officialConfirmed, status(draft_ai/auto_published/published/needs_review/ignored/merged/retracted), createdAt, updatedAt。
- **FetchLog**：id, sourceId, status(success/failed/skipped), message, fetchedCount, newCount, startedAt, endedAt。

关系：Source 1—N Signal、Source 1—N FetchLog、Event 1—N Signal（Signal.eventId 可空）。

Event.category 完整 14 类：anime_adaptation, sequel_announced, pv_released, key_visual_released, cast_announced, staff_announced, broadcast_date_announced, delay_announced, movie_announced, theme_song_announced, event_info, merch_release, bd_release, other。

## 6. 数据流关键决策

- **去重 hash**：`sha256(sourceId + 归一化url + 归一化title)`。归一化 = 去首尾空白、去 url 查询追踪参数、统一小写域名。存 `Signal.hash`，加唯一约束；同源命中即跳过（不重复入库）。
- **firstSeenAt**：Signal 入库时间即"首次发现时间"。`Event.firstSeenAt` 取其首个关联 Signal 的 firstSeenAt。这是首页排序核心字段。
- **自动发布规则**：来源类型为 `official_news` 或 `youtube_rss`，且 `confidence >= 0.9` → Event.status = `auto_published`；否则 `draft_ai`，等待后台审核。
- **YouTube 关键词过滤**：视频标题不含关键词（PV / ティザー / 本PV / 特報 / 予告 / CM / ノンクレジットOP / ノンクレジットED / 制作決定 / 放送決定）的，直接丢弃，不生成 Signal。
- **条件抓取**：RssAdapter 使用 etag/lastModified 条件请求（304 → skipped）；HtmlListAdapter / PageDiffAdapter 使用 `Source.lastSeenHash` 判断列表/正文是否变化，未变则 skipped，节省请求与解析。
- **HtmlListAdapter 详情抓取**：先抓列表页解析出 item；仅当发现 DB 中不存在的新 URL 时才抓详情页补全 rawText/summary。使用 Cheerio，不使用 Playwright。

## 7. AI mock 规则（packages/ai）

`classify` 第一版不调用大模型，基于关键词规则：

关键词集合：制作決定, アニメ化, 第2期, 続編, 放送決定, 放送開始, 放送延期, 配信決定, PV公開, ティザーPV, 本PV, 予告, 特報, キービジュアル, ビジュアル公開, キャスト解禁, スタッフ解禁, 主題歌, OP, ED, 劇場版, 映画化, 新作アニメ。

分类映射（命中即归类，优先级从上到下）：

- 制作決定 / アニメ化 / 新作アニメ → `anime_adaptation`
- 第2期 / 続編 → `sequel_announced`
- PV / ティザー / 予告 / 特報 → `pv_released`
- キービジュアル / ビジュアル → `key_visual_released`
- キャスト → `cast_announced`
- スタッフ → `staff_announced`
- 放送（含延期单独判断） → `broadcast_date_announced`
- 延期 → `delay_announced`
- 劇場版 / 映画化 → `movie_announced`
- 主題歌 / OP / ED → `theme_song_announced`
- 命中任意关键词但无明确分类 → `other`
- 不含任何关键词 → 判定"非动漫新情报"，Signal.status = `ignored`，不生成 Event

`classify` 返回 `{ isAnimeNews, category, confidence }`；命中越强关键词 confidence 越高。`summarize` mock 返回基于标题的简短中文摘要占位（titleZh/summaryZh）。

## 8. 抓取流程（worker）

scheduler 每 30 秒运行一次：

1. 查 enabled=true 且 `now - lastCheckedAt >= fetchIntervalSec` 的 Source。
2. 为每个投递 `fetch-source` job 到 BullMQ。
3. fetch worker 按 fetchStrategy 选 Adapter 执行，开 FetchLog。
4. 对每个 FetchedItem 计算 hash 去重。
5. 新内容入库 Signal（status=raw），更新 Source.lastCheckedAt/lastSuccessAt/etag/lastModified/lastSeenHash。
6. 为每个新 Signal 投递 `classify-signal` job。
7. classify worker 调用 AI mock 判断是否动漫新情报。
8. 是 → 生成 Event（status 默认 draft_ai）。
9. 满足自动发布规则 → auto_published；否则 draft_ai 待审。
10. 否 → Signal.status=ignored。
11. 全程异常写 FetchLog(failed) 并 `failureCount++`，单条解析/AI 失败不阻断整批。

## 9. 页面

### 前台
- `/` 情报流：按 `Event.firstSeenAt DESC`。每条显示 titleZh 或 title、category、summaryZh、firstSeenAt（"几分钟前发现"相对时间）、officialConfirmed、confidence、来源数量、状态。
- `/events/[id]` 详情：Event 详情 + AI 摘要 + 关联 Signal 列表（来源名、原始标题、原文链接、publishedAt、firstSeenAt）。

### 后台
- `/admin/sources`：列表、新增、编辑、启用/禁用、手动触发抓取、显示 lastCheckedAt/lastSuccessAt/failureCount。
- `/admin/signals`：列表、按 source+status 筛选、手动忽略。
- `/admin/events`：列表、按 status+category 筛选、手动发布/忽略/撤回。
- `/admin/fetch-logs`：source、status、fetchedCount、newCount、message、startedAt、endedAt。

### API（web 内）
- `POST /api/admin/sources` / `PATCH /api/admin/sources/[id]` — 增改 Source
- `POST /api/admin/sources/[id]/fetch` — 入队手动抓取
- `PATCH /api/admin/signals/[id]` — 忽略
- `PATCH /api/admin/events/[id]` — 发布/忽略/撤回

### UI 风格
TailwindCSS + shadcn/ui，深色模式优先，卡片 + 时间线 + 状态 badge，"情报雷达"冷色调，不堆二次元图。首页突出"刚刚发现 / 几分钟前发现"。

## 10. 错误处理 & 日志

每次抓取开一条 FetchLog（startedAt→endedAt）。Adapter 抛错被 worker 捕获 → 写 failed 日志 + `Source.failureCount++`；成功更新 `lastSuccessAt` 并归零或保留 failureCount。AI/解析单条失败不阻断整批，记入 message。所有核心函数有基础 try/catch 与边界检查。

## 11. 测试策略

重点测纯逻辑：

- `parser`：喂 fixture XML/HTML，断言结构化输出。
- `detector`：hash 稳定性与去重行为。
- `ai` mock：关键词→category 映射、ignored 判定、confidence 区间。

抓取/队列用集成冒烟：seed 一个公开 RSS，跑通 fetch→signal→classify→event 闭环。

## 12. seed 内置示例 Source（公开稳定源，便于即时验证）

- アニメ！アニメ！(animeanime.jp) RSS — type=media, strategy=rss
- Anime News Network RSS — type=media, strategy=rss
- 一个官方频道 YouTube RSS（如 アニプレックス）— type=youtube_rss, strategy=youtube_rss
- 一个 HtmlList 示例（带 selectorConfig）— type=official_news, strategy=html_list
- 一个 PageDiff 示例 — type=company_news, strategy=page_diff

## 13. 后续扩展（本期留接口，不实现）

- 事件合并 `detector.mergeIntoEvent`：同主题多源 Signal 合并为单 Event、heatScore 累加。
- AI 接真实模型：替换 `ai/classify.ts`、`ai/summarize.ts` 内部实现，接口不变。
- 更多官网 News 解析器、X 监控、用户系统、评分（均为后续阶段）。
