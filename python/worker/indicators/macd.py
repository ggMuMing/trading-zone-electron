"""Built-in MACD indicator returning ChartInput via plot dialect."""

from __future__ import annotations

from typing import Any

from worker.indicators.base import DEA_COLOR, DIF_COLOR, DOWN_COLOR, UP_COLOR, ema, prepare_ohlcv
from worker.plot import ChartInput, histogram, line, output, subplot


def indicator_macd(
    bars: list[dict[str, Any]],
    *,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> ChartInput:
    times, closes, candle, volume = prepare_ohlcv(bars)
    ema_fast = ema(closes, fast)
    ema_slow = ema(closes, slow)
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

    signal_on_dif = ema(dif_for_signal, signal)
    dea: list[float | None] = [None] * len(closes)
    for j, idx in enumerate(dif_index):
        dea[idx] = signal_on_dif[j]

    hist: list[float | None] = [
        None if dif_v is None or dea_v is None else (dif_v - dea_v) * 2
        for dif_v, dea_v in zip(dif, dea, strict=True)
    ]

    return output(
        subplot(
            "macd",
            line("dif", dif, times=times, color=DIF_COLOR, line_width=1),
            line("dea", dea, times=times, color=DEA_COLOR, line_width=1),
            histogram("macd", hist, times=times, color_by_sign=(UP_COLOR, DOWN_COLOR)),
        ),
        candle=candle,
        volume=volume,
    )
