from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path
from typing import Any, Callable

# Support both `python -m worker.main` (cwd=python/) and `python worker/main.py`.
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from pydantic import ValidationError  # noqa: E402

from worker.handlers.stock_list import sync_stock_list  # noqa: E402
from worker.models import ReadyMessage, WorkerError, WorkerRequest, WorkerResponse  # noqa: E402

Handler = Callable[[dict[str, Any]], Any]

HANDLERS: dict[str, Handler] = {
    "data.sync.stock_list": sync_stock_list,
}


def smoke_imports() -> dict[str, bool]:
    status: dict[str, bool] = {}
    for name in ("pandas", "numpy", "duckdb", "tushare", "pydantic"):
        try:
            __import__(name)
            status[name] = True
        except Exception:
            status[name] = False
    return status


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def emit_error(request_id: str, code: str, message: str) -> None:
    emit(
        WorkerResponse(
            id=request_id,
            ok=False,
            error=WorkerError(code=code, message=message),
        ).model_dump()
    )


def handle_request(raw: dict[str, Any]) -> None:
    try:
        request = WorkerRequest.model_validate(raw)
    except Exception as exc:
        emit_error(str(raw.get("id", "unknown")), "invalid_request", str(exc))
        return

    handler = HANDLERS.get(request.method)
    if handler is None:
        emit_error(request.id, "unknown_method", f"Unknown method: {request.method}")
        return

    try:
        result = handler(request.params)
        if hasattr(result, "model_dump"):
            result = result.model_dump()
        emit(WorkerResponse(id=request.id, ok=True, result=result).model_dump())
    except ValidationError as exc:
        emit_error(request.id, "invalid_params", str(exc))
    except Exception as exc:
        message = str(exc) or exc.__class__.__name__
        lowered = message.lower()
        if "权限" in message or "token" in lowered and "invalid" in lowered:
            code = "auth_error"
        else:
            code = "handler_error"
        print(traceback.format_exc(), file=sys.stderr, flush=True)
        emit_error(request.id, code, message)


def main() -> int:
    imports = smoke_imports()
    emit(ReadyMessage(imports=imports, python=sys.version.split()[0]).model_dump())
    if not all(imports.values()):
        missing = [name for name, ok in imports.items() if not ok]
        print(f"Import smoke failed: {missing}", file=sys.stderr, flush=True)
        return 1

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as exc:
            emit_error("unknown", "invalid_json", str(exc))
            continue
        if not isinstance(payload, dict):
            emit_error("unknown", "invalid_request", "Request must be a JSON object")
            continue
        handle_request(payload)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
