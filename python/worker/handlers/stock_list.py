from __future__ import annotations

import tushare as ts

from worker.models import StockBasicRow, StockListParams, StockListResult

FIELDS = "ts_code,symbol,name,area,industry,market,list_date"


def sync_stock_list(params: dict) -> StockListResult:
    parsed = StockListParams.model_validate(params)
    pro = ts.pro_api(parsed.token)
    df = pro.stock_basic(
        exchange=parsed.exchange,
        list_status=parsed.list_status,
        fields=FIELDS,
    )

    if df is None or df.empty:
        return StockListResult(stocks=[], count=0)

    stocks: list[StockBasicRow] = []
    for row in df.itertuples(index=False):
        stocks.append(
            StockBasicRow(
                ts_code=str(row.ts_code),
                symbol=str(row.symbol),
                name=str(row.name),
                area=_nullable_str(getattr(row, "area", None)),
                industry=_nullable_str(getattr(row, "industry", None)),
                market=_nullable_str(getattr(row, "market", None)),
                list_date=_nullable_str(getattr(row, "list_date", None)),
            )
        )

    return StockListResult(stocks=stocks, count=len(stocks))


def _nullable_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    return text
