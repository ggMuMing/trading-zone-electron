"""Default chart: candle + volume + MA20 + MACD(12,26,9)."""

from __future__ import annotations

from typing import Any

from worker.indicators.base import (
    DEA_COLOR,
    DIF_COLOR,
    DOWN_COLOR,
    MA_COLOR,
    UP_COLOR,
    ema,
    prepare_ohlcv,
    sma,
)
from worker.plot import ChartInput, histogram, line, output, subplot

MA_PERIOD = 20
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9


def default_chart(bars: list[dict[str, Any]]) -> ChartInput:
    times, closes, candle, volume = prepare_ohlcv(bars)

    ma20 = sma(closes, MA_PERIOD)
    ema_fast = ema(closes, MACD_FAST)
    ema_slow = ema(closes, MACD_SLOW)
    dif: list[float | None] = [
        None if fast_v is None or slow_v is None else fast_v - slow_v
        for fast_v, slow_v in zip(ema_fast, ema_slow, strict=True)
    ]

    dif_for_signal: list[float] = []
    dif_index: list[int] = []
    for i, value in enumerate(dif):
        if value is not None:
            dif_for_signal.append(value)
            dif_index.append(i)

    signal_on_dif = ema(dif_for_signal, MACD_SIGNAL)
    dea: list[float | None] = [None] * len(closes)
    for j, idx in enumerate(dif_index):
        dea[idx] = signal_on_dif[j]

    hist: list[float | None] = [
        None if dif_v is None or dea_v is None else (dif_v - dea_v) * 2
        for dif_v, dea_v in zip(dif, dea, strict=True)
    ]

    return output(
        line("ma20", ma20, times=times, color=MA_COLOR, line_width=2),
        subplot(
            "macd",
            line("dif", dif, times=times, color=DIF_COLOR, line_width=1),
            line("dea", dea, times=times, color=DEA_COLOR, line_width=1),
            histogram("macd", hist, times=times, color_by_sign=(UP_COLOR, DOWN_COLOR)),
        ),
        candle=candle,
        volume=volume,
    )
