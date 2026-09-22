from __future__ import annotations

import tushare as ts

from worker.models import StockBasicRow, StockListParams, StockListResult
from worker.rate_limit import wait_for_tushare_slot

FIELDS = "ts_code,symbol,name,area,industry,market,list_date,list_status,delist_date"

_SUPPORTED_STATUSES = ("L", "D")


def sync_stock_list(params: dict) -> StockListResult:
    parsed = StockListParams.model_validate(params)
    pro = ts.pro_api(parsed.token)

    statuses = [
        item.strip().upper()
        for item in parsed.list_status.split(",")
        if item.strip().upper() in _SUPPORTED_STATUSES
    ]
    if not statuses:
        statuses = ["L"]

    errors: list[str] = []
    by_code: dict[str, StockBasicRow] = {}
    counts = {status: 0 for status in _SUPPORTED_STATUSES}

    for status in statuses:
        try:
            wait_for_tushare_slot()
            df = pro.stock_basic(
                exchange=parsed.exchange,
                list_status=status,
                fields=FIELDS,
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"stock_basic {status}: {exc}" if str(exc) else f"stock_basic {status} failed")
            continue

        if df is None or df.empty:
            continue

        for row in df.itertuples(index=False):
            ts_code = str(row.ts_code)
            # Trust the endpoint we asked rather than a possibly absent column.
            row_status = _normalize_status(getattr(row, "list_status", None)) or status
            by_code[ts_code] = StockBasicRow(
                ts_code=ts_code,
                symbol=str(row.symbol),
                name=str(row.name),
                area=_nullable_str(getattr(row, "area", None)),
                industry=_nullable_str(getattr(row, "industry", None)),
                market=_nullable_str(getattr(row, "market", None)),
                list_date=_nullable_str(getattr(row, "list_date", None)),
                list_status=row_status,
                delist_date=_nullable_str(getattr(row, "delist_date", None)),
            )
            counts[row_status] += 1

    stocks = [by_code[code] for code in sorted(by_code)]
    return StockListResult(
        stocks=stocks,
        count=len(stocks),
        listed_count=counts["L"],
        delisted_count=counts["D"],
        errors=errors,
    )


def _normalize_status(value: object) -> str | None:
    text = _nullable_str(value)
    if not text:
        return None
    upper = text.upper()
    return upper if upper in _SUPPORTED_STATUSES else None


def _nullable_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    return text
