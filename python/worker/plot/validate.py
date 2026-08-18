"""Semantic validation aligned with src/shared/chart/validateChartInput.ts."""

from __future__ import annotations

import re
from typing import Any

from worker.plot.models import (
    CHART_INPUT_SCHEMA_VERSION,
    CandlePoint,
    ChartInput,
    PlotPrimitive,
    PlotPrimitiveStyle,
    ValuePoint,
    VolumePoint,
)

ISO_DATE_PATTERN = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


class ChartInputValidationError(ValueError):
    def __init__(self, issues: list[dict[str, str]]) -> None:
        self.issues = issues
        message = "; ".join(f"{item['path']}: {item['message']}" for item in issues) or "invalid ChartInput"
        super().__init__(message)


def _push(issues: list[dict[str, str]], path: str, message: str) -> None:
    issues.append({"path": path, "message": message})


def _is_finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value == value and value not in (
        float("inf"),
        float("-inf"),
    )


def _is_iso_date(value: Any) -> bool:
    return isinstance(value, str) and bool(ISO_DATE_PATTERN.match(value))


def _assert_sorted_unique_times(
    issues: list[dict[str, str]],
    path: str,
    times: list[str],
    domain: set[str],
) -> None:
    for i, time in enumerate(times):
        if time not in domain:
            _push(issues, f"{path}[{i}].time", f"time {time} is not in timeDomain")
        if i > 0 and time <= times[i - 1]:
            _push(issues, f"{path}[{i}].time", "times must be strictly ascending and unique")


def validate_chart_input(raw: Any) -> ChartInput:
    issues: list[dict[str, str]] = []
    if not isinstance(raw, dict):
        raise ChartInputValidationError([{"path": "", "message": "ChartInput must be an object"}])

    allowed = {"schemaVersion", "timeDomain", "candle", "volume", "primitives", "series"}
    extra = [key for key in raw if key not in allowed]
    if extra:
        _push(issues, "", f"unexpected keys: {', '.join(extra)}")

    if raw.get("schemaVersion") != CHART_INPUT_SCHEMA_VERSION:
        _push(issues, "schemaVersion", f"must be {CHART_INPUT_SCHEMA_VERSION}")

    time_domain_raw = raw.get("timeDomain")
    if not isinstance(time_domain_raw, list) or len(time_domain_raw) == 0:
        _push(issues, "timeDomain", "must be a non-empty array")
        raise ChartInputValidationError(issues)

    time_domain: list[str] = []
    for i, time in enumerate(time_domain_raw):
        if not _is_iso_date(time):
            _push(issues, f"timeDomain[{i}]", "must be YYYY-MM-DD")
            continue
        if i > 0 and time_domain and time <= time_domain[-1]:
            _push(issues, f"timeDomain[{i}]", "must be strictly ascending and unique")
        time_domain.append(time)
    domain = set(time_domain)

    candle_raw = raw.get("candle")
    if not isinstance(candle_raw, list) or len(candle_raw) == 0:
        _push(issues, "candle", "must be a non-empty array")
        raise ChartInputValidationError(issues)

    candle: list[CandlePoint] = []
    for i, point_raw in enumerate(candle_raw):
        point = _read_candle(point_raw, f"candle[{i}]", issues)
        if point is not None:
            candle.append(point)

    if len(candle) != len(time_domain):
        _push(issues, "candle", "length must equal timeDomain length")
    else:
        for i, point in enumerate(candle):
            if point.time != time_domain[i]:
                _push(issues, f"candle[{i}].time", "must match timeDomain at the same index")

    volume: list[VolumePoint] | None = None
    if "volume" in raw and raw["volume"] is not None:
        volume_raw = raw["volume"]
        if not isinstance(volume_raw, list):
            _push(issues, "volume", "must be an array")
        else:
            volume = []
            for i, point_raw in enumerate(volume_raw):
                point = _read_volume(point_raw, f"volume[{i}]", issues)
                if point is not None:
                    volume.append(point)
            _assert_sorted_unique_times(issues, "volume", [p.time for p in volume], domain)

    primitives_raw = raw.get("primitives")
    series_raw = raw.get("series")
    if not isinstance(primitives_raw, list):
        _push(issues, "primitives", "must be an array")
        raise ChartInputValidationError(issues)
    if not isinstance(series_raw, dict):
        _push(issues, "series", "must be an object")
        raise ChartInputValidationError(issues)

    primitives: list[PlotPrimitive] = []
    ids: set[str] = set()
    for i, item in enumerate(primitives_raw):
        primitive = _read_primitive(item, f"primitives[{i}]", issues)
        if primitive is None:
            continue
        if primitive.id in ids:
            _push(issues, f"primitives[{i}].id", f"duplicate id {primitive.id}")
        ids.add(primitive.id)
        primitives.append(primitive)

    for key in series_raw:
        if key not in ids:
            _push(issues, f"series.{key}", "has no matching primitive id")
    for primitive_id in ids:
        if primitive_id not in series_raw:
            _push(issues, f"series.{primitive_id}", "missing series for primitive id")

    series: dict[str, list[ValuePoint]] = {}
    for primitive in primitives:
        points_raw = series_raw.get(primitive.id)
        if not isinstance(points_raw, list):
            if points_raw is not None:
                _push(issues, f"series.{primitive.id}", "must be an array")
            continue
        points: list[ValuePoint] = []
        for i, point_raw in enumerate(points_raw):
            point = _read_value_point(point_raw, f"series.{primitive.id}[{i}]", issues)
            if point is not None:
                points.append(point)
        _assert_sorted_unique_times(issues, f"series.{primitive.id}", [p.time for p in points], domain)
        series[primitive.id] = points

    if issues:
        raise ChartInputValidationError(issues)

    payload: dict[str, Any] = {
        "schemaVersion": CHART_INPUT_SCHEMA_VERSION,
        "timeDomain": time_domain,
        "candle": [p.model_dump(exclude_none=True) for p in candle],
        "primitives": [p.model_dump(exclude_none=True) for p in primitives],
        "series": {key: [p.model_dump(exclude_none=True) for p in points] for key, points in series.items()},
    }
    if volume is not None:
        payload["volume"] = [p.model_dump(exclude_none=True) for p in volume]
    return ChartInput.model_validate(payload)


