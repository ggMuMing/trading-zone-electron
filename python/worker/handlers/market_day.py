from __future__ import annotations

import time
from typing import Any

import tushare as ts

from worker.db import market_db
from worker.models import MarketSyncDayParams, MarketSyncDayResult, MarketSyncDayTimings
from worker.rate_limit import wait_for_tushare_slot

DAILY_FIELDS = (
    "ts_code,trade_date,open,high,low,close,pre_close,change,pct_chg,"
    "vol,amount,ah_vol,ah_amount"
)
ADJ_FIELDS = "ts_code,trade_date,adj_factor"


def _elapsed_ms(started: float) -> int:
    return max(0, int((time.perf_counter() - started) * 1000))


def market_day(params: dict) -> MarketSyncDayResult:
    parsed = MarketSyncDayParams.model_validate(params)
    market_db.init_schema()
    pro = ts.pro_api(parsed.token)
    errors: list[str] = []
    bar_count = 0
    adj_count = 0
    wait_ms = 0
    daily_ms = 0
    upsert_daily_ms = 0
    adj_ms = 0
    upsert_adj_ms = 0

    waited = wait_for_tushare_slot()
    wait_ms += max(0, int(waited * 1000))
    try:
        started = time.perf_counter()
        bar_rows = _fetch_daily(pro, parsed.trade_date)
        daily_ms = _elapsed_ms(started)
        started = time.perf_counter()
        bar_count = market_db.upsert_daily_bars(bar_rows)
        upsert_daily_ms = _elapsed_ms(started)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"daily: {exc}" if str(exc) else "daily failed")

    waited = wait_for_tushare_slot()
    wait_ms += max(0, int(waited * 1000))
    try:
        started = time.perf_counter()
        adj_rows = _fetch_adj_factor(pro, parsed.trade_date)
        adj_ms = _elapsed_ms(started)
        started = time.perf_counter()
        adj_count = market_db.upsert_adj_factors(adj_rows)
        upsert_adj_ms = _elapsed_ms(started)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"adj_factor: {exc}" if str(exc) else "adj_factor failed")

    status = "complete" if not errors else "partial"
    error = "; ".join(errors) if errors else None
    market_db.upsert_sync_trade_date(parsed.trade_date, bar_count, adj_count, status)
    return MarketSyncDayResult(
        trade_date=parsed.trade_date,
        bar_count=bar_count,
        adj_count=adj_count,
        status=status,
        error=error,
        timings_ms=MarketSyncDayTimings(
            wait=wait_ms,
            daily=daily_ms,
            upsert_daily=upsert_daily_ms,
            adj=adj_ms,
            upsert_adj=upsert_adj_ms,
        ),
    )


def _fetch_daily(pro: Any, trade_date: str) -> list[dict[str, Any]]:
    df = pro.daily(trade_date=trade_date, fields=DAILY_FIELDS)
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
                "pre_close": _nullable_float(getattr(row, "pre_close", None)),
                "change": _nullable_float(getattr(row, "change", None)),
                "pct_chg": _nullable_float(getattr(row, "pct_chg", None)),
                "vol": _nullable_float(getattr(row, "vol", None)),
                "amount": _nullable_float(getattr(row, "amount", None)),
                "ah_vol": _nullable_float(getattr(row, "ah_vol", None)),
                "ah_amount": _nullable_float(getattr(row, "ah_amount", None)),
            }
        )
    return rows


def _fetch_adj_factor(pro: Any, trade_date: str) -> list[dict[str, Any]]:
    df = pro.adj_factor(trade_date=trade_date, fields=ADJ_FIELDS)
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
