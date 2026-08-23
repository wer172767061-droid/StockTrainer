#!/usr/bin/env python3
"""
抓取全部股票的历史财报公告日，修正东方财富API的年份偏移bug，存入数据库文件。

原理:
  东方财富API的 NOTICE_DATE 月份/日期准确，但年份被偏移了1~2年。
  用 REPORT_DATE（报告期截止日，数据准确）做锚点，
  将 NOTICE_DATE 回退N年，使两者间隔落在15~50天（美股财报正常披露窗口），
  即可还原出精确的实际公告日。

用法:
  python3 fetch_earnings.py
"""

import json
import os
import time
import urllib.request
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stock_data")
OUTPUT_FILE = os.path.join(DATA_DIR, "_earnings.json")

API_URL = (
    "https://datacenter-web.eastmoney.com/api/data/v1/get"
    "?reportName=RPT_USF10_FN_GMAININDICATOR"
    "&columns=SECUCODE,NOTICE_DATE,REPORT_TYPE,REPORT_DATE"
    "&filter=(SECUCODE=%22{secucode}%22)"
    "&pageSize=100&sortColumns=NOTICE_DATE&sortTypes=-1"
    "&source=INTLSECURITIES&client=PC"
)

# 财报类型中文映射
REPORT_TYPE_MAP = {
    "Q1": "一季报",
    "Q2": "中报",
    "Q3": "三季报",
    "Q4": "年报",
    "Q6": "中报",
    "Q9": "三季报",
    "FY": "年报",
}


def translate_report_type(rt):
    """将 REPORT_TYPE (如 2025/Q1, 2024/FY) 翻译为中文"""
    if not rt:
        return "财报"
    rt = str(rt)
    parts = rt.split("/")
    if len(parts) == 2:
        return REPORT_TYPE_MAP.get(parts[1], rt)
    return rt


def correct_date(notice_str, report_str):
    """
    修正 NOTICE_DATE 的年份偏移。
    用 REPORT_DATE 做锚点，将 NOTICE_DATE 回退N年，
    使间隔落在 [15, 50] 天窗口内，即还原实际公告日。
    修正失败时兜底为 REPORT_DATE + 32 天。
    """
    try:
        notice = datetime.strptime(str(notice_str)[:10], "%Y-%m-%d")
        report = datetime.strptime(str(report_str)[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return None

    for n in range(0, 5):
        corrected = notice
        ok = True
        for _ in range(n):
            try:
                corrected = corrected.replace(year=corrected.year - 1)
            except ValueError:
                # 2月29日回退到非闰年 → 2月28日
                corrected = corrected.replace(year=corrected.year - 1, day=28)
        diff = (corrected - report).days
        if 15 <= diff <= 50:
            return corrected.strftime("%Y-%m-%d")

    # 兜底: REPORT_DATE + 32天
    return (report + timedelta(days=32)).strftime("%Y-%m-%d")


def fetch_raw_earnings(code, suffix="O"):
    """从东方财富API拉取某只股票的原始财报记录"""
    secucode = f"{code}.{suffix}"
    url = API_URL.format(secucode=secucode)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        if data.get("success") and data.get("result") and data["result"]["data"]:
            return data["result"]["data"]
    except Exception:
        pass
    return []


def build_earnings_for_stock(code):
    """抓取并修正单只股票的财报日期，返回按公告日升序的列表"""
    rows = fetch_raw_earnings(code, "O")
    if not rows:
        rows = fetch_raw_earnings(code, "N")  # 尝试NYSE后缀

    # 按 REPORT_DATE 去重（同一报告期可能有多条记录）
    seen = {}
    for r in rows:
        rd = str(r.get("REPORT_DATE", ""))[:10]
        if rd and rd not in seen:
            seen[rd] = r

    earnings = []
    for rd in sorted(seen.keys(), reverse=True):
        row = seen[rd]
        notice = str(row.get("NOTICE_DATE", ""))[:10]
        if not notice or notice == "None":
            continue
        corrected = correct_date(notice, rd)
        if not corrected:
            continue
        earnings.append({
            "date": corrected,  # 修正后的实际公告日
            "type": translate_report_type(row.get("REPORT_TYPE")),
        })

    # 按公告日升序排列
    earnings.sort(key=lambda x: x["date"])
    return earnings


def main():
    # 从 _index.json 读取股票列表
    index_path = os.path.join(DATA_DIR, "_index.json")
    with open(index_path) as f:
        index = json.load(f)
    codes = sorted(index.keys())
    print(f"共 {len(codes)} 只股票，开始抓取财报日期...")

    db = {}
    success = 0
    empty = 0
    for i, code in enumerate(codes):
        earnings = build_earnings_for_stock(code)
        if earnings:
            db[code] = earnings
            success += 1
        else:
            empty += 1
            print(f"  [{i+1}/{len(codes)}] {code}: 无财报数据")
        # 进度提示
        if (i + 1) % 10 == 0:
            print(f"  进度: {i+1}/{len(codes)}")
        # 限流保护
        time.sleep(0.3)

    with open(OUTPUT_FILE, "w") as f:
        json.dump(db, f, ensure_ascii=False, indent=1)

    print(f"\n完成!")
    print(f"  有财报数据: {success} 只")
    print(f"  无数据:     {empty} 只")
    print(f"  数据库文件: {OUTPUT_FILE}")

    # 抽样展示
    sample = ["AAPL", "MSFT", "TSLA", "NVDA"]
    for code in sample:
        if code in db:
            items = db[code][-4:]  # 最近4条
            dates = ", ".join(f"{e['date']}({e['type']})" for e in items)
            print(f"  {code}: {dates}")


if __name__ == "__main__":
    main()