def _read_style(raw: Any, path: str, issues: list[dict[str, str]]) -> PlotPrimitiveStyle | None:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        _push(issues, path, "style must be an object")
        return None
    extra = [key for key in raw if key not in ("color", "lineWidth")]
    if extra:
        _push(issues, path, f"unexpected keys: {', '.join(extra)}")
    style: dict[str, Any] = {}
    if "color" in raw and raw["color"] is not None:
        if not isinstance(raw["color"], str) or len(raw["color"]) == 0:
            _push(issues, f"{path}.color", "must be a non-empty string")
        else:
            style["color"] = raw["color"]
    if "lineWidth" in raw and raw["lineWidth"] is not None:
        width = raw["lineWidth"]
        if not isinstance(width, int) or isinstance(width, bool) or width < 1 or width > 4:
            _push(issues, f"{path}.lineWidth", "must be an integer from 1 to 4")
        else:
            style["lineWidth"] = width
    return PlotPrimitiveStyle.model_validate(style) if style else PlotPrimitiveStyle()


def _read_candle(raw: Any, path: str, issues: list[dict[str, str]]) -> CandlePoint | None:
    if not isinstance(raw, dict):
        _push(issues, path, "must be an object")
        return None
    extra = [key for key in raw if key not in ("time", "open", "high", "low", "close", "vol", "amount")]
    if extra:
        _push(issues, path, f"unexpected keys: {', '.join(extra)}")
    if not _is_iso_date(raw.get("time")):
        _push(issues, f"{path}.time", "must be YYYY-MM-DD")
    for field in ("open", "high", "low", "close"):
        if not _is_finite_number(raw.get(field)):
            _push(issues, f"{path}.{field}", "must be a finite number")
    vol = raw.get("vol")
    if vol is not None and not _is_finite_number(vol):
        _push(issues, f"{path}.vol", "must be a finite number or null")
    amount = raw.get("amount")
    if amount is not None and not _is_finite_number(amount):
        _push(issues, f"{path}.amount", "must be a finite number or null")
    if not (
        _is_iso_date(raw.get("time"))
        and _is_finite_number(raw.get("open"))
        and _is_finite_number(raw.get("high"))
        and _is_finite_number(raw.get("low"))
        and _is_finite_number(raw.get("close"))
    ):
        return None
    if raw["high"] < raw["low"]:
        _push(issues, f"{path}.high", "high must be >= low")
    payload: dict[str, Any] = {
        "time": raw["time"],
        "open": float(raw["open"]),
        "high": float(raw["high"]),
        "low": float(raw["low"]),
        "close": float(raw["close"]),
    }
    if "vol" in raw:
        payload["vol"] = None if vol is None else float(vol)
    if "amount" in raw:
        payload["amount"] = None if amount is None else float(amount)
    return CandlePoint.model_validate(payload)


