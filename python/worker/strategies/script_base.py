"""User strategy scripts: param.* declares StrategyParam, compute() writes signals."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from worker.strategies.params import StrategyParam, StrategyParamOption, coerce_parameters


@dataclass(frozen=True)
class ParamDecl:
    widget: str
    default: int | float | str
    title: str
    min: int | float | None = None
    max: int | float | None = None
    options: tuple[StrategyParamOption, ...] = ()


class ParamAPI:
    def int(
        self,
        default: int,
        title: str,
        min: int | None = None,
        max: int | None = None,
    ) -> ParamDecl:
        if type(default) is not int or isinstance(default, bool):
            raise ValueError("param.int default must be an int")
        if not isinstance(title, str) or not title:
            raise ValueError("param.int title must be a non-empty string")
        _check_bounds("param.int", default, min, max, integer=True)
        return ParamDecl(widget="int", default=default, title=title, min=min, max=max)

    def float(
        self,
        default: float,
        title: str,
        min: float | None = None,
        max: float | None = None,
    ) -> ParamDecl:
        if isinstance(default, bool) or not isinstance(default, (int, float)):
            raise ValueError("param.float default must be a number")
        if not isinstance(title, str) or not title:
            raise ValueError("param.float title must be a non-empty string")
        number = float(default)
        if not math.isfinite(number):
            raise ValueError("param.float default must be finite")
        _check_bounds("param.float", number, min, max, integer=False)
        return ParamDecl(widget="float", default=number, title=title, min=min, max=max)

    def enum(
        self,
        default: str,
        title: str,
        options: Sequence[tuple[str, str]],
    ) -> ParamDecl:
        if not isinstance(default, str) or not default:
            raise ValueError("param.enum default must be a non-empty string")
        if not isinstance(title, str) or not title:
            raise ValueError("param.enum title must be a non-empty string")
        parsed = _parse_options(options)
        allowed = {option.value for option in parsed}
        if default not in allowed:
            raise ValueError("param.enum default must be one of the options")
        return ParamDecl(widget="enum", default=default, title=title, options=parsed)


param = ParamAPI()


class StrategyScript:
    def __init__(self) -> None:
        object.__setattr__(self, "_declare_phase", False)
        object.__setattr__(self, "_declared", [])
        object.__setattr__(self, "_raw_params", {})

    def declare(self) -> None:
        return None

    def compute(self, daily: pd.DataFrame) -> pd.DataFrame | None:
        raise NotImplementedError("compute is required")

    def __setattr__(self, name: str, value: Any) -> None:
        if name.startswith("_"):
            object.__setattr__(self, name, value)
            return
        if bool(getattr(self, "_declare_phase", False)) and isinstance(value, ParamDecl):
            _bind_param(self, name, value)
            return
        object.__setattr__(self, name, value)


def apply_declare(instance: StrategyScript, params: dict[str, Any] | None) -> tuple[StrategyParam, ...]:
    if params is None:
        params = {}
    if not isinstance(params, dict):
        raise ValueError("params must be an object")
    instance._declare_phase = True
    instance._declared = []
    instance._raw_params = params
    try:
        instance.declare()
    finally:
        instance._declare_phase = False
        instance._raw_params = {}
    parameters = tuple(instance._declared)
    resolved = coerce_parameters(parameters, params)
    for name, value in resolved.items():
        setattr(instance, name, value)
    return parameters


def manifest_from_parameters(parameters: tuple[StrategyParam, ...]) -> dict[str, Any]:
    return {"parameters": [item.to_dict() for item in parameters]}


def _attach_compute_line(instance: StrategyScript, message: str) -> str:
    fn = getattr(instance, "compute", None)
    code = getattr(fn, "__code__", None)
    filename = getattr(code, "co_filename", "")
    lineno = getattr(code, "co_firstlineno", None)
    if isinstance(filename, str) and filename.startswith("<user_") and isinstance(lineno, int):
        return f'{message}\n  File "{filename}", line {lineno}'
    return message


def run_compute(instance: StrategyScript, daily: pd.DataFrame) -> dict[str, Any]:
    if daily.empty:
        return empty_result()
    expected_index = daily.index.copy()
    returned = instance.compute(daily)
    frame = daily if returned is None else returned
    if not isinstance(frame, pd.DataFrame):
        raise ValueError(_attach_compute_line(instance, "compute must return a DataFrame or None"))
    if len(frame) != len(expected_index):
        raise ValueError(_attach_compute_line(instance, "compute result length must match the input bars"))
    if not frame.index.equals(expected_index):
        raise ValueError(_attach_compute_line(instance, "compute result index must match the input bars"))
    for column in ("buy_signal", "sell_signal"):
        if column not in frame.columns:
            raise ValueError(_attach_compute_line(instance, f"compute must set {column}"))
    out = frame.copy()
    out["buy_signal"] = [_signal_bool(value) for value in out["buy_signal"].tolist()]
    out["sell_signal"] = [_signal_bool(value) for value in out["sell_signal"].tolist()]
    return frame_to_payload(out)


def empty_result() -> dict[str, Any]:
    return {
        "stats": {"buy_count": 0, "sell_count": 0, "bar_count": 0},
        "series": [],
    }


def bars_to_frame(bars: list[dict[str, Any]]) -> pd.DataFrame:
    columns = ["open", "high", "low", "close", "vol"]
    if not bars:
        return pd.DataFrame(columns=columns)
    frame = pd.DataFrame(bars)
    if "trade_date" not in frame.columns:
        raise ValueError("bars must include trade_date")
    frame["trade_date"] = frame["trade_date"].map(_trade_date)
    frame = frame.set_index("trade_date")
    for column in columns:
        if column not in frame.columns:
            frame[column] = None
    return frame


def frame_to_payload(frame: pd.DataFrame) -> dict[str, Any]:
    series: list[dict[str, Any]] = []
    for trade_date, row in frame.iterrows():
        record: dict[str, Any] = {}
        for key, value in row.items():
            if key in ("buy_signal", "sell_signal"):
                continue
            record[str(key)] = _json_value(value)
        record["time"] = _trade_date(trade_date)
        for column in ("open", "high", "low", "close", "vol"):
            record.setdefault(column, None)
        record["buy_signal"] = bool(row["buy_signal"])
        record["sell_signal"] = bool(row["sell_signal"])
        series.append(record)
    buy_count = int(sum(1 for row in series if row["buy_signal"]))
    sell_count = int(sum(1 for row in series if row["sell_signal"]))
    return {
        "stats": {
            "buy_count": buy_count,
            "sell_count": sell_count,
            "bar_count": len(series),
        },
        "series": series,
    }


def _bind_param(instance: StrategyScript, name: str, decl: ParamDecl) -> None:
    declared: list[StrategyParam] = instance._declared
    if any(item.name == name for item in declared):
        raise ValueError(f"duplicate param name {name}")
    item = StrategyParam(
        name=name,
        title=decl.title,
        widget=decl.widget,  # type: ignore[arg-type]
        default=decl.default,
        min=decl.min,
        max=decl.max,
        options=decl.options,
    )
    declared.append(item)
    raw: dict[str, Any] = instance._raw_params
    supplied = {name: raw[name]} if name in raw else {}
    value = coerce_parameters((item,), supplied)[name]
    object.__setattr__(instance, name, value)


def _parse_options(options: Sequence[tuple[str, str]]) -> tuple[StrategyParamOption, ...]:
    if isinstance(options, (str, bytes)) or not isinstance(options, Sequence) or len(options) < 1:
        raise ValueError("param.enum options must contain at least one item")
    parsed: list[StrategyParamOption] = []
    seen: set[str] = set()
    for item in options:
        if not isinstance(item, (tuple, list)) or len(item) != 2:
            raise ValueError("param.enum option must be (value, label)")
        value, label = item
        if not isinstance(value, str) or not value or not isinstance(label, str) or not label:
            raise ValueError("param.enum option value and label must be non-empty strings")
        if value in seen:
            raise ValueError(f"duplicate enum option {value}")
        seen.add(value)
        parsed.append(StrategyParamOption(value=value, label=label))
    return tuple(parsed)


def _check_bounds(
    label: str,
    value: int | float,
    minimum: int | float | None,
    maximum: int | float | None,
    *,
    integer: bool,
) -> None:
    if minimum is not None:
        if integer and type(minimum) is not int:
            raise ValueError(f"{label} min must be an int")
        if not integer and (isinstance(minimum, bool) or not isinstance(minimum, (int, float))):
            raise ValueError(f"{label} min must be a number")
    if maximum is not None:
        if integer and type(maximum) is not int:
            raise ValueError(f"{label} max must be an int")
        if not integer and (
            isinstance(maximum, bool) or not isinstance(maximum, (int, float))
        ):
            raise ValueError(f"{label} max must be a number")
    if minimum is not None and maximum is not None and minimum > maximum:
        raise ValueError(f"{label} min must be <= max")
    if minimum is not None and value < minimum:
        raise ValueError(f"{label} default is below min")
    if maximum is not None and value > maximum:
        raise ValueError(f"{label} default is above max")


def _signal_bool(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)) and not isinstance(value, bool):
        return bool(int(value))
    if isinstance(value, (float, np.floating)):
        number = float(value)
        if not math.isfinite(number):
            return False
        return bool(number)
    try:
        if pd.isna(value):
            return False
    except (TypeError, ValueError):
        pass
    raise ValueError("signal values must be boolean or numeric")


def _trade_date(value: object) -> str:
    text = str(value).replace("-", "")
    digits = "".join(ch for ch in text if ch.isdigit())
    return digits[:8]


def _json_value(value: object) -> object:
    if value is None:
        return None
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, (float, np.floating)):
        number = float(value)
        if not math.isfinite(number):
            return None
        return number
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y%m%d")
    if isinstance(value, str):
        return value
    return str(value)
