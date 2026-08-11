#!/usr/bin/env python3
"""
通过富途 OpenD 获取 _index.json 中所有股票的市值，
列出市值 < 200亿美元 的股票。
"""
import json
from futu import OpenQuoteContext, RET_OK

INDEX_PATH = '/Users/jefferypang/StockTrainer/StockTrainer/_index.json'
THRESHOLD = 20_000_000_000  # 200亿美元 = 20 billion USD

with open(INDEX_PATH) as f:
    index = json.load(f)

codes = list(index.keys())
print(f"共 {len(codes)} 只股票，开始获取市值...\n")

quote_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)

# 测试连接
ret, data = quote_ctx.get_market_state(["US.AAPL"])
if ret != RET_OK:
    print(f"❌ 连接失败: {data}")
    exit(1)
print("✅ 富途 OpenD 已连接\n")

# 批量获取快照（futu 支持批量，但一次太多可能超限，分批处理）
BATCH = 30
results = []  # (code, name, market_value_usd, price)

for i in range(0, len(codes), BATCH):
    batch = codes[i:i+BATCH]
    futu_codes = [f"US.{c}" for c in batch]
    ret, snap = quote_ctx.get_market_snapshot(futu_codes)
    if ret != RET_OK:
        print(f"❌ 批量获取失败: {snap}")
        continue
    for _, row in snap.iterrows():
        code = row['code'].replace('US.', '')
        name = row.get('name', '') or index.get(code, {}).get('name', '')
        # total_market_val 是总市值（USD），issued_shares 是总股本
        mv = row.get('total_market_val', 0)
        if mv is None or str(mv) == 'nan':
            mv = 0
        last_price = row.get('last_price', 0)
        if str(last_price) == 'nan':
            last_price = 0
        results.append((code, name, float(mv), float(last_price)))
    print(f"  已获取 {min(i+BATCH, len(codes))}/{len(codes)}")

quote_ctx.close()

# 按市值排序（升序）
results.sort(key=lambda x: x[2])

# 统计
below = [(c, n, mv, p) for c, n, mv, p in results if 0 < mv < THRESHOLD]
above = [(c, n, mv, p) for c, n, mv, p in results if mv >= THRESHOLD]
zero   = [(c, n, mv, p) for c, n, mv, p in results if mv == 0]

print(f"\n{'='*80}")
print(f"市值 < 200亿美元的股票（共 {len(below)} 只）：")
print(f"{'='*80}")
print(f"{'代码':<8} {'名称':<28} {'市值(亿美元)':>12} {'现价':>10}")
print("-" * 80)
for code, name, mv, price in below:
    mv_yi = mv / 1e8  # 转为亿美元
    print(f"{code:<8} {name:<28} {mv_yi:>12.1f} {price:>10.2f}")

print(f"\n{'='*80}")
print(f"汇总：")
print(f"  < 200亿美元: {len(below)} 只")
print(f"  >= 200亿美元: {len(above)} 只")
print(f"  无数据/为0: {len(zero)} 只 {[c for c,_,_,_ in zero]}")
print(f"  总计: {len(results)} 只")

# 也输出 JSON 方便后续使用
output = {
    "threshold_usd": THRESHOLD,
    "threshold_yi_usd": 200,
    "below": [{"code": c, "name": n, "market_value_usd": mv, "market_value_yi_usd": round(mv/1e8, 1), "price": p} for c, n, mv, p in below],
    "count_below": len(below),
    "count_above": len(above),
    "count_total": len(results),
}
with open('/Users/jefferypang/StockTrainer/market_cap_below_20b.json', 'w') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
print(f"\n结果已保存到 /Users/jefferypang/StockTrainer/market_cap_below_20b.json")
