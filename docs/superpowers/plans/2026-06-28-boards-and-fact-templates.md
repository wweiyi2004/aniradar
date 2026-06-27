# 板块维度 + 结构化事实模板 + UI 升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给情报加「作品媒介」板块维度（动画/漫画/轻小说/游戏/剧场版/周边+其它），详情页从「一段摘要」升级为「一句话导语 + 结构化事实表」，并加顶部板块 tab + 首页混合布局。

**Architecture:** AI `analyze()` 一次调用扩展输出 `medium + leadZh + facts`，写到 `Event.medium` / `Event.facts(Json)` / `Event.summaryZh`；mock 无 key 时按 category 规则兜底 medium、facts 留空。前端按 medium 顶部 tab 过滤情报流，详情页按 (medium, category) 两层模板把 facts 渲染成事实表。复用既有 reanalyze 队列回填历史。

**Tech Stack:** TypeScript(ESM)、pnpm workspace、Prisma 5(Postgres 16, JSONB)、BullMQ 5、Next.js 14、Vitest 2。

## Global Constraints

- 提交信息不带任何协作者署名（无 `Co-Authored-By` 尾行）。
- env / 惰性 getter / 测试风格沿用现有约定。
- 板块归属规则：按「这条动态是哪种媒介」，不看原作媒介。
- 事实准确性优先：facts 只填原文明确陈述的字段，未知省略，不编造。
- `Medium` 取值固定：`anime / manga / light_novel / game / film / goods_event / other`。
- DB 列 `Event.summaryZh` **不改名**，内容存一句话导语（leadZh）。
- medium/facts 只加在 `Event`；Signal 不加列。
- 类型门禁（worker/包）：`npx tsc -p apps/worker/tsconfig.json --noEmit`（沿 import 覆盖 shared/ai/db）；web：`pnpm --filter @aniradar/web build`（next build 含类型检查）。`pnpm -r build` 跳过无 build 脚本的包，仅终验用。

---

## File Structure

- `packages/shared/src/index.ts`（改）— `MEDIUMS`/`Medium`。
- `packages/shared/src/medium.ts`（新）— `mediumFromCategory()` 纯规则。
- `packages/shared/tests/medium.test.ts`（新）。
- `packages/db/prisma/schema.prisma`（改）+ 新迁移 — `Event.medium`、`Event.facts`。
- `packages/ai/src/analyze.ts`（改）— `AnalyzeResult` 加 `medium/leadZh/facts`；prompt；mock。
- `packages/ai/src/provider.ts`（改）— `chatJson` max_tokens 调大。
- `packages/ai/tests/analyze.test.ts`（改）— 断言 mock medium。
- `apps/worker/src/processClassify.ts`（改）— 写 medium/facts（新建/合并填空）。
- `apps/worker/src/processReanalyze.ts`（改）— 回填 medium/facts。
- `packages/db/prisma/backfillMedium.ts`（新）— 无 key 时一次性按规则补 medium。
- `apps/web/lib/format.ts`（改）— `MEDIUM_LABEL`。
- `apps/web/components/medium-badge.tsx`（新）。
- `apps/web/components/board-tabs.tsx`（新）。
- `apps/web/components/event-card.tsx`（改）— 加 medium badge + 关键事实 inline。
- `apps/web/app/page.tsx`（改）— board 过滤 + 混合布局。
- `apps/web/lib/facts.ts`（新）— 事实模板矩阵 + `buildFactRows()`。
- `apps/web/tests/facts.test.ts`（新）。
- `apps/web/components/fact-table.tsx`（新）。
- `apps/web/app/events/[id]/page.tsx`（改）— 导语 + 事实表。

---

## 阶段一：数据模型 + AI 抽取 + 回填

### Task 1: Medium 枚举 + mediumFromCategory 规则

**Files:**
- Modify: `packages/shared/src/index.ts`（在 `FETCHLOG_STATUS` 附近追加）
- Create: `packages/shared/src/medium.ts`
- Create: `packages/shared/tests/medium.test.ts`

**Interfaces:**
- Produces:
  - `MEDIUMS: readonly string[]`、`type Medium`
  - `function mediumFromCategory(category: EventCategory): Medium`

- [ ] **Step 1: shared 加 MEDIUMS/Medium**

`packages/shared/src/index.ts` 在 `export type FetchLogStatus = ...` 之后追加：

```ts
export const MEDIUMS = ["anime", "manga", "light_novel", "game", "film", "goods_event", "other"] as const;
export type Medium = (typeof MEDIUMS)[number];
```

并在文件末尾追加 re-export：

```ts
export { mediumFromCategory } from "./medium";
```

- [ ] **Step 2: 写失败测试**

