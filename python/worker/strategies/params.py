"""Declared strategy parameters. Values are coerced once, then written onto the instance."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Literal

WidgetKind = Literal["int", "float", "enum"]


@dataclass(frozen=True)
class StrategyParamOption:
    value: str
    label: str


@dataclass(frozen=True)
class StrategyParam:
    name: str
    title: str
    widget: WidgetKind
    default: int | float | str
    min: int | float | None = None
    max: int | float | None = None
    options: tuple[StrategyParamOption, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "name": self.name,
            "title": self.title,
            "widget": self.widget,
            "default": self.default,
        }
        if self.min is not None:
            payload["min"] = self.min
        if self.max is not None:
            payload["max"] = self.max
        if self.options:
            payload["options"] = [
                {"value": option.value, "label": option.label} for option in self.options
            ]
        return payload


def declared_default(parameters: tuple[StrategyParam, ...], name: str) -> Any:
    for item in parameters:
        if item.name == name:
            return item.default
    raise KeyError(name)


def coerce_parameters(
    parameters: tuple[StrategyParam, ...],
    raw: dict[str, Any] | None,
) -> dict[str, Any]:
    """Fill omitted keys from defaults. Reject unknown keys, bad types, and out-of-range values."""
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ValueError("params must be an object")
    known = {item.name: item for item in parameters}
    unknown = sorted(str(key) for key in raw if key not in known)
    if unknown:
        raise ValueError(f"unknown params: {', '.join(unknown)}")
    resolved: dict[str, Any] = {}
    for item in parameters:
        if item.name in raw:
            resolved[item.name] = _coerce_value(item, raw[item.name])
        else:
            resolved[item.name] = item.default
    return resolved


def _coerce_value(param: StrategyParam, value: Any) -> Any:
    if param.widget == "int":
        return _coerce_int(param, value)
    if param.widget == "float":
        return _coerce_float(param, value)
    if param.widget == "enum":
        return _coerce_enum(param, value)
    raise ValueError(f"unsupported widget: {param.widget}")


def _coerce_int(param: StrategyParam, value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError(f"{param.name} must be an integer")
    if isinstance(value, int):
        number = value
    else:
        if isinstance(value, str):
            text = value.strip()
            if text == "":
                raise ValueError(f"{param.name} must be an integer")
            try:
                as_float = float(text)
            except ValueError as exc:
                raise ValueError(f"{param.name} must be an integer") from exc
        else:
            as_float = float(value)
        if not math.isfinite(as_float) or not as_float.is_integer():
            raise ValueError(f"{param.name} must be an integer")
        number = int(as_float)
    _check_bounds(param, number)
    return number


def _coerce_float(param: StrategyParam, value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError(f"{param.name} must be a number")
    if isinstance(value, str):
        text = value.strip()
        if text == "":
            raise ValueError(f"{param.name} must be a number")
        try:
            number = float(text)
        except ValueError as exc:
            raise ValueError(f"{param.name} must be a number") from exc
    else:
        number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"{param.name} must be a finite number")
    _check_bounds(param, number)
    return number


def _coerce_enum(param: StrategyParam, value: Any) -> str:
    allowed = {option.value for option in param.options}
    if not isinstance(value, str) or value not in allowed:
        raise ValueError(f"{param.name} must be one of the declared options")
    return value


def _check_bounds(param: StrategyParam, number: float) -> None:
    if param.min is not None and number < param.min:
        raise ValueError(f"{param.name} must be >= {param.min}")
    if param.max is not None and number > param.max:
        raise ValueError(f"{param.name} must be <= {param.max}")
