#!/usr/bin/env python3
"""
富途 OpenD 批量下载科技类美股K线数据
仅下载纳斯达克100 + 标普500科技股 + 热门科技股
排除中概股、医疗健康股
仅下载近3年K线数据
筛选近三年每年市值都 > 100亿美元

在 Mac 上运行（富途 OpenD 需已启动并登录）

用法: python3 download.py
输出: stock_data/ 目录，每只股票一个 JSON
"""
import json, os, time, sys
from datetime import datetime
from futu import *

OPEND_HOST = '127.0.0.1'
OPEND_PORT = 11111
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stock_data')

# ===== 近3年日期范围 =====
now = datetime.now()
START_DATE = f"{now.year - 3}-{now.month:02d}-{now.day:02d}"
END_DATE = now.strftime('%Y-%m-%d')

# ===== 市值过滤阈值: 100亿美元 =====
# 要求近三年每一年平均市值都 > $10B
MIN_MARKET_CAP = 10_000_000_000  # $10B

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
    "HPQ", "HPE", "ANSS", "FFIV", "CHKP",
    "PANW", "FTNT", "SNPS", "CDNS", "WDAY",

    # === 网络平台 / 互联网科技 ===
    "TSLA", "NFLX", "UBER", "ABNB", "SHOP", "PYPL", "DASH", "ROKU",
    "PINS", "SNAP", "SPOT",

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
print(f"共 {len(TECH_STOCKS)} 只科技类美股候选")
print(f"数据范围: {START_DATE} ~ {END_DATE}")
print(f"市值过滤: 近三年每年市值都 > ${MIN_MARKET_CAP/1e9:.0f}B\n")

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
        print(f"🧹 清理 {removed} 个不在新筛选列表中的旧数据文件")

    # 清理旧格式缓存（没有 min_yearly_market_cap 字段的文件需重新计算）
    old_fmt = 0
    for f in os.listdir(OUTPUT_DIR):
        if f.endswith('.json') and f != '_index.json':
            try:
                with open(os.path.join(OUTPUT_DIR, f)) as fp:
                    d = json.load(fp)
                if 'min_yearly_market_cap' not in d:
                    os.remove(os.path.join(OUTPUT_DIR, f))
                    old_fmt += 1
            except:
                pass
    if old_fmt > 0:
        print(f"🔄 清理 {old_fmt} 个旧格式缓存文件（需用新市值逻辑重新计算）")
    print()

os.makedirs(OUTPUT_DIR, exist_ok=True)
quote_ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT)

# 测试连接
ret, data = quote_ctx.get_market_state(["US.AAPL"])
if ret != RET_OK:
    print(f"❌ 连接失败: {data}")
    print("请确保富途 OpenD 已启动并登录")
    sys.exit(1)
print("✅ 富途 OpenD 已连接\n")

success, skip, fail, filtered_out = 0, 0, 0, 0
index = {}

