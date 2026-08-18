"""Pydantic mirror of contracts/chart_input.json."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CHART_INPUT_SCHEMA_VERSION = 1
PlotKind = Literal["line", "histogram"]


class PlotPrimitiveStyle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    color: str | None = None
    lineWidth: int | None = Field(default=None, ge=1, le=4)


class PlotPrimitive(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    pane: str = Field(min_length=1)
    kind: PlotKind
    style: PlotPrimitiveStyle | None = None


class CandlePoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    time: str
    open: float
    high: float
    low: float
    close: float
    vol: float | None = None
    amount: float | None = None


class VolumePoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    time: str
    value: float
    color: str = Field(min_length=1)


class ValuePoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    time: str
    value: float
    color: str | None = Field(default=None, min_length=1)


class ChartInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal[1] = CHART_INPUT_SCHEMA_VERSION
    timeDomain: list[str] = Field(min_length=1)
    candle: list[CandlePoint] = Field(min_length=1)
    volume: list[VolumePoint] | None = None
    primitives: list[PlotPrimitive]
    series: dict[str, list[ValuePoint]]
