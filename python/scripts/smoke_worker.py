"""Smoke-test the MessagePack worker: ready + optional stock_list call.

Usage (from repo root, with venv activated):
  python python/scripts/smoke_worker.py
  python python/scripts/smoke_worker.py --token YOUR_TUSHARE_TOKEN
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PYTHON_DIR = ROOT / "python"
WORKER = PYTHON_DIR / "worker" / "main.py"

if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from worker.codec import pack_message, read_message  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--token", default=os.environ.get("TUSHARE_TOKEN", ""))
    args = parser.parse_args()

    proc = subprocess.Popen(
        [sys.executable, str(WORKER)],
        cwd=str(PYTHON_DIR),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert proc.stdout is not None
    assert proc.stdin is not None

    try:
        ready = read_message(proc.stdout)
    except Exception as exc:
        err = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
        print(f"Worker failed to emit ready: {exc}\n{err}", file=sys.stderr)
        return 1

    if not ready:
        err = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
        print("Worker failed to emit ready:", err, file=sys.stderr)
        return 1

    print("ready:", json.dumps(ready, ensure_ascii=False, default=str))
    if ready.get("type") != "ready" or not all(ready.get("imports", {}).values()):
        print("Import smoke failed", file=sys.stderr)
        proc.kill()
        return 1

    if not args.token:
        print("No token provided; skipping data.sync.stock_list")
        proc.stdin.close()
        proc.wait(timeout=5)
        return 0

    req = {
        "id": "smoke-1",
        "method": "data.sync.stock_list",
        "params": {"token": args.token},
    }
    proc.stdin.write(pack_message(req))
    proc.stdin.flush()
    proc.stdin.close()

    try:
        resp = read_message(proc.stdout)
    except Exception as exc:
        err = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
        print(f"No response: {exc}\n{err}", file=sys.stderr)
        return 1

    if not resp:
        err = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
        print("No response:", err, file=sys.stderr)
        return 1

    if not resp.get("ok"):
        print("error:", json.dumps(resp, ensure_ascii=False, default=str))
        return 1

    count = resp["result"]["count"]
    sample = resp["result"]["stocks"][:3]
    print(f"ok: count={count}, sample={json.dumps(sample, ensure_ascii=False)}")
    proc.wait(timeout=10)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
