from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import pandas as pd

_PYTHON_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(_PYTHON_ROOT))

from worker.db import market_db
from worker.strategies.Strategy import StrategyClass


def _to_yyyymmdd(value: str) -> str:
    return value.replace("-", "")


def _apply_adj_factor(
    daily: pd.DataFrame,
    adjust: str,
    earliest: float | None,
    latest: float | None,
) -> pd.DataFrame:
    out = daily.copy()
    adj = out["adj_factor"]
    if adjust == "qfq" and latest not in (None, 0):
        scale = adj / latest
    elif adjust == "hfq" and earliest not in (None, 0):
        scale = adj / earliest
    else:
        scale = pd.Series(1.0, index=out.index)
    scale = scale.fillna(1.0)
    for col in ("open", "high", "low", "close"):
        out[col] = out[col] * scale
    return out


def _true_range(high: pd.Series, low: pd.Series, close: pd.Series) -> pd.Series:
    prev_close = close.shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    if len(tr) > 0:
        tr.iloc[0] = high.iloc[0] - low.iloc[0]
    return tr


def _is_db_lock_error(exc: BaseException) -> bool:
    text = str(exc)
    return (
        "Cannot open file" in text
        or "already open" in text.lower()
        or "IO Error" in text
        or "IOException" in type(exc).__name__
    )


def _ensure_market_db() -> None:
    try:
        market_db.init_schema()
        return
    except Exception as exc:
        if not _is_db_lock_error(exc):
            raise
    market_db.close_conn()
    path = market_db.resolve_db_path()
    market_db._conn = duckdb.connect(str(path), read_only=True)


class MingSystemVer1(StrategyClass):
    squeeze_period = 20
    wr_n = 3
    # "co": C-O（忽略下影线）；"cl": C-L（接受较长下影线）
    range_mode = "co"
    k = 0.6
    vol_x = 5
    vol_y = 1

    def __init__(
        self,
        ts_code: str = "002518.SZ",
        start_date: str = "2020-01-01",
        end_date: str = "2026-09-15",
        adjust: str = "qfq",
    ) -> None:
        self.ts_code = ts_code
        self.start_date = _to_yyyymmdd(start_date)
        self.end_date = _to_yyyymmdd(end_date)
        self.adjust = adjust

    def read_data(self) -> pd.DataFrame:
        _ensure_market_db()
        daily = market_db.query_ohlcv_arrow(
            self.ts_code, self.start_date, self.end_date, "none"
        ).to_pandas()
        earliest, latest = market_db.get_anchor_adj_factors(self.ts_code)
        daily = _apply_adj_factor(daily, self.adjust, earliest, latest)
        daily = daily.set_index("trade_date")[["open", "high", "low", "close", "vol"]]
        self.daily = daily
        return daily

    def compute_algorithm(self):
        daily = self.daily.copy()
        open_ = daily["open"]
        high = daily["high"]
        low = daily["low"]
        close = daily["close"]
        vol = daily["vol"]

        # 一、周期滤网：用 t-1 的 STD/ATR，当天扩张不破坏前一日的收缩判定
        std = close.rolling(self.squeeze_period).std(ddof=0)
        atr = _true_range(high, low, close).rolling(self.squeeze_period).mean()
        std_prev = std.shift(1)
        atr_prev = atr.shift(1)
        in_squeeze = std_prev < atr_prev

        # 二、动能穿透：WR 的 Hn/Ln 含当天（C >= H_(n-1) 时 WR=0）
        hn = high.rolling(self.wr_n).max()
        ln = low.rolling(self.wr_n).min()
        wr_range = hn - ln
        wr = (hn - close) / wr_range.replace(0, pd.NA) * 100
        wr_ok = wr < 50

        # 强势 K：与 t-1 起往前 n 日的 Hn-Ln 比较，不含当天
        hn_prev = high.shift(1).rolling(self.wr_n).max()
        ln_prev = low.shift(1).rolling(self.wr_n).min()
        n_range = hn_prev - ln_prev
        impulse = (close - open_) if self.range_mode == "co" else (close - low)
        strong_k = impulse >= n_range * self.k

        # 三、成交量配合：当日成交量 >= 过去 x 日均量 * y
        vol_ma = vol.shift(1).rolling(self.vol_x).mean()
        vol_ok = vol >= vol_ma * self.vol_y

        buy_signal = in_squeeze & wr_ok & strong_k & vol_ok
        daily["std"] = std_prev
        daily["atr"] = atr_prev
        daily["in_squeeze"] = in_squeeze.fillna(False)
        daily["hn"] = hn
        daily["ln"] = ln
        daily["n_range"] = n_range
        daily["wr"] = wr
        daily["impulse"] = impulse
        daily["strong_k"] = strong_k.fillna(False)
        daily["vol_ma"] = vol_ma
        daily["vol_ok"] = vol_ok.fillna(False)
        daily["buy_signal"] = buy_signal.fillna(False)
        self.daily = daily

    def analyze_result(self):
        self.signals = self.daily.loc[self.daily["buy_signal"]].copy()

    def output_result(self):
        mode = "C-O" if self.range_mode == "co" else "C-L"
        print(
            f"{self.ts_code} {self.start_date}-{self.end_date} {self.adjust} "
            f"bars={len(self.daily)} buys={len(self.signals)} "
            f"mode={mode} n={self.wr_n} k={self.k} vol={self.vol_x}x{self.vol_y}"
        )
        if self.signals.empty:
            print("no buy signals")
            return
        cols = [
            "open",
            "high",
            "low",
            "close",
            "vol",
            "wr",
            "impulse",
            "n_range",
            "std",
            "atr",
        ]
        print(self.signals[cols].to_string(float_format=lambda x: f"{x:.4f}"))
