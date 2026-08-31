#!/usr/bin/env python3
"""
抓取全部股票的历史财报公告日，修正东方财富API的年份偏移bug，
并用本地K线把财报对齐到"实际价格反应日"，存入数据库文件。

三层处理:
  1. 年份修正: 东方财富API的 NOTICE_DATE 月份/日期准确但年份偏移1~2年，
     用 REPORT_DATE（报告期截止日，数据准确）做锚点，
     将 NOTICE_DATE 回退N年，使两者间隔落在15~50天（美股正常披露窗口），
     还原出精确的实际公告日。修正失败时兜底 REPORT_DATE+32天（标记 predicted）。

  2. 反应日对齐: 美股财报分盘前(BMO)/盘后(AMC)公布。
     盘后公布的财报，价格跳空+放量发生在下一个交易日。
     用本地K线在 [公告日, 公告日+1个交易日] 中找跳空+放量得分更高的那天，
     作为财报的实际"反应日"（reaction 字段）。前端以此日显示提醒，
     保证"今日财报发布"横幅出现的那天正是价格真正波动的日子。

  3. 未来财报预测: 下一报告期 = 最近REPORT_DATE + 1个季度；
     公告日 = 报告期截止日 + 该股历史披露滞后中位数。
     标记 predicted=true，前端显示"（预计）"。

用法:
  python3 fetch_earnings.py
"""

