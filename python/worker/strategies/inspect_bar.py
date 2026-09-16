from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

_PYTHON_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(_PYTHON_ROOT))

if not os.environ.get("TRADING_ZONE_USER_DATA", "").strip():
    if sys.platform == "win32":
        _user_data = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "trading-zone-electron"
    elif sys.platform == "darwin":
        _user_data = Path.home() / "Library" / "Application Support" / "trading-zone-electron"
    else:
        _config = os.environ.get("XDG_CONFIG_HOME", str(Path.home() / ".config"))
        _user_data = Path(_config) / "trading-zone-electron"
    os.environ["TRADING_ZONE_USER_DATA"] = str(_user_data)

from MingSystemVer1 import MingSystemVer1


def _to_yyyymmdd(value: str) -> str:
    return value.replace("-", "")


def _fmt(value: object, digits: int = 6) -> str:
    if value is None or pd.isna(value):
        return "NA"
    return f"{float(value):.{digits}f}"


def _mark(passed: bool | None) -> str:
    if passed is None:
        return "未就绪"
    return "通过" if passed else "未通过"


def _lookback_start(trade_date: str, calendar_days: int = 500) -> str:
    day = datetime.strptime(trade_date, "%Y%m%d")
    return (day - timedelta(days=calendar_days)).strftime("%Y%m%d")


def explain_bar(strategy: MingSystemVer1, trade_date: str) -> int:
    date = _to_yyyymmdd(trade_date)
    daily = strategy.daily
    if daily.empty:
        print(f"{strategy.ts_code} 在 {strategy.start_date}-{strategy.end_date} 没有行情")
        return 1
    if date not in daily.index:
        nearby = daily.loc[(daily.index >= f"{date[:6]}01") & (daily.index <= f"{date[:6]}31")]
        print(f"{strategy.ts_code} 没有 {date} 这根K线（可能不是交易日）")
        if not nearby.empty:
            print(f"同月交易日: {', '.join(nearby.index.astype(str).tolist())}")
        return 1

    row = daily.loc[date]
    mode = "C-O" if strategy.range_mode == "co" else "C-L"
    std_ready = pd.notna(row["std"]) and pd.notna(row["atr"])
    wr_ready = pd.notna(row["wr"])
    strong_ready = pd.notna(row["n_range"])
    vol_ready = pd.notna(row["vol_ma"])

    squeeze_ok = bool(row["in_squeeze"]) if std_ready else None
    wr_ok = bool(row["wr"] < 50) if wr_ready else None
    strong_ok = bool(row["strong_k"]) if strong_ready else None
    vol_ok = bool(row["vol_ok"]) if vol_ready else None

    k_th = (float(row["n_range"]) * strategy.k) if strong_ready else None
    vol_need = (float(row["vol_ma"]) * strategy.vol_y) if vol_ready else None

    print(
        f"{strategy.ts_code}  {date}  {strategy.adjust}  "
        f"{mode}  n={strategy.wr_n}  k={strategy.k}  "
        f"vol={strategy.vol_x}x{strategy.vol_y}"
    )
    print(
        f"OHLC  O={_fmt(row['open'], 4)}  H={_fmt(row['high'], 4)}  "
        f"L={_fmt(row['low'], 4)}  C={_fmt(row['close'], 4)}  "
        f"V={_fmt(row['vol'], 2)}"
    )
    print()

    print(f"1. 周期挤压  [{_mark(squeeze_ok)}]")
    if not std_ready:
        print(f"   t-1 的 STD/ATR 尚未形成，至少需要 {strategy.squeeze_period + 1} 根K线")
    else:
        print(
            f"   t-1 STD({strategy.squeeze_period})={_fmt(row['std'])}  "
            f"t-1 ATR({strategy.squeeze_period})={_fmt(row['atr'])}  "
            "需要 t-1 的 STD < ATR"
        )

    print(f"2. 威廉动能  [{_mark(wr_ok)}]")
    if not wr_ready:
        print(f"   WR 尚未形成，至少需要 {strategy.wr_n} 根K线")
    else:
        print(
            f"   WR={_fmt(row['wr'], 4)}  Hn={_fmt(row['hn'], 4)}  "
            f"Ln={_fmt(row['ln'], 4)}  C={_fmt(row['close'], 4)}  "
            "需要 WR < 50（Hn/Ln 含当天）"
        )

    print(f"3. 强势K {mode}  [{_mark(strong_ok)}]")
    if not strong_ready:
        print(f"   t-1 起 n日波幅尚未形成，至少需要 {strategy.wr_n + 1} 根K线")
    else:
        print(
            f"   {mode}={_fmt(row['impulse'])}  "
            f"(Hn-Ln)[t-n:t-1]*k={_fmt(k_th)}  "
            f"需要 {mode} >= (Hn-Ln)*k（波幅不含当天）"
        )

    print(f"4. 成交量  [{_mark(vol_ok)}]")
    if not vol_ready:
        print(f"   均量尚未形成，至少需要过去 {strategy.vol_x} 根K线")
    else:
        print(
            f"   vol={_fmt(row['vol'], 2)}  "
            f"过去{strategy.vol_x}日均量={_fmt(row['vol_ma'], 2)}  "
            f"阈值={_fmt(vol_need, 2)}  "
            f"需要 vol >= 均量 * {strategy.vol_y}"
        )

    checks = [
        ("周期挤压", squeeze_ok),
        ("威廉动能", wr_ok),
        ("强势K", strong_ok),
        ("成交量", vol_ok),
    ]
    failed = [name for name, ok in checks if ok is False]
    unread = [name for name, ok in checks if ok is None]
    print()
    if unread:
        print(f"结论：无法判定。未就绪：{'、'.join(unread)}")
        return 2
    if failed:
        print(f"结论：不符合买入信号。卡住的条件：{'、'.join(failed)}")
        return 0
    print("结论：符合买入信号")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="检查指定K线为什么不符合 MingSystemVer1 买入条件")
    parser.add_argument("ts_code", help="标的代码，例如 600188.SH")
    parser.add_argument("trade_date", help="K线日期，YYYYMMDD 或 YYYY-MM-DD")
    parser.add_argument("--adjust", default="qfq", choices=("none", "qfq", "hfq"))
    parser.add_argument("--n", type=int, default=None, help="WR 周期，默认用策略参数")
    parser.add_argument("--k", type=float, default=None, help="强势K波幅系数")
    parser.add_argument("--mode", choices=("co", "cl"), default=None, help="C-O 或 C-L")
    parser.add_argument("--vol-x", type=int, default=None, help="均量天数")
    parser.add_argument("--vol-y", type=float, default=None, help="放量倍数")
    return parser


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    args = build_parser().parse_args(argv)
    trade_date = _to_yyyymmdd(args.trade_date)
    strategy = MingSystemVer1(
        ts_code=args.ts_code,
        start_date=_lookback_start(trade_date),
        end_date=trade_date,
        adjust=args.adjust,
    )
    if args.n is not None:
        strategy.wr_n = args.n
    if args.k is not None:
        strategy.k = args.k
    if args.mode is not None:
        strategy.range_mode = args.mode
    if args.vol_x is not None:
        strategy.vol_x = args.vol_x
    if args.vol_y is not None:
        strategy.vol_y = args.vol_y

    strategy.read_data()
    strategy.compute_algorithm()
    return explain_bar(strategy, trade_date)


if __name__ == "__main__":
    raise SystemExit(main())
