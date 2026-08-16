from __future__ import annotations

from worker.db import market_db


def seed_market_fixture(params: dict) -> dict:
    """Acceptance-only helper: write a tiny deterministic OHLCV + adj_factor sample."""
    ts_code = str(params.get("ts_code") or "__ACCEPTANCE__.SZ")
    market_db.init_schema()

    bars = [
        {
            "ts_code": ts_code,
            "trade_date": "20240102",
            "open": 10.0,
            "high": 11.0,
            "low": 9.5,
            "close": 10.5,
            "pre_close": 10.0,
            "change": 0.5,
            "pct_chg": 5.0,
            "vol": 1000.0,
            "amount": 10500.0,
            "ah_vol": None,
            "ah_amount": None,
        },
        {
            "ts_code": ts_code,
            "trade_date": "20240103",
            "open": 10.5,
            "high": 12.0,
            "low": 10.0,
            "close": 11.5,
            "pre_close": 10.5,
            "change": 1.0,
            "pct_chg": 100.0 / 10.5,
            "vol": 1200.0,
            "amount": 13800.0,
            "ah_vol": None,
            "ah_amount": None,
        },
    ]
    factors = [
        {"ts_code": ts_code, "trade_date": "20240102", "adj_factor": 1.0},
        {"ts_code": ts_code, "trade_date": "20240103", "adj_factor": 1.1},
    ]

    bar_count = market_db.upsert_daily_bars(bars)
    adj_count = market_db.upsert_adj_factors(factors)
    return {
        "ts_code": ts_code,
        "bar_count": bar_count,
        "adj_count": adj_count,
        "db_path": str(market_db.resolve_db_path()),
    }


def seed_sync_fixture(params: dict) -> dict:
    """Acceptance helper: inject trade calendar and complete-day watermarks without Tushare."""
    trade_dates = [str(d) for d in (params.get("trade_dates") or [])]
    complete_dates = [str(d) for d in (params.get("complete_dates") or [])]
    market_db.init_schema()
    if trade_dates:
        market_db.upsert_trade_cal([(d, 1) for d in trade_dates])
    for trade_date in complete_dates:
        market_db.upsert_sync_trade_date(trade_date, bar_count=0, adj_count=0, status="complete")
    return {
        "trade_dates": trade_dates,
        "complete_dates": complete_dates,
        "db_path": str(market_db.resolve_db_path()),
    }
