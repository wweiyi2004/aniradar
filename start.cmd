@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul || (echo [error] 请先安装 Node.js 22+ & pause & exit /b 1)
where pnpm >nul 2>nul || (echo [error] 请先安装 pnpm 11 & pause & exit /b 1)

if not exist node_modules (
  echo [install] 安装依赖...
  call pnpm install --frozen-lockfile || (pause & exit /b 1)
)

echo [start] Web: http://localhost:3000
echo [start] 按 Ctrl+C 同时停止 Web 与 Worker
call pnpm dev
