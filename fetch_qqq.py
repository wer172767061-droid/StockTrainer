# -*- coding: utf-8 -*-
"""用 moomoo OpenD 拉 QQQ 全历史日K，覆盖写入 stock_data/QQQ.json

用法:
    python fetch_qqq.py            # 拉取并写入
    python fetch_qqq.py --dry-run  # 只打印统计，不落盘

说明:
  * QQQ 上市日为 1999-03-10，所以"1990 年开始"实际只能拿到 1999-03-10 起的数据。
  * 单次请求上限 1000 条，脚本按 start 游标分页直到取完。
  * 输出结构与仓库既有 JSON 完全一致，并自动同步 _index.json。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta

try:
    import moomoo as ft
except ImportError:  # 仓库原生依赖是 futu-api，两个都能跑
    try:
        import futu as ft
    except ImportError:
        sys.exit("[X] 需要 moomoo-api 或 futu-api：python -m pip install moomoo-api")

if not hasattr(ft, "OpenQuoteContext"):
    sys.exit("[X] 导入到的模块不是官方 SDK（可能被同名目录遮蔽）")

BASE = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE, "stock_data")

CODE = "QQQ"
FT_CODE = "US.QQQ"
REQUESTED_START = "1990-01-01"          # 用户要求的起点；实际起点受上市日限制
END_DATE = datetime.now().strftime("%Y-%m-%d")
HOST, PORT = "127.0.0.1", 11111
MAX_PAGES = 30                          # 1999→今 约 6800 交易日，10 页足够，留余量


def fetch_all_pages(ctx) -> list[dict]:
    """按 start 游标分页，返回按日期升序、去重后的 K 线列表。"""
    rows: list[dict] = []
    cursor = REQUESTED_START
    ktype = getattr(ft.KLType, "K_DAY")
    autype = getattr(ft.AuType, "QFQ")

    for page in range(MAX_PAGES):
        ret, data, _key = ctx.request_history_kline(
            FT_CODE, start=cursor, end=END_DATE,
            ktype=ktype, autype=autype, max_count=1000,
        )
        if ret != ft.RET_OK:
            msg = str(data)
            if "quota" in msg.lower() or "额度" in msg:
                raise RuntimeError(
                    f"历史K线额度不足：{msg}\n"
                    "    -> 到 moomoo OpenAPI 后台查看/购买「历史K线额度」，或换有 LV2 权限的账户"
                )
            raise RuntimeError(f"request_history_kline 失败: {msg}")

        if data is None or data.empty:
            break

        for row in data.to_dict("records"):
            rows.append({
                "t": str(row["time_key"])[:10],
                "o": round(float(row["open"]), 2),
                "h": round(float(row["high"]), 2),
                "l": round(float(row["low"]), 2),
                "c": round(float(row["close"]), 2),
                "v": int(row["volume"]),
            })
        print(f"  第 {page + 1} 页: {len(data)} 条 "
              f"({str(data.iloc[0]['time_key'])[:10]} ~ {str(data.iloc[-1]['time_key'])[:10]})")

        if len(data) < 1000:
            break
        latest = str(data.iloc[-1]["time_key"])[:10]
        nxt = (datetime.strptime(latest, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
        if nxt > END_DATE or nxt == cursor:
            break
        cursor = nxt
        time.sleep(0.3)

    uniq = {r["t"]: r for r in rows}
    return sorted(uniq.values(), key=lambda x: x["t"])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="只统计，不写文件")
    args = ap.parse_args()

    print(f"连接 OpenD {HOST}:{PORT} ...")
    ctx = ft.OpenQuoteContext(host=HOST, port=PORT)
    try:
        try:
            ret, quota = ctx.get_history_kl_quota(get_detail=True)
            print(f"历史K线额度: {quota}")
        except Exception as exc:
            print(f"（额度查询跳过: {exc}）")

        print(f"\n拉取 {FT_CODE} 日K，请求区间 {REQUESTED_START} ~ {END_DATE}")
        klines = fetch_all_pages(ctx)

        if not klines:
            print("[X] 没有取到任何数据（OpenD 未登录？无美股行情权限？）")
            return 1

        name = CODE
        try:
            ret2, snap = ctx.get_market_snapshot([FT_CODE])
            if ret2 == ft.RET_OK and not snap.empty:
                name = str(snap.iloc[0].get("name", "") or name)
        except Exception:
            pass

        print(f"\n共 {len(klines)} 条，{klines[0]['t']} ~ {klines[-1]['t']}，名称={name}")
        if klines[0]["t"] > "1990-12-31":
            print(f"[i] 注意：起点是 {klines[0]['t']}，不是 1990。"
                  f"QQQ 于 1999-03-10 上市，此前不存在该标的。")

        if args.dry_run:
            print("（--dry-run，未写文件）")
            return 0

        os.makedirs(OUTPUT_DIR, exist_ok=True)
        fp = os.path.join(OUTPUT_DIR, f"{CODE}.json")
        if os.path.exists(fp):
            bak = fp + f".bak-{datetime.now():%Y%m%d%H%M%S}"
            os.replace(fp, bak)
            print(f"旧文件已备份: {os.path.basename(bak)}")

        payload = {
            "code": CODE,
            "name": name,
            "currency": "USD",
            "downloaded_date": END_DATE,
            "data_start": klines[0]["t"],
            "data_end": klines[-1]["t"],
            "count": len(klines),
            "klines": klines,
        }
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        size_kb = os.path.getsize(fp) / 1024
        print(f"已写入 {fp} ({size_kb:.0f} KB)")

        # 同步索引，保留其它条目与顺序
        idx_path = os.path.join(OUTPUT_DIR, "_index.json")
        index = {}
        if os.path.exists(idx_path):
            with open(idx_path, encoding="utf-8") as f:
                index = json.load(f)
        index[CODE] = {"name": name, "days": len(klines)}
        with open(idx_path, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        print(f"_index.json 已更新（共 {len(index)} 只标的）")
        return 0
    finally:
        ctx.close()


if __name__ == "__main__":
    sys.exit(main())
