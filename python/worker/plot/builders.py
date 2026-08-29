"""Thin plot dialect builders that assemble ChartInput fragments."""

from __future__ import annotations

from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field

from worker.plot.models import (
    CHART_INPUT_SCHEMA_VERSION,
    CandlePoint,
    ChartInput,
    PlotPrimitive,
    PlotPrimitiveStyle,
    ValuePoint,
    VolumePoint,
)
from worker.plot.validate import validate_chart_input

NumberLike = float | int | None


@dataclass
class PlotFragment:
    primitives: list[PlotPrimitive] = field(default_factory=list)
    series: dict[str, list[ValuePoint]] = field(default_factory=dict)

    def with_pane(self, pane: str) -> PlotFragment:
        return PlotFragment(
            primitives=[
                PlotPrimitive(
                    id=item.id,
                    pane=pane,
                    kind=item.kind,
                    style=item.style,
                )
                for item in self.primitives
            ],
            series=dict(self.series),
        )


def _compact_series(
    times: Sequence[str],
    values: Sequence[NumberLike],
    *,
    color_of: Callable[[float], str] | None = None,
) -> list[ValuePoint]:
    if len(times) != len(values):
        raise ValueError("values length must match time domain length")
    points: list[ValuePoint] = []
    for time, value in zip(times, values, strict=True):
        if value is None:
            continue
        number = float(value)
        if number != number or number in (float("inf"), float("-inf")):
            continue
        point = ValuePoint(time=time, value=number)
        if color_of is not None:
            point.color = color_of(number)
        points.append(point)
    return points


def line(
    id: str,
    values: Sequence[NumberLike],
    *,
    times: Sequence[str] | None = None,
    color: str | None = None,
    line_width: int | None = None,
    pane: str = "main",
) -> PlotFragment:
    if times is None:
        raise ValueError("line() requires times aligned to the main candle domain")
    style = None
    if color is not None or line_width is not None:
        style = PlotPrimitiveStyle(color=color, lineWidth=line_width)
    return PlotFragment(
        primitives=[PlotPrimitive(id=id, pane=pane, kind="line", style=style)],
        series={id: _compact_series(times, values)},
    )


def histogram(
    id: str,
    values: Sequence[NumberLike],
    *,
    times: Sequence[str] | None = None,
    color_by_sign: tuple[str, str] | None = None,
    pane: str = "main",
) -> PlotFragment:
    if times is None:
        raise ValueError("histogram() requires times aligned to the main candle domain")

    def color_of(value: float) -> str:
        if color_by_sign is None:
            raise ValueError("histogram() requires color_by_sign when coloring by sign")
        up, down = color_by_sign
        return up if value >= 0 else down

    return PlotFragment(
        primitives=[PlotPrimitive(id=id, pane=pane, kind="histogram")],
        series={
            id: _compact_series(times, values, color_of=color_of if color_by_sign is not None else None)
        },
    )


def overlay(*parts: PlotFragment) -> PlotFragment:
    merged = PlotFragment()
    for part in parts:
        for primitive in part.primitives:
            if any(existing.id == primitive.id for existing in merged.primitives):
                raise ValueError(f"duplicate primitive id {primitive.id}")
            merged.primitives.append(primitive)
        for key, points in part.series.items():
            if key in merged.series:
                raise ValueError(f"duplicate series id {key}")
            merged.series[key] = points
    return merged


def subplot(pane: str, *parts: PlotFragment) -> PlotFragment:
    if not pane or pane == "main":
        raise ValueError('subplot pane must be a non-empty key other than "main"')
    merged = PlotFragment()
    for part in parts:
        remapped = part.with_pane(pane)
        for primitive in remapped.primitives:
            if any(existing.id == primitive.id for existing in merged.primitives):
                raise ValueError(f"duplicate primitive id {primitive.id}")
            merged.primitives.append(primitive)
        merged.series.update(remapped.series)
    return merged


def output(
    *parts: PlotFragment,
    candle: Iterable[CandlePoint | dict],
    volume: Iterable[VolumePoint | dict] | None = None,
) -> ChartInput:
    candle_points = [
        point if isinstance(point, CandlePoint) else CandlePoint.model_validate(point) for point in candle
    ]
    if not candle_points:
        raise ValueError("candle must be non-empty")
    time_domain = [point.time for point in candle_points]

    volume_points: list[VolumePoint] | None = None
    if volume is not None:
        volume_points = [
            point if isinstance(point, VolumePoint) else VolumePoint.model_validate(point) for point in volume
        ]

    primitives: list[PlotPrimitive] = []
    series: dict[str, list[ValuePoint]] = {}
    for part in parts:
        for primitive in part.primitives:
            if any(existing.id == primitive.id for existing in primitives):
                raise ValueError(f"duplicate primitive id {primitive.id}")
            primitives.append(primitive)
        for key, points in part.series.items():
            if key in series:
                raise ValueError(f"duplicate series id {key}")
            series[key] = points

    payload: dict = {
        "schemaVersion": CHART_INPUT_SCHEMA_VERSION,
        "timeDomain": time_domain,
        "candle": [point.model_dump(exclude_none=True) for point in candle_points],
        "primitives": [item.model_dump(exclude_none=True) for item in primitives],
        "series": {key: [point.model_dump(exclude_none=True) for point in points] for key, points in series.items()},
    }
    if volume_points is not None:
        payload["volume"] = [point.model_dump(exclude_none=True) for point in volume_points]
    return validate_chart_input(payload)
