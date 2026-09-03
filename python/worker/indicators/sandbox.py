"""Run one user Indicator source in an isolated subprocess; return PlotFragment."""

from __future__ import annotations

import builtins as builtins_mod
import json
import os
import re
import subprocess
import sys
import traceback
from pathlib import Path
from typing import Any, ClassVar

PYTHON_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from worker.indicators.base import ema, sma
from worker.indicators.model import Indicator, IndicatorManifest, Ohlcv
from worker.indicators.runtime import dummy_ohlcv, execute_indicator, input, plot
from worker.plot import PlotFragment
from worker.plot.models import CandlePoint, PlotPrimitive, ValuePoint, VolumePoint

USER_SCRIPT_FILENAME = "<user_indicator>"
SCRIPT_TIMEOUT_SEC = 10
_USER_FRAME_RE = re.compile(rf'File "{re.escape(USER_SCRIPT_FILENAME)}", line (\d+)')
ALLOWED_IMPORT_ROOTS = frozenset({"numpy", "typing", "collections", "math"})
_BLOCKED_BUILTINS = (
    "open",
    "exec",
    "eval",
    "compile",
    "breakpoint",
    "input",
    "exit",
    "quit",
    "help",
    "memoryview",
)
_real_import = builtins_mod.__import__


def _restricted_import(
    name: str,
    globals: dict[str, Any] | None = None,
    locals: dict[str, Any] | None = None,
    fromlist: tuple[str, ...] = (),
    level: int = 0,
) -> Any:
    if level != 0:
        raise ImportError("relative imports are not allowed")
    root = name.split(".", 1)[0]
    if root not in ALLOWED_IMPORT_ROOTS:
        raise ImportError(f"import {name!r} is not allowed")
    return _real_import(name, globals, locals, fromlist, level)


def _restricted_builtins() -> dict[str, Any]:
    allowed = dict(vars(builtins_mod))
    for name in _BLOCKED_BUILTINS:
        allowed.pop(name, None)
    allowed["__import__"] = _restricted_import
    return allowed


def _dump_ohlcv(ohlcv: Ohlcv) -> dict[str, Any]:
    return {
        "time": list(ohlcv.time),
        "open": list(ohlcv.open),
        "high": list(ohlcv.high),
        "low": list(ohlcv.low),
        "close": list(ohlcv.close),
        "volume": list(ohlcv.volume),
        "candle": [point.model_dump(exclude_none=True) for point in ohlcv.candle],
        "volume_points": [point.model_dump(exclude_none=True) for point in ohlcv.volume_points],
    }


def _load_ohlcv(raw: dict[str, Any]) -> Ohlcv:
    return Ohlcv(
        time=tuple(raw["time"]),
        open=tuple(raw["open"]),
        high=tuple(raw["high"]),
        low=tuple(raw["low"]),
        close=tuple(raw["close"]),
        volume=tuple(raw["volume"]),
        candle=tuple(CandlePoint.model_validate(point) for point in raw["candle"]),
        volume_points=tuple(VolumePoint.model_validate(point) for point in raw["volume_points"]),
    )


def _dump_fragment(fragment: PlotFragment) -> dict[str, Any]:
    return {
        "primitives": [item.model_dump(exclude_none=True) for item in fragment.primitives],
        "series": {
            key: [point.model_dump(exclude_none=True) for point in points]
            for key, points in fragment.series.items()
        },
    }


def fragment_from_payload(raw: dict[str, Any]) -> PlotFragment:
    if not isinstance(raw, dict):
        raise ValueError("fragment payload must be an object")
    primitives_raw = raw.get("primitives")
    series_raw = raw.get("series")
    if not isinstance(primitives_raw, list):
        raise ValueError("fragment.primitives must be a list")
    if not isinstance(series_raw, dict):
        raise ValueError("fragment.series must be an object")
    primitives = [PlotPrimitive.model_validate(item) for item in primitives_raw]
    series = {
        key: [ValuePoint.model_validate(point) for point in points]
        for key, points in series_raw.items()
    }
    return PlotFragment(primitives=primitives, series=series)


def load_indicator_class(source: str) -> type[Indicator]:
    if not isinstance(source, str) or not source.strip():
        raise ValueError("source must be a non-empty string")

    namespace: dict[str, Any] = {
        "__name__": "user_indicator",
        "__builtins__": _restricted_builtins(),
        "Indicator": Indicator,
        "Ohlcv": Ohlcv,
        "input": input,
        "plot": plot,
        "sma": sma,
        "ema": ema,
        "ClassVar": ClassVar,
    }
    exec(compile(source, USER_SCRIPT_FILENAME, "exec"), namespace, namespace)

    cls = namespace.get("indicator")
    if not isinstance(cls, type) or not issubclass(cls, Indicator) or cls is Indicator:
        raise ValueError("source must export indicator = <Indicator subclass>")
    return cls


def _exec_source(
    source: str, ohlcv: Ohlcv, params: dict[str, Any]
) -> tuple[IndicatorManifest, PlotFragment]:
    if not isinstance(params, dict):
        raise ValueError("params must be an object")
    cls = load_indicator_class(source)
    return execute_indicator(cls, ohlcv, params)


