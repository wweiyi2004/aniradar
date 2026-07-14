#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

command -v node >/dev/null 2>&1 || { echo "[error] 请先安装 Node.js 22+" >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "[error] 请先安装 pnpm 11" >&2; exit 1; }

if [ ! -d node_modules ]; then
  echo "[install] 安装依赖..."
  pnpm install --frozen-lockfile
fi

echo "[start] Web: http://localhost:3000"
echo "[start] 按 Ctrl+C 同时停止 Web 与 Worker"
exec pnpm dev
