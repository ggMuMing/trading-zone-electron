"""compute.script_try: load or run one user source; return ScriptTryResult (never raises for user errors)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from worker.db import market_db
from worker.indicators.model import Ohlcv
from worker.indicators.sandbox import try_source
from worker.models import MarketQueryParams


class TryScriptParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: str
    params: dict[str, Any] = Field(default_factory=dict)
    query: MarketQueryParams | None = None


def try_script(params: dict[str, Any]) -> dict[str, Any]:
    parsed = TryScriptParams.model_validate(params)
    if parsed.query is None:
        return try_source(parsed.source)
    market_db.init_schema()
    query = parsed.query
    table = market_db.query_ohlcv_arrow(
        query.ts_code,
        query.start_date,
        query.end_date,
        query.adjust,
        query.limit,
    )
    if table.num_rows == 0:
        return {
            "ok": False,
            "error": "当前窗口没有K线",
            "traceback": "",
            "line": None,
            "column": None,
        }
    ohlcv = Ohlcv.from_bars(table.to_pylist())
    return try_source(parsed.source, parsed.params, ohlcv)
