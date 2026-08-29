"""Shared OHLCV → candle / volume helpers for built-in indicators."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from worker.plot.models import CandlePoint, VolumePoint

UP_COLOR = "#ef5350"
DOWN_COLOR = "#26a69a"
MA_COLOR = "#2962FF"
MA5_COLOR = "#FF9800"
MA250_COLOR = "#7E57C2"
DIF_COLOR = "#f5a623"
DEA_COLOR = "#4a90d9"


def yyyymmdd_to_iso(value: str) -> str:
    if len(value) != 8:
        return value
    return f"{value[0:4]}-{value[4:6]}-{value[6:8]}"


def is_complete_ohlc(bar: dict[str, Any]) -> bool:
    return all(bar.get(field) is not None for field in ("open", "high", "low", "close"))


def prepare_ohlcv(bars: list[dict[str, Any]]) -> tuple[list[str], list[float], list[CandlePoint], list[VolumePoint]]:
    complete = [bar for bar in bars if is_complete_ohlc(bar)]
    complete.sort(key=lambda bar: str(bar.get("trade_date", "")))

    time_domain: list[str] = []
    closes: list[float] = []
    candle: list[CandlePoint] = []
    volume: list[VolumePoint] = []
    prev_close: float | None = None

    for bar in complete:
        trade_date = str(bar["trade_date"])
        time = yyyymmdd_to_iso(trade_date)
        open_ = float(bar["open"])
        high = float(bar["high"])
        low = float(bar["low"])
        close = float(bar["close"])
        vol = bar.get("vol")
        amount = bar.get("amount")

        time_domain.append(time)
        closes.append(close)
        candle.append(
            CandlePoint(
                time=time,
                open=open_,
                high=high,
                low=low,
                close=close,
                vol=None if vol is None else float(vol),
                amount=None if amount is None else float(amount),
            )
        )
        down = close < prev_close if prev_close is not None else close < open_
        volume.append(
            VolumePoint(
                time=time,
                value=0.0 if vol is None else float(vol),
                color=DOWN_COLOR if down else UP_COLOR,
            )
        )
        prev_close = close

    if not candle:
        raise ValueError("bars must contain at least one complete OHLC row")
    return time_domain, closes, candle, volume


def sma(values: Sequence[float], period: int) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if len(values) < period:
        return out
    total = 0.0
    for i, value in enumerate(values):
        total += value
        if i >= period:
            total -= values[i - period]
        if i >= period - 1:
            out[i] = total / period
    return out


def ema(values: Sequence[float], period: int) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if len(values) < period:
        return out
    k = 2 / (period + 1)
    total = sum(values[:period])
    prev = total / period
    out[period - 1] = prev
    for i in range(period, len(values)):
        prev = values[i] * k + prev * (1 - k)
        out[i] = prev
    return out
