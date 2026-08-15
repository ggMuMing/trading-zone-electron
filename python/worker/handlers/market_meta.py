from __future__ import annotations

from worker.db import market_db
from worker.models import MarketCoverageParams, MarketCoverageResult, MarketCoverageStock


def market_coverage(params: dict) -> MarketCoverageResult:
    parsed = MarketCoverageParams.model_validate(params or {})
    market_db.init_schema()
    raw = market_db.get_coverage(parsed.ts_codes)
    return MarketCoverageResult(
        total_bars=raw["total_bars"],
        total_adj=raw["total_adj"],
        stock_count=raw["stock_count"],
        stocks=[MarketCoverageStock.model_validate(s) for s in raw["stocks"]],
        min_date=raw.get("min_date"),
        max_date=raw.get("max_date"),
        complete_days=int(raw.get("complete_days") or 0),
        db_path=raw["db_path"],
    )
