#!/usr/bin/env python3
"""
富途 OpenD 批量下载科技类美股K线数据
仅下载纳斯达克100 + 标普500科技股 + 热门科技股
排除中概股、医疗健康股
仅下载近3年K线数据

用法: python3 download.py
前提: 富途牛牛客户端已启动 OpenD（默认端口 11111）
输出: stock_data/ 目录，每只股票一个 JSON
"""
import json, os, sys, time
from datetime import datetime, timedelta

from futu import OpenQuoteContext, KLType, AuType, RET_OK

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stock_data')

# ===== 近3年日期范围 =====
now = datetime.now()
START_DATE = (now - timedelta(days=365 * 3)).strftime('%Y-%m-%d')
END_DATE = now.strftime('%Y-%m-%d')

# ===== 富途 OpenD 连接参数 =====
FUTU_HOST = '127.0.0.1'
FUTU_PORT = 11111

# ===== 科技股池 =====
# 纳斯达克100 + 标普500科技 + 热门科技股
# 已排除: 中概股、医疗健康、保险、传统金融、能源、材料、消费、工业、公用事业、REITs
TECH_STOCKS = [
    # === NASDAQ 100 核心科技巨头 ===
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "AMD", "INTC", "AVGO",
    "ADBE", "CSCO", "QCOM", "TXN", "ORCL", "CRM", "NOW", "INTU", "MU", "AMAT",
    "ADI", "LRCX", "NXPI", "MCHP", "MRVL", "KLAC", "ANET", "ON",

    # === S&P 500 信息技术 ===
    "IBM", "ACN", "CTSH", "IT", "KEYS", "TER", "STX", "WDC", "NTAP",
    "HPQ", "HPE", "FFIV", "CHKP",
    "PANW", "FTNT", "SNPS", "CDNS", "WDAY",

    # === 网络平台 / 互联网科技 ===
    "TSLA", "NFLX", "UBER", "ABNB", "SHOP", "PYPL", "DASH", "ROKU",
    "SPOT",

    # === 云计算 / SaaS ===
    "SNOW", "DDOG", "TEAM", "MDB", "OKTA", "CRWD", "PLTR", "NET",
    "GTLB", "HUBS", "BILL", "MNDY", "ZS", "TTD", "APP", "NTNX",
    "ESTC", "FROG", "PD", "DOCN", "WIX", "GDDY", "PCOR",

    # === 半导体扩展 ===
    "TSM", "ASML", "ARM", "MPWR", "ALAB",

    # === 硬件 / 服务器 ===
    "DELL", "LOGI",

    # === 金融科技（非传统金融）===
    "HOOD",

    # === 游戏 / 元宇宙 ===
    "RBLX", "U",

    # === AI / 量子 / 太空热门科技 ===
    "IONQ", "ASTS", "RKLB",
]

# 去重
seen = set()
TECH_STOCKS = [s for s in TECH_STOCKS if not (s in seen or seen.add(s))]
TECH_SET = set(TECH_STOCKS)
print(f"共 {len(TECH_STOCKS)} 只科技类美股")
print(f"数据源: 富途 OpenD ({FUTU_HOST}:{FUTU_PORT})")
print(f"数据范围: {START_DATE} ~ {END_DATE}")
print()

# ===== 清理不在新列表中的旧数据文件 =====
if os.path.exists(OUTPUT_DIR):
    removed = 0
    for f in os.listdir(OUTPUT_DIR):
        if f.endswith('.json') and f != '_index.json':
            code = f.replace('.json', '')
            if code not in TECH_SET:
                os.remove(os.path.join(OUTPUT_DIR, f))
                removed += 1
    if removed > 0:
        print(f"🧹 清理 {removed} 个不在新筛选列表中的旧数据文件\n")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ===== 连接富途 OpenD =====
print(f"正在连接富途 OpenD ({FUTU_HOST}:{FUTU_PORT})...")
quote_ctx = OpenQuoteContext(host=FUTU_HOST, port=FUTU_PORT)
print("连接成功！\n")

success, skip, fail = 0, 0, 0
index = {}

print("=" * 70)
for i, code in enumerate(TECH_STOCKS):
    fp = os.path.join(OUTPUT_DIR, f"{code}.json")

    # 如果已有缓存且下载日期匹配，跳过
    if os.path.exists(fp):
        try:
            with open(fp) as f:
                d = json.load(f)
            if d.get("downloaded_date", "") == END_DATE and d.get("count", 0) > 100:
                skip += 1
                index[code] = {
                    "name": d.get("name", ""),
                    "days": d.get("count", 0)
                }
                print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ⏭️  {code:6s} {d.get('name',''):16s} 已缓存 {d.get('count',0)}天")
                continue
        except:
            pass

    try:
        futu_code = f"US.{code}"

        # ===== 1. 下载近3年K线数据 =====
        ret, kline_data, _ = quote_ctx.request_history_kline(
            futu_code,
            start=START_DATE,
            end=END_DATE,
            ktype=KLType.K_DAY,
            autype=AuType.QFQ,
            max_count=1000
        )

        if ret != RET_OK:
            fail += 1
            print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ❌ {code:6s} K线获取失败: {str(kline_data)[:50]}")
            time.sleep(0.5)
            continue

        if kline_data is None or kline_data.empty:
            fail += 1
            print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ❌ {code:6s} 无K线数据")
            time.sleep(0.5)
            continue

        klines = []
        for _, row in kline_data.iterrows():
            klines.append({
                "t": str(row['time_key'])[:10],
                "o": round(float(row['open']), 2),
                "h": round(float(row['high']), 2),
                "l": round(float(row['low']), 2),
                "c": round(float(row['close']), 2),
                "v": int(row['volume'])
            })
        klines.sort(key=lambda x: x['t'])

        if len(klines) < 50:
            fail += 1
            print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ⚠️ {code:6s} 数据不足({len(klines)}天), 跳过")
            time.sleep(0.5)
            continue

        # ===== 2. 获取股票名称 =====
        name = code
        try:
            ret2, snap = quote_ctx.get_market_snapshot([futu_code])
            if ret2 == RET_OK and not snap.empty:
                row = snap.iloc[0]
                name = str(row.get('name', '') or row.get('stock_name', '') or code)
        except:
            pass

        # ===== 3. 保存数据 =====
        with open(fp, 'w') as f:
            json.dump({
                "code": code,
                "name": name,
                "currency": "USD",
                "downloaded_date": END_DATE,
                "data_start": klines[0]['t'],
                "data_end": klines[-1]['t'],
                "count": len(klines),
                "klines": klines
            }, f, ensure_ascii=False)

        success += 1
        index[code] = {
            "name": name,
            "days": len(klines)
        }
        print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ✅ {code:6s} {name:16s} {len(klines):4d}天")

    except Exception as e:
        fail += 1
        print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ❌ {code:6s} {str(e)[:60]}")
    
    time.sleep(0.3)

# 保存索引
with open(os.path.join(OUTPUT_DIR, '_index.json'), 'w') as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

quote_ctx.close()

total_mb = sum(os.path.getsize(os.path.join(OUTPUT_DIR, x))
               for x in os.listdir(OUTPUT_DIR) if x.endswith('.json')) / 1024 / 1024

print("=" * 70)
print(f"✅ 完成！成功:{success} 跳过:{skip} 失败:{fail}")
print(f"📁 {OUTPUT_DIR}/ ({total_mb:.1f} MB)")
print(f"📊 股票数: {len(index)}")
print(f"\n下一步: 启动后端服务:")
print(f"  python3 server_backend.py")
print(f"  浏览器打开 http://localhost:8765")
