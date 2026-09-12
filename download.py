#!/usr/bin/env python3
"""
富途 OpenD 批量下载科技类美股K线数据
24只核心科技股，近10年日K（富途单次上限1000条，自动分页）

用法: python3 download.py
前提: 富途牛牛客户端已启动 OpenD（默认端口 11111）
输出: stock_data/ 目录，每只股票一个 JSON
"""
import json, os, sys, time
from datetime import datetime, timedelta

from futu import OpenQuoteContext, KLType, AuType, RET_OK

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stock_data')

# ===== 近10年日期范围 =====
now = datetime.now()
START_DATE = (now - timedelta(days=365 * 10)).strftime('%Y-%m-%d')
END_DATE = now.strftime('%Y-%m-%d')

# ===== 富途 OpenD 连接参数 =====
FUTU_HOST = '127.0.0.1'
FUTU_PORT = 11111

# ===== 23只核心科技股 =====
# 注: EA 已于2025年被私有化收购退市，富途已无此股票，故移除
TECH_STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA",
    "AVGO", "CSCO", "ADBE", "QCOM", "TXN", "INTC",
    "AMAT", "ADI", "LRCX", "MU", "INTU", "NFLX",
    "ADP", "PANW", "NXPI", "BKNG", "CTSH",
]

# 去重（保持顺序）
seen = set()
TECH_STOCKS = [s for s in TECH_STOCKS if not (s in seen or seen.add(s))]
TECH_SET = set(TECH_STOCKS)
print(f"共 {len(TECH_STOCKS)} 只科技类美股")
print(f"数据源: 富途 OpenD ({FUTU_HOST}:{FUTU_PORT})")
print(f"数据范围: {START_DATE} ~ {END_DATE} (近10年)")
print()

# ===== 清理不在新列表中的旧数据文件 =====
if os.path.exists(OUTPUT_DIR):
    removed = 0
    for f in os.listdir(OUTPUT_DIR):
        if f.endswith('.json'):
            code = f.replace('.json', '')
            if code.startswith('_'):
                os.remove(os.path.join(OUTPUT_DIR, f))
                removed += 1
            elif code not in TECH_SET:
                os.remove(os.path.join(OUTPUT_DIR, f))
                removed += 1
    if removed > 0:
        print(f"🧹 清理 {removed} 个不在新筛选列表中的旧数据文件\n")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ===== 连接富途 OpenD =====
print(f"正在连接富途 OpenD ({FUTU_HOST}:{FUTU_PORT})...")
quote_ctx = OpenQuoteContext(host=FUTU_HOST, port=FUTU_PORT)
print("连接成功！\n")


def fetch_all_klines(quote_ctx, futu_code):
    """
    分页拉取近10年日K。
    富途 request_history_kline 单次最多返回1000条（从start往后数），
    所以不断把start游标往后挪，直到取完或到达END_DATE。
    """
    all_rows = []
    start_cursor = START_DATE
    for _ in range(10):  # 最多10页保险
        ret, data, _ = quote_ctx.request_history_kline(
            futu_code,
            start=start_cursor,
            end=END_DATE,
            ktype=KLType.K_DAY,
            autype=AuType.QFQ,
            max_count=1000
        )
        if ret != RET_OK:
            raise RuntimeError(str(data)[:80])
        if data is None or data.empty:
            break
        all_rows.append(data)
        if len(data) < 1000:
            break
        # 本页最晚日期，游标后移1天继续往后翻
        latest = str(data.iloc[-1]['time_key'])[:10]
        start_cursor = (datetime.strptime(latest, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
        if start_cursor > END_DATE:
            break
        time.sleep(0.3)
    if not all_rows:
        return []
    import pandas as pd
    df = pd.concat(all_rows, ignore_index=True)
    return df.to_dict('records')


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
            if d.get("downloaded_date", "") == END_DATE and d.get("count", 0) > 2000:
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

        # ===== 1. 分页下载近10年K线数据 =====
        rows = fetch_all_klines(quote_ctx, futu_code)

        if len(rows) < 50:
            fail += 1
            print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ⚠️ {code:6s} 数据不足({len(rows)}天), 跳过")
            time.sleep(0.5)
            continue

        klines = []
        for row in rows:
            klines.append({
                "t": str(row['time_key'])[:10],
                "o": round(float(row['open']), 2),
                "h": round(float(row['high']), 2),
                "l": round(float(row['low']), 2),
                "c": round(float(row['close']), 2),
                "v": int(row['volume'])
            })
        # 去重 + 排序
        uniq = {k['t']: k for k in klines}
        klines = sorted(uniq.values(), key=lambda x: x['t'])

        # ===== 2. 获取股票名称 =====
        name = code
        try:
            ret2, snap = quote_ctx.get_market_snapshot([futu_code])
            if ret2 == RET_OK and not snap.empty:
                srow = snap.iloc[0]
                name = str(srow.get('name', '') or srow.get('stock_name', '') or code)
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
        print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ✅ {code:6s} {name:16s} {len(klines):4d}天 ({klines[0]['t']} ~ {klines[-1]['t']})")

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
print(f"\n下一步: 重建财报数据库:")
print(f"  python3 fetch_earnings.py")
print(f"  python3 server_backend.py")
print(f"  浏览器打开 http://localhost:8765")