def _read_volume(raw: Any, path: str, issues: list[dict[str, str]]) -> VolumePoint | None:
    if not isinstance(raw, dict):
        _push(issues, path, "must be an object")
        return None
    if not _is_iso_date(raw.get("time")):
        _push(issues, f"{path}.time", "must be YYYY-MM-DD")
    if not _is_finite_number(raw.get("value")):
        _push(issues, f"{path}.value", "must be a finite number")
    color = raw.get("color")
    if not isinstance(color, str) or len(color) == 0:
        _push(issues, f"{path}.color", "must be a non-empty string")
    if not (_is_iso_date(raw.get("time")) and _is_finite_number(raw.get("value")) and isinstance(color, str) and color):
        return None
    return VolumePoint(time=raw["time"], value=float(raw["value"]), color=color)


def _read_value_point(raw: Any, path: str, issues: list[dict[str, str]]) -> ValuePoint | None:
    if not isinstance(raw, dict):
        _push(issues, path, "must be an object")
        return None
    if not _is_iso_date(raw.get("time")):
        _push(issues, f"{path}.time", "must be YYYY-MM-DD")
    if not _is_finite_number(raw.get("value")):
        _push(issues, f"{path}.value", "must be a finite number")
    color = raw.get("color")
    if color is not None and (not isinstance(color, str) or len(color) == 0):
        _push(issues, f"{path}.color", "must be a non-empty string")
    if not (_is_iso_date(raw.get("time")) and _is_finite_number(raw.get("value"))):
        return None
    payload: dict[str, Any] = {"time": raw["time"], "value": float(raw["value"])}
    if isinstance(color, str) and color:
        payload["color"] = color
    return ValuePoint.model_validate(payload)


def _read_primitive(raw: Any, path: str, issues: list[dict[str, str]]) -> PlotPrimitive | None:
    if not isinstance(raw, dict):
        _push(issues, path, "must be an object")
        return None
    extra = [key for key in raw if key not in ("id", "pane", "kind", "style")]
    if extra:
        _push(issues, path, f"unexpected keys: {', '.join(extra)}")
    if not isinstance(raw.get("id"), str) or len(raw["id"]) == 0:
        _push(issues, f"{path}.id", "must be a non-empty string")
    if not isinstance(raw.get("pane"), str) or len(raw["pane"]) == 0:
        _push(issues, f"{path}.pane", "must be a non-empty string")
    kind = raw.get("kind")
    if kind not in ("line", "histogram"):
        _push(issues, f"{path}.kind", "must be line or histogram")
    style = _read_style(raw.get("style"), f"{path}.style", issues)
    if not (
        isinstance(raw.get("id"), str)
        and raw["id"]
        and isinstance(raw.get("pane"), str)
        and raw["pane"]
        and kind in ("line", "histogram")
    ):
        return None
    if raw["pane"] == "main" and kind == "histogram":
        _push(issues, f"{path}.kind", "histogram on pane main is reserved for first-class volume")
    payload: dict[str, Any] = {"id": raw["id"], "pane": raw["pane"], "kind": kind}
    if style is not None and (style.color is not None or style.lineWidth is not None):
        payload["style"] = style.model_dump(exclude_none=True)
    return PlotPrimitive.model_validate(payload)
