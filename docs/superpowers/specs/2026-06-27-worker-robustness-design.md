# Worker 健壮性改进设计

日期：2026-06-27
范围：`apps/worker`、`packages/config`、`packages/ai`、`packages/shared`、`packages/db`

## 背景

近期改动给抓取链路加了详情页增强（正文+主图）与媒体字段。复查 worker 全链路后发现四处健壮性缺口，本设计逐一处理。

一个重要前提（影响 ②）：`packages/ai/src/analyze.ts` 内部已对网络/超时/解析失败做 try/catch 并回退规则 mock，**`analyze()` 不会抛错**。因此 `processClassify` 外层 catch 实际只会被**数据库异常**触发，而非 AI API 抖动。AI 临时不可用时，signal 会被 mock 较弱地分类并永久定型——这是 ③ 要解决的问题。

## 目标

1. **enrich 限流**：源首次抓取时所有条目都是新条目，会一次性对几十个详情页发请求（并发 5、各 12s），既慢又易被目标站限流。给每轮增强加总量上限。
2. **classify 重试**：队列无 `attempts` 配置（默认 1 次），且 `processClassify` 无差别吞掉所有异常并标 `failed`——即使配了重试 BullMQ 也看不到失败。让瞬时 DB 错误能被重试。
3. **AI 恢复后重分析**：mock 定型的 signal 在 AI 恢复后能升级为真实译文/摘要，且过程幂等、不产生重复事件或重复计热。
4. **fetch 失败重试**：`processFetch` 外层 catch 记录失败但不重抛，BullMQ 视为成功，不重试。让瞬时网络错误能被重试。

## 非目标 / 取舍

- ③ 的重分析**只升级译文（titleZh/summaryZh），不改 category、不重新合并、不动 heatScore/eventId**。换取幂等与"绝不产生重复事件/重复计热"。代价：mock 把分类判错时不会被纠正。
- 不对 prisma 密集的 worker 流程做集成测试（沿用现状，worker 目前无测试）；只对新增纯逻辑做单测。

## 公共基建

### packages/config（`src/index.ts`，惰性 getter 风格）
- `enrichMaxPerCycle` ← `ENRICH_MAX_PER_CYCLE`，默认 `12`
- `reanalyzeIntervalMs` ← `REANALYZE_INTERVAL_MS`，默认 `600000`（10 分钟）
- `reanalyzeWindowHours` ← `REANALYZE_WINDOW_HOURS`，默认 `168`（7 天）
- `reanalyzeBatch` ← `REANALYZE_BATCH`，默认 `20`

重试次数与退避作为 `apps/worker/src/queues.ts` 内常量，不进 env：
- classify：`attempts: 3`，`backoff: { type: "exponential", delay: 2000 }`
- fetch：`attempts: 3`，`backoff: { type: "exponential", delay: 5000 }`

### apps/worker/src/retry.ts（新）
```ts
export interface RetryCtx { attemptsMade: number; maxAttempts: number; }
export function isTransientError(e: unknown): boolean;
export function shouldRetry(e: unknown, ctx: RetryCtx | undefined): boolean;
```
- `isTransientError`：瞬时 = Prisma 连接类错误（`code` 以 `P1` 开头）或网络错误（`ECONNREFUSED`/`ECONNRESET`/`ETIMEDOUT`/无 `code`）；永久 = `P2*` 等数据/约束错误。
- `shouldRetry(e, ctx)`：`isTransientError(e) && ctx && ctx.attemptsMade + 1 < ctx.maxAttempts`。
- 注：BullMQ `attemptsMade` 语义在实现阶段以 TDD 校验（首跑为 0，失败后递增）。

### packages/ai
导出 `isAiConfigured(): boolean`（即 `getAiConfig() !== null`），供 scheduler 在无 AI 配置时跳过重分析扫描。

### packages/shared
新增 `QUEUE_REANALYZE` 常量与 `ReanalyzeJobData { signalId: string }` 类型。

## ① enrich 限流（apps/worker/src/processFetch.ts）

`fresh` 是带 hash 的条目数组（`{ item, hash }[]`）。关键：排序作用在**整条 `{ item, hash }` 上**，让 item 与 hash 始终成对，避免错位。

在算出 `fresh` 后：
1. `pickToEnrich(fresh, max)` 按 `item.publishedAt` 倒序排（无日期者排末尾），切出 `toEnrich`（前 `max` 条）与 `rest`（其余），返回的两段都是 `{ item, hash }` 条目。
2. 对 `toEnrich.map(e => e.item)` 调 `enrichItems`；`rest` 的条目**照常入库但不增强**。
3. 按 `ordered = [...toEnrich, ...rest]` 这一固定顺序遍历入库：`enriched[i]` 与 `ordered[i].hash` 对齐（`enriched = [...enrichedItems, ...rest.map(e => e.item)]`）。

纯函数签名：
```ts
type FreshEntry = { item: FetchedItem; hash: string };
export function pickToEnrich(
  fresh: FreshEntry[],
  max: number,
): { toEnrich: FreshEntry[]; rest: FreshEntry[] };
```
要求：按 `publishedAt` 倒序稳定排序；`max >= fresh.length` 时 `rest` 为空；`max <= 0` 时全部进 `rest`。

