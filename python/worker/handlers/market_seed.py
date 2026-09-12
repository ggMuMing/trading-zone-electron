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
        market_db.upsert_sync_trade_date(trade_date, bar_count=1, adj_count=1, status="complete")
    return {
        "trade_dates": trade_dates,
        "complete_dates": complete_dates,
        "db_path": str(market_db.resolve_db_path()),
    }


_FUT_BASIS_OFFSETS: dict[str, float] = {"IH": -10.0, "IF": -20.0, "IC": 5.0, "IM": -30.0}


def seed_dashboard_fixture(params: dict) -> dict:
    """Acceptance helper: write index / margin / limit_status plus a tiny breadth sample."""
    from worker.dashboard_codes import (
        DASHBOARD_ALL_INDEX_CODES,
        DASHBOARD_BASIS_PRODUCTS,
        DASHBOARD_DISPLAY_INDICES,
    )

    market_db.init_schema()
    days = [str(d) for d in (params.get("trade_dates") or ["20240102", "20240103"])]
    if len(days) < 2:
        days = ["20240102", "20240103"]

    index_rows: list[dict] = []
    for i, ts_code in enumerate(DASHBOARD_ALL_INDEX_CODES):
        for j, trade_date in enumerate(days):
            close = 1000.0 + i + j
            index_rows.append(
                {
                    "ts_code": ts_code,
                    "trade_date": trade_date,
                    "open": close - 1,
                    "high": close + 2,
                    "low": close - 2,
                    "close": close,
                    "pre_close": close - 1,
                    "change": 1.0,
                    "pct_chg": 0.1 + j,
                    "vol": 100.0 + i,
                    "amount": 1_000_000.0 + i * 1000 + j,
                }
            )
    index_count = market_db.upsert_index_daily(index_rows)

    volume_override_rows: list[dict] = []
    for j, trade_date in enumerate(days):
        volume_override_rows.append(
            {
                "ts_code": "399107.SZ",
                "trade_date": trade_date,
                "open": 2000.0,
                "high": 2010.0,
                "low": 1990.0,
                "close": 2005.0,
                "pre_close": 2000.0,
                "change": 5.0,
                "pct_chg": 0.25,
                "vol": 9999.0,
                "amount": 50_000_000.0 + j,
            }
        )
        volume_override_rows.append(
            {
                "ts_code": "399102.SZ",
                "trade_date": trade_date,
                "open": 2100.0,
                "high": 2110.0,
                "low": 2090.0,
                "close": 2105.0,
                "pre_close": 2100.0,
                "change": 5.0,
                "pct_chg": 0.24,
                "vol": 8888.0,
                "amount": 40_000_000.0 + j,
            }
        )
    index_count += market_db.upsert_index_daily(volume_override_rows)

    margin_rows: list[dict] = []
    for j, trade_date in enumerate(days):
        base = 1.0e12 + j * 1.0e11
        for exchange_id, share in (("SSE", 0.5), ("SZSE", 0.4), ("BSE", 0.1)):
            margin_rows.append(
                {
                    "trade_date": trade_date,
                    "exchange_id": exchange_id,
                    "rzye": base * share * 0.9,
                    "rqye": base * share * 0.1,
                    "rzrqye": base * share,
                }
            )
    margin_count = market_db.upsert_margin(margin_rows)

    prev_date = days[-2]
    breadth_date = days[-1]
    prev_daily = [
        _bar("000002.SZ", prev_date, 9.5, 2),
        _bar("000003.SZ", prev_date, 10.0, 3),
        _bar("000008.SZ", prev_date, -9.5, 5),
        _bar("000010.SZ", prev_date, 1.2, 1),
    ]
    prev_limits = [2, 3, 5, 1]
    last_daily = [
        _bar("000001.SZ", breadth_date, 0.0, 0),
        _bar("000002.SZ", breadth_date, 6.0, 2),
        _bar("000003.SZ", breadth_date, 3.0, 1),
        _bar("000004.SZ", breadth_date, 0.5, 1),
        _bar("000005.SZ", breadth_date, 0.0, 0),
        _bar("000006.SZ", breadth_date, -0.5, 4),
        _bar("000007.SZ", breadth_date, -3.0, 4),
        _bar("000008.SZ", breadth_date, -6.0, 5),
        _bar("000009.SZ", breadth_date, -10.0, 6),
        _bar("000010.SZ", breadth_date, 1.2, 1),
    ]
    last_limits = [0, 2, 1, 1, 0, 4, 4, 5, 6, 1]
    daily_rows = prev_daily + last_daily
    limit_rows = [
        {"ts_code": row["ts_code"], "trade_date": row["trade_date"], "limit_status": status}
        for row, status in zip(daily_rows, prev_limits + last_limits)
    ]
    bar_count = market_db.upsert_daily_bars(daily_rows)
    limit_count = market_db.upsert_limit_status(limit_rows)
    market_db.upsert_trade_cal([(d, 1) for d in days])
    for trade_date in days:
        market_db.upsert_sync_trade_date(trade_date, bar_count=5, adj_count=0, status="complete")

    weight_count = _seed_index_weight_sample()

    spot_close: dict[tuple[str, str], float] = {}
    for row in index_rows:
        close = row.get("close")
        if close is None:
            continue
        spot_close[(str(row["ts_code"]), str(row["trade_date"]))] = float(close)

    fut_rows: list[dict] = []
    for meta in DASHBOARD_BASIS_PRODUCTS:
        offset = _FUT_BASIS_OFFSETS[meta["product"]]
        for trade_date in days:
            spot = spot_close.get((meta["spot_code"], trade_date))
            if spot is None:
                continue
            fut_rows.append(
                {
                    "ts_code": meta["fut_code"],
                    "trade_date": trade_date,
                    "close": spot + offset,
                }
            )
    fut_count = market_db.upsert_fut_daily(fut_rows)

    return {
        "index_count": index_count,
        "margin_count": margin_count,
        "limit_count": limit_count,
        "bar_count": bar_count,
        "weight_count": weight_count,
        "fut_count": fut_count,
        "display_count": len(DASHBOARD_DISPLAY_INDICES),
        "trade_dates": days,
        "db_path": str(market_db.resolve_db_path()),
    }


