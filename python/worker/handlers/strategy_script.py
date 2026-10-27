"""strategy.script_try / strategy.script_run: user strategy source against DuckDB OHLCV."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from worker.models import MarketQueryParams
from worker.strategies.sandbox import run_source, try_source
from worker.strategies.script_base import empty_result
from worker.strategies.script_data import frame_to_bars, load_strategy_frame


class StrategyScriptTryParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: str
    params: dict[str, Any] = Field(default_factory=dict)
    query: MarketQueryParams | None = None


class StrategyScriptRunParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: str = Field(min_length=1)
    ts_code: str = Field(min_length=1)
    start_date: str = Field(min_length=8, max_length=8, pattern=r"^[0-9]{8}$")
    end_date: str = Field(min_length=8, max_length=8, pattern=r"^[0-9]{8}$")
    adjust: Literal["none", "qfq", "hfq"] = "qfq"
    params: dict[str, Any] | None = None


def _empty_window() -> dict[str, Any]:
    return {
        "ok": False,
        "error": "当前窗口没有K线",
        "traceback": "",
        "line": None,
        "column": None,
    }


def _fail_result(result: dict[str, Any]) -> None:
    if result.get("ok"):
        return
    message = str(result.get("error") or "脚本失败")
    line = result.get("line")
    if isinstance(line, int):
        message = f"{message} (line {line})"
    raise ValueError(message)


def strategy_script_try(params: dict[str, Any]) -> dict[str, Any]:
    parsed = StrategyScriptTryParams.model_validate(params)
    if parsed.query is None:
        return try_source(parsed.source, parsed.params, None)
    query = parsed.query
    frame = load_strategy_frame(query.ts_code, query.start_date, query.end_date, query.adjust)
    if frame.empty:
        return _empty_window()
    return try_source(parsed.source, parsed.params, frame_to_bars(frame))


def strategy_script_run(params: dict[str, Any]) -> dict[str, Any]:
    parsed = StrategyScriptRunParams.model_validate(params)
    frame = load_strategy_frame(parsed.ts_code, parsed.start_date, parsed.end_date, parsed.adjust)
    if frame.empty:
        declared = try_source(parsed.source, parsed.params, None)
        _fail_result(declared)
        result = empty_result()
    else:
        result = run_source(parsed.source, parsed.params, frame_to_bars(frame))
    stats = result["stats"]
    return {
        "strategy_id": "",
        "ts_code": parsed.ts_code,
        "start_date": parsed.start_date,
        "end_date": parsed.end_date,
        "adjust": parsed.adjust,
        "stats": {
            "buy_count": int(stats.get("buy_count") or 0),
            "sell_count": int(stats.get("sell_count") or 0),
            "bar_count": int(stats.get("bar_count") or 0),
        },
        "series": result["series"],
    }
