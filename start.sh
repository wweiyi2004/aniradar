#!/usr/bin/env sh
# AniRadar 一键启动（macOS/Linux）。依赖 docker + docker compose。
# 流程：生成 .env（如缺失）-> docker compose 构建并启动全部服务（含建表+种子源）-> 等 web 就绪 -> 打开浏览器。
set -e
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "[error] 未找到 docker 命令，请先安装并启动 Docker。" >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[init] 未找到 .env，已从 .env.example 生成。"
  echo "[init] 提示：AI_API_KEY 为空时用规则 mock 分类；ADMIN_PASSWORD 为空时 /admin 不可用。可编辑 .env 后重新运行本脚本。"
fi

echo "[up] 构建并启动服务（首次构建可能需要几分钟）..."
docker compose up -d --build

echo "[wait] 等待 web 就绪 ..."
i=0
until curl -sf -o /dev/null http://localhost:3000; do
  i=$((i + 1))
  if [ "$i" -gt 150 ]; then
    echo "[error] web 长时间未就绪，查看日志：docker compose logs web" >&2
    exit 1
  fi
  sleep 2
done

if command -v open >/dev/null 2>&1; then
  open http://localhost:3000
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:3000
fi

echo
echo "[ok] AniRadar 已启动：http://localhost:3000"
echo "[ok] worker 正在后台自动抓取（约 30 秒一轮调度）。"
echo "[ok] 停止：docker compose down    查看日志：docker compose logs -f worker"