## ② classify 重试

- `queues.ts`：classifyQueue 加 `defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 500, removeOnFail: 500 }`。
- `index.ts`：classifyWorker 回调传入 ctx：`processClassify(job.data, { attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts ?? 1 })`。
- `processClassify(data, ctx?)`：catch 改为
  ```ts
  } catch (e) {
    if (shouldRetry(e, ctx)) throw e;            // 瞬时且非末次 → BullMQ 重试
    await prisma.signal.update({ where: { id: signal.id }, data: { status: "failed" } });
  }
  ```

## ③ AI 恢复后重分析

### Schema（packages/db/prisma/schema.prisma）+ 迁移
`model Signal` 增 `aiSource String?`。新增一个 prisma 迁移。

### processClassify
三条更新路径（`ignored` / 合并 / 新建后的 signal.update）都写入 `aiSource: result.source`。
- ignored 路径：signal.update 加 `aiSource: result.source`。
- classified（合并 / 新建）路径：signal.update 加 `aiSource: result.source`。

### 新队列 + 处理器
- `queues.ts`：`reanalyzeQueue = new Queue(QUEUE_REANALYZE, ...)`，`defaultJobOptions: { attempts: 2, backoff: exponential 5s, removeOnComplete: 200, removeOnFail: 200 }`。
- `apps/worker/src/processReanalyze.ts`（新）`processReanalyze(data: ReanalyzeJobData)`：
  1. 读 signal（含 event）。若 `aiSource !== "mock"` 或无 `eventId` → 返回（已升级/无目标）。
  2. 重跑 `analyze({ title, summary, rawText })`。
  3. 若 `result.source !== "ai"`（AI 仍不可用）→ 返回，保持 `aiSource="mock"`，下轮再试。
  4. 若 `result.source === "ai"`：
     - signal.update：`titleZh: result.titleZh`，`aiSource: "ai"`。
     - event.update（关联 event）：`titleZh: result.titleZh`，`summaryZh: result.summaryZh`。**不**改 category/heatScore/officialConfirmed/eventId。
- `index.ts`：新增 `reanalyzeWorker = new Worker(QUEUE_REANALYZE, ..., { concurrency: 1 })`，并入 `failed` 日志与 `shutdown()` 关闭列表。

### Scheduler（apps/worker/src/scheduler.ts）
新增 `reanalyzeTick()`：
- 若 `!isAiConfigured()` → 直接返回。
- 查 `aiSource: "mock"`、`status: "classified"`、`eventId != null`、`firstSeenAt >= now - reanalyzeWindowHours` 的 signal，取 `reanalyzeBatch` 条，逐条入 `reanalyzeQueue`。
- `startScheduler()` 额外注册一个 `setInterval(reanalyzeTick, env.reanalyzeIntervalMs)`，并随 `shutdown` 清理（与现有 fetch tick 的 timer 一致管理；`startScheduler` 改为返回两个 timer 或一个数组）。

幂等保证：`aiSource` 升级为 `"ai"` 后不再被 `reanalyzeTick` 选中；重分析不触发合并/计热，重复执行只是把同一份 AI 译文再写一遍。

## ④ fetch 失败重试

- `queues.ts`：fetchQueue 加 `defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 100, removeOnFail: 100 }`。（scheduler 现在 per-add 传 removeOnComplete/Fail；保留即可，per-add 优先。）
- `index.ts`：fetchWorker 回调传 ctx：`processFetch(job.data, { attemptsMade, maxAttempts })`。
- `processFetch(data, ctx?)` 外层 catch：
  ```ts
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.fetchLog.update({ ..., data: { status: "failed", message, endedAt: new Date() } });
    if (shouldRetry(e, ctx)) throw e;                 // 瞬时且非末次 → 重试
    await prisma.source.update({ where: { id: source.id }, data: { lastCheckedAt: new Date(), failureCount: { increment: 1 } } });
  }
  ```
  即 `failureCount` 只在末次自增，避免一次故障 +3；每次尝试各记一条 `fetchLog`。

## 测试（TDD，只测纯逻辑）

新增 worker 测试目录 `apps/worker/tests/`（确认 vitest 配置覆盖 apps，否则在根 `vitest.config.ts` 调整 include）：
- `retry.test.ts`：`isTransientError` 对 `P1001`/`P2002`/`ECONNRESET`/无 code 的分类；`shouldRetry` 在末次/非末次、瞬时/永久的组合。
- `pickToEnrich.test.ts`：排序稳定、`max>=len` 时 rest 空、`max=0` 时全 rest、保持下标对齐所需的同序性。
- 重分析"是否跳过"的判定若抽成纯 helper（如 `shouldReanalyze(signal)`），加单测；否则跳过。

## 迁移清单

1. 新 prisma 迁移：`Signal.aiSource String?`。

## 验收

- `pnpm -r build` 通过（含 web 类型检查）。
- `vitest run` 全绿，含新增单测。
- 人工核对：迁移 SQL 与 schema 一致。
