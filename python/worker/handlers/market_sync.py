from __future__ import annotations

import time
from typing import Any

import tushare as ts

from worker.db import market_db
from worker.models import MarketPoolSyncError, MarketPoolSyncParams, MarketPoolSyncResult

DAILY_FIELDS = "ts_code,trade_date,open,high,low,close,vol,amount"
ADJ_FIELDS = "ts_code,trade_date,adj_factor"
SLEEP_SECONDS = 0.3


def sync_market_pool(params: dict) -> MarketPoolSyncResult:
    parsed = MarketPoolSyncParams.model_validate(params)
    market_db.init_schema()
    pro = ts.pro_api(parsed.token)

    total_bars = 0
    total_adj = 0
    errors: list[MarketPoolSyncError] = []

    for index, ts_code in enumerate(parsed.ts_codes):
        if index > 0:
            time.sleep(SLEEP_SECONDS)
        try:
            bar_rows = _fetch_daily(pro, ts_code, parsed.start_date, parsed.end_date)
            total_bars += market_db.upsert_daily_bars(bar_rows)
        except Exception as exc:  # noqa: BLE001 - collect per-stock errors
            errors.append(
                MarketPoolSyncError(ts_code=ts_code, stage="daily", message=str(exc) or exc.__class__.__name__)
            )

        try:
            time.sleep(SLEEP_SECONDS)
            adj_rows = _fetch_adj_factor(pro, ts_code, parsed.start_date, parsed.end_date)
            total_adj += market_db.upsert_adj_factors(adj_rows)
        except Exception as exc:  # noqa: BLE001
            errors.append(
                MarketPoolSyncError(
                    ts_code=ts_code, stage="adj_factor", message=str(exc) or exc.__class__.__name__
                )
            )

    return MarketPoolSyncResult(
        pool_size=len(parsed.ts_codes),
        bar_count=total_bars,
        adj_count=total_adj,
        ts_codes=list(parsed.ts_codes),
        errors=errors,
    )


def _fetch_daily(pro: Any, ts_code: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
    df = pro.daily(
        ts_code=ts_code,
        start_date=start_date,
        end_date=end_date,
        fields=DAILY_FIELDS,
    )
    if df is None or df.empty:
        return []

    rows: list[dict[str, Any]] = []
    for row in df.itertuples(index=False):
        rows.append(
            {
                "ts_code": str(row.ts_code),
                "trade_date": str(row.trade_date),
                "open": _nullable_float(getattr(row, "open", None)),
                "high": _nullable_float(getattr(row, "high", None)),
                "low": _nullable_float(getattr(row, "low", None)),
                "close": _nullable_float(getattr(row, "close", None)),
                "vol": _nullable_float(getattr(row, "vol", None)),
                "amount": _nullable_float(getattr(row, "amount", None)),
            }
        )
    return rows


def _fetch_adj_factor(pro: Any, ts_code: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
    df = pro.adj_factor(
        ts_code=ts_code,
        start_date=start_date,
        end_date=end_date,
        fields=ADJ_FIELDS,
    )
    if df is None or df.empty:
        return []

    rows: list[dict[str, Any]] = []
    for row in df.itertuples(index=False):
        factor = _nullable_float(getattr(row, "adj_factor", None))
        if factor is None:
            continue
        rows.append(
            {
                "ts_code": str(row.ts_code),
                "trade_date": str(row.trade_date),
                "adj_factor": factor,
            }
        )
    return rows


def _nullable_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        text = str(value).strip()
        if not text or text.lower() == "nan":
            return None
        return float(text)
    except (TypeError, ValueError):
        return None
