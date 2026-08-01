"""Smoke-test the NDJSON worker: ready + optional stock_list call.

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
        text=True,
        encoding="utf-8",
    )
    assert proc.stdout is not None
    assert proc.stdin is not None

    ready_line = proc.stdout.readline()
    if not ready_line:
        err = proc.stderr.read() if proc.stderr else ""
        print("Worker failed to emit ready:", err, file=sys.stderr)
        return 1

    ready = json.loads(ready_line)
    print("ready:", json.dumps(ready, ensure_ascii=False))
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
    proc.stdin.write(json.dumps(req) + "\n")
    proc.stdin.flush()
    proc.stdin.close()

    resp_line = proc.stdout.readline()
    if not resp_line:
        err = proc.stderr.read() if proc.stderr else ""
        print("No response:", err, file=sys.stderr)
        return 1

    resp = json.loads(resp_line)
    if not resp.get("ok"):
        print("error:", json.dumps(resp, ensure_ascii=False))
        return 1

    count = resp["result"]["count"]
    sample = resp["result"]["stocks"][:3]
    print(f"ok: count={count}, sample={json.dumps(sample, ensure_ascii=False)}")
    proc.wait(timeout=10)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
