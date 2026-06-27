# Worker 健壮性改进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 worker 抓取/分类链路补齐四项健壮性：详情页增强限流、classify 瞬时错误重试、AI 恢复后重分析、fetch 失败重试。

**Architecture:** 把"瞬时/永久错误判定 + 末次才做终态记账"抽成共享纯函数 `retry.ts`，classify 与 fetch 通过 BullMQ `attempts`+指数退避重试。增强限流抽成纯函数 `pickToEnrich`。重分析新增独立队列 `reanalyzeQueue` + 处理器，由 scheduler 周期性把 mock 定型的 signal 入队，AI 恢复后只升级译文、不重新合并/计热以保持幂等。

**Tech Stack:** TypeScript (ESM)、pnpm workspace、BullMQ 5.79.1、Prisma 5、Vitest 2、Postgres 16、Redis 7。

## Global Constraints

- 提交信息不带任何协作者署名（无 `Co-Authored-By` 尾行）。
- 所有 env 读取沿用 `packages/config/src/index.ts` 的惰性 getter + `Number(process.env.X ?? 默认)` 风格。
- BullMQ 5.79.1：处理器内 `job.attemptsMade` 首跑为 0、每次失败后递增；末次判定用 `attemptsMade + 1 < maxAttempts`。
- 重分析只升级 `titleZh`/`summaryZh`，绝不改 `category`/`heatScore`/`officialConfirmed`/`eventId`，也不触发合并。
- 错误判定：Prisma `code` 以 `P1` 开头=瞬时（连接/初始化），`P2` 开头=永久（数据/约束）；常见网络 code（`ECONNREFUSED`/`ECONNRESET`/`ETIMEDOUT`/`EAI_AGAIN`）=瞬时；无 `code` 的未知错误=瞬时（保守重试，受 attempts 上限约束）。

---

## File Structure

- `apps/worker/src/retry.ts`（新）— 错误重试判定纯逻辑。
- `apps/worker/src/enrichPlan.ts`（新）— 增强限流挑选纯逻辑。
- `apps/worker/src/reanalyzePlan.ts`（新）— 是否重分析判定纯逻辑。
- `apps/worker/src/processReanalyze.ts`（新）— 重分析处理器。
- `apps/worker/src/processFetch.ts`（改）— 限流接线 + 失败重试。
- `apps/worker/src/processClassify.ts`（改）— 重试接线 + 写 `aiSource`。
- `apps/worker/src/queues.ts`（改）— 三个队列的 `defaultJobOptions` + 新增 `reanalyzeQueue`。
- `apps/worker/src/index.ts`（改）— worker 传 ctx、新增 reanalyze worker、调度 timers 管理。
- `apps/worker/src/scheduler.ts`（改）— 新增 `reanalyzeTick` 与第二个 interval。
- `apps/worker/tests/*.test.ts`（新）— 纯逻辑单测。
- `packages/config/src/index.ts`（改）— 新增 4 个 env getter。
- `packages/shared/src/index.ts`（改）— `QUEUE_REANALYZE` + `ReanalyzeJobData`。
- `packages/ai/src/provider.ts` + `index.ts`（改）— 导出 `isAiConfigured`。
- `packages/db/prisma/schema.prisma`（改）+ 新迁移 — `Signal.aiSource`。
- `vitest.config.ts`（改）— include 覆盖 `apps/**/tests`。

---

## 校验门禁说明（重要）

`pnpm -r build` **只覆盖有 `build` 脚本的项目**：`apps/worker` 以及 `packages/parser`、`sources`、`crawler`、`detector`、`config`、`shared` 等**无 build 脚本**，不会被它类型检查。worker 用 `tsx` 运行也不做类型检查。

因此本计划统一用 **`npx tsc -p apps/worker/tsconfig.json --noEmit`** 作为类型门禁：它从 worker 源码沿 import 把上述包的源码**一并类型检查**，覆盖最全。`pnpm -r build` 仅在 Task 9 用于校验 `apps/web`（Next.js）。

---

## Task 0: 修复既有类型错误（执行前置）

发现一处**潜伏的真实类型错误**：`packages/parser/src/youtube.ts:15` 的 `(it: Record<string, unknown>)` 标注与 rss-parser 的 item 类型不兼容（`error TS2345`，缺索引签名）。因 parser 无 build 脚本，`pnpm -r build` 与 vitest（esbuild 不做类型检查）都漏掉了它；只有 worker 类型门禁能暴露。必须先修，否则后续每个任务的类型门禁都会因这条历史错误而失败。

**Files:**
- Modify: `packages/parser/src/youtube.ts:15`

- [ ] **Step 1: 复现错误**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: FAIL，报 `packages/parser/src/youtube.ts(15,37): error TS2345 ...`。