`packages/shared/tests/medium.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { mediumFromCategory } from "../src/medium";

describe("mediumFromCategory（mock 兜底规则）", () => {
  it("剧场版→film", () => expect(mediumFromCategory("movie_announced")).toBe("film"));
  it("BD/周边/活动→goods_event", () => {
    expect(mediumFromCategory("bd_release")).toBe("goods_event");
    expect(mediumFromCategory("merch_release")).toBe("goods_event");
    expect(mediumFromCategory("event_info")).toBe("goods_event");
  });
  it("放送/声优/PV 等动画动态→anime", () => {
    expect(mediumFromCategory("broadcast_date_announced")).toBe("anime");
    expect(mediumFromCategory("cast_announced")).toBe("anime");
    expect(mediumFromCategory("pv_released")).toBe("anime");
    expect(mediumFromCategory("anime_adaptation")).toBe("anime");
  });
  it("other→other", () => expect(mediumFromCategory("other")).toBe("other"));
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run packages/shared/tests/medium.test.ts`
Expected: FAIL，无法解析 `../src/medium`。

- [ ] **Step 4: 实现 medium.ts**

`packages/shared/src/medium.ts`：

```ts
import type { EventCategory } from "./index";
import type { Medium } from "./index";

// mock 无 AI key 时的兜底：仅能从情报类型推断媒介。
// manga/light_novel/game 无法由 category 判断（情报类型与媒介正交），故只在 AI 路径产出。
const GOODS = new Set<EventCategory>(["bd_release", "merch_release", "event_info"]);

export function mediumFromCategory(category: EventCategory): Medium {
  if (category === "movie_announced") return "film";
  if (GOODS.has(category)) return "goods_event";
  if (category === "other") return "other";
  return "anime";
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run packages/shared/tests/medium.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 6: 提交**

```bash
git add packages/shared/src/index.ts packages/shared/src/medium.ts packages/shared/tests/medium.test.ts
git commit -m "feat(shared): Medium 枚举 + mediumFromCategory 兜底规则"
```

---

### Task 2: Event.medium + facts 字段 + 迁移

**Files:**
- Modify: `packages/db/prisma/schema.prisma`（`model Event`，`summaryZh` 之后）
- Create: 新 prisma 迁移（CLI 生成）

**Interfaces:**
- Produces: `Event.medium: string | null`、`Event.facts: Prisma.JsonValue | null`

- [ ] **Step 1: schema 增字段**

`packages/db/prisma/schema.prisma` 的 `model Event` 中 `summaryZh String?` 之后追加：

```prisma
  medium            String?
  facts             Json?
```

- [ ] **Step 2: 启动 Postgres 并生成迁移**

```bash
docker compose up -d postgres
cd packages/db && pnpm exec dotenv -e ../../.env -- prisma migrate dev --name event_medium_facts && cd ../..
```

Expected: 生成 `<时间戳>_event_medium_facts/migration.sql`，内容为 `ALTER TABLE "Event" ADD COLUMN "medium" TEXT, ADD COLUMN "facts" JSONB;`（纯追加，两列可空），Prisma 客户端重新生成。
若 Prisma 提示 RESET/DRIFT/要丢数据 → **停止并报告 BLOCKED**，不要接受 reset。

- [ ] **Step 3: 类型门禁**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: exit 0（客户端含 medium/facts）。

- [ ] **Step 4: 提交**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): Event 加 medium + facts(JSONB) 字段"
```

---

### Task 3: analyze() 扩展输出 medium + leadZh + facts

**Files:**
- Modify: `packages/ai/src/analyze.ts`
- Modify: `packages/ai/src/provider.ts:46`（max_tokens）
- Modify: `packages/ai/tests/analyze.test.ts`

**Interfaces:**
- Consumes: `mediumFromCategory`、`Medium`（`@aniradar/shared`）。
- Produces: `AnalyzeResult` 增 `medium: Medium`、`leadZh: string`、`facts: Record<string, unknown>`。

- [ ] **Step 1: 更新 analyze.test.ts（先让断言失败）**

把 `packages/ai/tests/analyze.test.ts` 第一个用例改为同时断言 medium，并加一个 film 用例：

```ts
  it("回退 mock 并正确分类 + 兜底 medium", async () => {
    const r = await analyze({ title: "「鬼滅の刃」アニメ第2期制作決定" });
    expect(r.source).toBe("mock");
    expect(r.isAnimeNews).toBe(true);
    expect(r.category).toBe("sequel_announced");
    expect(r.medium).toBe("anime");
    expect(r.facts).toEqual({});
    expect(typeof r.leadZh).toBe("string");
  });

  it("剧场版 mock → medium=film", async () => {
    const r = await analyze({ title: "劇場版アニメ 制作決定" });
    expect(r.source).toBe("mock");
    expect(r.medium).toBe("film");
  });
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run packages/ai/tests/analyze.test.ts`
Expected: FAIL（`r.medium`/`r.facts`/`r.leadZh` 未定义）。

- [ ] **Step 3: 改 analyze.ts**

a) import 增 medium 工具：

