from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import pandas as pd

_PYTHON_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(_PYTHON_ROOT))

import numpy as np

from worker.db import market_db
from worker.strategies.Strategy import StrategyClass
from worker.strategies.params import StrategyParam, StrategyParamOption, declared_default


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


MING_PARAMETERS: tuple[StrategyParam, ...] = (
    StrategyParam("squeeze_period", "标准差 / ATR 周期", "int", 20, min=2),
    StrategyParam("wr_n", "过去 n 日波幅", "int", 3, min=1),
    StrategyParam(
        "range_mode",
        "信号 K 波幅",
        "enum",
        "co",
        options=(
            StrategyParamOption("co", "收−开"),
            StrategyParamOption("cl", "收−低"),
        ),
    ),
    StrategyParam("k", "波幅系数", "float", 0.6, min=0),
    StrategyParam("vol_x", "成交量均线天数", "int", 5, min=1),
    StrategyParam("vol_y", "成交倍量", "float", 1, min=0),
)


class MingSystemVer1(StrategyClass):
    parameters = MING_PARAMETERS
    squeeze_period = declared_default(MING_PARAMETERS, "squeeze_period")
    wr_n = declared_default(MING_PARAMETERS, "wr_n")
    range_mode = declared_default(MING_PARAMETERS, "range_mode")
    k = declared_default(MING_PARAMETERS, "k")
    vol_x = declared_default(MING_PARAMETERS, "vol_x")
    vol_y = declared_default(MING_PARAMETERS, "vol_y")

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
        if daily.empty or "trade_date" not in daily.columns:
            self.daily = pd.DataFrame(columns=["open", "high", "low", "close", "vol"])
            return self.daily
        earliest, latest = market_db.get_anchor_adj_factors(self.ts_code)
        daily = _apply_adj_factor(daily, self.adjust, earliest, latest)
        daily = daily.set_index("trade_date")[["open", "high", "low", "close", "vol"]]
        self.daily = daily
        return daily

    def compute_algorithm(self):
        if self.daily.empty:
            return
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
        daily = getattr(self, "daily", None)
        if daily is None or daily.empty or "buy_signal" not in daily.columns:
            self.signals = pd.DataFrame()
            self.buy_count = 0
            self.bar_count = 0 if daily is None else int(len(daily))
            return
        self.signals = daily.loc[daily["buy_signal"]].copy()
        self.buy_count = int(len(self.signals))
        self.bar_count = int(len(daily))

    def output_result(self) -> dict:
        daily = getattr(self, "daily", None)
        if daily is None or daily.empty:
            return {
                "stats": {"buy_count": 0, "bar_count": int(getattr(self, "bar_count", 0) or 0)},
                "series": [],
            }
        frame = daily.reset_index()
        if "trade_date" in frame.columns:
            frame = frame.rename(columns={"trade_date": "time"})
        if "buy_signal" not in frame.columns:
            frame["buy_signal"] = False
        frame["sell_signal"] = False
        series = [_row_to_record(row) for row in frame.to_dict(orient="records")]
        return {
            "stats": {
                "buy_count": int(getattr(self, "buy_count", 0) or 0),
                "bar_count": int(getattr(self, "bar_count", len(series))),
            },
            "series": series,
        }


def _row_to_record(row: dict) -> dict:
    out: dict = {}
    for key, value in row.items():
        out[str(key)] = _to_json_value(value)
    out["buy_signal"] = bool(out.get("buy_signal"))
    out["sell_signal"] = bool(out.get("sell_signal"))
    time_value = out.get("time")
    if time_value is not None:
        out["time"] = str(time_value).replace("-", "")[:8]
    return out


def _to_json_value(value: object) -> object:
    if value is None:
        return None
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        number = float(value)
        if not np.isfinite(number):
            return None
        return number
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y%m%d")
    return value
