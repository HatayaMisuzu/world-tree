#!/bin/bash
set -e

echo ""
echo "  🌳 World Tree Desktop v2.3.1"
echo "  ════════════════════════════"
echo ""

# 检测 Node.js
if ! command -v node &> /dev/null; then
    echo "  ❌ 未检测到 Node.js，请先安装："
    echo "     https://nodejs.org （推荐 v18+ LTS 版本）"
    echo ""
    exit 1
fi

echo "  ✅ Node.js 版本: $(node -v)"

# 首次运行自动安装依赖
if [ ! -d "node_modules" ]; then
    echo "  📦 首次运行，正在安装依赖..."
    npm install
    echo "  ✅ 依赖安装完成"
fi

# 启动服务器
echo "  🚀 启动服务器..."
echo ""

# 尝试自动打开浏览器
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000 &
elif command -v open &> /dev/null; then
    open http://localhost:3000 &
fi

node server.js