```ts
import { EVENT_CATEGORIES, type EventCategory, type Medium, MEDIUMS, mediumFromCategory } from "@aniradar/shared";
```

b) `AnalyzeResult` 接口改为：

```ts
export interface AnalyzeResult {
  isAnimeNews: boolean;
  medium: Medium;
  category: EventCategory;
  confidence: number;
  titleZh: string;
  leadZh: string;
  summaryZh: string; // 兼容旧调用：与 leadZh 同值
  facts: Record<string, unknown>;
  source: "ai" | "mock";
}
```

c) `buildSystem()` 的输出字段说明整段替换为（保留前面的判定规则文本不动，只替换从 "summaryZh 要写成…" 到结尾的字段说明部分）：

```ts
    "leadZh 写成一句话简体中文导语（≤60字）：只讲“公布了什么”。",
    "medium 从以下之一选，按“这条情报讲的是哪种媒介的动态”判断（动画化/PV/放送→anime，不看原作）：",
    MEDIUMS.join(", ") + "。拿不准用 other。",
    "facts 输出一个 JSON 对象，只填原文明确陈述的事实字段，未知字段直接省略，不要编造日期/人名。",
    "facts 可用键（按需取）：work,original,studio,director,author,magazine,publisher,illustrator,label,platform,developer,genre,releaseDate,distributor,itemName,date,place,note,expectedAir,season,pvType,duration,pvUrl,kvDate,airDate,broadcaster,streaming,originalDate,newDate,reason,theaters,songType,songTitle,artist,eventName,eventDate,venue,price,spec,volume。",
    "cast/staff 为数组，元素 {role,name}。",
    "只输出一个 JSON 对象，字段：isAnimeNews(boolean), medium(string), category(string), confidence(0~1 number), titleZh(string), leadZh(string), facts(object)。",
    `category 必须是以下之一：${EVENT_CATEGORIES.join(", ")}。非情报时 category 用 "other"。`,
```

d) `mockAnalyze` 改为：

```ts
function mockAnalyze(input: AnalyzeInput): AnalyzeResult {
  const c = classify(input);
  const s = summarize(input);
  const lead = s.summaryZh;
  return {
    isAnimeNews: c.isAnimeNews,
    medium: mediumFromCategory(c.category),
    category: c.category,
    confidence: c.confidence,
    titleZh: s.titleZh,
    leadZh: lead,
    summaryZh: lead,
    facts: {},
    source: "mock",
  };
}
```

e) AI 成功路径的 return（解析 parsed 之后）改为：

```ts
    const rawMedium = String(parsed.medium ?? "other");
    const medium: Medium = (MEDIUMS as readonly string[]).includes(rawMedium)
      ? (rawMedium as Medium)
      : "other";
    const leadZh = String(parsed.leadZh ?? parsed.summaryZh ?? "").trim() || (input.summary ?? "").trim();
    const facts = (parsed.facts && typeof parsed.facts === "object" && !Array.isArray(parsed.facts))
      ? (parsed.facts as Record<string, unknown>)
      : {};

    return {
      isAnimeNews,
      medium: isAnimeNews ? medium : "other",
      category: isAnimeNews ? category : "other",
      confidence,
      titleZh,
      leadZh,
      summaryZh: leadZh,
      facts: isAnimeNews ? facts : {},
      source: "ai",
    };
```

（删除原 return 中的 `summaryZh` 单独计算逻辑，用上面的 leadZh。）

- [ ] **Step 4: provider max_tokens 调大**

`packages/ai/src/provider.ts` 把 `max_tokens: 500` 改为 `max_tokens: 900`。

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run packages/ai/tests/analyze.test.ts`
Expected: PASS（4 个用例：原 2 + 新增断言）。

- [ ] **Step 6: 类型门禁**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: exit 0。

- [ ] **Step 7: 提交**

```bash
git add packages/ai/src/analyze.ts packages/ai/src/provider.ts packages/ai/tests/analyze.test.ts
git commit -m "feat(ai): analyze 扩展输出 medium+leadZh+facts，mock 兜底 medium"
```

---

### Task 4: processClassify 写入 medium/facts

**Files:**
- Create: `apps/worker/src/facts.ts`（共享 `mergeFacts` helper，Task 5 也用）
- Modify: `apps/worker/src/processClassify.ts`

**Interfaces:**
- Consumes: `AnalyzeResult.medium/leadZh/facts`（Task 3）。
- Produces: `function mergeFacts(existing: unknown, incoming: Record<string, unknown>): Record<string, unknown>`（`apps/worker/src/facts.ts`）。

- [ ] **Step 1: 新建 Event 写 medium/facts**

新建分支的 `tx.event.create({ data: {...} })` 中，把 `summaryZh: result.summaryZh,` 一行替换为：

```ts
        summaryZh: result.leadZh,
        medium: result.medium,
        facts: result.facts as object,