def clear_fut_daily_fixture(params: dict) -> dict:
    """Acceptance helper: remove all fut_daily rows so basis series stay empty."""
    market_db.init_schema()
    conn = market_db.get_conn()
    conn.execute("DELETE FROM fut_daily")
    return {"ok": True}


def clear_index_weight_fixture(params: dict) -> dict:
    """Acceptance helper: remove all index_weight rows for one index."""
    index_code = str(params.get("index_code") or "")
    market_db.init_schema()
    conn = market_db.get_conn()
    if index_code:
        conn.execute("DELETE FROM index_weight WHERE index_code = ?", [index_code])
    return {"index_code": index_code}


def seed_index_weight_fixture(params: dict) -> dict:
    """Acceptance helper: write deterministic index constituents."""
    index_code = str(params.get("index_code") or "000300.SH")
    trade_date = str(params.get("trade_date") or "20240131")
    con_codes = [str(code) for code in (params.get("con_codes") or ["000001.SZ", "000002.SZ", "000003.SZ"])]
    market_db.init_schema()
    rows = [
        {
            "index_code": index_code,
            "trade_date": trade_date,
            "con_code": code,
            "weight": float(index + 1),
        }
        for index, code in enumerate(con_codes)
    ]
    count = market_db.upsert_index_weight(rows)
    return {
        "index_code": index_code,
        "trade_date": trade_date,
        "con_codes": con_codes,
        "count": count,
        "db_path": str(market_db.resolve_db_path()),
    }


def _seed_index_weight_sample() -> int:
    rows = [
        {
            "index_code": "000300.SH",
            "trade_date": "20240131",
            "con_code": code,
            "weight": float(index + 1),
        }
        for index, code in enumerate(["000001.SZ", "000002.SZ", "000003.SZ"])
    ]
    rows.extend(
        {
            "index_code": "932000.CSI",
            "trade_date": "20240131",
            "con_code": code,
            "weight": float(index + 1),
        }
        for index, code in enumerate(["000008.SZ", "000009.SZ", "000010.SZ"])
    )
    return market_db.upsert_index_weight(rows)


def _bar(ts_code: str, trade_date: str, pct_chg: float, _limit: int) -> dict:
    close = 10.0 * (1 + pct_chg / 100)
    return {
        "ts_code": ts_code,
        "trade_date": trade_date,
        "open": 10.0,
        "high": max(10.0, close),
        "low": min(10.0, close),
        "close": close,
        "pre_close": 10.0,
        "change": close - 10.0,
        "pct_chg": pct_chg,
        "vol": 1000.0,
        "amount": 10000.0,
        "ah_vol": None,
        "ah_amount": None,
    }
