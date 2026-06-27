# 板块维度 + 结构化事实模板 + UI 升级 设计

日期：2026-06-28
范围：`packages/db`、`packages/shared`、`packages/ai`、`apps/worker`、`apps/web`

## 背景与目标

当前信息架构只有「单一情报流 + 14 个情报类型(EventCategory)」，没有「作品媒介」维度；详情页只有一段 AI 摘要，缺少可核对的结构化事实。本设计加入三件事：

1. **板块维度（medium）**：按作品媒介把情报分到 动画 / 漫画 / 轻小说 / 游戏 / 剧场版·影视 / 周边·活动（+ other 兜底）6+1 个板块，作为顶部一级频道。
2. **结构化事实模板**：详情页从「一段摘要」改为「一句话导语 + 结构化事实表」。事实表两层：**板块定底字段 + 情报类型定专有字段**，叠加渲染，空字段不显示。
3. **UI 升级**：顶部板块 tab + 首页「热门大图卡 + 紧凑列表」混合布局。

## 关键决策（已与用户确认）

- 板块集合：`anime / manga / light_novel / game / film / goods_event` + `other` 兜底。
- 板块归属规则：**按「这条动态是哪种媒介」**，不看原作媒介（「某漫画宣布动画化」→ anime；「轻小说宣布漫画化」→ manga）。
- 模板维度：两层（板块底字段 + 情报类型专有字段叠加）。
- 摘要处理：保留为**一句话导语**（leadZh），事实表为主体。
- 导航：顶部板块 tab（一级频道）。
- UI：混合（热门大图卡 + 紧凑列表）。
- 现有 14 个 EventCategory 不变，作为板块内二级标签。
- 现有 49 个 Event 回填 medium+facts（复用 reanalyze 队列，有 AI key 时）。

## 非目标 / 取舍

- 不改动现有抓取/去重/合并/重试链路的核心逻辑（只在 classify 产出处增加 medium+facts）。
- 事实抽取以**准确性优先**：只填原文明确陈述的字段，未知留空，不编造。
- facts 存 Event 级（聚合展示）；不为每个 Signal 单独建 facts 列。

---

## A. 数据模型

### Medium 枚举（packages/shared）
```ts
export const MEDIUMS = ["anime", "manga", "light_novel", "game", "film", "goods_event", "other"] as const;
export type Medium = (typeof MEDIUMS)[number];
```
中文标签（web 用）：anime=动画, manga=漫画, light_novel=轻小说, game=游戏, film=剧场版·影视, goods_event=周边·活动, other=其它。

### Schema（packages/db/prisma/schema.prisma）+ 迁移
`model Event` 新增：
- `medium   String?`（存 Medium 值；为兼容历史数据用 String? 而非 prisma enum，校验在应用层）
- `facts    Json?`（结构化事实，见 C 节 shape）

迁移：1 个新 prisma 迁移，`ALTER TABLE "Event" ADD COLUMN "medium" TEXT, ADD COLUMN "facts" JSONB;`（额外两列均可空，纯追加，向后兼容）。

> 说明：medium/facts 只加在 Event。Signal 不加列；回填/重分析时由 signal 的原文重新 analyze 后写回 Event。

---

## B. AI 抽取（扩展 packages/ai/src/analyze.ts，仍一次调用）

### 输出结构
`AnalyzeResult` 扩展：
```ts
export interface AnalyzeResult {
  isAnimeNews: boolean;
  medium: Medium;          // 新增
  category: EventCategory;
  confidence: number;
  titleZh: string;
  leadZh: string;          // 一句话导语（语义化的原 summaryZh）
  facts: Record<string, unknown>; // 新增；键见 C 节
  source: "ai" | "mock";
}
```
DB 列名 **不改**：`Event.summaryZh` 保留，内容写入 `leadZh`（避免 rename 迁移与 web 破坏）。`AnalyzeResult` 对外用 `leadZh`，processClassify 把它写进 `Event.summaryZh`。详情页读 `summaryZh` 渲染导语。

### system prompt 增量要求
- 判定 medium：按「这条情报讲的是哪种媒介的动态」选 `MEDIUMS` 之一；拿不准用 `other`。
- leadZh：1 句话（≤60 字）概述「公布了什么」。
- facts：输出一个 JSON 对象，**只填原文明确陈述的字段**；未知字段直接省略（不要填「未知/不明」）；不得编造日期/人名。字段键白名单见 C 节，按 medium+category 取并集。
- cast/staff 为数组：`cast: [{role, name}]`、`staff: [{role, name}]`。

### 无 key 兜底（mock）
- medium：按 category 规则映射（`movie_announced→film`、`bd_release/merch_release→goods_event`、`event_info→goods_event`、其余动画类→anime、无法判断→other）。
- leadZh：取原 summarize 的首句。
- facts：留空 `{}`（mock 不做结构化抽取）。

### 写入（apps/worker/src/processClassify.ts）
- 新建 Event：写 `medium`、`facts`（= result.facts）、`summaryZh`(= leadZh)。
- 合并 Event：`medium` 取既有值（不覆盖）；`facts` **填空不覆盖**（仅补既有 facts 中缺失/空的键，已有非空键保留）。仍在 Task（重试）的 `$transaction` 内完成。

### 回填（复用 reanalyze 队列）
扩展 `processReanalyze`：重跑 analyze 后，若 `source==="ai"`，除升级 titleZh/leadZh 外，**补写 Event 的 medium（原为空时）与 facts（填空不覆盖）**。scheduler 的 reanalyzeTick 选取条件维持「aiSource=mock 且近窗口」，自然覆盖历史 49 条（有 key 时）。

