#!/usr/bin/env python3
"""
Stock Trainer 后端服务 (Render 兼容版)
提供股票K线数据 API + 静态前端

Render 启动命令: gunicorn server_backend:app
本地启动: python3 server_backend.py
"""
import json
import os
import sys
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='.')

# 数据目录（Render 上数据文件在项目根目录的 stock_data/ 下）
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stock_data')

# ===== CORS 中间件 =====
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = '*'
    return response

# ===== API 路由 =====

@app.route('/api/kline')
def api_kline():
    """获取单只股票K线数据"""
    code = request.args.get('code', '').upper()
    if not code:
        return jsonify({"error": "缺少 code 参数"}), 400

    filepath = os.path.join(DATA_DIR, f'{code}.json')
    if not os.path.exists(filepath):
        return jsonify({"error": f"股票 {code} 数据不存在"}), 404

    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/stock_list')
def api_stock_list():
    """获取所有可用股票列表（含市值信息）"""
    index_path = os.path.join(DATA_DIR, '_index.json')
    if not os.path.exists(index_path):
        # 尝试从数据文件直接生成
        stock_list = []
        if os.path.exists(DATA_DIR):
            for f in sorted(os.listdir(DATA_DIR)):
                if f.endswith('.json') and f != '_index.json':
                    code = f.replace('.json', '')
                    try:
                        with open(os.path.join(DATA_DIR, f), 'r') as fp:
                            d = json.load(fp)
                        stock_list.append({
                            "code": code,
                            "name": d.get("name", ""),
                            "days": d.get("count", 0),
                            "avg_mkt_cap": d.get("avg_market_cap", 0)
                        })
                    except:
                        stock_list.append({"code": code, "name": "", "days": 0, "avg_mkt_cap": 0})
        return jsonify(stock_list)

    with open(index_path, 'r') as f:
        index = json.load(f)
    stock_list = [
        {
            "code": k,
            "name": v.get("name", ""),
            "days": v.get("days", 0),
            "avg_mkt_cap": v.get("avg_mkt_cap", 0)
        }
        for k, v in index.items()
    ]
    return jsonify(stock_list)


@app.route('/api/earnings')
def api_earnings():
    """获取财报公告日数据库（支持 ?code=XXX 过滤单只股票）

    数据由 fetch_earnings.py 预先生成（修正了东方财富API的年份偏移bug），
    返回修正后的实际公告日。
    """
    earnings_path = os.path.join(DATA_DIR, '_earnings.json')
    if not os.path.exists(earnings_path):
        return jsonify({})

    try:
        with open(earnings_path, 'r') as f:
            db = json.load(f)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    code = request.args.get('code', '').upper()
    if code:
        return jsonify(db.get(code, []))
    return jsonify(db)


@app.route('/api/health')
def api_health():
    """健康检查"""
    total_stocks = 0
    total_days = 0
    total_market_cap = 0
    if os.path.exists(DATA_DIR):
        for f in os.listdir(DATA_DIR):
            if f.endswith('.json') and f != '_index.json':
                total_stocks += 1
                try:
                    with open(os.path.join(DATA_DIR, f), 'r') as fp:
                        d = json.load(fp)
                    total_days += d.get('count', 0)
                    total_market_cap += d.get('avg_market_cap', 0)
                except:
                    pass

    avg_market_cap = total_market_cap / total_stocks if total_stocks > 0 else 0
    return jsonify({
        "status": "ok",
        "total_stocks": total_stocks,
        "total_kline_days": total_days,
        "avg_market_cap_all": round(avg_market_cap, 2),
        "data_source": "futu_opend",
        "data_range": "3years"
    })


# ===== 静态文件（前端） =====

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    if filename in ('app.js', 'style.css', 'index.html'):
        return send_from_directory('.', filename)
    return jsonify({"error": "not found"}), 404


# ===== 本地启动 =====
if __name__ == '__main__':
    if not os.path.exists(DATA_DIR):
        print(f"⚠️ 数据目录不存在: {DATA_DIR}")
        print("请先运行 futu_download.py 下载数据")
        os.makedirs(DATA_DIR, exist_ok=True)

    port = int(os.environ.get('PORT', 8765))
    print(f"🚀 Stock Trainer 后端启动")
    print(f"   端口: {port}")
    print(f"   数据: {DATA_DIR}")
    app.run(host='0.0.0.0', port=port, debug=False)
