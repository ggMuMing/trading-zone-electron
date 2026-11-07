from __future__ import annotations

from worker.db import market_db

_DATE_RE_LEN = 8


def query_heatmap_quotes(params: dict) -> dict:
    trade_date = str((params or {}).get("trade_date") or "").strip()
    if len(trade_date) != _DATE_RE_LEN or not trade_date.isdigit():
        raise ValueError("trade_date must be YYYYMMDD")
    raw_index = (params or {}).get("index_code")
    index_code = raw_index.strip() if isinstance(raw_index, str) else ""
    index_code = index_code or None
    market_db.init_schema()
    return market_db.fetch_heatmap_quotes(trade_date, index_code)