print("=" * 70)
for i, code in enumerate(TECH_STOCKS):
    fp = os.path.join(OUTPUT_DIR, f"{code}.json")

    # 如果已有缓存且下载日期匹配且通过市值过滤，跳过
    if os.path.exists(fp):
        try:
            with open(fp) as f:
                d = json.load(f)
            if (d.get("downloaded_date", "") == END_DATE and
                d.get("min_yearly_market_cap", 0) >= MIN_MARKET_CAP):
                skip += 1
                index[code] = {
                    "name": d.get("name", ""),
                    "days": d.get("count", 0),
                    "avg_mkt_cap": d.get("avg_market_cap", 0),
                    "min_yearly_mkt_cap": d.get("min_yearly_market_cap", 0)
                }
                continue
        except:
            pass

    try:
        # ===== 1. 下载近3年K线数据 =====
        ret, data, _ = quote_ctx.request_history_kline(
            f"US.{code}", start=START_DATE, end=END_DATE,
            ktype=KLType.K_DAY, max_count=1000
        )
        if ret != RET_OK or data.empty:
            fail += 1
            print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ❌ {code:6s} K线获取失败")
            time.sleep(0.3)
            continue

        klines = []
        close_prices = []
        for _, r in data.iterrows():
            close = round(float(r['close']), 2)
            klines.append({
                "t": str(r['time_key'])[:10],
                "o": round(float(r['open']), 2),
                "h": round(float(r['high']), 2),
                "l": round(float(r['low']), 2),
                "c": close,
                "v": int(r['volume'])
            })
            close_prices.append(close)
        klines.sort(key=lambda x: x['t'])

        if len(klines) < 100:
            fail += 1
            print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ⚠️ {code:6s} 数据不足({len(klines)}天), 跳过")
            time.sleep(0.3)
            continue

        # ===== 2. 获取股票快照（名称 + 当前总市值）=====
        ret2, snap = quote_ctx.get_market_snapshot([f"US.{code}"])
        name = ''
        current_mkt_cap = 0

        if ret2 == RET_OK and not snap.empty:
            row = snap.iloc[0]
            # 获取股票名称
            for name_col in ['name', 'stock_name']:
                if name_col in snap.columns:
                    val = row.get(name_col, '')
                    if val:
                        name = str(val)
                        break
            # 获取当前总市值 - Futu API 列名是 total_market_value
            # 兼容多种可能的列名
            for cap_col in ['total_market_value', 'total_value', 'market_value', 'total_market_cap']:
                if cap_col in snap.columns:
                    try:
                        val = float(row.get(cap_col, 0) or 0)
                        if val > 0:
                            current_mkt_cap = val
                            break
                    except:
                        pass

        # ===== 3. 按年计算市值，确保每一年都 > $10B =====
        # 方法: 用当前总市值 / 最新收盘价 得到估算总股本,
        #       再用总股本 × 每年平均收盘价 估算每年平均市值
        last_close = close_prices[-1] if close_prices else 0
        avg_close = sum(close_prices) / len(close_prices) if close_prices else 0
        yearly_mkt_caps = {}  # 初始化，防止后续引用未定义变量

        # 按年分组收盘价
        yearly_prices = {}
        for kl in klines:
            year = kl['t'][:4]
            if year not in yearly_prices:
                yearly_prices[year] = []
            yearly_prices[year].append(kl['c'])

        if current_mkt_cap > 0 and last_close > 0:
            # 估算总股本 = 当前总市值 / 最新收盘价
            estimated_shares = current_mkt_cap / last_close
            # 计算每年平均市值
            yearly_mkt_caps = {}
            for year, prices in yearly_prices.items():
                yearly_avg = sum(prices) / len(prices)
                yearly_mkt_caps[year] = estimated_shares * yearly_avg
            min_yearly_mkt_cap = min(yearly_mkt_caps.values()) if yearly_mkt_caps else 0
            avg_market_cap = estimated_shares * avg_close
        else:
            # 如果拿不到市值数据，尝试用 total_shares
            # 再尝试从快照获取 total_shares
            total_shares = 0
            if ret2 == RET_OK and not snap.empty:
                row = snap.iloc[0]
                for ts_col in ['total_shares', 'share_total', 'total_shares_num']:
                    if ts_col in snap.columns:
                        try:
                            total_shares = float(row.get(ts_col, 0) or 0)
                            if total_shares > 0:
                                break
                        except:
                            pass
            if total_shares > 0:
                yearly_mkt_caps = {}
                for year, prices in yearly_prices.items():
                    yearly_avg = sum(prices) / len(prices)
                    yearly_mkt_caps[year] = total_shares * yearly_avg
                min_yearly_mkt_cap = min(yearly_mkt_caps.values()) if yearly_mkt_caps else 0
                avg_market_cap = total_shares * avg_close
            else:
                # 无法获取市值信息，不过滤（保留数据）
                min_yearly_mkt_cap = 0
                avg_market_cap = 0

        # ===== 4. 市值过滤: 每年市值都必须 > $10B =====
        if min_yearly_mkt_cap > 0 and min_yearly_mkt_cap < MIN_MARKET_CAP:
            filtered_out += 1
            cap_str = f"${min_yearly_mkt_cap/1e9:.1f}B" if min_yearly_mkt_cap > 0 else "N/A"
            yearly_str = " | ".join(f"{y}: ${v/1e9:.1f}B" for y, v in sorted(yearly_mkt_caps.items()))
            print(f"[{i+1:3d}/{len(TECH_STOCKS)}] 🚫 {code:6s} {name:16s} 最低年市值{cap_str} < $10B  [{yearly_str}]")
            if os.path.exists(fp):
                os.remove(fp)
            time.sleep(0.3)
            continue

        # 如果拿不到市值数据，也保留（宁可多留也不误删）
        if min_yearly_mkt_cap == 0 and current_mkt_cap == 0:
            print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ⚠️ {code:6s} {name:16s} 无法获取市值数据, 保留")

        # ===== 5. 保存数据 =====
        with open(fp, 'w') as f:
            json.dump({
                "code": code,
                "name": name,
                "currency": "USD",
                "downloaded_date": END_DATE,
                "data_start": klines[0]['t'],
                "data_end": klines[-1]['t'],
                "count": len(klines),
                "current_market_cap": current_mkt_cap,
                "avg_market_cap": round(avg_market_cap, 2),
                "min_yearly_market_cap": round(min_yearly_mkt_cap, 2),
                "yearly_market_caps": {y: round(v, 2) for y, v in sorted(yearly_mkt_caps.items())} if yearly_mkt_caps else {},
                "klines": klines
            }, f, ensure_ascii=False)

        success += 1
        index[code] = {
            "name": name,
            "days": len(klines),
            "avg_mkt_cap": round(avg_market_cap, 2),
            "min_yearly_mkt_cap": round(min_yearly_mkt_cap, 2)
        }
        cap_str = f"${min_yearly_mkt_cap/1e9:.1f}B" if min_yearly_mkt_cap > 0 else "N/A"
        print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ✅ {code:6s} {name:16s} {len(klines):4d}天  最低年市值{cap_str}")

    except Exception as e:
        fail += 1
        print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ❌ {code:6s} {str(e)[:50]}")
    time.sleep(0.3)

quote_ctx.close()

# 保存索引
with open(os.path.join(OUTPUT_DIR, '_index.json'), 'w') as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

total_mb = sum(os.path.getsize(os.path.join(OUTPUT_DIR, x))
               for x in os.listdir(OUTPUT_DIR) if x.endswith('.json')) / 1024 / 1024

print("=" * 70)
print(f"✅ 完成！成功:{success} 跳过:{skip} 过滤(市值不足):{filtered_out} 失败:{fail}")
print(f"📁 {OUTPUT_DIR}/ ({total_mb:.1f} MB)")
print(f"📊 筛选后股票数: {len(index)}")
print(f"\n下一步: 启动后端服务:")
print(f"  pip install -r requirements.txt")
print(f"  python3 server_backend.py")
print(f"  浏览器打开 http://localhost:8765")
