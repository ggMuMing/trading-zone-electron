from __future__ import annotations

import pandas as pd

from worker.strategies.MingSystemVer1 import MingSystemVer1, _true_range
from worker.strategies.params import StrategyParam, StrategyParamOption, declared_default


# 描述未给缺省的三项：肯特那系数取布林 2σ 对照下的常用 1.5；
# 成交量周期与比值沿用自研说明里的 5 与 1.5。
MING_V2_PARAMETERS: tuple[StrategyParam, ...] = (
    StrategyParam("m", "通道周期", "int", 20, min=2),
    StrategyParam("kc_c", "肯特那系数", "float", 1.5, min=0),
    StrategyParam("n", "威廉周期", "int", 10, min=1),
    StrategyParam("w", "信号K回看", "int", 5, min=1),
    StrategyParam(
        "range_mode",
        "信号K涨幅",
        "enum",
        "co",
        options=(
            StrategyParamOption("co", "收−开"),
            StrategyParamOption("cl", "收−低"),
        ),
    ),
    StrategyParam("k1", "波幅比例", "float", 0.6, min=0),
    StrategyParam("r", "成交量均线", "int", 5, min=1),
    StrategyParam("k2", "成交量比值", "float", 1.5, min=0),
)


class MingSystemVer2(MingSystemVer1):
    """买点 = 波动坍缩 ∧ 威廉上半区 ∧ 强势K ∧ 放量。卖出仍恒为 false。"""

    parameters = MING_V2_PARAMETERS
    m = declared_default(MING_V2_PARAMETERS, "m")
    kc_c = declared_default(MING_V2_PARAMETERS, "kc_c")
    n = declared_default(MING_V2_PARAMETERS, "n")
    w = declared_default(MING_V2_PARAMETERS, "w")
    range_mode = declared_default(MING_V2_PARAMETERS, "range_mode")
    k1 = declared_default(MING_V2_PARAMETERS, "k1")
    r = declared_default(MING_V2_PARAMETERS, "r")
    k2 = declared_default(MING_V2_PARAMETERS, "k2")

    def compute_algorithm(self):
        if self.daily.empty:
            return
        daily = self.daily.copy()
        open_ = daily["open"]
        high = daily["high"]
        low = daily["low"]
        close = daily["close"]
        vol = daily["vol"]

        # 一、波动坍缩：2*STD < C*ATR。用 t-1，避免信号K当天把通道撑开后滤网失效
        std = close.rolling(self.m).std(ddof=0)
        atr = _true_range(high, low, close).rolling(self.m).mean()
        std_prev = std.shift(1)
        atr_prev = atr.shift(1)
        in_squeeze = (2 * std_prev) < (self.kc_c * atr_prev)

        # 二、大周期：威廉含当天，WR < 50 即收盘在 N 日波幅上半区
        hn = high.rolling(self.n).max()
        ln = low.rolling(self.n).min()
        wr_range = hn - ln
        wr = (hn - close) / wr_range.replace(0, pd.NA) * 100
        wr_ok = wr < 50

        # 小周期：涨幅达到过去 W 日波幅的 K1 倍，不含当天
        high_w = high.shift(1).rolling(self.w).max()
        low_w = low.shift(1).rolling(self.w).min()
        w_range = high_w - low_w
        impulse = (close - open_) if self.range_mode == "co" else (close - low)
        strong_k = impulse >= w_range * self.k1

        # 三、放量：当日量 >= 过去 R 日均量 * K2，均量不含当天
        vol_ma = vol.shift(1).rolling(self.r).mean()
        vol_ok = vol >= vol_ma * self.k2

        buy_signal = in_squeeze & wr_ok & strong_k & vol_ok
        daily["std"] = std_prev
        daily["atr"] = atr_prev
        daily["in_squeeze"] = in_squeeze.fillna(False)
        daily["hn"] = hn
        daily["ln"] = ln
        daily["wr"] = wr
        daily["w_range"] = w_range
        daily["impulse"] = impulse
        daily["strong_k"] = strong_k.fillna(False)
        daily["vol_ma"] = vol_ma
        daily["vol_ok"] = vol_ok.fillna(False)
        daily["buy_signal"] = buy_signal.fillna(False)
        self.daily = daily
