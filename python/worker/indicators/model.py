"""Indicator authoring model: class fields are params, compute returns a fragment."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, ClassVar, Literal, get_args

from annotated_types import Ge, Gt, Le, Lt
from pydantic import BaseModel, ConfigDict, ValidationError
from pydantic.fields import FieldInfo
from pydantic_core import PydanticUndefined

from worker.indicators.base import prepare_ohlcv
from worker.plot import PlotFragment
from worker.plot.models import CandlePoint, VolumePoint

ParamWidget = Literal["int", "float", "color", "lineWidth"]
_WIDGETS = set(get_args(ParamWidget))


class ParamField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    widget: ParamWidget
    title: str
    default: int | float | str
    min: int | float | None = None
    max: int | float | None = None


class IndicatorManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    fields: list[ParamField]
    defaultParams: dict[str, int | float | str]


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


def _field_extra(name: str, field: FieldInfo) -> dict[str, Any]:
    extra = field.json_schema_extra
    if extra is None:
        raise ValueError(f"{name} Field must set json_schema_extra widget and title")
    if callable(extra):
        raise ValueError(f"{name} json_schema_extra must be a dict, not a callable")
    if not isinstance(extra, dict):
        raise ValueError(f"{name} json_schema_extra must be a dict")
    return extra


def _field_bounds(field: FieldInfo) -> tuple[int | float | None, int | float | None]:
    minimum: int | float | None = None
    maximum: int | float | None = None
    for item in field.metadata:
        if isinstance(item, Ge):
            minimum = item.ge
        elif isinstance(item, Gt):
            minimum = item.gt
        elif isinstance(item, Le):
            maximum = item.le
        elif isinstance(item, Lt):
            maximum = item.lt
    return minimum, maximum


def _field_default(name: str, field: FieldInfo) -> int | float | str:
    default = field.default
    if default is PydanticUndefined or default is None or isinstance(default, (bool, dict, list)):
        raise ValueError(f"{name} Field must have an int, float, or str default")
    if isinstance(default, (int, float, str)):
        return default
    raise ValueError(f"{name} Field must have an int, float, or str default")


class Indicator(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: ClassVar[str]
    title: ClassVar[str]

    def compute(self, ohlcv: Ohlcv) -> PlotFragment:
        raise NotImplementedError

    @classmethod
    def manifest(cls) -> IndicatorManifest:
        if cls is Indicator:
            raise TypeError("Indicator.manifest() must be called on a subclass")
        key = cls.key
        title = cls.title
        if not isinstance(key, str) or not key:
            raise ValueError(f"{cls.__name__}.key must be a non-empty string")
        if not isinstance(title, str) or not title:
            raise ValueError(f"{cls.__name__}.title must be a non-empty string")

        fields: list[ParamField] = []
        for name, field in cls.model_fields.items():
            extra = _field_extra(name, field)
            widget = extra.get("widget")
            label = extra.get("title")
            if widget not in _WIDGETS:
                raise ValueError(f"{name} widget must be one of {sorted(_WIDGETS)}")
            if not isinstance(label, str) or not label:
                raise ValueError(f"{name} json_schema_extra.title must be a non-empty string")
            minimum, maximum = _field_bounds(field)
            item = ParamField(
                name=name,
                widget=widget,
                title=label,
                default=_field_default(name, field),
                min=None if widget == "color" else minimum,
                max=None if widget == "color" else maximum,
            )
            fields.append(item)

        try:
            defaults = cls().model_dump()
        except ValidationError as exc:
            raise ValueError(f"{cls.__name__} must construct with Field defaults: {exc}") from exc
        expected = [item.name for item in fields]
        if list(defaults.keys()) != expected:
            raise ValueError(f"{cls.__name__} defaultParams keys must match fields order")
        for item in fields:
            if defaults[item.name] != item.default:
                raise ValueError(f"{cls.__name__}.{item.name} defaultParams mismatch")

        return IndicatorManifest(key=key, title=title, fields=fields, defaultParams=defaults)
