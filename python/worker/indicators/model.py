"""Indicator authoring model: inputs() declares params, compute() calls plot()."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, ClassVar, Literal

from pydantic import BaseModel, ConfigDict

from worker.indicators.base import prepare_ohlcv
from worker.plot.models import CandlePoint, VolumePoint

ParamWidget = Literal["int", "float", "bool"]
PlotKind = Literal["line", "histogram"]


class ParamField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    widget: ParamWidget
    title: str
    default: int | float | bool
    min: int | float | None = None
    max: int | float | None = None


class PlotStyleField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    kind: PlotKind
    color: str | None = None
    lineWidth: int | None = None
    colorUp: str | None = None
    colorDown: str | None = None


class IndicatorManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    overlay: bool = True
    fields: list[ParamField]
    plots: list[PlotStyleField]
    defaultParams: dict[str, int | float | bool]


@dataclass(frozen=True)
class Ohlcv:
    time: tuple[str, ...]
    open: tuple[float, ...]
    high: tuple[float, ...]
    low: tuple[float, ...]
    close: tuple[float, ...]
    volume: tuple[float, ...]
    candle: tuple[CandlePoint, ...]
    volume_points: tuple[VolumePoint, ...]

    @classmethod
    def from_bars(cls, bars: list[dict[str, Any]]) -> Ohlcv:
        times, _closes, candle, volume_points = prepare_ohlcv(bars)
        return cls(
            time=tuple(times),
            open=tuple(point.open for point in candle),
            high=tuple(point.high for point in candle),
            low=tuple(point.low for point in candle),
            close=tuple(point.close for point in candle),
            volume=tuple(point.value for point in volume_points),
            candle=tuple(candle),
            volume_points=tuple(volume_points),
        )


class Indicator:
    key: ClassVar[str] = ""
    title: ClassVar[str] = ""
    overlay: ClassVar[bool] = True

    def __init__(self) -> None:
        object.__setattr__(self, "_input_phase", False)
        object.__setattr__(self, "_declared", [])
        object.__setattr__(self, "_input_params", {})

    def inputs(self) -> None:
        return None

    def compute(self, ohlcv: Ohlcv) -> None:
        raise NotImplementedError

    def __setattr__(self, name: str, value: Any) -> None:
        if name.startswith("_"):
            object.__setattr__(self, name, value)
            return
        from worker.indicators.runtime import InputDecl, bind_input

        if bool(getattr(self, "_input_phase", False)) and isinstance(value, InputDecl):
            bind_input(self, name, value)
            return
        object.__setattr__(self, name, value)