```

- [ ] **Step 2: 合并 Event 填空不覆盖 medium/facts**

合并分支的 `tx.event.update({ where: { id: target.id }, data: {...} })`，在 `videoUrl: target.videoUrl ?? signal.videoUrl,` 之后追加：

```ts
          medium: target.medium ?? result.medium,
          facts: mergeFacts(target.facts, result.facts) as object,
```

新建 `apps/worker/src/facts.ts`（Task 5 也 import 它）：

```ts
// 合并事实：以既有为准，仅补既有缺失/空的键（不覆盖已有非空值）。
export function mergeFacts(existing: unknown, incoming: Record<string, unknown>): Record<string, unknown> {
  const base = (existing && typeof existing === "object" && !Array.isArray(existing))
    ? { ...(existing as Record<string, unknown>) }
    : {};
  for (const [k, v] of Object.entries(incoming ?? {})) {
    const cur = base[k];
    const empty = cur == null || (typeof cur === "string" && cur.trim() === "") ||
      (Array.isArray(cur) && cur.length === 0);
    if (empty && v != null) base[k] = v;
  }
  return base;
}
```

并在 `processClassify.ts` 顶部 import 区加：`import { mergeFacts } from "./facts";`

- [ ] **Step 3: 类型门禁**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: exit 0。

- [ ] **Step 4: 提交**

```bash
git add apps/worker/src/processClassify.ts
git commit -m "feat(worker): classify 写入 medium/facts(合并时填空不覆盖)"
```

---

### Task 5: reanalyze 回填 medium/facts + 无 key 一次性补 medium

**Files:**
- Modify: `apps/worker/src/processReanalyze.ts`
- Create: `packages/db/prisma/backfillMedium.ts`

**Interfaces:**
- Consumes: `analyze`、`mergeFacts`（来自 `apps/worker/src/facts.ts`，Task 4 创建）。

- [ ] **Step 1: processReanalyze 回填 medium/facts**

`apps/worker/src/processReanalyze.ts` 中，把 event.update 块：

```ts
  if (signal.eventId) {
    await prisma.event.update({
      where: { id: signal.eventId },
      data: { titleZh: result.titleZh, summaryZh: result.summaryZh },
    });
  }
```

替换为（需读取既有 event 以填空不覆盖）：

```ts
  if (signal.eventId) {
    const ev = await prisma.event.findUnique({ where: { id: signal.eventId }, select: { medium: true, facts: true } });
    await prisma.event.update({
      where: { id: signal.eventId },
      data: {
        titleZh: result.titleZh,
        summaryZh: result.leadZh,
        medium: ev?.medium ?? result.medium,
        facts: mergeFacts(ev?.facts, result.facts) as object,
      },
    });
  }
```

并在 `processReanalyze.ts` 顶部 import 区加：`import { mergeFacts } from "./facts";`

（注意：`result.source !== "ai"` 仍提前 return，故此路径只在 AI 可用时回填真实值。）

- [ ] **Step 2: 无 key 一次性 medium 兜底脚本**

`packages/db/prisma/backfillMedium.ts`：

```ts
import { prisma } from "../src/index";
import { mediumFromCategory } from "@aniradar/shared";

// 给 medium 为空的 Event 按 category 规则补一个兜底 medium（facts 留空）。
// 用于无 AI key 时让历史/新事件也能进对应板块。
async function main() {
  const events = await prisma.event.findMany({ where: { medium: null }, select: { id: true, category: true } });
  let n = 0;
  for (const e of events) {
    await prisma.event.update({ where: { id: e.id }, data: { medium: mediumFromCategory(e.category) } });
    n++;
  }
  console.log(`backfilled medium for ${n} events`);
  await prisma.$disconnect();
}
main();
```

- [ ] **Step 3: 类型门禁**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: exit 0。

- [ ] **Step 4: 运行兜底脚本（可选，DB 在跑时）**

Run: `cd packages/db && pnpm exec dotenv -e ../../.env -- tsx prisma/backfillMedium.ts && cd ../..`
Expected: 打印 `backfilled medium for <N> events`（现有 49 条里 medium 为空的会被补）。

- [ ] **Step 5: 提交**

```bash
git add apps/worker/src/processReanalyze.ts packages/db/prisma/backfillMedium.ts
git commit -m "feat(worker): reanalyze 回填 medium/facts + 无key时一次性按规则补 medium"
```

---

## 阶段二：首页板块导航 + 混合布局

### Task 6: MEDIUM_LABEL + MediumBadge

**Files:**
- Modify: `apps/web/lib/format.ts`（`CATEGORY_LABEL` 之后）
- Create: `apps/web/components/medium-badge.tsx`

**Interfaces:**
- Produces: `MEDIUM_LABEL: Record<string,string>`、`<MediumBadge medium={string|null} />`

- [ ] **Step 1: 加 MEDIUM_LABEL**

`apps/web/lib/format.ts` 在 `CATEGORY_LABEL` 之后追加：

```ts
export const MEDIUM_LABEL: Record<string, string> = {
  anime: "动画",
  manga: "漫画",
  light_novel: "轻小说",
  game: "游戏",
  film: "剧场版",
  goods_event: "周边",
  other: "其它",
};
```

- [ ] **Step 2: MediumBadge 组件**

`apps/web/components/medium-badge.tsx`：

```tsx
import { Badge } from "@/components/ui/badge";
import { MEDIUM_LABEL } from "@/lib/format";

