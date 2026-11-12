#!/bin/bash
# Stock Trainer 一键启动脚本
# 自动: 检查依赖 → 下载数据 → 启动服务

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "  Stock Trainer - 美股模拟交易系统"
echo "=========================================="
echo ""

# 检查 Python3
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 python3，请先安装 Python 3"
    exit 1
fi

# 检查是否已安装依赖
echo "📦 检查依赖..."
pip3 install -r requirements.txt -q 2>/dev/null || pip install -r requirements.txt -q 2>/dev/null

# 检查是否已有数据
DATA_DIR="./stock_data"
HAS_DATA=false
if [ -d "$DATA_DIR" ]; then
    COUNT=$(ls "$DATA_DIR"/*.json 2>/dev/null | wc -l)
    if [ "$COUNT" -gt 1 ]; then
        HAS_DATA=true
        echo "📊 已有 $COUNT 个数据文件"
    fi
fi

# 如果没有数据，先下载
if [ "$HAS_DATA" = false ]; then
    echo ""
    echo "📥 未找到数据，开始下载..."
    echo "   请确保富途 OpenD 已启动并登录"
    echo ""
    python3 download.py

    # 检查下载结果
    if [ ! -d "$DATA_DIR" ]; then
        echo "❌ 数据下载失败，请检查富途 OpenD 是否运行"
        exit 1
    fi
    COUNT=$(ls "$DATA_DIR"/*.json 2>/dev/null | wc -l)
    if [ "$COUNT" -lt 2 ]; then
        echo "❌ 数据下载不完整，请重试"
        exit 1
    fi
fi

echo ""
echo "🚀 启动服务..."
echo "   地址: http://localhost:8765"
echo "   按 Ctrl+C 停止"
echo "=========================================="
echo ""

python3 server_backend.py
