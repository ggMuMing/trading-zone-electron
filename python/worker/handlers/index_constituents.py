from __future__ import annotations

from worker.db import market_db
from worker.models import IndexConstituentsParams, IndexConstituentsResult


def query_index_constituents(params: dict) -> IndexConstituentsResult:
    parsed = IndexConstituentsParams.model_validate(params)
    market_db.init_schema()
    payload = market_db.fetch_latest_constituents(parsed.index_code)
    return IndexConstituentsResult.model_validate(payload)
