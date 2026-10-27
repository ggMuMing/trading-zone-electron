"""Run one user strategy source in an isolated subprocess."""

from __future__ import annotations

import builtins as builtins_mod
import json
import os
import re
import subprocess
import sys
import traceback
from pathlib import Path
from typing import Any

import pandas as pd

PYTHON_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from worker.strategies.script_base import (  # noqa: E402
    StrategyScript,
    apply_declare,
    bars_to_frame,
    empty_result,
    manifest_from_parameters,
    param,
    run_compute,
)

USER_SCRIPT_FILENAME = "<user_strategy>"
SCRIPT_TIMEOUT_SEC = 10
_USER_FRAME_RE = re.compile(rf'File "{re.escape(USER_SCRIPT_FILENAME)}", line (\d+)')
ALLOWED_IMPORT_ROOTS = frozenset({"pandas", "numpy", "math", "typing", "collections"})
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


def load_strategy_class(source: str) -> type[StrategyScript]:
    if not isinstance(source, str) or not source.strip():
        raise ValueError("source must be a non-empty string")
    namespace: dict[str, Any] = {
        "__name__": "user_strategy",
        "__builtins__": _restricted_builtins(),
        "StrategyScript": StrategyScript,
        "param": param,
        "pd": pd,
    }
    exec(compile(source, USER_SCRIPT_FILENAME, "exec"), namespace, namespace)
    cls = namespace.get("strategy")
    if not isinstance(cls, type) or not issubclass(cls, StrategyScript) or cls is StrategyScript:
        raise ValueError("source must export strategy = <StrategyScript subclass>")
    return cls


def execute_source(
    source: str,
    params: dict[str, Any] | None,
    bars: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    if params is None:
        params = {}
    if not isinstance(params, dict):
        raise ValueError("params must be an object")
    cls = load_strategy_class(source)
    instance = cls()
    parameters = apply_declare(instance, params)
    payload: dict[str, Any] = {"manifest": manifest_from_parameters(parameters)}
    if bars is None:
        return payload
    frame = bars_to_frame(bars)
    result = empty_result() if frame.empty else run_compute(instance, frame)
    payload["stats"] = result["stats"]
    payload["series"] = result["series"]
    return payload


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


def _run_child(
    source: str,
    params: dict[str, Any],
    bars: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    payload = json.dumps(
        {"source": source, "params": params, "bars": bars},
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
    bars: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    try:
        message = _run_child(source, params or {}, bars)
        manifest = message.get("manifest")
        if not isinstance(manifest, dict):
            raise ValueError("script ok payload must include manifest")
        result: dict[str, Any] = {"ok": True, "manifest": manifest}
        stats = message.get("stats")
        if isinstance(stats, dict):
            result["buy_count"] = int(stats.get("buy_count") or 0)
            result["sell_count"] = int(stats.get("sell_count") or 0)
            result["bar_count"] = int(stats.get("bar_count") or 0)
        return result
    except Exception as exc:
        return user_script_diagnostic(exc)


def run_source(
    source: str,
    params: dict[str, Any] | None,
    bars: list[dict[str, Any]],
) -> dict[str, Any]:
    try:
        message = _run_child(source, params or {}, bars)
    except Exception as exc:
        diagnostic = user_script_diagnostic(exc)
        text = str(diagnostic.get("error") or "脚本失败")
        line = diagnostic.get("line")
        if isinstance(line, int):
            text = f"{text} (line {line})"
        raise ValueError(text) from exc
    stats = message.get("stats")
    series = message.get("series")
    if not isinstance(stats, dict) or not isinstance(series, list):
        raise ValueError("script ok payload must include stats and series")
    return {"stats": stats, "series": series}


def _child_main() -> int:
    try:
        raw = json.load(sys.stdin)
        if not isinstance(raw, dict):
            raise ValueError("sandbox stdin must be an object")
        source = raw.get("source")
        params = raw.get("params")
        bars = raw.get("bars")
        if not isinstance(source, str):
            raise ValueError("source must be a string")
        if not isinstance(params, dict):
            raise ValueError("params must be an object")
        if bars is not None and not isinstance(bars, list):
            raise ValueError("bars must be a list or null")
        real_stdout = sys.stdout
        sys.stdout = sys.stderr
        try:
            payload = execute_source(source, params, bars)
        finally:
            sys.stdout = real_stdout
        json.dump({"ok": True, **payload}, real_stdout, ensure_ascii=False)
        real_stdout.write("\n")
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
