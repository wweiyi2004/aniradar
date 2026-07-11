@echo off
rem AniRadar 一键启动：双击即可。依赖 Docker Desktop（需已启动）。
rem 流程：生成 .env（如缺失）-> docker compose 构建并启动全部服务（含建表+种子源）-> 等 web 就绪 -> 打开浏览器。
setlocal enabledelayedexpansion
cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
  echo [error] 未找到 docker 命令，请先安装并启动 Docker Desktop。
  pause
  exit /b 1
)

if not exist .env (
  copy .env.example .env >nul
  echo [init] 未找到 .env，已从 .env.example 生成。
  echo [init] 提示：AI_API_KEY 为空时用规则 mock 分类；ADMIN_PASSWORD 为空时 /admin 不可用。可编辑 .env 后重新运行本脚本。
)

echo [up] 构建并启动服务（首次构建可能需要几分钟）...
docker compose up -d --build
if errorlevel 1 (
  echo [error] docker compose 启动失败，请确认 Docker Desktop 正在运行，或查看上方报错。
  pause
  exit /b 1
)

echo [wait] 等待 web 就绪 ...
set /a tries=0
:wait
set /a tries+=1
if !tries! gtr 150 (
  echo [error] web 长时间未就绪，查看日志：docker compose logs web
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
curl -s -o nul http://localhost:3000 || goto :wait

start "" http://localhost:3000
echo.
echo [ok] AniRadar 已启动：http://localhost:3000
echo [ok] worker 正在后台自动抓取（约 30 秒一轮调度）。
echo [ok] 停止：docker compose down    查看日志：docker compose logs -f worker
pause