const COLOR: Record<string, string> = {
  anime: "border-sky-500 text-sky-500",
  manga: "border-violet-500 text-violet-500",
  light_novel: "border-emerald-500 text-emerald-500",
  game: "border-amber-500 text-amber-500",
  film: "border-rose-500 text-rose-500",
  goods_event: "border-teal-500 text-teal-500",
  other: "border-[hsl(var(--muted-foreground))] text-[hsl(var(--muted-foreground))]",
};

export function MediumBadge({ medium }: { medium: string | null }) {
  if (!medium) return null;
  return <Badge className={COLOR[medium] ?? COLOR.other}>{MEDIUM_LABEL[medium] ?? medium}</Badge>;
}
```

- [ ] **Step 3: web 构建校验**

Run: `pnpm --filter @aniradar/web build`
Expected: 编译成功（✓ Compiled），exit 0。

- [ ] **Step 4: 提交**

```bash
git add apps/web/lib/format.ts apps/web/components/medium-badge.tsx
git commit -m "feat(web): MEDIUM_LABEL + MediumBadge"
```

---

### Task 7: 板块 tab + 首页 board 过滤 + 混合布局 + 卡片加 medium

**Files:**
- Create: `apps/web/components/board-tabs.tsx`
- Modify: `apps/web/components/event-card.tsx`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `MediumBadge`、`MEDIUM_LABEL`（Task 6）。

- [ ] **Step 1: BoardTabs 组件**

`apps/web/components/board-tabs.tsx`：

```tsx
import Link from "next/link";
import { MEDIUM_LABEL } from "@/lib/format";

const BOARDS = ["anime", "manga", "light_novel", "game", "film", "goods_event"] as const;

export function BoardTabs({ board, sort }: { board?: string; sort?: string }) {
  const sortQ = sort === "hot" ? "&sort=hot" : "";
  const item = (key: string | undefined, label: string) => {
    const active = (key ?? "") === (board ?? "");
    const href = key ? `/?board=${key}${sortQ}` : `/${sort === "hot" ? "?sort=hot" : ""}`;
    return (
      <Link
        key={key ?? "all"}
        href={href}
        className={
          "shrink-0 rounded-md px-3 py-1 text-sm " +
          (active
            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : "border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")
        }
      >
        {label}
      </Link>
    );
  };
  return (
    <div className="flex flex-wrap gap-2">
      {item(undefined, "全部")}
      {BOARDS.map((b) => item(b, MEDIUM_LABEL[b]))}
    </div>
  );
}
```

- [ ] **Step 2: EventCard 加 medium**

`apps/web/components/event-card.tsx`：
1. import 增加：`import { MediumBadge } from "./medium-badge";`
2. `EventCardData` 接口加一行（`category: string;` 之后）：`medium: string | null;`
3. 徽章行里，`<CategoryBadge category={ev.category} />` 之前插入：`<MediumBadge medium={ev.medium} />`

- [ ] **Step 3: 首页 board 过滤 + 混合布局**

`apps/web/app/page.tsx` 整体替换为：

```tsx
import { prisma } from "@aniradar/db";
import { EventCard } from "@/components/event-card";
import { BoardTabs } from "@/components/board-tabs";
import { Flame } from "lucide-react";

export const dynamic = "force-dynamic";

const VISIBLE = ["auto_published", "published", "draft_ai"] as const;
const SELECT = {
  id: true, title: true, titleZh: true, summaryZh: true, imageUrl: true, videoUrl: true,
  category: true, medium: true, status: true, firstSeenAt: true, confidence: true,
  heatScore: true, officialConfirmed: true, _count: { select: { signals: true } },
} as const;

