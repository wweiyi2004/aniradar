# 单镜像构建 monorepo，拆 worker/web 两个 target。
# 保留 devDependencies：worker 运行依赖 tsx；web 构建依赖 next/typescript。
# 固定 Node 小版本，避免浮动标签更新引入行为变化；pnpm 11 需要 >=22.13。
FROM node:22.13.1-slim AS base
# WSL2 5.15 内核的 io_uring 有 bug，Node 20+ 默认启用会随机 SIGSEGV，显式禁用。
ENV UV_USE_IO_URING=0
# 容器内无宿主机代理，直连 npmjs/prisma 官方源会挂起甚至压崩 Node（下载中被重置），
# 一律走 npmmirror；外网通畅的环境可用 --build-arg NPM_REGISTRY=https://registry.npmjs.org 覆盖。
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
# 不用 corepack（其下载 pnpm 无法走镜像），npm 全局安装同版本 pnpm。
RUN npm i -g pnpm@11.5.2 --registry=$NPM_REGISTRY
WORKDIR /app
# Prisma 引擎需要 openssl
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile --registry=$NPM_REGISTRY
RUN pnpm --filter @aniradar/db exec prisma generate
ENV NODE_ENV=production

# worker：抓取/分类/合成常驻进程，用 tsx 运行（无需 next build）。
FROM base AS worker
CMD ["pnpm", "--filter", "@aniradar/worker", "exec", "tsx", "src/index.ts"]

# web：Next.js 前台，需要 next build。
# 注意：next build 在内存受限的容器里可能 SIGSEGV；如遇到，给 Docker 调大内存
# （Docker Desktop → Settings → Resources，建议 ≥4GB），或在宿主机构建后挂载 .next。
FROM base AS web
RUN pnpm --filter @aniradar/web build
CMD ["pnpm", "--filter", "@aniradar/web", "exec", "next", "start", "-p", "3000"]
