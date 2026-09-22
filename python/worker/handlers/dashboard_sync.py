from __future__ import annotations

import math
from typing import Any

import tushare as ts

from worker.dashboard_codes import (
    DASHBOARD_ALL_INDEX_CODES,
    DASHBOARD_DEFAULT_TS_CODE,
    DASHBOARD_FUT_CODES,
)
from worker.db import market_db
from worker.models import DashboardBackfillParams, DashboardBackfillResult
from worker.rate_limit import wait_for_tushare_slot

INDEX_DAILY_FIELDS = (
    "ts_code,trade_date,open,high,low,close,pre_close,change,pct_chg,vol,amount"
)
MARGIN_FIELDS = "trade_date,exchange_id,rzye,rqye,rzrqye"
LIMIT_FIELDS = "ts_code,trade_date,limit_status"
FUT_DAILY_FIELDS = "ts_code,trade_date,close"


def sync_limit_status_for_date(pro: Any, trade_date: str) -> int:
    """涨跌停状态仍随股票日线按日拉。指数 / 两融 / 期指改由步骤 2/8/9 按区间全量拉取。"""
    wait_for_tushare_slot()
    return market_db.upsert_limit_status(fetch_limit_status(pro, trade_date))


def dashboard_backfill(params: dict) -> DashboardBackfillResult:
    parsed = DashboardBackfillParams.model_validate(params)
    market_db.init_schema()
    pro = ts.pro_api(parsed.token)

    errors: list[str] = []
    index_count = 0
    margin_count = 0
    limit_count = 0
    fut_count = 0
    index_fetched = False
    margin_fetched = False
    fut_fetched = False
    limit_days = 0

    complete_dates = market_db.list_complete_dates(parsed.start_date, parsed.end_date)
    open_dates = market_db.list_open_trade_dates(parsed.start_date, parsed.end_date)
    target_dates = complete_dates or open_dates

    sentinel_dates = set(
        market_db.list_index_dates(DASHBOARD_DEFAULT_TS_CODE, parsed.start_date, parsed.end_date)
    )
    need_index = bool(target_dates) and any(d not in sentinel_dates for d in target_dates)

    if need_index:
        index_fetched = True
        for ts_code in DASHBOARD_ALL_INDEX_CODES:
            try:
                wait_for_tushare_slot()
                rows = fetch_index_daily(
                    pro,
                    ts_code,
                    start_date=parsed.start_date,
                    end_date=parsed.end_date,
                )
                index_count += market_db.upsert_index_daily(rows)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"index_daily {ts_code}: {exc}" if str(exc) else f"index_daily {ts_code} failed")

    margin_dates = set(market_db.list_margin_dates(parsed.start_date, parsed.end_date))
    need_margin = bool(target_dates) and any(d not in margin_dates for d in target_dates)
    if need_margin:
        margin_fetched = True
        try:
            wait_for_tushare_slot()
            rows = fetch_margin(pro, start_date=parsed.start_date, end_date=parsed.end_date)
            margin_count = market_db.upsert_margin(rows)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"margin: {exc}" if str(exc) else "margin failed")

    missing_fut_codes: list[str] = []
    for ts_code in DASHBOARD_FUT_CODES:
        have = set(market_db.list_fut_dates(ts_code, parsed.start_date, parsed.end_date))
        if any(day not in have for day in target_dates):
            missing_fut_codes.append(ts_code)
    if missing_fut_codes:
        fut_fetched = True
        for ts_code in missing_fut_codes:
            try:
                wait_for_tushare_slot()
                rows = fetch_fut_daily(
                    pro,
                    ts_code=ts_code,
                    start_date=parsed.start_date,
                    end_date=parsed.end_date,
                )
                fut_count += market_db.upsert_fut_daily(rows)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"fut_daily {ts_code}: {exc}" if str(exc) else f"fut_daily {ts_code} failed")

    limit_dates = set(market_db.list_limit_status_dates(parsed.start_date, parsed.end_date))
    missing_limit = [d for d in target_dates if d not in limit_dates]
    for trade_date in missing_limit:
        try:
            wait_for_tushare_slot()
            rows = fetch_limit_status(pro, trade_date)
            limit_count += market_db.upsert_limit_status(rows)
            limit_days += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"limit_status {trade_date}: {exc}" if str(exc) else f"limit_status {trade_date} failed")

    return DashboardBackfillResult(
        start_date=parsed.start_date,
        end_date=parsed.end_date,
        index_count=index_count,
        margin_count=margin_count,
        limit_count=limit_count,
        index_fetched=index_fetched,
        margin_fetched=margin_fetched,
        limit_days=limit_days,
        fut_count=fut_count,
        fut_fetched=fut_fetched,
        error="; ".join(errors) if errors else None,
    )


