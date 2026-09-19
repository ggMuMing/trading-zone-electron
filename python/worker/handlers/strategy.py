"""strategy.list / strategy.run: built-in strategies against DuckDB OHLCV."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from worker.strategies import STRATEGY_REGISTRY, list_strategies


class StrategyListResult(BaseModel):
    strategies: list[dict[str, str]]


class StrategyRunParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    strategy_id: str = Field(min_length=1)
    ts_code: str = Field(min_length=1)
    start_date: str = Field(min_length=8, max_length=8, pattern=r"^[0-9]{8}$")
    end_date: str = Field(min_length=8, max_length=8, pattern=r"^[0-9]{8}$")
    adjust: Literal["none", "qfq", "hfq"] = "qfq"

    @field_validator("strategy_id")
    @classmethod
    def known_strategy(cls, value: str) -> str:
        if value not in STRATEGY_REGISTRY:
            raise ValueError(f"unknown strategy_id: {value}")
        return value


def strategy_list(_params: dict[str, Any] | None = None) -> dict[str, Any]:
    return StrategyListResult(strategies=list_strategies()).model_dump()


def strategy_run(params: dict[str, Any]) -> dict[str, Any]:
    parsed = StrategyRunParams.model_validate(params)
    cls, _name = STRATEGY_REGISTRY[parsed.strategy_id]
    strategy = cls(
        ts_code=parsed.ts_code,
        start_date=parsed.start_date,
        end_date=parsed.end_date,
        adjust=parsed.adjust,
    )
    payload = strategy.run()
    stats = payload.get("stats") if isinstance(payload, dict) else None
    series = payload.get("series") if isinstance(payload, dict) else None
    if not isinstance(stats, dict):
        stats = {"buy_count": 0, "bar_count": 0}
    if not isinstance(series, list):
        series = []
    return {
        "strategy_id": parsed.strategy_id,
        "ts_code": parsed.ts_code,
        "start_date": parsed.start_date,
        "end_date": parsed.end_date,
        "adjust": parsed.adjust,
        "stats": {
            "buy_count": int(stats.get("buy_count") or 0),
            "bar_count": int(stats.get("bar_count") or 0),
        },
        "series": series,
    }
