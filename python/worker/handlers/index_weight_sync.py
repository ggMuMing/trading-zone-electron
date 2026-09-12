from __future__ import annotations

import calendar
from datetime import date
from typing import Any, Literal

import tushare as ts

from worker.dashboard_codes import DASHBOARD_DISPLAY_INDICES
from worker.db import market_db
from worker.models import IndexWeightSyncParams, IndexWeightSyncResult
from worker.rate_limit import wait_for_tushare_slot

INDEX_WEIGHT_FIELDS = "index_code,con_code,trade_date,weight"

# Historical quirk: some accounts only get CSI300 weights under the SZ code.
_FALLBACK_INDEX_CODES: dict[str, str] = {
    "000300.SH": "399300.SZ",
}


def _month_bounds(year: int, month: int) -> tuple[str, str]:
    last_day = calendar.monthrange(year, month)[1]
    start = date(year, month, 1).strftime("%Y%m%d")
    end = date(year, month, last_day).strftime("%Y%m%d")
    return start, end


def _prev_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _trade_date_yyyymm(trade_date: str) -> str:
    return trade_date[:6]


def fetch_index_weight(
    pro: Any,
    index_code: str,
    start_date: str,
    end_date: str,
) -> list[dict[str, Any]]:
    df = pro.index_weight(
        index_code=index_code,
        start_date=start_date,
        end_date=end_date,
        fields=INDEX_WEIGHT_FIELDS,
    )
    if df is None or df.empty:
        return []
    rows: list[dict[str, Any]] = []
    for row in df.itertuples(index=False):
        rows.append(
            {
                "index_code": str(getattr(row, "index_code", index_code)),
                "con_code": str(row.con_code),
                "trade_date": str(row.trade_date),
                "weight": _nullable_float(getattr(row, "weight", None)),
            }
        )
    return rows


def _nullable_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _fetch_with_fallback(
    pro: Any,
    canonical_code: str,
    start_date: str,
    end_date: str,
) -> list[dict[str, Any]]:
    rows = fetch_index_weight(pro, canonical_code, start_date, end_date)
    if rows:
        for row in rows:
            row["index_code"] = canonical_code
        return rows
    fallback = _FALLBACK_INDEX_CODES.get(canonical_code)
    if not fallback:
        return []
    rows = fetch_index_weight(pro, fallback, start_date, end_date)
    for row in rows:
        row["index_code"] = canonical_code
    return rows


def _sync_one_index(
    pro: Any,
    index_code: str,
    *,
    today: date,
) -> tuple[Literal["updated", "skipped", "empty"], str | None, int]:
    latest = market_db.latest_index_weight_trade_date(index_code)
    current_start, current_end = _month_bounds(today.year, today.month)
    current_yyyymm = f"{today.year:04d}{today.month:02d}"

    if latest and _trade_date_yyyymm(latest) >= current_yyyymm:
        return "skipped", latest, 0

    wait_for_tushare_slot()
    rows = _fetch_with_fallback(pro, index_code, current_start, current_end)
    if rows:
        count = market_db.upsert_index_weight(rows)
        trade_date = max(str(r["trade_date"]) for r in rows)
        return "updated", trade_date, count

    prev_year, prev_month = _prev_month(today.year, today.month)
    prev_start, prev_end = _month_bounds(prev_year, prev_month)
    prev_yyyymm = f"{prev_year:04d}{prev_month:02d}"

    if latest and _trade_date_yyyymm(latest) >= prev_yyyymm:
        return "skipped", latest, 0

    wait_for_tushare_slot()
    rows = _fetch_with_fallback(pro, index_code, prev_start, prev_end)
    if rows:
        count = market_db.upsert_index_weight(rows)
        trade_date = max(str(r["trade_date"]) for r in rows)
        return "updated", trade_date, count

    return "empty", latest, 0


def sync_index_weight(params: dict) -> IndexWeightSyncResult:
    parsed = IndexWeightSyncParams.model_validate(params)
    market_db.init_schema()
    pro = ts.pro_api(parsed.token)
    today = date.today()

    updated_count = 0
    skipped_count = 0
    empty_count = 0
    as_of_dates: dict[str, str] = {}
    errors: list[str] = []

    for index_code, _name, _group in DASHBOARD_DISPLAY_INDICES:
        try:
            status, trade_date, _row_count = _sync_one_index(pro, index_code, today=today)
            if status == "updated":
                updated_count += 1
                if trade_date:
                    as_of_dates[index_code] = trade_date
            elif status == "skipped":
                skipped_count += 1
                if trade_date:
                    as_of_dates[index_code] = trade_date
            else:
                empty_count += 1
                if trade_date:
                    as_of_dates[index_code] = trade_date
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{index_code}: {exc}" if str(exc) else f"{index_code} failed")

    for index_code, _name, _group in DASHBOARD_DISPLAY_INDICES:
        if index_code not in as_of_dates:
            latest = market_db.latest_index_weight_trade_date(index_code)
            if latest:
                as_of_dates[index_code] = latest

    return IndexWeightSyncResult(
        updated_count=updated_count,
        skipped_count=skipped_count,
        empty_count=empty_count,
        as_of_dates=as_of_dates,
        errors=errors,
    )