def fetch_index_daily(
    pro: Any,
    ts_code: str,
    *,
    trade_date: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict[str, Any]]:
    kwargs: dict[str, Any] = {"ts_code": ts_code, "fields": INDEX_DAILY_FIELDS}
    if trade_date:
        kwargs["trade_date"] = trade_date
    else:
        kwargs["start_date"] = start_date
        kwargs["end_date"] = end_date
    df = pro.index_daily(**kwargs)
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
            }
        )
    return rows


def fetch_margin(
    pro: Any,
    *,
    trade_date: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict[str, Any]]:
    kwargs: dict[str, Any] = {"fields": MARGIN_FIELDS}
    if trade_date:
        kwargs["trade_date"] = trade_date
    else:
        kwargs["start_date"] = start_date
        kwargs["end_date"] = end_date
    df = pro.margin(**kwargs)
    if df is None or df.empty:
        return []
    rows: list[dict[str, Any]] = []
    for row in df.itertuples(index=False):
        exchange_id = str(getattr(row, "exchange_id", "") or "").strip()
        day = str(getattr(row, "trade_date", "") or "").strip()
        if not exchange_id or not day:
            continue
        rows.append(
            {
                "trade_date": day,
                "exchange_id": exchange_id,
                "rzye": _nullable_float(getattr(row, "rzye", None)),
                "rqye": _nullable_float(getattr(row, "rqye", None)),
                "rzrqye": _nullable_float(getattr(row, "rzrqye", None)),
            }
        )
    return rows


def fetch_fut_daily(
    pro: Any,
    *,
    ts_code: str | None = None,
    exchange: str | None = None,
    trade_date: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict[str, Any]]:
    kwargs: dict[str, Any] = {"fields": FUT_DAILY_FIELDS}
    if ts_code:
        kwargs["ts_code"] = ts_code
    if exchange:
        kwargs["exchange"] = exchange
    if trade_date:
        kwargs["trade_date"] = trade_date
    else:
        kwargs["start_date"] = start_date
        kwargs["end_date"] = end_date
    df = pro.fut_daily(**kwargs)
    if df is None or df.empty:
        return []
    allowed = set(DASHBOARD_FUT_CODES)
    rows: list[dict[str, Any]] = []
    for row in df.itertuples(index=False):
        code = str(getattr(row, "ts_code", "") or "").strip()
        day = str(getattr(row, "trade_date", "") or "").strip()
        if not code or not day or code not in allowed:
            continue
        close = _nullable_float(getattr(row, "close", None))
        if close is None:
            continue
        rows.append({"ts_code": code, "trade_date": day, "close": close})
    return rows


def fetch_limit_status(pro: Any, trade_date: str) -> list[dict[str, Any]]:
    df = pro.daily_basic(trade_date=trade_date, fields=LIMIT_FIELDS)
    if df is None or df.empty:
        return []
    rows: list[dict[str, Any]] = []
    for row in df.itertuples(index=False):
        status = _nullable_int(getattr(row, "limit_status", None))
        if status is None:
            continue
        rows.append(
            {
                "ts_code": str(row.ts_code),
                "trade_date": str(row.trade_date),
                "limit_status": status,
            }
        )
    return rows


def _nullable_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return None
        text = str(value).strip()
        if not text or text.lower() == "nan":
            return None
        return float(text)
    except (TypeError, ValueError):
        return None


def _nullable_int(value: object) -> int | None:
    number = _nullable_float(value)
    if number is None:
        return None
    return int(number)
