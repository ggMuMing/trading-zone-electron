"""Built-in SMA indicator returning ChartInput via plot dialect."""

from __future__ import annotations

from typing import Any

from worker.indicators.base import MA_COLOR, prepare_ohlcv, sma
from worker.plot import ChartInput, line, output


def indicator_ma(bars: list[dict[str, Any]], period: int = 20) -> ChartInput:
    times, closes, candle, volume = prepare_ohlcv(bars)
    values = sma(closes, period)
    return output(
        line(f"ma{period}", values, times=times, color=MA_COLOR, line_width=2),
        candle=candle,
        volume=volume,
    )
