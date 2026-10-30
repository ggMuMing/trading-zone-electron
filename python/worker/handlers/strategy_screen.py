"""strategy.screen: one read of a symbol window, one signal day."""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Literal

import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field

from worker.db import market_db
from worker.strategies import STRATEGY_REGISTRY
from worker.strategies.sandbox import run_frames
from worker.strategies.script_data import frame_to_bars

SCREEN_LOOKBACK_DAYS = 400


class StrategyScreenParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    strategy_id: str = ""
    source: str | None = None
    ts_codes: list[str] = Field(min_length=1)
    signal_date: str = Field(min_length=8, max_length=8, pattern=r"^[0-9]{8}$")
    adjust: Literal["none", "qfq", "hfq"] = "qfq"


def _window_start(signal_date: str) -> str:
    day = datetime.strptime(signal_date, "%Y%m%d")
    return (day - timedelta(days=SCREEN_LOOKBACK_DAYS)).strftime("%Y%m%d")


def _truthy(value: object) -> bool:
    if value is None:
        return False
    try:
        if pd.isna(value):
            return False
    except TypeError:
        pass
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)) and not isinstance(value, bool):
        return int(value) != 0
    if isinstance(value, (float, np.floating)):
        number = float(value)
        return math.isfinite(number) and number != 0
    text = str(value).strip().lower()
    return text in {"1", "true"}


def _row_side(frame: pd.DataFrame, signal_date: str) -> str | None:
    if signal_date not in frame.index:
        return None
    row = frame.loc[signal_date]
    if isinstance(row, pd.DataFrame):
        row = row.iloc[-1]
    buy = _truthy(row["buy_signal"]) if "buy_signal" in frame.columns else False
    sell = _truthy(row["sell_signal"]) if "sell_signal" in frame.columns else False
    if buy:
        return "buy"
    if sell:
        return "sell"
    return None


def _builtin_side(
    cls: type,
    ts_code: str,
    start_date: str,
    signal_date: str,
    adjust: str,
    frame: pd.DataFrame,
) -> str | None:
    strategy = cls(
        ts_code=ts_code,
        start_date=start_date,
        end_date=signal_date,
        adjust=adjust,
    )
    strategy.apply_parameters(None)
    strategy.daily = frame
    strategy.compute_algorithm()
    daily = getattr(strategy, "daily", None)
    if not isinstance(daily, pd.DataFrame) or daily.empty:
        return None
    return _row_side(daily, signal_date)


def strategy_screen(params: dict[str, Any]) -> dict[str, Any]:
    parsed = StrategyScreenParams.model_validate(params)
    start_date = _window_start(parsed.signal_date)
    frames = market_db.query_strategy_frames(
        list(parsed.ts_codes),
        start_date,
        parsed.signal_date,
        parsed.adjust,
    )
    source = parsed.source.strip() if isinstance(parsed.source, str) else ""
    if source:
        payload = []
        for ts_code in parsed.ts_codes:
            frame = frames.get(ts_code)
            if frame is None or getattr(frame, "empty", True):
                continue
            payload.append({"ts_code": ts_code, "bars": frame_to_bars(frame)})
        hits = run_frames(source, None, payload, parsed.signal_date)
        return {"signal_date": parsed.signal_date, "hits": hits}
    if parsed.strategy_id not in STRATEGY_REGISTRY:
        raise ValueError(f"unknown strategy_id: {parsed.strategy_id}")
    cls, _name = STRATEGY_REGISTRY[parsed.strategy_id]
    hits: list[dict[str, str]] = []
    for ts_code in parsed.ts_codes:
        frame = frames.get(ts_code)
        if not isinstance(frame, pd.DataFrame) or frame.empty:
            continue
        side = _builtin_side(cls, ts_code, start_date, parsed.signal_date, parsed.adjust, frame)
        if side:
            hits.append({"ts_code": ts_code, "side": side})
    return {"signal_date": parsed.signal_date, "hits": hits}