export default async function Home({ searchParams }: { searchParams: { sort?: string; board?: string } }) {
  const sort = searchParams.sort === "hot" ? "hot" : "new";
  const board = searchParams.board;
  const mediumWhere = board ? { medium: board } : {};

  const hotEvents = await prisma.event.findMany({
    where: { status: { in: [...VISIBLE] }, heatScore: { gt: 1 }, ...mediumWhere },
    orderBy: [{ heatScore: "desc" }, { firstSeenAt: "desc" }],
    take: 4,
    select: SELECT,
  });
  const hotIds = hotEvents.map((e) => e.id);

  const mainEvents = await prisma.event.findMany({
    where: { status: { in: [...VISIBLE] }, id: { notIn: hotIds }, ...mediumWhere },
    orderBy: sort === "hot" ? [{ heatScore: "desc" }, { firstSeenAt: "desc" }] : [{ firstSeenAt: "desc" }],
    take: 50,
    select: SELECT,
  });

  const sortHref = (key: "new" | "hot") => {
    const b = board ? `board=${board}` : "";
    if (key === "new") return b ? `/?${b}` : "/";
    return b ? `/?${b}&sort=hot` : "/?sort=hot";
  };

  return (
    <div className="space-y-6">
      <BoardTabs board={board} sort={sort} />

      {hotEvents.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Flame className="h-5 w-5 text-orange-500" />
            热门聚合
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {hotEvents.map((ev) => (
              <EventCard key={ev.id} ev={ev} highlight />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
          <div>
            <h1 className="text-2xl font-bold">实时情报流</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              {sort === "hot" ? "按热度排序" : "按首次发现时间排序"} · 共 {mainEvents.length} 条
            </p>
          </div>
          <div className="flex gap-2">
            <a href={sortHref("new")} className={"rounded-md px-3 py-1 text-sm " + (sort === "new" ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")}>最新发现</a>
            <a href={sortHref("hot")} className={"rounded-md px-3 py-1 text-sm " + (sort === "hot" ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")}>热度</a>
          </div>
        </div>
        {mainEvents.length === 0 && (
          <p className="text-[hsl(var(--muted-foreground))]">该板块暂无情报。</p>
        )}
        {mainEvents.map((ev) => (
          <EventCard key={ev.id} ev={ev} />
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: web 构建校验**

Run: `pnpm --filter @aniradar/web build`
Expected: 编译成功，exit 0。

- [ ] **Step 5: 提交**

```bash
git add apps/web/components/board-tabs.tsx apps/web/components/event-card.tsx apps/web/app/page.tsx
git commit -m "feat(web): 顶部板块 tab + 首页 board 过滤 + 卡片显示 medium"
```

---

## 阶段三：详情页事实模板

### Task 8: 事实模板矩阵 + buildFactRows（纯逻辑 TDD）

**Files:**
- Create: `apps/web/lib/facts.ts`
- Create: `apps/web/tests/facts.test.ts`

**Interfaces:**
- Produces:
  - `type FactRow = { label: string; value: string } | { label: string; list: { sub: string; value: string }[] }`
  - `function buildFactRows(medium: string | null, category: string, facts: unknown): FactRow[]`

- [ ] **Step 1: 写失败测试**

`apps/web/tests/facts.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { buildFactRows } from "../lib/facts";

describe("buildFactRows", () => {
  it("动画+放送日：底字段+专有字段叠加，空字段跳过", () => {
    const rows = buildFactRows("anime", "broadcast_date_announced", {
      work: "鬼灭之刃", studio: "ufotable", airDate: "2024-04", broadcaster: "TOKYO MX",
      director: "", // 空，跳过
    });
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("作品");
    expect(labels).toContain("制作");
    expect(labels).toContain("开播日");
    expect(labels).toContain("放送平台");
    expect(labels).not.toContain("监督"); // 空被跳过
  });

  it("声优解禁：cast 列表渲染为 {sub,value}", () => {
    const rows = buildFactRows("anime", "cast_announced", {
      work: "某作", cast: [{ role: "田中", name: "花泽香菜" }],
    });
    const castRow = rows.find((r) => r.label === "声优");
    expect(castRow && "list" in castRow && castRow.list[0]).toEqual({ sub: "田中", value: "花泽香菜" });
  });

  it("facts 全空 → 空数组", () => {
    expect(buildFactRows("anime", "pv_released", {})).toEqual([]);
  });

  it("未知 medium 不报错，仅取 category 字段", () => {
    const rows = buildFactRows(null, "movie_announced", { releaseDate: "2025-01-01" });
    expect(rows.map((r) => r.label)).toContain("上映日");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run apps/web/tests/facts.test.ts`
Expected: FAIL，无法解析 `../lib/facts`。

- [ ] **Step 3: 实现 facts.ts**

`apps/web/lib/facts.ts`：

```ts
export type FactRow =
  | { label: string; value: string }
  | { label: string; list: { sub: string; value: string }[] };

// [key, label] 有序数组
const MEDIUM_BASE: Record<string, [string, string][]> = {
  anime: [["work", "作品"], ["original", "原作"], ["studio", "制作"], ["director", "监督"]],
  manga: [["work", "作品"], ["author", "作者"], ["magazine", "连载"], ["publisher", "出版社"]],
  light_novel: [["work", "作品"], ["author", "作者"], ["illustrator", "插画"], ["label", "文库"]],
  game: [["work", "作品"], ["platform", "平台"], ["developer", "开发/发行"], ["genre", "类型"]],
  film: [["work", "作品"], ["releaseDate", "上映日"], ["distributor", "发行/院线"], ["director", "监督"]],
  goods_event: [["work", "作品"], ["itemName", "名称"], ["date", "日期"], ["place", "地点"]],
  other: [["work", "作品"], ["note", "说明"]],
};

const CATEGORY_FIELDS: Record<string, [string, string][]> = {
  anime_adaptation: [["studio", "制作"], ["expectedAir", "开播预定"]],
  sequel_announced: [["season", "季数/续作"]],
  pv_released: [["pvType", "PV类型"], ["duration", "时长"], ["pvUrl", "链接"]],
  key_visual_released: [["kvDate", "公开日"]],
  cast_announced: [["cast", "声优"]],
  staff_announced: [["staff", "STAFF"]],
  broadcast_date_announced: [["airDate", "开播日"], ["broadcaster", "放送平台"], ["streaming", "配信"]],
  delay_announced: [["originalDate", "原定"], ["newDate", "延期至"], ["reason", "原因"]],
  movie_announced: [["releaseDate", "上映日"], ["theaters", "院线"]],
  theme_song_announced: [["songType", "OP/ED"], ["songTitle", "曲名"], ["artist", "艺人"]],
  event_info: [["eventName", "活动"], ["eventDate", "日期"], ["venue", "地点"]],
  merch_release: [["itemName", "商品"], ["releaseDate", "发售日"], ["price", "价格"], ["spec", "规格"]],
  bd_release: [["volume", "卷/话"], ["releaseDate", "发售日"], ["price", "价格"], ["spec", "规格"]],
  other: [],
};

const LIST_KEYS = new Set(["cast", "staff"]);

export function buildFactRows(medium: string | null, category: string, facts: unknown): FactRow[] {
  const obj = (facts && typeof facts === "object" && !Array.isArray(facts))
    ? (facts as Record<string, unknown>)
    : {};
  const pairs = [...(MEDIUM_BASE[medium ?? "other"] ?? []), ...(CATEGORY_FIELDS[category] ?? [])];
  const seen = new Set<string>();
  const rows: FactRow[] = [];
  for (const [key, label] of pairs) {
    if (seen.has(key)) continue;
    seen.add(key);
    const v = obj[key];
    if (LIST_KEYS.has(key)) {
      if (Array.isArray(v) && v.length) {
        const list = v
          .map((e) => {
            const o = (e && typeof e === "object") ? (e as Record<string, unknown>) : {};
            return { sub: String(o.role ?? "").trim(), value: String(o.name ?? "").trim() };
          })
          .filter((x) => x.value);
        if (list.length) rows.push({ label, list });
      }
      continue;
    }
    if (v != null && String(v).trim() !== "") rows.push({ label, value: String(v) });
  }
  return rows;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run apps/web/tests/facts.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/lib/facts.ts apps/web/tests/facts.test.ts
git commit -m "feat(web): 事实模板矩阵 + buildFactRows(板块底字段+情报类型专有字段)"
```

---

### Task 9: FactTable 组件 + 详情页改版

**Files:**
- Create: `apps/web/components/fact-table.tsx`
- Modify: `apps/web/app/events/[id]/page.tsx`

**Interfaces:**
- Consumes: `buildFactRows`/`FactRow`（Task 8）、`MediumBadge`（Task 6）。

- [ ] **Step 1: FactTable 组件**

`apps/web/components/fact-table.tsx`：

```tsx
import { buildFactRows } from "@/lib/facts";

export function FactTable({ medium, category, facts }: { medium: string | null; category: string; facts: unknown }) {
  const rows = buildFactRows(medium, category, facts);
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[5rem_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map((r, i) => (
        <div key={i} className="contents">
          <dt className="text-[hsl(var(--muted-foreground))]">{r.label}</dt>
          <dd className="min-w-0">
            {"value" in r ? (
              <span className="break-words">{r.value}</span>
            ) : (
              <ul className="space-y-0.5">
                {r.list.map((it, j) => (
                  <li key={j} className="break-words">
                    <span className="text-[hsl(var(--muted-foreground))]">{it.sub}</span>
                    {it.sub ? " → " : ""}
                    {it.value}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 2: 详情页查询补 medium/facts + 渲染**

`apps/web/app/events/[id]/page.tsx`：
1. 顶部 import 增加：
```ts
import { FactTable } from "@/components/fact-table";
import { MediumBadge } from "@/components/medium-badge";
```
2. 徽章行 `<CategoryBadge category={ev.category} />` 之前插入：`<MediumBadge medium={ev.medium} />`
3. 把「AI 摘要」那一段 `<section>`：

```tsx
        <section className="rounded-md border bg-[hsl(var(--card))] p-4">
          <h2 className="mb-2 text-sm font-semibold text-[hsl(var(--muted-foreground))]">AI 摘要</h2>
          <p className="leading-7">{ev.summaryZh || "（暂无摘要）"}</p>
        </section>
```

替换为「导语 + 事实表」：

```tsx
        <section className="space-y-4 rounded-md border bg-[hsl(var(--card))] p-4">
          <p className="leading-7">{ev.summaryZh || "（暂无导语）"}</p>
          <FactTable medium={ev.medium} category={ev.category} facts={ev.facts} />
        </section>
```

（`ev` 由 `prisma.event.findUnique` 取，默认返回全部标量列，已含 `medium`/`facts`，无需改 select。）

- [ ] **Step 3: web 构建校验**

Run: `pnpm --filter @aniradar/web build`
Expected: 编译成功，exit 0。

- [ ] **Step 4: 提交**

```bash
git add apps/web/components/fact-table.tsx apps/web/app/events/[id]/page.tsx
git commit -m "feat(web): 详情页改为一句话导语 + 结构化事实表"
```

---

## 阶段四：UI 打磨

### Task 10: 紧凑列表关键事实 inline + 视觉细节

**Files:**
- Modify: `apps/web/components/event-card.tsx`

**Interfaces:**
- Consumes: `buildFactRows`（Task 8）。

- [ ] **Step 1: 卡片底部加 1 条关键事实 inline**

`apps/web/components/event-card.tsx`：
1. import 增加：`import { buildFactRows } from "@/lib/facts";`
2. `EventCardData` 接口加：`facts: unknown;`（`medium` 之后）
3. 组件内 `const multiSource = ...` 之后加：

```tsx
  const keyFact = buildFactRows(ev.medium, ev.category, ev.facts).find((r) => "value" in r) as
    | { label: string; value: string }
    | undefined;
```

4. 在 summaryZh 的 `<p>` 之后插入：

```tsx
          {keyFact && (
            <p className="text-xs text-[hsl(var(--foreground))]">
              <span className="text-[hsl(var(--muted-foreground))]">{keyFact.label}</span> {keyFact.value}
            </p>
          )}
```

- [ ] **Step 2: 首页/详情查询确保带 facts**

确认 `apps/web/app/page.tsx` 的 `SELECT` 含 `facts: true`（Task 7 的 SELECT 未含 facts，此处补上）：在 `SELECT` 对象的 `medium: true,` 之后加 `facts: true,`。

- [ ] **Step 3: web 构建校验**

Run: `pnpm --filter @aniradar/web build`
Expected: 编译成功，exit 0。

- [ ] **Step 4: 提交**

```bash
git add apps/web/components/event-card.tsx apps/web/app/page.tsx
git commit -m "feat(web): 情报卡片显示一条关键事实 inline"
```

---

## Task 11: 全量验证

**Files:** 无改动（仅校验）。

- [ ] **Step 1: worker 类型门禁**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: 无输出，exit 0。

- [ ] **Step 2: 全量测试**

Run: `npx vitest run`
Expected: 全绿。原 44 + 新增（medium 4 + analyze 改 + facts 4）共约 52 个用例通过。

- [ ] **Step 3: 全量构建（含 web）**

Run: `pnpm -r build`
Expected: 有 build 脚本的项目全部成功，含 `apps/web`，exit 0。

- [ ] **Step 4: 迁移核对**

确认新迁移 SQL 仅 `ADD COLUMN "medium" TEXT, ADD COLUMN "facts" JSONB`，schema 的 Event 含 `medium String?` + `facts Json?`。

- [ ] **Step 5（可选）: 端到端冒烟**

DB+Redis 在跑时：跑过 Task 5 的 backfillMedium 脚本后，访问 `http://localhost:3000/?board=anime` 看板块过滤；打开一个事件详情看事实表（有 key 时字段更丰富，无 key 时至少有底字段中 mock 能填的部分/导语）。

---

## Self-Review 记录

- **Spec coverage**：A 数据模型→Task 1/2；B AI 抽取→Task 3，写入→Task 4，回填→Task 5；C 事实矩阵→Task 8；D 前端(tab/首页)→Task 6/7，(详情)→Task 9；UI 打磨→Task 10；E 回填→Task 5；F 分期→Task 分组对应。无遗漏。
- **类型一致性**：`Medium`/`mediumFromCategory`(Task1)→Task3/5 消费；`AnalyzeResult.medium/leadZh/facts`(Task3)→Task4/5 写入；`mergeFacts`(Task4 建于 `apps/worker/src/facts.ts`)→Task5 import；`buildFactRows`/`FactRow`(Task8)→Task9/10 消费；`MediumBadge`(Task6)→Task7/9；EventCardData 增 `medium`+`facts` 与 page.tsx SELECT 对齐(Task7 加 medium、Task10 补 facts)。
- **占位符**：无 TODO/TBD；每个代码步骤给出完整代码或精确 before→after。
- **已知取舍**：mock 无 key 只能推 anime/film/goods/other，manga/轻小说/游戏靠 AI；`mergeFacts` 抽到 `apps/worker/src/facts.ts` 由 processClassify/processReanalyze 共享(同包，不跨 web/worker)。
