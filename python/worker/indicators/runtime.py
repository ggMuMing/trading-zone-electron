"""Authoring runtime: input.* declarations and plot() registration."""

from __future__ import annotations

from collections.abc import Sequence
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Literal

from worker.indicators.model import (
    Indicator,
    IndicatorManifest,
    Ohlcv,
    ParamField,
    PlotKind,
    PlotStyleField,
)
from worker.plot.builders import PlotFragment, histogram, line, overlay

NumberLike = float | int | None
DEFAULT_LINE_COLOR = "#2962FF"
DEFAULT_LINE_WIDTH = 1
DEFAULT_HIST_UP = "#ef5350"
DEFAULT_HIST_DOWN = "#26a69a"
DUMMY_BAR_COUNT = 32


@dataclass(frozen=True)
class InputDecl:
    widget: Literal["int", "float", "bool"]
    default: int | float | bool
    title: str
    min: int | float | None = None
    max: int | float | None = None


class InputAPI:
    def int(
        self,
        default: int,
        title: str,
        min: int | None = None,
        max: int | None = None,
    ) -> InputDecl:
        if type(default) is not int or isinstance(default, bool):
            raise ValueError("input.int default must be an int")
        if not isinstance(title, str) or not title:
            raise ValueError("input.int title must be a non-empty string")
        _check_bounds("input.int", default, min, max, integer=True)
        return InputDecl(widget="int", default=default, title=title, min=min, max=max)

    def float(
        self,
        default: float,
        title: str,
        min: float | None = None,
        max: float | None = None,
    ) -> InputDecl:
        if isinstance(default, bool) or not isinstance(default, (int, float)):
            raise ValueError("input.float default must be a number")
        if not isinstance(title, str) or not title:
            raise ValueError("input.float title must be a non-empty string")
        number = float(default)
        if number != number or number in (float("inf"), float("-inf")):
            raise ValueError("input.float default must be finite")
        _check_bounds("input.float", number, min, max, integer=False)
        return InputDecl(widget="float", default=number, title=title, min=min, max=max)

    def bool(self, default: bool, title: str) -> InputDecl:
        if type(default) is not bool:
            raise ValueError("input.bool default must be a bool")
        if not isinstance(title, str) or not title:
            raise ValueError("input.bool title must be a non-empty string")
        return InputDecl(widget="bool", default=default, title=title)


input = InputAPI()


@dataclass
class PlotDecl:
    id: str
    title: str
    kind: PlotKind
    color: str | None
    line_width: int | None
    color_up: str | None
    color_down: str | None
    values: Sequence[NumberLike]


@dataclass
class ExecContext:
    ohlcv: Ohlcv
    overlay: bool
    styles: dict[str, dict[str, Any]]
    plots: list[PlotDecl] = field(default_factory=list)


_ctx: ContextVar[ExecContext | None] = ContextVar("indicator_exec", default=None)


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
        if not integer and not isinstance(minimum, (int, float)):
            raise ValueError(f"{label} min must be a number")
    if maximum is not None:
        if integer and type(maximum) is not int:
            raise ValueError(f"{label} max must be an int")
        if not integer and not isinstance(maximum, (int, float)):
            raise ValueError(f"{label} max must be a number")
    if minimum is not None and maximum is not None and minimum > maximum:
        raise ValueError(f"{label} min must be <= max")
    if minimum is not None and value < minimum:
        raise ValueError(f"{label} default is below min")
    if maximum is not None and value > maximum:
        raise ValueError(f"{label} default is above max")


def dummy_ohlcv(n: int = DUMMY_BAR_COUNT) -> Ohlcv:
    bars: list[dict[str, Any]] = []
    start = date(2020, 1, 1)
    for i in range(n):
        trade_date = (start + timedelta(days=i)).strftime("%Y%m%d")
        bars.append(
            {
                "ts_code": "DRY.RUN",
                "trade_date": trade_date,
                "open": 10.0,
                "high": 10.1,
                "low": 9.9,
                "close": 10.0,
                "vol": 1.0,
                "amount": 1.0,
            }
        )
    return Ohlcv.from_bars(bars)


