# AniRadar

AniRadar 自动抓取日本动画、漫画、轻小说与相关二次元资讯，经规则或 AI 分类、翻译、合并后生成可检索的中文情报流。

项目采用单机双进程架构：Next.js Web 与独立 Worker 共享一个 SQLite 文件。无需 Docker、PostgreSQL 或 Redis。

## 架构

```text
外部 RSS / HTML / YouTube
          │
          ▼
  Worker（抓取、分类、合并、AI）
          │
          ▼
  data/aniradar.db（SQLite WAL）
          ▲
          │
  Next.js Web / Admin API
```

- `apps/web`：公开情报流、详情页和 Basic Auth 后台。
- `apps/worker`：定时调度与 SQLite 持久化 Job runners。
- `packages/db`：Prisma schema、SQLite Job 队列、seed 与 PostgreSQL 导入工具。
- `packages/crawler` / `parser` / `sources`：安全抓取、解析和来源适配。
- `packages/ai` / `detector`：分类、翻译、事实提取与事件合并。

SQLite 只面向单机本地磁盘；不要把数据库文件放在 NFS/SMB，也不要让多台服务器共享同一文件。Worker 使用数据库租约保证单实例运行。

## 要求

- Node.js 22+
- pnpm 11

## 一键启动

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会自动：

1. 缺少 `.env` 时从 `.env.example` 创建；
2. 创建 `data/aniradar.db`；
3. 应用 SQLite migration 并幂等 seed；
4. 同时启动 Web 和 Worker。

访问：

- 前台：http://localhost:3000
- 后台：http://localhost:3000/admin/sources

Windows 也可双击 `start.cmd`；macOS/Linux 可运行 `./start.sh`。

## 配置

核心 `.env`：

```dotenv
DATABASE_URL="file:../../../data/aniradar.db"

ADMIN_USER="admin"
ADMIN_PASSWORD="请设置强密码"

AI_API_KEY=""
AI_BASE_URL="https://api.deepseek.com"
AI_MODEL="deepseek-chat"

SCHEDULER_INTERVAL_MS=30000
JOB_POLL_INTERVAL_MS=500
JOB_LOCK_TIMEOUT_MS=300000
WORKER_LEASE_TTL_MS=30000
```

`DATABASE_URL` 相对 `packages/db/prisma/schema.prisma`，默认最终落在仓库根目录 `data/aniradar.db`。不配置 AI key 时使用规则分类，抓取链路仍可运行。

## 常用命令

```bash
pnpm dev                 # 自动初始化并启动 Web + Worker
pnpm dev:web             # 只启动 Web
pnpm dev:worker          # 只启动 Worker
pnpm db:setup            # 应用 migration + seed
pnpm db:migrate          # 开发新 migration
pnpm sources:check       # 检查 seed 来源
pnpm test                # 单元测试 + SQLite 集成测试
pnpm typecheck
pnpm build
```

生产运行：

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
pnpm start
```

## 从旧 PostgreSQL 全量导入

先停止 Web 和 Worker，并临时恢复旧 PostgreSQL。把旧连接地址放进 `.env`：

```dotenv
POSTGRES_SOURCE_URL="postgresql://user:password@localhost:5432/aniradar?schema=public"
```

目标 SQLite 已有 seed 数据时使用：

```bash
pnpm db:import:postgres -- --force
```

导入器会在修改前 checkpoint 并备份 SQLite，然后分批迁移 Source、Event、Signal、FetchLog，保留原 ID、关系、JSON 和时间，最后比较表计数、检查孤立外键并重建未完成任务。失败时自动恢复备份。

## 部署到单台服务器

推荐 Linux VPS + systemd/PM2 + Caddy/Nginx：

1. 将项目和 `data/` 放在持久本地磁盘；
2. 用 `pnpm start` 同时运行 Web/Worker；
3. 仅让 Next.js 监听本机端口，通过反向代理提供 HTTPS；
4. 为 `data/aniradar.db` 做定期在线备份；
5. 发布前停止服务或完成 SQLite checkpoint 后再复制数据库文件。

此架构适合单服务器的小到中等抓取量。若未来需要多服务器、共享存储或大量并发写入，应迁回共享 PostgreSQL 与分布式队列。

## 安全说明

- 后台密码为空时 fail-closed，不允许访问。
- 后台变更 API 会拒绝跨站请求。
- 抓取器只允许 HTTP(S)，逐跳检查重定向与 DNS 解析结果，拒绝私网/环回目标。
- 抓取响应默认限制为 5 MiB。
- Basic Auth 必须置于 HTTPS 反向代理之后。
