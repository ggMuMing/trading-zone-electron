from __future__ import annotations

from worker.db import market_db
from worker.models import MarketQueryParams, MarketQueryResult


def query_ohlcv(params: dict) -> MarketQueryResult:
    parsed = MarketQueryParams.model_validate(params)
    market_db.init_schema()
    table = market_db.query_ohlcv_arrow(
        parsed.ts_code,
        parsed.start_date,
        parsed.end_date,
        parsed.adjust,
        parsed.limit,
    )
    return MarketQueryResult(
        ts_code=parsed.ts_code,
        adjust=parsed.adjust,
        count=int(table.num_rows),
        arrow_ipc=market_db.table_to_ipc_bytes(table),
    )