def class_meta(cls: type[Indicator]) -> tuple[str, str, bool]:
    if cls is Indicator:
        raise TypeError("Indicator methods must be called on a subclass")
    key = getattr(cls, "key", "")
    title = getattr(cls, "title", "")
    overlay = getattr(cls, "overlay", True)
    if not isinstance(key, str) or not key:
        raise ValueError(f"{cls.__name__}.key must be a non-empty string")
    if not isinstance(title, str) or not title:
        raise ValueError(f"{cls.__name__}.title must be a non-empty string")
    if type(overlay) is not bool:
        raise ValueError(f"{cls.__name__}.overlay must be a bool")
    return key, title, overlay


def _coerce_input_value(field: ParamField, raw: Any) -> int | float | bool:
    if field.widget == "bool":
        if type(raw) is not bool:
            raise ValueError(f"invalid params: {field.name} must be a bool")
        return raw
    if field.widget == "int":
        if type(raw) is not int or isinstance(raw, bool):
            raise ValueError(f"invalid params: {field.name} must be an integer")
        if field.min is not None and raw < field.min:
            raise ValueError(f"invalid params: {field.name} is below min")
        if field.max is not None and raw > field.max:
            raise ValueError(f"invalid params: {field.name} is above max")
        return raw
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        raise ValueError(f"invalid params: {field.name} must be a finite number")
    number = float(raw)
    if number != number or number in (float("inf"), float("-inf")):
        raise ValueError(f"invalid params: {field.name} must be a finite number")
    if field.min is not None and number < field.min:
        raise ValueError(f"invalid params: {field.name} is below min")
    if field.max is not None and number > field.max:
        raise ValueError(f"invalid params: {field.name} is above max")
    return number


def bind_input(instance: Indicator, name: str, decl: InputDecl) -> None:
    declared: list[ParamField] = instance._declared
    if any(item.name == name for item in declared):
        raise ValueError(f"duplicate input name {name}")
    field = ParamField(
        name=name,
        widget=decl.widget,
        title=decl.title,
        default=decl.default,
        min=decl.min,
        max=decl.max,
    )
    params: dict[str, Any] = instance._input_params
    value = params[name] if name in params else decl.default
    object.__setattr__(instance, name, _coerce_input_value(field, value))
    declared.append(field)


def apply_inputs(instance: Indicator, params: dict[str, Any]) -> list[ParamField]:
    if not isinstance(params, dict):
        raise ValueError("params.inputs must be an object")
    instance._input_phase = True
    instance._declared = []
    instance._input_params = params
    try:
        instance.inputs()
    finally:
        instance._input_phase = False
        instance._input_params = {}
    fields: list[ParamField] = instance._declared
    extra = [key for key in params if key not in {item.name for item in fields}]
    if extra:
        raise ValueError(f"invalid params: unknown keys {extra}")
    return fields


