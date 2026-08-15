from __future__ import annotations

import tushare as ts

from worker.db import market_db
from worker.models import MarketSyncPlanParams, MarketSyncPlanResult


def market_plan(params: dict) -> MarketSyncPlanResult:
    parsed = MarketSyncPlanParams.model_validate(params)
    if parsed.start_date > parsed.end_date:
        raise ValueError("start_date must be <= end_date")

    market_db.init_schema()

    token = (parsed.token or "").strip()
    if token:
        _refresh_trade_cal(token, parsed.start_date, parsed.end_date)

    trade_dates = market_db.list_open_trade_dates(parsed.start_date, parsed.end_date)
    complete_set = set(market_db.list_complete_dates(parsed.start_date, parsed.end_date))
    complete_dates = [d for d in trade_dates if d in complete_set]
    pending_dates = [d for d in trade_dates if d not in complete_set]

    return MarketSyncPlanResult(
        start_date=parsed.start_date,
        end_date=parsed.end_date,
        trade_dates=trade_dates,
        complete_dates=complete_dates,
        pending_dates=pending_dates,
        total_days=len(trade_dates),
        complete_count=len(complete_dates),
        pending_count=len(pending_dates),
    )


def _refresh_trade_cal(token: str, start_date: str, end_date: str) -> None:
    pro = ts.pro_api(token)
    df = pro.trade_cal(
        exchange="SSE",
        start_date=start_date,
        end_date=end_date,
        is_open="1",
    )
    rows: list[tuple[str, int]] = []
    if df is not None and not df.empty:
        for row in df.itertuples(index=False):
            cal_date = str(getattr(row, "cal_date", "") or getattr(row, "trade_date", "")).strip()
            if cal_date:
                rows.append((cal_date, 1))
    if rows:
        market_db.upsert_trade_cal(rows)
