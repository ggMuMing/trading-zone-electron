"""Pipeline steps whose fetch and write stay inside Python / DuckDB.

Windows are code constants (`pipeline_steps.py`); callers never pass start / end dates.
Steps that touch SQLite (`stock_list`, `sw_industry`) or need per-day progress (`daily_bar`)
are orchestrated by Main instead.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import tushare as ts

from worker.dashboard_codes import DASHBOARD_ALL_INDEX_CODES, DASHBOARD_FUT_CODES
from worker.db import market_db
from worker.handlers.dashboard_sync import fetch_fut_daily, fetch_index_daily, fetch_margin
from worker.handlers.index_weight_sync import sync_index_weight
from worker.handlers.pipeline_status import resolve_last_closed_trade_date
from worker.models import PipelineStepParams, TradeCalSyncParams
from worker.pipeline_steps import (
    DAILY_BAR_DEFAULT_START,
    DAILY_BAR_HISTORY_BY_ID,
    FULL_RANGE_START,
    STEP_DAILY_BAR,
    STEP_FUT_DAILY,
    STEP_INDEX_DAILY,
    STEP_INDEX_WEIGHT,
    STEP_MARGIN,
    STEP_TRADE_CAL,
)
from worker.rate_limit import wait_for_tushare_slot

TRADE_CAL_FIELDS = "exchange,cal_date,is_open"
#: Tushare caps rows per call; walk long histories in windows instead of one 26-year request.
_TRADE_CAL_WINDOW_YEARS = 10
_INDEX_WINDOW_YEARS = 5
#: margin returns one row per exchange per day, so keep its windows shorter.
_MARGIN_WINDOW_YEARS = 1


def _year_windows(start_date: str, end_date: str, years: int) -> list[tuple[str, str]]:
    if start_date > end_date:
        return []
    windows: list[tuple[str, str]] = []
    cursor = int(start_date[:4])
    last_year = int(end_date[:4])
    while cursor <= last_year:
        window_start = max(start_date, f"{cursor:04d}0101")
        window_end = min(end_date, f"{cursor + years - 1:04d}1231")
        if window_start <= window_end:
            windows.append((window_start, window_end))
        cursor += years
    return windows


def _incremental_start(existing_end: str | None) -> str:
    """Re-pull the last stored day so a partially published session gets corrected."""
    return existing_end if existing_end else FULL_RANGE_START


def sync_trade_cal(params: dict) -> dict[str, Any]:
    parsed = TradeCalSyncParams.model_validate(params)
    market_db.init_schema()
    pro = ts.pro_api(parsed.token)

    today = date.today()
    # Pull past the current day so the calendar can answer "is today an open day" by itself.
    end_date = f"{today.year:04d}1231"
    _min, existing_end, _open_days = market_db.trade_cal_bounds()
    # Re-walking 26 years on every page open would burn the quota; once the history is in,
    # only the current year can still move (休市调整).
    start_date = (
        f"{today.year:04d}0101"
        if existing_end and existing_end >= today.strftime("%Y%m%d")
        else FULL_RANGE_START
    )

    rows: list[tuple[str, int]] = []
    for window_start, window_end in _year_windows(start_date, end_date, _TRADE_CAL_WINDOW_YEARS):
        wait_for_tushare_slot()
        df = pro.trade_cal(
            exchange="SSE",
            start_date=window_start,
            end_date=window_end,
            is_open="1",
            fields=TRADE_CAL_FIELDS,
        )
        if df is None or df.empty:
            continue
        for row in df.itertuples(index=False):
            cal_date = str(getattr(row, "cal_date", "") or getattr(row, "trade_date", "")).strip()
            if cal_date:
                rows.append((cal_date, 1))
    if rows:
        market_db.upsert_trade_cal(rows)

    _min, max_date, open_days = market_db.trade_cal_bounds()
    last_closed = resolve_last_closed_trade_date()
    market_db.set_step_synced(STEP_TRADE_CAL, last_closed)
    return {
        "start_date": start_date,
        "end_date": max_date or end_date,
        "open_days": open_days,
        "last_closed_trade_date": last_closed,
    }


def _run_index_daily(pro: Any, last_closed: str) -> tuple[int, list[str]]:
    bounds = market_db.index_daily_bounds(list(DASHBOARD_ALL_INDEX_CODES))
    errors: list[str] = []
    total = 0
    for ts_code in DASHBOARD_ALL_INDEX_CODES:
        existing_end = bounds.get(ts_code, (None, None))[1]
        start_date = _incremental_start(existing_end)
        if start_date > last_closed:
            continue
        for window_start, window_end in _year_windows(start_date, last_closed, _INDEX_WINDOW_YEARS):
            try:
                wait_for_tushare_slot()
                rows = fetch_index_daily(
                    pro, ts_code, start_date=window_start, end_date=window_end
                )
                total += market_db.upsert_index_daily(rows)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"index_daily {ts_code} {window_start}: {exc}".strip())
    return total, errors


def _run_fut_daily(pro: Any, last_closed: str) -> tuple[int, list[str]]:
    bounds = market_db.fut_daily_bounds(list(DASHBOARD_FUT_CODES))
    errors: list[str] = []
    total = 0
    for ts_code in DASHBOARD_FUT_CODES:
        existing_end = bounds.get(ts_code, (None, None))[1]
        start_date = _incremental_start(existing_end)
        if start_date > last_closed:
            continue
        for window_start, window_end in _year_windows(start_date, last_closed, _INDEX_WINDOW_YEARS):
            try:
                wait_for_tushare_slot()
                rows = fetch_fut_daily(
                    pro, ts_code=ts_code, start_date=window_start, end_date=window_end
                )
                total += market_db.upsert_fut_daily(rows)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"fut_daily {ts_code} {window_start}: {exc}".strip())
    return total, errors


def _run_margin(pro: Any, last_closed: str) -> tuple[int, list[str]]:
    bounds = market_db.margin_bounds_by_exchange()
    ends = [value[1] for value in bounds.values()]
    # Restart from the *earliest* exchange edge so a market that lags gets caught up too.
    start_date = _incremental_start(min(ends) if ends else None)
    errors: list[str] = []
    total = 0
    for window_start, window_end in _year_windows(start_date, last_closed, _MARGIN_WINDOW_YEARS):
        try:
            wait_for_tushare_slot()
            rows = fetch_margin(pro, start_date=window_start, end_date=window_end)
            total += market_db.upsert_margin(rows)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"margin {window_start}: {exc}".strip())
    return total, errors


def pipeline_plan(params: dict) -> dict[str, Any]:
    """Pending open days for a 股票日线 step. The window is fixed here, never by the caller."""
    step_id = str((params or {}).get("step_id") or "").strip()
    market_db.init_schema()

    if step_id == STEP_DAILY_BAR:
        start_date = DAILY_BAR_DEFAULT_START
        end_date = resolve_last_closed_trade_date()
        if end_date is None:
            raise ValueError("trade calendar is empty; run the trade_cal step first")
    elif step_id in DAILY_BAR_HISTORY_BY_ID:
        hist = DAILY_BAR_HISTORY_BY_ID[step_id]
        start_date = hist.start
        end_date = hist.end
    else:
        raise ValueError(f"step_id has no daily-bar plan: {step_id}")

    open_dates = market_db.list_open_trade_dates(start_date, end_date)
    complete = set(market_db.list_complete_dates(start_date, end_date))
    # Resume asks the watermark only; the latch has no say in which days still need pulling.
    pending = [day for day in open_dates if day not in complete]
    return {
        "step_id": step_id,
        "start_date": start_date,
        "end_date": end_date,
        "total_days": len(open_dates),
        "complete_count": len(open_dates) - len(pending),
        "pending_dates": pending,
    }


def pipeline_step(params: dict) -> dict[str, Any]:
    parsed = PipelineStepParams.model_validate(params)
    market_db.init_schema()

    if parsed.step_id == STEP_TRADE_CAL:
        calendar = sync_trade_cal({"token": parsed.token})
        return {
            "step_id": parsed.step_id,
            "row_count": int(calendar["open_days"]),
            "detail": f"开市日 {calendar['open_days']} 天",
            "error": None,
        }

    if parsed.step_id == STEP_INDEX_WEIGHT:
        weights = sync_index_weight({"token": parsed.token})
        errors = list(weights.errors)
        return {
            "step_id": parsed.step_id,
            "row_count": weights.updated_count,
            "detail": f"刷新 {weights.updated_count} 个，跳过 {weights.skipped_count} 个，空窗 {weights.empty_count} 个",
            "error": "; ".join(errors) if errors else None,
        }

    last_closed = resolve_last_closed_trade_date()
    if last_closed is None:
        raise ValueError("trade calendar is empty; run the trade_cal step first")

    pro = ts.pro_api(parsed.token)
    if parsed.step_id == STEP_INDEX_DAILY:
        total, errors = _run_index_daily(pro, last_closed)
    elif parsed.step_id == STEP_FUT_DAILY:
        total, errors = _run_fut_daily(pro, last_closed)
    elif parsed.step_id == STEP_MARGIN:
        total, errors = _run_margin(pro, last_closed)
    else:
        raise ValueError(f"step_id is not runnable in Python: {parsed.step_id}")

    market_db.set_step_synced(parsed.step_id, last_closed)
    return {
        "step_id": parsed.step_id,
        "row_count": total,
        "detail": f"写入 {total} 行",
        "error": "; ".join(errors) if errors else None,
    }
