"""compute.indicator: query or bars + layout instances → validated ChartInput."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from worker.db import market_db
from worker.indicators.compose import compose
from worker.models import MarketQueryParams
from worker.plot import ChartInputValidationError


class IndicatorInstance(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1)
    kind: Literal["script"]
    ref: str = Field(min_length=1)
    params: dict[str, Any]
    source: str = Field(min_length=1)


class ComputeIndicatorParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bars: list[dict[str, Any]] | None = Field(default=None, min_length=1)
    query: MarketQueryParams | None = None
    instances: list[IndicatorInstance]

    @model_validator(mode="after")
    def exactly_one_source(self) -> ComputeIndicatorParams:
        has_bars = self.bars is not None
        has_query = self.query is not None
        if has_bars == has_query:
            raise ValueError("exactly one of bars or query is required")
        return self


def compute_indicator(params: dict[str, Any]) -> dict[str, Any] | None:
    parsed = ComputeIndicatorParams.model_validate(params)
    instances = [item.model_dump() for item in parsed.instances]
    if parsed.query is not None:
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
            return None
        bars = table.to_pylist()
    else:
        assert parsed.bars is not None
        bars = parsed.bars
    try:
        chart = compose(bars, instances)
    except ChartInputValidationError:
        raise
    except ValueError as exc:
        raise ValueError(str(exc)) from exc
    return chart.model_dump(exclude_none=True)