- [ ] **Step 2: 去掉错误标注，交给类型推断**

把 `packages/parser/src/youtube.ts` 第 15 行：

```ts
  return (feed.items ?? []).flatMap((it: Record<string, unknown>) => {
```

改为：

```ts
  return (feed.items ?? []).flatMap((it) => {
```

（推断后 `it` 为 rss-parser 的 item 类型，`it.link`/`it.videoId`/`it.isoDate` 仍可用，运行时行为不变。）

- [ ] **Step 3: 确认类型门禁通过**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: 无输出，exit 0。

- [ ] **Step 4: 确认 youtube 解析测试仍通过**

Run: `npx vitest run packages/parser/tests/youtube.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/parser/src/youtube.ts
git commit -m "fix(parser): 去掉 youtube 解析中与 rss-parser item 不兼容的类型标注"
```

---

## Task 1: retry 工具 + 扩展 vitest 覆盖 apps

**Files:**
- Create: `apps/worker/src/retry.ts`
- Create: `apps/worker/tests/retry.test.ts`
- Modify: `vitest.config.ts:4`

**Interfaces:**
- Produces:
  - `interface RetryCtx { attemptsMade: number; maxAttempts: number }`
  - `function isTransientError(e: unknown): boolean`
  - `function shouldRetry(e: unknown, ctx: RetryCtx | undefined): boolean`

- [ ] **Step 1: 扩展 vitest include 覆盖 apps 测试**

把 `vitest.config.ts` 改为：

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["packages/**/tests/**/*.test.ts", "apps/**/tests/**/*.test.ts"] },
});
```

- [ ] **Step 2: 写失败测试**

新建 `apps/worker/tests/retry.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { isTransientError, shouldRetry } from "../src/retry";

describe("isTransientError", () => {
  it("Prisma P1 连接类错误视为瞬时", () => {
    expect(isTransientError({ code: "P1001" })).toBe(true);
  });
  it("Prisma P2 数据类错误视为永久", () => {
    expect(isTransientError({ code: "P2002" })).toBe(false);
  });
  it("常见网络错误视为瞬时", () => {
    expect(isTransientError({ code: "ECONNRESET" })).toBe(true);
  });
  it("无 code 的错误视为瞬时", () => {
    expect(isTransientError(new Error("boom"))).toBe(true);
  });
  it("其它已知 code 视为永久", () => {
    expect(isTransientError({ code: "EXYZ" })).toBe(false);
  });
});