import json
import os
import statistics
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
    返回 (修正后日期字符串, 是否为兜底估算)。
    """
    try:
        notice = datetime.strptime(str(notice_str)[:10], "%Y-%m-%d")
        report = datetime.strptime(str(report_str)[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return None, False

    for n in range(0, 5):
        corrected = notice
        for _ in range(n):
            try:
                corrected = corrected.replace(year=corrected.year - 1)
            except ValueError:
                # 2月29日回退到非闰年 → 2月28日
                corrected = corrected.replace(year=corrected.year - 1, day=28)
        diff = (corrected - report).days
        if 15 <= diff <= 50:
            return corrected.strftime("%Y-%m-%d"), False

    # 兜底: REPORT_DATE + 32天（估算，标记为 predicted）
    return (report + timedelta(days=32)).strftime("%Y-%m-%d"), True


# ===== 反应日对齐 =====

def load_klines(code):
    path = os.path.join(DATA_DIR, f"{code}.json")
    if not os.path.exists(path):
        return None
    try:
        with open(path) as f:
            data = json.load(f)
        return data.get("klines") or []
    except Exception:
        return None


def reaction_metrics(klines, j):
    """交易日j的跳空幅度(%)与放量倍数(vs 前10日成交量中位数)"""
    k = klines[j]
    prev = klines[j - 1]
    if j <= 0 or prev["c"] <= 0:
        return 0.0, 1.0
    gap = abs(k["o"] - prev["c"]) / prev["c"] * 100
    base = [klines[i]["v"] for i in range(max(0, j - 10), j)]
    base_median = statistics.median(base) if base else k["v"]
    vol_ratio = k["v"] / max(base_median, 1)
    return gap, vol_ratio


def find_reaction_day(klines, ann_date, back=12, fwd=3):
    """
    找出财报公布后价格真正跳空放量的交易日（反应日）。

    三级策略:
      1. 局部判断: 公告日当天 vs 次个交易日，谁的反应强用谁
         (盘前BMO公布→当日反应; 盘后AMC公布→次日反应)。
         若两者之一已是强信号(放量≥2x或跳空≥2%)，直接采用。
      2. 财报级信号吸附: 东方财富的公告日常带"数据录入滞后"，
         实际跳空可能早于公告日数个交易日(如ADBE晚11天)。
         在 [公告日-back, 公告日+fwd] 个交易日范围内，
         找符合财报级反应(放量≥1.8x且跳空≥1.5%，或放量≥2.5x)的最高得分日。
      3. 都没有明显信号(市场反应平淡): 用公告日当天。

    返回反应日的日期字符串; 公告日超出本地K线范围时返回原日期。
    """
    if not klines:
        return ann_date
    idx0 = None
    for i, k in enumerate(klines):
        if k["t"] >= ann_date:
            idx0 = i
            break
    if idx0 is None:
        return ann_date  # 超出本地K线范围（未来事件），保持原日期

    idx1 = idx0 + 1 if idx0 + 1 < len(klines) else None

    # --- 第1级: 局部强信号 ---
    # 盘前(BMO)公布→当日反应; 盘后(AMC)公布→次日反应。
    # 当日或次日已有强信号(放量≥2x或跳空≥2%)时直接采用。
    for j in ([idx0] + ([idx1] if idx1 is not None else [])):
        gap, vr = reaction_metrics(klines, j)
        if vr >= 2.0 or gap >= 2.0:
            return klines[j]["t"]

    # --- 第2级: 财报级信号吸附 ---
    # 东方财富的公告日常带"数据录入滞后"，实际跳空可能早于/晚于公告日
    # 数个交易日(如ADBE晚11天)。在 [公告日-back, 公告日+fwd] 个交易日
    # 范围内找符合财报级反应的最高得分日。
    lo = max(1, idx0 - back)
    hi = min(len(klines) - 1, idx0 + fwd)
    best_j = None
    best_score = -1.0
    for j in range(lo, hi + 1):
        gap, vr = reaction_metrics(klines, j)
        qualifying = (vr >= 1.8 and gap >= 1.5) or vr >= 2.5
        if not qualifying:
            continue
        # 距离惩罚: 离公告日越远，要求信号越强
        score = vr * (1 + gap * 0.2) / (1 + 0.15 * abs(j - idx0))
        if score > best_score:
            best_score = score
            best_j = j
    if best_j is not None:
        return klines[best_j]["t"]

    # --- 第3级: 弱局部选择（市场反应平淡时按公告日/次日中较强者） ---
    if idx1 is not None:
        def local_score(j):
            gap, vr = reaction_metrics(klines, j)
            return vr * (1 + gap * 0.2)
        if local_score(idx1) > local_score(idx0) * 1.3 and local_score(idx1) > 1.5:
            return klines[idx1]["t"]
    return klines[idx0]["t"]


# ===== 未来财报预测 =====

NEXT_TYPE_MAP = {
    "一季报": "中报",
    "中报": "三季报",
    "三季报": "年报",
    "年报": "一季报",
}


def predict_next_earnings(events, klines):
    """
    推算下一次财报:
      下一报告期截止日 = 最近报告期 + 最近两个报告期的实际间隔
                         (兼容AAPL 9月财年、NVDA 1月末财年等非自然季度);
      预测公告日 = 下一报告期截止日 + 该股历史"公告滞后"中位数。
    若预测日落在本地K线范围内，同样做反应日对齐（可补齐API缺失的已发财报）。
    events: 已按公告日升序、含 report_date 的历史事件列表。
    返回预测事件 dict 或 None。
    """
    if not events:
        return None

    rds = []
    for e in events:
        try:
            rds.append(datetime.strptime(e["report_date"], "%Y-%m-%d"))
        except (ValueError, TypeError, KeyError):
            continue
    if not rds:
        return None
    last_rd = rds[-1]

    # 下一报告期 = 最近报告期 + 实际季度间隔（异常时兜底91天）
    if len(rds) >= 2:
        spacing = (rds[-1] - rds[-2]).days
        if not (60 <= spacing <= 120):
            spacing = 91
    else:
        spacing = 91
    next_rd = last_rd + timedelta(days=spacing)

    # 历史"公告滞后"中位数
    lags = []
    for e in events:
        try:
            rd = datetime.strptime(e["report_date"], "%Y-%m-%d")
            ann = datetime.strptime(e["date"], "%Y-%m-%d")
            lag = (ann - rd).days
            if 10 <= lag <= 90:
                lags.append(lag)
        except (ValueError, TypeError, KeyError):
            continue
    if not lags:
        return None

    pred_date = next_rd + timedelta(days=round(statistics.median(lags)))
    pred_date_str = pred_date.strftime("%Y-%m-%d")
    last_type = events[-1].get("type", "财报")
    return {
        "date": pred_date_str,
        "reaction": find_reaction_day(klines, pred_date_str),
        "type": NEXT_TYPE_MAP.get(last_type, "财报"),
        "report_date": next_rd.strftime("%Y-%m-%d"),
        "predicted": True,
        "is_next": True,
    }


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


def build_earnings_for_stock(code, klines):
    """抓取、修正、对齐反应日，并追加预测的下一次财报。返回按日期升序列表。"""
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
    deferred = 0  # 反应日被顺延到次日的事件数
    for rd in sorted(seen.keys(), reverse=True):
        row = seen[rd]
        notice = str(row.get("NOTICE_DATE", ""))[:10]
        if not notice or notice == "None":
            continue
        corrected, is_estimate = correct_date(notice, rd)
        if not corrected:
            continue
        reaction = find_reaction_day(klines, corrected)
        if reaction > corrected:
            deferred += 1
        earnings.append({
            "date": corrected,               # 实际公告日
            "reaction": reaction,            # 价格反应日（前端显示用）
            "type": translate_report_type(row.get("REPORT_TYPE")),
            "report_date": rd,               # 报告期截止日（预测下季用）
            "predicted": is_estimate,        # 年份修正失败的兜底估算
        })

    # 按公告日升序排列
    earnings.sort(key=lambda x: x["date"])

    # 追加预测的下一次财报（如果它晚于最后一条历史公告）
    pred = predict_next_earnings(earnings, klines)
    if pred and (not earnings or pred["date"] > earnings[-1]["date"]):
        earnings.append(pred)

    return earnings, deferred


def main():
    # 从 _index.json 读取股票列表
    index_path = os.path.join(DATA_DIR, "_index.json")
    with open(index_path) as f:
        index = json.load(f)
    codes = sorted(index.keys())
    print(f"共 {len(codes)} 只股票，开始抓取财报日期...")

    # 读取旧库: 本次API抓取失败的股票保留旧数据（东方财富接口偶发超时）
    old_db = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE) as f:
                old_db = json.load(f)
        except Exception:
            old_db = {}

    db = {}
    success = 0
    empty = 0
    reused = 0
    total_events = 0
    total_deferred = 0
    total_estimates = 0
    total_predicted_next = 0
    for i, code in enumerate(codes):
        klines = load_klines(code)
        earnings, deferred = build_earnings_for_stock(code, klines)
        if not earnings and code in old_db and old_db[code]:
            earnings = old_db[code]
            deferred = 0
            reused += 1
            print(f"  [{i+1}/{len(codes)}] {code}: API无返回，沿用上次数据")
        if earnings:
            db[code] = earnings
            success += 1
            total_events += len(earnings)
            total_deferred += deferred
            total_estimates += sum(1 for e in earnings if e.get("predicted") and not e.get("is_next"))
            total_predicted_next += sum(1 for e in earnings if e.get("is_next"))
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
    print(f"  有财报数据:   {success} 只")
    print(f"  沿用旧数据:   {reused} 只")
    print(f"  无数据:       {empty} 只")
    print(f"  历史事件总数: {total_events}")
    print(f"  反应日顺延:   {total_deferred} 个 (盘后公布→次日反应)")
    print(f"  兜底估算:     {total_estimates} 个 (标记 predicted)")
    print(f"  预测下季:     {total_predicted_next} 个 (标记 predicted)")
    print(f"  数据库文件: {OUTPUT_FILE}")

    # 抽样展示
    sample = ["AAPL", "MSFT", "TSLA", "NVDA"]
    for code in sample:
        if code in db:
            items = db[code][-4:]  # 最近4条
            dates = ", ".join(
                f"{e['date']}→{e['reaction']}{e['type']}"
                + ("(预计)" if e.get("predicted") else "")
                for e in items
            )
            print(f"  {code}: {dates}")


if __name__ == "__main__":
    main()