def _error_message(exc: BaseException) -> str:
    text = str(exc).strip()
    if text:
        first = text.split("\n", 1)[0].strip()
        if first and not first.startswith("Traceback"):
            return first
    return type(exc).__name__


def _user_script_location(exc: BaseException, text: str) -> tuple[int | None, int | None]:
    line: int | None = None
    column: int | None = None
    if isinstance(exc, SyntaxError):
        if isinstance(exc.lineno, int):
            line = exc.lineno
        if isinstance(exc.offset, int):
            column = exc.offset
    if line is None:
        matches = _USER_FRAME_RE.findall(text)
        if matches:
            line = int(matches[-1])
    return (line, column)


def user_script_diagnostic(exc: BaseException) -> dict[str, Any]:
    formatted = traceback.format_exc()
    message = str(exc)
    combined = f"{formatted}\n{message}"
    line, column = _user_script_location(exc, combined)
    tb_text = message if f'File "{USER_SCRIPT_FILENAME}"' in message else formatted
    tb_text = tb_text.strip()
    if not tb_text or tb_text == "NoneType: None":
        tb_text = formatted.strip() or message
    return {
        "ok": False,
        "error": _error_message(exc),
        "traceback": tb_text,
        "line": line,
        "column": column,
    }


def _run_child(source: str, ohlcv: Ohlcv, params: dict[str, Any]) -> dict[str, Any]:
    payload = json.dumps(
        {"source": source, "params": params, "ohlcv": _dump_ohlcv(ohlcv)},
        ensure_ascii=False,
    ).encode("utf-8")
    env = dict(os.environ)
    extra = env.get("PYTHONPATH")
    env["PYTHONPATH"] = str(PYTHON_ROOT) + ((os.pathsep + extra) if extra else "")
    env["PYTHONIOENCODING"] = "utf-8"
    try:
        completed = subprocess.run(
            [sys.executable, str(Path(__file__).resolve())],
            cwd=str(PYTHON_ROOT),
            input=payload,
            capture_output=True,
            timeout=SCRIPT_TIMEOUT_SEC,
            check=False,
            env=env,
        )
    except subprocess.TimeoutExpired as exc:
        raise ValueError("script timed out") from exc

    stdout = completed.stdout.decode("utf-8", errors="replace").strip()
    stderr = completed.stderr.decode("utf-8", errors="replace").strip()
    if not stdout:
        detail = stderr or f"exit {completed.returncode}"
        raise ValueError(f"script produced no output: {detail}")
    try:
        message = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise ValueError(f"script output is not JSON: {stdout[:500]}") from exc
    if not isinstance(message, dict):
        raise ValueError("script output must be an object")
    if not message.get("ok"):
        error = message.get("error") or "script failed"
        trace = message.get("traceback")
        extra_text = f"\n{trace}" if isinstance(trace, str) and trace else ""
        if stderr:
            extra_text += f"\n{stderr}"
        raise ValueError(f"{error}{extra_text}")
    return message


def try_source(
    source: str,
    params: dict[str, Any] | None = None,
    ohlcv: Ohlcv | None = None,
) -> dict[str, Any]:
    try:
        if ohlcv is None:
            message = _run_child(source, dummy_ohlcv(), {})
            manifest = message.get("manifest")
            if not isinstance(manifest, dict):
                raise ValueError("script ok payload must include manifest")
            return {"ok": True, "manifest": manifest}
        run_script(source, ohlcv, params or {})
        return {"ok": True}
    except Exception as exc:
        return user_script_diagnostic(exc)


def run_script(source: str, ohlcv: Ohlcv, params: dict[str, Any]) -> PlotFragment:
    message = _run_child(source, ohlcv, params)
    fragment_raw = message.get("fragment")
    if not isinstance(fragment_raw, dict):
        raise ValueError("script ok payload must include fragment")
    return fragment_from_payload(fragment_raw)


def _child_main() -> int:
    try:
        raw = json.load(sys.stdin)
        if not isinstance(raw, dict):
            raise ValueError("sandbox stdin must be an object")
        source = raw.get("source")
        params = raw.get("params")
        ohlcv_raw = raw.get("ohlcv")
        if not isinstance(source, str):
            raise ValueError("source must be a string")
        if not isinstance(params, dict):
            raise ValueError("params must be an object")
        if not isinstance(ohlcv_raw, dict):
            raise ValueError("ohlcv must be an object")
        real_stdout = sys.stdout
        sys.stdout = sys.stderr
        try:
            manifest, fragment = _exec_source(source, _load_ohlcv(ohlcv_raw), params)
        finally:
            sys.stdout = real_stdout
        json.dump(
            {
                "ok": True,
                "fragment": _dump_fragment(fragment),
                "manifest": manifest.model_dump(exclude_none=True),
            },
            sys.stdout,
            ensure_ascii=False,
        )
        sys.stdout.write("\n")
        return 0
    except Exception as exc:
        json.dump(
            {
                "ok": False,
                "error": str(exc) or type(exc).__name__,
                "traceback": traceback.format_exc(),
            },
            sys.stdout,
            ensure_ascii=False,
        )
        sys.stdout.write("\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(_child_main())