def split_params(params: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    if params is None:
        return {}, {}
    if not isinstance(params, dict):
        raise ValueError("params must be an object")
    if not params:
        return {}, {}
    extra = [key for key in params if key not in ("inputs", "styles")]
    if extra:
        raise ValueError("params must be {inputs, styles}")
    inputs = params.get("inputs")
    styles = params.get("styles")
    if inputs is None:
        inputs = {}
    if styles is None:
        styles = {}
    if not isinstance(inputs, dict):
        raise ValueError("params.inputs must be an object")
    if not isinstance(styles, dict):
        raise ValueError("params.styles must be an object")
    normalized: dict[str, dict[str, Any]] = {}
    for plot_id, raw in styles.items():
        if not isinstance(plot_id, str) or not plot_id:
            raise ValueError("params.styles keys must be non-empty strings")
        if not isinstance(raw, dict):
            raise ValueError(f"params.styles.{plot_id} must be an object")
        normalized[plot_id] = raw
    return inputs, normalized


def _line_width(value: Any, *, fallback: int) -> int:
    width = fallback if value is None else value
    if width not in (1, 2, 3, 4):
        raise ValueError("lineWidth must be an integer from 1 to 4")
    return int(width)


def _color(value: Any, *, fallback: str | None) -> str | None:
    if value is None:
        return fallback
    if not isinstance(value, str) or not value.strip():
        raise ValueError("color must be a non-empty string")
    return value


def plot(
    series: Sequence[NumberLike],
    title: str,
    *,
    id: str | None = None,
    color: str | None = None,
    linewidth: int | None = None,
    style: PlotKind = "line",
    color_up: str | None = None,
    color_down: str | None = None,
) -> None:
    ctx = _ctx.get()
    if ctx is None:
        raise RuntimeError("plot() must be called from compute()")
    if not isinstance(title, str) or not title:
        raise ValueError("plot title must be a non-empty string")
    if style not in ("line", "histogram"):
        raise ValueError('plot style must be "line" or "histogram"')
    plot_id = id if id is not None else title
    if not isinstance(plot_id, str) or not plot_id:
        raise ValueError("plot id must be a non-empty string")
    if any(item.id == plot_id for item in ctx.plots):
        raise ValueError(f"duplicate plot id {plot_id}")

    if style == "line":
        decl_color = color if color is not None else DEFAULT_LINE_COLOR
        decl_width = DEFAULT_LINE_WIDTH if linewidth is None else linewidth
        _line_width(decl_width, fallback=DEFAULT_LINE_WIDTH)
        decl = PlotDecl(
            id=plot_id,
            title=title,
            kind="line",
            color=_color(decl_color, fallback=DEFAULT_LINE_COLOR),
            line_width=int(decl_width),
            color_up=None,
            color_down=None,
            values=series,
        )
    else:
        decl = PlotDecl(
            id=plot_id,
            title=title,
            kind="histogram",
            color=None,
            line_width=None,
            color_up=_color(color_up, fallback=DEFAULT_HIST_UP),
            color_down=_color(color_down, fallback=DEFAULT_HIST_DOWN),
            values=series,
        )
    ctx.plots.append(decl)


def _style_field(decl: PlotDecl) -> PlotStyleField:
    return PlotStyleField(
        id=decl.id,
        title=decl.title,
        kind=decl.kind,
        color=decl.color,
        lineWidth=decl.line_width,
        colorUp=decl.color_up,
        colorDown=decl.color_down,
    )


def fragment_from_context(ctx: ExecContext) -> PlotFragment:
    pane = "main" if ctx.overlay else "sub"
    parts: list[PlotFragment] = []
    for decl in ctx.plots:
        override = ctx.styles.get(decl.id, {})
        if decl.kind == "line":
            color = _color(override.get("color"), fallback=decl.color)
            width = _line_width(override.get("lineWidth"), fallback=decl.line_width or DEFAULT_LINE_WIDTH)
            parts.append(
                line(
                    decl.id,
                    decl.values,
                    times=ctx.ohlcv.time,
                    color=color,
                    line_width=width,
                    pane=pane,
                )
            )
            continue
        up = _color(override.get("colorUp"), fallback=decl.color_up)
        down = _color(override.get("colorDown"), fallback=decl.color_down)
        color_by_sign = (up, down) if up is not None and down is not None else None
        parts.append(
            histogram(
                decl.id,
                decl.values,
                times=ctx.ohlcv.time,
                color_by_sign=color_by_sign,
                pane=pane,
            )
        )
    return overlay(*parts)


def _enter(ctx: ExecContext) -> Token[ExecContext | None]:
    return _ctx.set(ctx)


def _exit(token: Token[ExecContext | None]) -> None:
    _ctx.reset(token)


def execute_indicator(
    cls: type[Indicator],
    ohlcv: Ohlcv,
    params: dict[str, Any] | None,
) -> tuple[IndicatorManifest, PlotFragment]:
    key, title, overlay = class_meta(cls)
    inputs, styles = split_params(params)
    instance = cls()
    fields = apply_inputs(instance, inputs)
    ctx = ExecContext(ohlcv=ohlcv, overlay=overlay, styles=styles)
    token = _enter(ctx)
    try:
        instance.compute(ohlcv)
    finally:
        _exit(token)
    if not ctx.plots:
        raise ValueError("脚本必须调用 plot() 产生输出")
    extra_styles = [plot_id for plot_id in styles if plot_id not in {item.id for item in ctx.plots}]
    if extra_styles:
        raise ValueError(f"invalid params: unknown style keys {extra_styles}")
    manifest = IndicatorManifest(
        key=key,
        title=title,
        overlay=overlay,
        fields=fields,
        plots=[_style_field(item) for item in ctx.plots],
        defaultParams={item.name: item.default for item in fields},
    )
    return manifest, fragment_from_context(ctx)