describe("shouldRetry", () => {
  const ctx = (attemptsMade: number, maxAttempts: number) => ({ attemptsMade, maxAttempts });
  it("瞬时错误且未到末次 → 重试", () => {
    expect(shouldRetry({ code: "P1001" }, ctx(0, 3))).toBe(true);
    expect(shouldRetry({ code: "P1001" }, ctx(1, 3))).toBe(true);
  });
  it("末次不再重试", () => {
    expect(shouldRetry({ code: "P1001" }, ctx(2, 3))).toBe(false);
  });
  it("永久错误不重试", () => {
    expect(shouldRetry({ code: "P2002" }, ctx(0, 3))).toBe(false);
  });
  it("无 ctx 不重试", () => {
    expect(shouldRetry({ code: "P1001" }, undefined)).toBe(false);
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run apps/worker/tests/retry.test.ts`
Expected: FAIL，提示无法解析 `../src/retry`。

- [ ] **Step 4: 实现 retry.ts**

新建 `apps/worker/src/retry.ts`：

```ts
export interface RetryCtx {
  attemptsMade: number;
  maxAttempts: number;
}

const TRANSIENT_NET_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"]);

// 瞬时错误：值得重试。Prisma 连接/初始化类（code P1*）或常见网络错误，或无 code 的未知错误。
// 永久错误：Prisma 数据/约束类（P2*）及其它已知 code，不重试。
export function isTransientError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === "string") {
    if (code.startsWith("P1")) return true;
    if (code.startsWith("P2")) return false;
    if (TRANSIENT_NET_CODES.has(code)) return true;
    return false;
  }
  return true;
}

export function shouldRetry(e: unknown, ctx: RetryCtx | undefined): boolean {
  if (!ctx) return false;
  return isTransientError(e) && ctx.attemptsMade + 1 < ctx.maxAttempts;
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run apps/worker/tests/retry.test.ts`
Expected: PASS（9 个用例）。

- [ ] **Step 6: 提交**

```bash
git add apps/worker/src/retry.ts apps/worker/tests/retry.test.ts vitest.config.ts
git commit -m "feat(worker): 新增 retry 工具(瞬时/永久错误判定)+ vitest 覆盖 apps 测试"
```

---

## Task 2: enrich 限流（pickToEnrich + processFetch 接线）

**Files:**
- Create: `apps/worker/src/enrichPlan.ts`
- Create: `apps/worker/tests/enrichPlan.test.ts`
- Modify: `packages/config/src/index.ts:23`（在 `crawlerTimeoutMs` getter 后追加）
- Modify: `apps/worker/src/processFetch.ts:1-2,31-47`

**Interfaces:**
- Consumes: `FetchedItem`（来自 `@aniradar/shared`）。
- Produces:
  - `interface FreshEntry { item: FetchedItem; hash: string }`
  - `function pickToEnrich(fresh: FreshEntry[], max: number): { toEnrich: FreshEntry[]; rest: FreshEntry[] }`
  - `env.enrichMaxPerCycle: number`

- [ ] **Step 1: 写失败测试**

新建 `apps/worker/tests/enrichPlan.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { pickToEnrich, type FreshEntry } from "../src/enrichPlan";

function entry(hash: string, ts?: number): FreshEntry {
  return {
    hash,
    item: {
      title: hash,
      url: `https://x/${hash}`,
      publishedAt: ts === undefined ? undefined : new Date(ts),
      publishedTimePrecision: "unknown",
    },
  };
}

describe("pickToEnrich", () => {
  it("按 publishedAt 倒序取前 max 条增强", () => {
    const fresh = [entry("a", 1000), entry("b", 3000), entry("c", 2000)];
    const { toEnrich, rest } = pickToEnrich(fresh, 2);
    expect(toEnrich.map((e) => e.hash)).toEqual(["b", "c"]);
    expect(rest.map((e) => e.hash)).toEqual(["a"]);
  });
  it("无日期的条目排在末尾", () => {
    const fresh = [entry("a"), entry("b", 5000)];
    const { toEnrich } = pickToEnrich(fresh, 1);
    expect(toEnrich.map((e) => e.hash)).toEqual(["b"]);
  });
  it("max >= 长度时 rest 为空", () => {
    const fresh = [entry("a", 1), entry("b", 2)];
    expect(pickToEnrich(fresh, 5).rest).toEqual([]);
  });
  it("max <= 0 时全部进 rest", () => {
    const fresh = [entry("a", 1)];
    const { toEnrich, rest } = pickToEnrich(fresh, 0);
    expect(toEnrich).toEqual([]);
    expect(rest.map((e) => e.hash)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run apps/worker/tests/enrichPlan.test.ts`
Expected: FAIL，无法解析 `../src/enrichPlan`。

- [ ] **Step 3: 实现 enrichPlan.ts**

新建 `apps/worker/src/enrichPlan.ts`：

```ts
import type { FetchedItem } from "@aniradar/shared";

export interface FreshEntry {
  item: FetchedItem;
  hash: string;
}

// 按 publishedAt 倒序（无日期排末尾）稳定排序后，切出需增强的前 max 条与其余。
export function pickToEnrich(
  fresh: FreshEntry[],
  max: number,
): { toEnrich: FreshEntry[]; rest: FreshEntry[] } {
  const sorted = [...fresh].sort((a, b) => {
    const ta = a.item.publishedAt ? a.item.publishedAt.getTime() : -Infinity;
    const tb = b.item.publishedAt ? b.item.publishedAt.getTime() : -Infinity;
    return tb - ta;
  });
  const cap = Math.max(0, max);
  return { toEnrich: sorted.slice(0, cap), rest: sorted.slice(cap) };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run apps/worker/tests/enrichPlan.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: 新增 env getter**

在 `packages/config/src/index.ts` 的 `crawlerTimeoutMs` getter 之后、对象闭合 `}` 之前追加：

```ts
  get enrichMaxPerCycle() {
    return Number(process.env.ENRICH_MAX_PER_CYCLE ?? 12);
  },
```

- [ ] **Step 6: processFetch 接入限流**

`apps/worker/src/processFetch.ts` 顶部 import 区，在 `import { classifyQueue } from "./queues";` 之后追加两行：

```ts
import { env } from "@aniradar/config";
import { pickToEnrich } from "./enrichPlan";
```

把现有这段（从 `// 先按 hash 找出新条目...` 到 for 循环头）：

```ts
    // 先按 hash 找出新条目，仅对新条目抓详情页增强（正文全文 + 主图），避免对重复项浪费请求。
    const hashed = result.items.map((item) => ({ item, hash: computeSignalHash(source.id, item) }));
    const existing = await prisma.signal.findMany({
      where: { hash: { in: hashed.map((h) => h.hash) } },
      select: { hash: true },
    });
    const existingHashes = new Set(existing.map((e) => e.hash));
    const fresh = hashed.filter((h) => !existingHashes.has(h.hash));
    const enriched = await enrichItems(
      fresh.map((h) => h.item),
      source.fetchStrategy,
    );

    let newCount = 0;
    for (let i = 0; i < fresh.length; i++) {
      const item = enriched[i];
      const hash = fresh[i].hash;
```

替换为：

```ts
    // 先按 hash 找出新条目，仅对新条目抓详情页增强（正文全文 + 主图），避免对重复项浪费请求。
    const hashed = result.items.map((item) => ({ item, hash: computeSignalHash(source.id, item) }));
    const existing = await prisma.signal.findMany({
      where: { hash: { in: hashed.map((h) => h.hash) } },
      select: { hash: true },
    });
    const existingHashes = new Set(existing.map((e) => e.hash));
    const fresh = hashed.filter((h) => !existingHashes.has(h.hash));

    // 限流：仅对最新 enrichMaxPerCycle 条抓详情页，其余照常入库但不增强。
    const { toEnrich, rest } = pickToEnrich(fresh, env.enrichMaxPerCycle);
    const enrichedItems = await enrichItems(
      toEnrich.map((e) => e.item),
      source.fetchStrategy,
    );
    const ordered = [...toEnrich, ...rest];
    const enriched = [...enrichedItems, ...rest.map((e) => e.item)];

    let newCount = 0;
    for (let i = 0; i < ordered.length; i++) {
      const item = enriched[i];
      const hash = ordered[i].hash;
```

（循环体其余不变；`enrichItems` 仍从 `@aniradar/sources` 导入，保持不动。）

- [ ] **Step 7: 类型门禁 + 测试**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: 无输出，exit 0。再跑 `npx vitest run apps/worker/tests/enrichPlan.test.ts` 确认仍 PASS。

- [ ] **Step 8: 提交**

```bash
git add apps/worker/src/enrichPlan.ts apps/worker/tests/enrichPlan.test.ts packages/config/src/index.ts apps/worker/src/processFetch.ts
git commit -m "feat(worker): 详情页增强按 publishedAt 倒序限流(默认每轮12条)"
```

---

## Task 3: classify 瞬时错误重试

**Files:**
- Modify: `apps/worker/src/queues.ts:6`
- Modify: `apps/worker/src/index.ts:13-16`
- Modify: `apps/worker/src/processClassify.ts:9,96-98`

**Interfaces:**
- Consumes: `shouldRetry`, `RetryCtx`（来自 `./retry`，Task 1）。

- [ ] **Step 1: classifyQueue 加重试配置**

`apps/worker/src/queues.ts` 把 `classifyQueue` 定义改为：

```ts
export const classifyQueue = new Queue(QUEUE_CLASSIFY, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 500,
  },
});
```

- [ ] **Step 2: worker 传入重试 ctx**

`apps/worker/src/index.ts` 把 classifyWorker 定义改为：

```ts
const classifyWorker = new Worker(
  QUEUE_CLASSIFY,
  async (job) =>
    processClassify(job.data, {
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
    }),
  { connection: redisConnection, concurrency: 1 },
);
```

- [ ] **Step 3: processClassify 接受 ctx 并按瞬时错误重抛**

`apps/worker/src/processClassify.ts`：
1. 顶部 import 区追加：`import { shouldRetry, type RetryCtx } from "./retry";`
2. 函数签名改为：`export async function processClassify(data: ClassifyJobData, ctx?: RetryCtx): Promise<void> {`
3. 末尾 catch 块从：

```ts
  } catch {
    await prisma.signal.update({ where: { id: signal.id }, data: { status: "failed" } });
  }
```

改为：

```ts
  } catch (e) {
    if (shouldRetry(e, ctx)) throw e; // 瞬时错误（多为 DB 抖动）交 BullMQ 重试
    await prisma.signal.update({ where: { id: signal.id }, data: { status: "failed" } });
  }
```

- [ ] **Step 4: 类型门禁**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: 无输出，exit 0。

- [ ] **Step 5: 提交**

```bash
git add apps/worker/src/queues.ts apps/worker/src/index.ts apps/worker/src/processClassify.ts
git commit -m "feat(worker): classify 队列 attempts=3 指数退避，瞬时错误重试、末次才标 failed"
```

---

## Task 4: fetch 失败重试

**Files:**
- Modify: `apps/worker/src/queues.ts:5`
- Modify: `apps/worker/src/index.ts:8-11`
- Modify: `apps/worker/src/processFetch.ts:7,94-104`

**Interfaces:**
- Consumes: `shouldRetry`, `RetryCtx`（来自 `./retry`，Task 1）。

- [ ] **Step 1: fetchQueue 加重试配置**

`apps/worker/src/queues.ts` 把 `fetchQueue` 定义改为：

```ts
export const fetchQueue = new Queue(QUEUE_FETCH, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});
```

- [ ] **Step 2: worker 传入重试 ctx**

`apps/worker/src/index.ts` 把 fetchWorker 定义改为：

```ts
const fetchWorker = new Worker(
  QUEUE_FETCH,
  async (job) =>
    processFetch(job.data, {
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
    }),
  { connection: redisConnection, concurrency: 4 },
);
```

- [ ] **Step 3: processFetch 接受 ctx，瞬时错误重抛、末次才记 failureCount**

`apps/worker/src/processFetch.ts`：
1. 顶部 import 区追加：`import { shouldRetry, type RetryCtx } from "./retry";`
2. 函数签名改为：`export async function processFetch(data: FetchJobData, ctx?: RetryCtx): Promise<void> {`
3. 末尾 catch 块从：

```ts
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.source.update({
      where: { id: source.id },
      data: { lastCheckedAt: new Date(), failureCount: { increment: 1 } },
    });
    await prisma.fetchLog.update({
      where: { id: log.id },
      data: { status: "failed", message, endedAt: new Date() },
    });
  }
```

改为：

```ts
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.fetchLog.update({
      where: { id: log.id },
      data: { status: "failed", message, endedAt: new Date() },
    });
    if (shouldRetry(e, ctx)) throw e; // 瞬时网络错误交 BullMQ 重试
    await prisma.source.update({
      where: { id: source.id },
      data: { lastCheckedAt: new Date(), failureCount: { increment: 1 } },
    });
  }
```

- [ ] **Step 4: 类型门禁**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: 无输出，exit 0。

- [ ] **Step 5: 提交**

```bash
git add apps/worker/src/queues.ts apps/worker/src/index.ts apps/worker/src/processFetch.ts
git commit -m "feat(worker): fetch 队列 attempts=3 指数退避，瞬时错误重试、末次才累加 failureCount"
```

---

## Task 5: Signal.aiSource 字段 + 迁移 + processClassify 写入

**Files:**
- Modify: `packages/db/prisma/schema.prisma`（Signal model，`videoUrl` 之后）
- Create: 新 prisma 迁移目录（由 CLI 生成）
- Modify: `apps/worker/src/processClassify.ts`（三条 signal.update）

**Interfaces:**
- Produces: `Signal.aiSource: string | null`（Prisma 客户端字段）。

- [ ] **Step 1: schema 增字段**

`packages/db/prisma/schema.prisma` 的 `model Signal` 中，`videoUrl String?` 一行之后追加：

```prisma
  aiSource               String?
```

- [ ] **Step 2: 启动 Postgres 并生成迁移**

确保 Postgres 运行（compose 服务名 `postgres`，映射端口 5433）：

```bash
docker compose up -d postgres
cd packages/db && pnpm exec dotenv -e ../../.env -- prisma migrate dev --name signal_ai_source && cd ../..
```

Expected: 在 `packages/db/prisma/migrations/` 下生成 `<时间戳>_signal_ai_source/migration.sql`，内容为 `ALTER TABLE "Signal" ADD COLUMN "aiSource" TEXT;`，且 Prisma 客户端已重新生成。
（若提示找不到 `dotenv`，改用：`cd packages/db && DATABASE_URL="$(grep -m1 '^DATABASE_URL=' ../../.env | cut -d= -f2-)" pnpm exec prisma migrate dev --name signal_ai_source && cd ../..`）

- [ ] **Step 3: processClassify 三处写入 aiSource**

`apps/worker/src/processClassify.ts`：

a) `ignored` 分支：

```ts
        data: { status: "ignored", titleZh: result.titleZh },
```
改为：
```ts
        data: { status: "ignored", titleZh: result.titleZh, aiSource: result.source },
```

b) 合并分支的 signal.update：

```ts
        data: { status: "classified", eventId: target.id, titleZh: result.titleZh },
```
改为：
```ts
        data: { status: "classified", eventId: target.id, titleZh: result.titleZh, aiSource: result.source },
```

c) 新建分支的 signal.update：

```ts
      data: { status: "classified", eventId: event.id, titleZh: result.titleZh },
```
改为：
```ts
      data: { status: "classified", eventId: event.id, titleZh: result.titleZh, aiSource: result.source },
```

- [ ] **Step 4: 类型门禁**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: 无输出，exit 0（Prisma 客户端已含 `aiSource`，worker 沿 import 校验通过）。

- [ ] **Step 5: 提交**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations apps/worker/src/processClassify.ts
git commit -m "feat(db): Signal.aiSource 记录分类来源(ai/mock)，processClassify 写入"
```

---

## Task 6: reanalyze 基建（shared 常量 + ai 导出 + 队列 + env）

**Files:**
- Modify: `packages/shared/src/index.ts:80-89`
- Modify: `packages/ai/src/provider.ts`（getAiConfig 之后）
- Modify: `packages/ai/src/index.ts`
- Modify: `apps/worker/src/queues.ts`
- Modify: `packages/config/src/index.ts`（enrichMaxPerCycle getter 之后）

**Interfaces:**
- Produces:
  - `QUEUE_REANALYZE: string`、`interface ReanalyzeJobData { signalId: string }`（`@aniradar/shared`）
  - `function isAiConfigured(): boolean`（`@aniradar/ai`）
  - `reanalyzeQueue: Queue`（`./queues`）
  - `env.reanalyzeIntervalMs / reanalyzeWindowHours / reanalyzeBatch: number`

- [ ] **Step 1: shared 增常量与类型**

`packages/shared/src/index.ts` 在 `export const QUEUE_CLASSIFY = "classify-signal";` 之后追加：

```ts
export const QUEUE_REANALYZE = "reanalyze-signal";
```

并在文件末尾 `ClassifyJobData` 接口之后追加：

```ts
export interface ReanalyzeJobData {
  signalId: string;
}
```

- [ ] **Step 2: ai 导出 isAiConfigured**

`packages/ai/src/provider.ts` 在 `getAiConfig` 函数之后追加：

```ts
// 是否配置了可用的 AI（有 API key）。供调度判断要不要尝试重分析。
export function isAiConfigured(): boolean {
  return getAiConfig() !== null;
}
```

`packages/ai/src/index.ts` 把：

```ts
export { getAiConfig } from "./provider";
```
改为：
```ts
export { getAiConfig, isAiConfigured } from "./provider";
```

- [ ] **Step 3: 新增 reanalyzeQueue**

`apps/worker/src/queues.ts`：
1. 顶部 import 增加 `QUEUE_REANALYZE`：

```ts
import { QUEUE_FETCH, QUEUE_CLASSIFY, QUEUE_REANALYZE } from "@aniradar/shared";
```

2. 文件末尾追加：

```ts
export const reanalyzeQueue = new Queue(QUEUE_REANALYZE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 200,
  },
});
```

- [ ] **Step 4: config 增 3 个 env getter**

`packages/config/src/index.ts` 在 `enrichMaxPerCycle` getter 之后追加：

```ts
  get reanalyzeIntervalMs() {
    return Number(process.env.REANALYZE_INTERVAL_MS ?? 600000);
  },
  get reanalyzeWindowHours() {
    return Number(process.env.REANALYZE_WINDOW_HOURS ?? 168);
  },
  get reanalyzeBatch() {
    return Number(process.env.REANALYZE_BATCH ?? 20);
  },
```

- [ ] **Step 5: 类型门禁**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: 无输出，exit 0。

- [ ] **Step 6: 提交**

```bash
git add packages/shared/src/index.ts packages/ai/src/provider.ts packages/ai/src/index.ts apps/worker/src/queues.ts packages/config/src/index.ts
git commit -m "feat: reanalyze 基建(队列/常量/isAiConfigured/env)"
```

---

## Task 7: processReanalyze 处理器（含 shouldReanalyze 纯逻辑）+ worker 接线

**Files:**
- Create: `apps/worker/src/reanalyzePlan.ts`
- Create: `apps/worker/tests/reanalyzePlan.test.ts`
- Create: `apps/worker/src/processReanalyze.ts`
- Modify: `apps/worker/src/index.ts`

**Interfaces:**
- Consumes: `ReanalyzeJobData`（`@aniradar/shared`）、`analyze`（`@aniradar/ai`）、`prisma`（`@aniradar/db`）。
- Produces:
  - `function shouldReanalyze(signal: { aiSource: string | null; eventId: string | null }): boolean`
  - `function processReanalyze(data: ReanalyzeJobData): Promise<void>`

- [ ] **Step 1: 写 shouldReanalyze 失败测试**

新建 `apps/worker/tests/reanalyzePlan.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { shouldReanalyze } from "../src/reanalyzePlan";

describe("shouldReanalyze", () => {
  it("mock 来源且已挂事件 → 需要重分析", () => {
    expect(shouldReanalyze({ aiSource: "mock", eventId: "e1" })).toBe(true);
  });
  it("已是 ai 来源 → 不再重分析", () => {
    expect(shouldReanalyze({ aiSource: "ai", eventId: "e1" })).toBe(false);
  });
  it("无关联事件 → 不重分析", () => {
    expect(shouldReanalyze({ aiSource: "mock", eventId: null })).toBe(false);
  });
  it("aiSource 为空 → 不重分析", () => {
    expect(shouldReanalyze({ aiSource: null, eventId: "e1" })).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run apps/worker/tests/reanalyzePlan.test.ts`
Expected: FAIL，无法解析 `../src/reanalyzePlan`。

- [ ] **Step 3: 实现 reanalyzePlan.ts**

新建 `apps/worker/src/reanalyzePlan.ts`：

```ts
// 是否对该 signal 做 AI 重分析：仅 mock 定型且已挂事件者。
export function shouldReanalyze(signal: { aiSource: string | null; eventId: string | null }): boolean {
  return signal.aiSource === "mock" && signal.eventId !== null;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run apps/worker/tests/reanalyzePlan.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: 实现 processReanalyze.ts**

新建 `apps/worker/src/processReanalyze.ts`：

```ts
import { prisma } from "@aniradar/db";
import { analyze } from "@aniradar/ai";
import type { ReanalyzeJobData } from "@aniradar/shared";
import { shouldReanalyze } from "./reanalyzePlan";

// AI 恢复后重分析：只升级译文/摘要，不改 category/heat/合并，保持幂等。
export async function processReanalyze(data: ReanalyzeJobData): Promise<void> {
  const signal = await prisma.signal.findUnique({ where: { id: data.signalId } });
  if (!signal || !shouldReanalyze(signal)) return;

  const result = await analyze({
    title: signal.title,
    summary: signal.summary ?? undefined,
    rawText: signal.rawText ?? undefined,
  });
  if (result.source !== "ai") return; // AI 仍不可用，保持 mock，下轮再试

  await prisma.signal.update({
    where: { id: signal.id },
    data: { titleZh: result.titleZh, aiSource: "ai" },
  });
  if (signal.eventId) {
    await prisma.event.update({
      where: { id: signal.eventId },
      data: { titleZh: result.titleZh, summaryZh: result.summaryZh },
    });
  }
}
```

- [ ] **Step 6: index.ts 接入 reanalyze worker**

`apps/worker/src/index.ts`：
1. import 区 `QUEUE_*` 一行改为含 `QUEUE_REANALYZE`：

```ts
import { QUEUE_FETCH, QUEUE_CLASSIFY, QUEUE_REANALYZE } from "@aniradar/shared";
```

2. 追加 processReanalyze import（在 `import { processClassify } from "./processClassify";` 后）：

```ts
import { processReanalyze } from "./processReanalyze";
```

3. 在 classifyWorker 定义之后追加：

```ts
const reanalyzeWorker = new Worker(QUEUE_REANALYZE, async (job) => processReanalyze(job.data), {
  connection: redisConnection,
  concurrency: 1,
});
```

4. 在现有两条 `.on("failed", ...)` 之后追加：

```ts
reanalyzeWorker.on("failed", (j, e) => console.error("reanalyze failed", j?.id, e?.message));
```

5. 在 `shutdown()` 内 `await classifyWorker.close();` 之后追加：

```ts
  await reanalyzeWorker.close();
```

- [ ] **Step 7: 类型门禁 + 测试**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: 无输出，exit 0。再跑 `npx vitest run apps/worker/tests/reanalyzePlan.test.ts` 确认 PASS。

- [ ] **Step 8: 提交**

```bash
git add apps/worker/src/reanalyzePlan.ts apps/worker/tests/reanalyzePlan.test.ts apps/worker/src/processReanalyze.ts apps/worker/src/index.ts
git commit -m "feat(worker): reanalyze 处理器(AI恢复后只升级译文，幂等)+ worker 接线"
```

---

## Task 8: scheduler 周期入队 reanalyzeTick

**Files:**
- Modify: `apps/worker/src/scheduler.ts`
- Modify: `apps/worker/src/index.ts:21,24-29`

**Interfaces:**
- Consumes: `isAiConfigured`（`@aniradar/ai`）、`reanalyzeQueue`（`./queues`）、`env.reanalyze*`（`@aniradar/config`）。
- Produces: `function reanalyzeTick(): Promise<void>`；`startScheduler(): NodeJS.Timeout[]`（返回值类型变更）。

- [ ] **Step 1: scheduler 增 reanalyzeTick 并管理两个 timer**

`apps/worker/src/scheduler.ts` 改为：

```ts
import { prisma } from "@aniradar/db";
import { env } from "@aniradar/config";
import { isAiConfigured } from "@aniradar/ai";
import { fetchQueue, reanalyzeQueue } from "./queues";

export async function tick(): Promise<void> {
  const now = Date.now();
  const sources = await prisma.source.findMany({ where: { enabled: true } });
  for (const s of sources) {
    const due =
      !s.lastCheckedAt || now - new Date(s.lastCheckedAt).getTime() >= s.fetchIntervalSec * 1000;
    if (due) {
      await fetchQueue.add("fetch", { sourceId: s.id }, { removeOnComplete: 100, removeOnFail: 100 });
    }
  }
}

// 周期性把 mock 定型、近窗口内、已挂事件的 signal 入队重分析；无 AI 配置时跳过。
export async function reanalyzeTick(): Promise<void> {
  if (!isAiConfigured()) return;
  const since = new Date(Date.now() - env.reanalyzeWindowHours * 60 * 60 * 1000);
  const signals = await prisma.signal.findMany({
    where: {
      aiSource: "mock",
      status: "classified",
      eventId: { not: null },
      firstSeenAt: { gte: since },
    },
    orderBy: { firstSeenAt: "desc" },
    take: env.reanalyzeBatch,
    select: { id: true },
  });
  for (const s of signals) {
    await reanalyzeQueue.add(
      "reanalyze",
      { signalId: s.id },
      { removeOnComplete: 200, removeOnFail: 200 },
    );
  }
}

export function startScheduler(): NodeJS.Timeout[] {
  tick().catch((e) => console.error("scheduler tick error", e));
  reanalyzeTick().catch((e) => console.error("reanalyze tick error", e));
  const fetchTimer = setInterval(() => {
    tick().catch((e) => console.error("scheduler tick error", e));
  }, env.schedulerIntervalMs);
  const reanalyzeTimer = setInterval(() => {
    reanalyzeTick().catch((e) => console.error("reanalyze tick error", e));
  }, env.reanalyzeIntervalMs);
  return [fetchTimer, reanalyzeTimer];
}
```

- [ ] **Step 2: index.ts 适配 timers 数组**

`apps/worker/src/index.ts`：
1. 把 `const timer = startScheduler();` 改为：`const timers = startScheduler();`
2. 把 `shutdown()` 内的 `clearInterval(timer);` 改为：`timers.forEach(clearInterval);`

- [ ] **Step 3: 类型门禁**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: 无输出，exit 0。

- [ ] **Step 4: 提交**

```bash
git add apps/worker/src/scheduler.ts apps/worker/src/index.ts
git commit -m "feat(worker): scheduler 周期入队 reanalyze(默认10min/批20/窗7天)，无AI配置则跳过"
```

---

## Task 9: 全量验证

**Files:** 无改动（仅校验）。

- [ ] **Step 1: worker 类型门禁（覆盖最全）**

Run: `npx tsc -p apps/worker/tsconfig.json --noEmit`
Expected: 无输出，exit 0。

- [ ] **Step 2: 全量构建（含 web 的 Next.js 类型检查）**

Run: `pnpm -r build`
Expected: 有 build 脚本的项目全部成功，含 `apps/web`，exit 0。

- [ ] **Step 3: 全量测试**

Run: `npx vitest run`
Expected: 全绿。原 27 个用例 + 新增（retry 9 + enrichPlan 4 + reanalyzePlan 4 = 17）共 44 个用例通过。

- [ ] **Step 4: 核对迁移与 schema 一致**

确认 `packages/db/prisma/migrations/<时间戳>_signal_ai_source/migration.sql` 仅含 `ALTER TABLE "Signal" ADD COLUMN "aiSource" TEXT;`，且 `schema.prisma` 的 Signal model 含 `aiSource String?`。

- [ ] **Step 5（可选）: 端到端冒烟**

若本地有 Postgres+Redis：`docker compose up -d` 后 `pnpm dev:worker`，观察日志出现 `AniRadar worker started`，无启动异常即可。

---

## Self-Review 记录

- **Spec coverage**：① enrich 限流→Task 2；② classify 重试→Task 1+3；③ AI 重分析→Task 5(字段)+6(基建)+7(处理器)+8(调度)；④ fetch 重试→Task 1+4；公共基建 retry/isAiConfigured/常量/env→Task 1/6；测试→Task 1/2/7+9。Task 0 为计划外发现的既有类型错误前置修复（spec 之外，但属"项目问题"范畴）。无遗漏。
- **校验门禁**：统一用 `npx tsc -p apps/worker/tsconfig.json --noEmit`（沿 import 覆盖无 build 脚本的包，最全）；`pnpm -r build` 仅 Task 9 校验 web。已实测：修复 Task 0 后该命令 exit 0。
- **类型一致性**：`RetryCtx`/`shouldRetry`/`isTransientError`（Task1）→ Task3/4 消费；`FreshEntry`/`pickToEnrich`（Task2）一致；`ReanalyzeJobData`/`QUEUE_REANALYZE`（Task6）→ Task7/8 消费；`shouldReanalyze`（Task7）签名与 processReanalyze 调用一致；`result.source`（AnalyzeResult，已存在 `"ai"|"mock"`）写入 `aiSource`。
- **占位符**：无 TODO/TBD；每个代码步骤均给出完整代码。
