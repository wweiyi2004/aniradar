# 单镜像构建 monorepo，拆 worker/web 两个 target。
# 保留 devDependencies：worker 运行依赖 tsx；web 构建依赖 next/typescript。
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app
# Prisma 引擎需要 openssl
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
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
