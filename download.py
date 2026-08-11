#!/usr/bin/env python3
"""
富途 OpenD 批量下载科技类美股K线数据
在 Mac 上运行（富途 OpenD 需已启动并登录）

用法: python3 download.py
输出: stock_data/ 目录，每只股票一个 JSON
"""
import json, os, time
from datetime import datetime
from futu import *

OPEND_HOST = '127.0.0.1'
OPEND_PORT = 11111
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stock_data')

# 科技类美股（不要中概、保险、医疗、能源、材料、消费）
TECH_STOCKS = [
    "AAPL","MSFT","GOOGL","AMZN","META","NVDA","AMD","INTC","AVGO","ADBE",
    "CSCO","QCOM","TXN","ORCL","CRM","IBM","NOW","CRWD","PLTR","NET","TSLA",
    "NFLX","PYPL","UBER","ABNB","SHOP","SQ","SNOW","DDOG","ZM","TEAM",
    "MDB","OKTA","EBAY","ROKU","COIN","HOOD","DASH","PINS","SNAP","RBLX",
    "U","MARA","TWLO","DOCU","DKNG","ZS","PATH","ESTC","FROG","PD",
    "DOCN","AI","WIX","GDDY","HUBS","BILL","MNDY","ZI","PCOR","TTD",
    "APP","NTNX","GTLB",
    "TSM","ASML","AMAT","MU","ADI","LRCX","NXPI","MCHP","MRVL","ARM",
    "ANET","KLAC","ON","SWKS","QRVO","MPWR","ONTO","AEHR","CAMT","UCTT",
    "ACMR","WOLF","SITM","ENTG","OLED","FORM","LSCC","ALAB","SGH","GFS",
    "DELL","SMCI","STX","WDC","NTAP","HPQ","HPE","LOGI","CDW",
    "PANW","FTNT","SNPS","CDNS","INTU","WDAY","ANSS","TYL","IT",
    "S","TENB","VRNS","RPD","CHKP","FFIV","GEN",
    "CIEN","LITE","FN","AAOI","IPGP","COHR","KEYS","TER",
    "RIVN","LCID","GM","F","JOBY","ACHR",
    "FSLR","ENPH","SOUN","IONQ","RGTI","QUBT","BBAI",
    "AFRM","OSIS","POET","LMND","OPEN","RDFN","ZG","COMP",
    "RKLB","ASTS","FFIE","LUMN","PRCT","NEWR",
    "SAP","ADP","ACN",
]

# 去重
seen = set()
TECH_STOCKS = [s for s in TECH_STOCKS if not (s in seen or seen.add(s))]
print(f"共 {len(TECH_STOCKS)} 只科技类美股\n")

os.makedirs(OUTPUT_DIR, exist_ok=True)

quote_ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT)

# 测试连接
ret, data = quote_ctx.get_market_state(["US.AAPL"])
if ret != RET_OK:
    print(f"❌ 连接失败: {data}")
    print("请确保富途 OpenD 已启动并登录")
    exit(1)
print("✅ 富途 OpenD 已连接\n")

success, skip, fail = 0, 0, 0
index = {}

print("=" * 60)
for i, code in enumerate(TECH_STOCKS):
    fp = os.path.join(OUTPUT_DIR, f"{code}.json")
    if os.path.exists(fp):
        skip += 1
        try:
            with open(fp) as f: d = json.load(f)
            index[code] = {"name": d.get("name",""), "days": d.get("count",0)}
        except: pass
        continue

    try:
        ret, data, _ = quote_ctx.request_history_kline(
            f"US.{code}", start='2016-01-01', end=datetime.now().strftime('%Y-%m-%d'),
            ktype=KLType.K_DAY, max_count=5000
        )
        if ret != RET_OK or data.empty:
            fail += 1
            print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ❌ {code}")
            time.sleep(0.3); continue

        klines = []
        for _, r in data.iterrows():
            klines.append({
                "t": str(r['time_key'])[:10],
                "o": round(float(r['open']),2),
                "h": round(float(r['high']),2),
                "l": round(float(r['low']),2),
                "c": round(float(r['close']),2),
                "v": int(r['volume'])
            })
        klines.sort(key=lambda x: x['t'])

        ret2, snap = quote_ctx.get_market_snapshot([f"US.{code}"])
        name = ''
        if ret2 == RET_OK and not snap.empty:
            name = snap.iloc[0].get('name', '') or snap.iloc[0].get('stock_name', '')

        with open(fp, 'w') as f:
            json.dump({
                "code": code, "name": name, "currency": "USD",
                "downloaded_date": datetime.now().strftime('%Y-%m-%d'),
                "count": len(klines), "klines": klines
            }, f)

        success += 1
        index[code] = {"name": name, "days": len(klines)}
        print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ✅ {code:6s} {name:12s} {len(klines)}天")
    except Exception as e:
        fail += 1
        print(f"[{i+1:3d}/{len(TECH_STOCKS)}] ❌ {code:6s} {str(e)[:40]}")
    time.sleep(0.3)

quote_ctx.close()

with open(os.path.join(OUTPUT_DIR, '_index.json'), 'w') as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

total_mb = sum(os.path.getsize(os.path.join(OUTPUT_DIR, x))
               for x in os.listdir(OUTPUT_DIR) if x.endswith('.json')) / 1024 / 1024

print("=" * 60)
print(f"✅ 完成！成功:{success} 跳过:{skip} 失败:{fail}")
print(f"📁 {OUTPUT_DIR}/ ({total_mb:.1f} MB)")
print(f"\n下一步: 把 stock_data/ 和以下文件一起部署到 Render:")
print(f"  server_backend.py  requirements.txt  app.js  index.html  style.css")
