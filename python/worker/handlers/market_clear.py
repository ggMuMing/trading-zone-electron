from __future__ import annotations

from worker.db import market_db
from worker.models import MarketClearResult


def clear_market(_params: dict) -> MarketClearResult:
    market_db.init_schema()
    db_path = market_db.clear_market()
    return MarketClearResult(ok=True, db_path=db_path)