---

## C. 事实模板（facts 字段矩阵）

`facts` 是扁平对象，键来自下面白名单。详情页模板 = **board 底字段键 ∪ category 专有字段键**，按定义顺序渲染，值为空/缺失则跳过。

### 板块底字段（base，按 medium）
| medium | 键 → 中文标签 |
| --- | --- |
| anime | work→作品, original→原作, studio→制作, director→监督 |
| manga | work→作品, author→作者, magazine→连载, publisher→出版社 |
| light_novel | work→作品, author→作者, illustrator→插画, label→文库 |
| game | work→作品, platform→平台, developer→开发/发行, genre→类型 |
| film | work→作品, releaseDate→上映日, distributor→发行/院线, director→监督 |
| goods_event | work→作品, itemName→名称, date→日期, place→地点 |
| other | work→作品, note→说明 |

### 情报类型专有字段（叠加，按 category）
| category | 键 → 中文标签 |
| --- | --- |
| anime_adaptation | studio→制作, expectedAir→开播预定 |
| sequel_announced | season→季数/续作 |
| pv_released | pvType→PV类型, duration→时长, pvUrl→链接 |
| key_visual_released | kvDate→公开日 |
| cast_announced | cast→声优(列表 角色→声优) |
| staff_announced | staff→STAFF(列表 职位→人) |
| broadcast_date_announced | airDate→开播日, broadcaster→放送平台, streaming→配信 |
| delay_announced | originalDate→原定, newDate→延期至, reason→原因 |
| movie_announced | releaseDate→上映日, theaters→院线 |
| theme_song_announced | songType→OP/ED, songTitle→曲名, artist→艺人 |
| event_info | eventName→活动, eventDate→日期, venue→地点 |
| merch_release | itemName→商品, releaseDate→发售日, price→价格, spec→规格 |
| bd_release | volume→卷/话, releaseDate→发售日, price→价格, spec→规格 |
| other | （无专有字段） |

渲染规则：
- 标量键 → `标签 | 值` 一行。
- 列表键（cast/staff）→ 小节，逐条 `子标签 → 值`。
- 模板键的并集去重（如 movie_announced 的 releaseDate 与 film 底字段 releaseDate 同键，取其一）。

---

## D. 前端（apps/web）

### 板块导航（site-header 或新 BoardTabs 组件）
顶部一排 tab：`全部 / 动画 / 漫画 / 轻小说 / 游戏 / 剧场版 / 周边`。路由用 query：`/?board=anime`（保留现有 `?sort=` 组合）。`全部` = 不筛 medium。

### 首页（apps/web/app/page.tsx）
按 `searchParams.board` 过滤 `Event.medium`（全部时不过滤）。布局「混合」：
- **热门大图卡区**：当前板块内 `heatScore>1` 取前若干，大图卡网格（沿用 EventCard highlight，强化主图）。
- **紧凑列表**：当前板块其余 Event，左小图 + 右侧（medium·category badge + 标题 + 1~2 个关键事实 inline，如开播日/发售日 + 时间/热度）。
- 排序 tab（最新/热度）保留，与 board 组合。

### 详情页（apps/web/app/events/[id]/page.tsx）
- 顶部：medium badge + category badge + 时间 + 官方确认。
- **一句话导语**（summaryZh/leadZh）。
- **事实表**：按 (medium, category) 模板渲染 facts，空字段不显示；facts 全空时回退显示导语。
- 保留：来源时间线、媒体侧栏（主图/视频）。

### 组件
- 新增 `MediumBadge`（medium→中文标签+配色）。
- 新增 `FactTable`（输入 medium+category+facts，按 C 节矩阵渲染）。
- 复用现有 `CategoryBadge`、`EventCard`。

### UI 打磨
- medium / category 双 badge 配色区分；事实表统一样式（label 列对齐、列表项缩进）；紧凑列表与大图卡视觉层次。沿用现有 hsl 变量与暗色模式。

---

## E. 迁移与回填

1. 新 prisma 迁移：Event 加 `medium TEXT`、`facts JSONB`。
2. 历史 49 个 Event 回填，两条路径：
   - **有 AI key**：经 reanalyze 自动回填 `medium`+`facts`（真实抽取）。`processReanalyze` 扩展为：`source==="ai"` 时补 medium（原空才写）与 facts（填空不覆盖）。
   - **无 AI key**：`processReanalyze` 的 mock 早返回不会回填，故另跑**一次性回填脚本**（`packages/db` 下，或 worker 启动时一次），对 `medium IS NULL` 的 Event 按 category 规则填 medium（facts 留空）。
   - 新情报：classify 时 mock 路径已按 category 规则写入 medium，无需额外处理。

## F. 落地分期（供 writing-plans 参考）

1. **数据模型 + AI 抽取**：medium 枚举、schema/迁移、analyze 扩展（medium+leadZh+facts）+ mock 兜底、processClassify 写入、reanalyze 回填。
2. **首页板块导航**：BoardTabs、page.tsx 按 board 过滤 + 混合布局、MediumBadge。
3. **详情页事实模板**：FactTable 组件 + 模板矩阵、详情页改版。
4. **UI 打磨**：badge 配色、事实表/列表样式细节。

## 验收

- `npx tsc -p apps/worker/tsconfig.json --noEmit` exit 0；`pnpm -r build` exit 0（含 web）；`vitest run` 全绿（含新增：medium 兜底映射、FactTable 模板取键等纯逻辑单测）。
- 迁移 SQL 与 schema 一致、纯追加。
- 人工：首页板块 tab 可切换并正确过滤；详情页按类型显示对应事实字段、空字段不显示。
