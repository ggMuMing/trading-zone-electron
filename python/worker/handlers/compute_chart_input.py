"""compute.chart_input: OHLCV bars → validated ChartInput."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from worker.indicators import default_chart
from worker.plot import ChartInputValidationError


class ComputeChartInputParams(BaseModel):
    bars: list[dict[str, Any]] = Field(min_length=1)


def compute_chart_input(params: dict[str, Any]) -> dict[str, Any]:
    parsed = ComputeChartInputParams.model_validate(params)
    try:
        chart = default_chart(parsed.bars)
    except ChartInputValidationError:
        raise
    except ValueError as exc:
        raise ValueError(str(exc)) from exc
    return chart.model_dump(exclude_none=True)
