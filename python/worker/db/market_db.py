from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import duckdb
import pyarrow as pa
import pyarrow.ipc as pa_ipc

_DAILY_BAR_EXTRA_COLUMNS = ("pre_close", "change", "pct_chg", "ah_vol", "ah_amount")

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS daily_bar (
  ts_code VARCHAR NOT NULL,
  trade_date VARCHAR NOT NULL,
  open DOUBLE,
  high DOUBLE,
  low DOUBLE,
  close DOUBLE,
  pre_close DOUBLE,
  change DOUBLE,
  pct_chg DOUBLE,
  vol DOUBLE,
  amount DOUBLE,
  ah_vol DOUBLE,
  ah_amount DOUBLE,
  synced_at TIMESTAMP NOT NULL,
  PRIMARY KEY (ts_code, trade_date)
);

CREATE TABLE IF NOT EXISTS adj_factor (
  ts_code VARCHAR NOT NULL,
  trade_date VARCHAR NOT NULL,
  adj_factor DOUBLE NOT NULL,
  synced_at TIMESTAMP NOT NULL,
  PRIMARY KEY (ts_code, trade_date)
);

CREATE TABLE IF NOT EXISTS sync_trade_date (
  trade_date VARCHAR PRIMARY KEY,
  bar_count INTEGER NOT NULL,
  adj_count INTEGER NOT NULL,
  status VARCHAR NOT NULL,
  synced_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_cal (
  trade_date VARCHAR PRIMARY KEY,
  is_open INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS index_daily (
  ts_code VARCHAR NOT NULL,
  trade_date VARCHAR NOT NULL,
  open DOUBLE,
  high DOUBLE,
  low DOUBLE,
  close DOUBLE,
  pre_close DOUBLE,
  change DOUBLE,
  pct_chg DOUBLE,
  vol DOUBLE,
  amount DOUBLE,
  synced_at TIMESTAMP NOT NULL,
  PRIMARY KEY (ts_code, trade_date)
);

CREATE TABLE IF NOT EXISTS margin (
  trade_date VARCHAR NOT NULL,
  exchange_id VARCHAR NOT NULL,
  rzye DOUBLE,
  rqye DOUBLE,
  rzrqye DOUBLE,
  synced_at TIMESTAMP NOT NULL,
  PRIMARY KEY (trade_date, exchange_id)
);

CREATE TABLE IF NOT EXISTS stock_limit_status (
  ts_code VARCHAR NOT NULL,
  trade_date VARCHAR NOT NULL,
  limit_status INTEGER,
  synced_at TIMESTAMP NOT NULL,
  PRIMARY KEY (ts_code, trade_date)
);

CREATE TABLE IF NOT EXISTS index_weight (
  index_code VARCHAR NOT NULL,
  trade_date VARCHAR NOT NULL,
  con_code VARCHAR NOT NULL,
  weight DOUBLE,
  synced_at TIMESTAMP NOT NULL,
  PRIMARY KEY (index_code, trade_date, con_code)
);

CREATE TABLE IF NOT EXISTS fut_daily (
  ts_code VARCHAR NOT NULL,
  trade_date VARCHAR NOT NULL,
  close DOUBLE,
  synced_at TIMESTAMP NOT NULL,
  PRIMARY KEY (ts_code, trade_date)
);
"""

_conn: duckdb.DuckDBPyConnection | None = None


def resolve_db_path() -> Path:
    user_data = os.environ.get("TRADING_ZONE_USER_DATA", "").strip()
    if not user_data:
        raise RuntimeError(
            "TRADING_ZONE_USER_DATA is not set. Main must inject userData path when starting Python."
        )
    data_dir = Path(user_data) / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "market.duckdb"


def get_conn() -> duckdb.DuckDBPyConnection:
    global _conn
    if _conn is None:
        path = resolve_db_path()
        _conn = duckdb.connect(str(path))
        init_schema(_conn)
    return _conn


def init_schema(conn: duckdb.DuckDBPyConnection | None = None) -> None:
    c = conn or get_conn()
    c.execute(_SCHEMA_SQL)
    for column in _DAILY_BAR_EXTRA_COLUMNS:
        c.execute(f"ALTER TABLE daily_bar ADD COLUMN IF NOT EXISTS {column} DOUBLE")


def close_conn() -> None:
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def upsert_daily_bars(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    conn = get_conn()
    synced_at = _now_iso()
    table = pa.table(
        {
            "ts_code": [str(r["ts_code"]) for r in rows],
            "trade_date": [str(r["trade_date"]) for r in rows],
            "open": pa.array([r.get("open") for r in rows], type=pa.float64()),
            "high": pa.array([r.get("high") for r in rows], type=pa.float64()),
            "low": pa.array([r.get("low") for r in rows], type=pa.float64()),
            "close": pa.array([r.get("close") for r in rows], type=pa.float64()),
            "pre_close": pa.array([r.get("pre_close") for r in rows], type=pa.float64()),
            "change": pa.array([r.get("change") for r in rows], type=pa.float64()),
            "pct_chg": pa.array([r.get("pct_chg") for r in rows], type=pa.float64()),
            "vol": pa.array([r.get("vol") for r in rows], type=pa.float64()),
            "amount": pa.array([r.get("amount") for r in rows], type=pa.float64()),
            "ah_vol": pa.array([r.get("ah_vol") for r in rows], type=pa.float64()),
            "ah_amount": pa.array([r.get("ah_amount") for r in rows], type=pa.float64()),
            "synced_at": [synced_at] * len(rows),
        }
    )
    view = "_tmp_daily_bar"
    conn.register(view, table)
    try:
        conn.execute(
            f"""
            INSERT OR REPLACE INTO daily_bar
              (ts_code, trade_date, open, high, low, close, pre_close, change, pct_chg,
               vol, amount, ah_vol, ah_amount, synced_at)
            SELECT ts_code, trade_date, open, high, low, close, pre_close, change, pct_chg,
                   vol, amount, ah_vol, ah_amount, synced_at
            FROM {view}
            """
        )
    finally:
        conn.unregister(view)
    return len(rows)


def upsert_index_daily(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    conn = get_conn()
    synced_at = _now_iso()
    table = pa.table(
        {
            "ts_code": [str(r["ts_code"]) for r in rows],
            "trade_date": [str(r["trade_date"]) for r in rows],
            "open": pa.array([r.get("open") for r in rows], type=pa.float64()),
            "high": pa.array([r.get("high") for r in rows], type=pa.float64()),
            "low": pa.array([r.get("low") for r in rows], type=pa.float64()),
            "close": pa.array([r.get("close") for r in rows], type=pa.float64()),
            "pre_close": pa.array([r.get("pre_close") for r in rows], type=pa.float64()),
            "change": pa.array([r.get("change") for r in rows], type=pa.float64()),
            "pct_chg": pa.array([r.get("pct_chg") for r in rows], type=pa.float64()),
            "vol": pa.array([r.get("vol") for r in rows], type=pa.float64()),
            "amount": pa.array([r.get("amount") for r in rows], type=pa.float64()),
            "synced_at": [synced_at] * len(rows),
        }
    )
    view = "_tmp_index_daily"
    conn.register(view, table)
    try:
        conn.execute(
            f"""
            INSERT OR REPLACE INTO index_daily
              (ts_code, trade_date, open, high, low, close, pre_close, change, pct_chg,
               vol, amount, synced_at)
            SELECT ts_code, trade_date, open, high, low, close, pre_close, change, pct_chg,
                   vol, amount, synced_at
            FROM {view}
            """
        )
    finally:
        conn.unregister(view)
    return len(rows)


def upsert_margin(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    conn = get_conn()
    synced_at = _now_iso()
    table = pa.table(
        {
            "trade_date": [str(r["trade_date"]) for r in rows],
            "exchange_id": [str(r["exchange_id"]) for r in rows],
            "rzye": pa.array([r.get("rzye") for r in rows], type=pa.float64()),
            "rqye": pa.array([r.get("rqye") for r in rows], type=pa.float64()),
            "rzrqye": pa.array([r.get("rzrqye") for r in rows], type=pa.float64()),
            "synced_at": [synced_at] * len(rows),
        }
    )
    view = "_tmp_margin"
    conn.register(view, table)
    try:
        conn.execute(
            f"""
            INSERT OR REPLACE INTO margin
              (trade_date, exchange_id, rzye, rqye, rzrqye, synced_at)
            SELECT trade_date, exchange_id, rzye, rqye, rzrqye, synced_at
            FROM {view}
            """
        )
    finally:
        conn.unregister(view)
    return len(rows)


def upsert_fut_daily(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    conn = get_conn()
    synced_at = _now_iso()
    table = pa.table(
        {
            "ts_code": [str(r["ts_code"]) for r in rows],
            "trade_date": [str(r["trade_date"]) for r in rows],
            "close": pa.array([r.get("close") for r in rows], type=pa.float64()),
            "synced_at": [synced_at] * len(rows),
        }
    )
    view = "_tmp_fut_daily"
    conn.register(view, table)
    try:
        conn.execute(
            f"""
            INSERT OR REPLACE INTO fut_daily
              (ts_code, trade_date, close, synced_at)
            SELECT ts_code, trade_date, close, synced_at
            FROM {view}
            """
        )
    finally:
        conn.unregister(view)
    return len(rows)


def list_fut_dates(ts_code: str, start_date: str, end_date: str) -> list[str]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT trade_date FROM fut_daily
        WHERE ts_code = ?
          AND trade_date >= ?
          AND trade_date <= ?
        ORDER BY trade_date
        """,
        [ts_code, start_date, end_date],
    ).fetchall()
    return [str(r[0]) for r in rows]


def latest_fut_trade_date(ts_code: str | None = None) -> str | None:
    conn = get_conn()
    if ts_code:
        row = conn.execute(
            "SELECT MAX(trade_date) FROM fut_daily WHERE ts_code = ?",
            [ts_code],
        ).fetchone()
    else:
        row = conn.execute("SELECT MAX(trade_date) FROM fut_daily").fetchone()
    if not row or row[0] is None:
        return None
    return str(row[0])


def fetch_fut_closes(ts_code: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT ts_code, trade_date, close
        FROM fut_daily
        WHERE ts_code = ?
          AND trade_date >= ?
          AND trade_date <= ?
        ORDER BY trade_date
        """,
        [ts_code, start_date, end_date],
    ).fetchall()
    return [
        {
            "ts_code": str(r[0]),
            "trade_date": str(r[1]),
            "close": _as_float(r[2]),
        }
        for r in rows
    ]


def upsert_limit_status(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    conn = get_conn()
    synced_at = _now_iso()
    table = pa.table(
        {
            "ts_code": [str(r["ts_code"]) for r in rows],
            "trade_date": [str(r["trade_date"]) for r in rows],
            "limit_status": pa.array([r.get("limit_status") for r in rows], type=pa.int32()),
            "synced_at": [synced_at] * len(rows),
        }
    )
    view = "_tmp_limit_status"
    conn.register(view, table)
    try:
        conn.execute(
            f"""
            INSERT OR REPLACE INTO stock_limit_status
              (ts_code, trade_date, limit_status, synced_at)
            SELECT ts_code, trade_date, limit_status, synced_at
            FROM {view}
            """
        )
    finally:
        conn.unregister(view)
    return len(rows)


def list_index_dates(ts_code: str, start_date: str, end_date: str) -> list[str]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT trade_date FROM index_daily
        WHERE ts_code = ?
          AND trade_date >= ?
          AND trade_date <= ?
        ORDER BY trade_date
        """,
        [ts_code, start_date, end_date],
    ).fetchall()
    return [str(r[0]) for r in rows]


def list_margin_dates(start_date: str, end_date: str) -> list[str]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT DISTINCT trade_date FROM margin
        WHERE trade_date >= ?
          AND trade_date <= ?
        ORDER BY trade_date
        """,
        [start_date, end_date],
    ).fetchall()
    return [str(r[0]) for r in rows]


def list_limit_status_dates(start_date: str, end_date: str) -> list[str]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT DISTINCT trade_date FROM stock_limit_status
        WHERE trade_date >= ?
          AND trade_date <= ?
        ORDER BY trade_date
        """,
        [start_date, end_date],
    ).fetchall()
    return [str(r[0]) for r in rows]


def fetch_index_bars(ts_code: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT ts_code, trade_date, open, high, low, close, pre_close, change, pct_chg, vol, amount
        FROM index_daily
        WHERE ts_code = ?
          AND trade_date >= ?
          AND trade_date <= ?
        ORDER BY trade_date
        """,
        [ts_code, start_date, end_date],
    ).fetchall()
    return [_index_row_to_dict(r) for r in rows]


def fetch_latest_index_rows(ts_codes: list[str]) -> list[dict[str, Any]]:
    if not ts_codes:
        return []
    conn = get_conn()
    placeholders = ", ".join(["?"] * len(ts_codes))
    rows = conn.execute(
        f"""
        SELECT i.ts_code, i.trade_date, i.open, i.high, i.low, i.close, i.pre_close,
               i.change, i.pct_chg, i.vol, i.amount
        FROM index_daily i
        INNER JOIN (
          SELECT ts_code, MAX(trade_date) AS trade_date
          FROM index_daily
          WHERE ts_code IN ({placeholders})
          GROUP BY ts_code
        ) latest
          ON i.ts_code = latest.ts_code AND i.trade_date = latest.trade_date
        """,
        ts_codes,
    ).fetchall()
    return [_index_row_to_dict(r) for r in rows]


def fetch_margin_totals(start_date: str, end_date: str) -> list[tuple[str, float | None]]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT trade_date, SUM(rzrqye) AS rzrqye
        FROM margin
        WHERE trade_date >= ?
          AND trade_date <= ?
        GROUP BY trade_date
        ORDER BY trade_date
        """,
        [start_date, end_date],
    ).fetchall()
    return [(str(r[0]), _as_float(r[1])) for r in rows]


def fetch_turnover_totals(
    ts_codes: list[str], start_date: str, end_date: str
) -> list[tuple[str, float | None]]:
    if not ts_codes:
        return []
    conn = get_conn()
    placeholders = ", ".join(["?"] * len(ts_codes))
    rows = conn.execute(
        f"""
        SELECT trade_date, SUM(amount) AS amount
        FROM index_daily
        WHERE ts_code IN ({placeholders})
          AND trade_date >= ?
          AND trade_date <= ?
        GROUP BY trade_date
        ORDER BY trade_date
        """,
        [*ts_codes, start_date, end_date],
    ).fetchall()
    return [(str(r[0]), _as_float(r[1])) for r in rows]


_BREADTH_CONSTITUENT_FILTER = """
          AND d.ts_code IN (
            SELECT con_code FROM index_weight
            WHERE index_code = ?
              AND trade_date = (
                SELECT MAX(trade_date) FROM index_weight WHERE index_code = ?
              )
          )
"""


def fetch_breadth_rows(
    trade_date: str, index_code: str | None = None
) -> list[tuple[str, float | None, float | None, int | None]]:
    conn = get_conn()
    constituent_filter = _BREADTH_CONSTITUENT_FILTER if index_code else ""
    params: list[str] = [trade_date]
    if index_code:
        params.extend([index_code, index_code])
    rows = conn.execute(
        f"""
        SELECT d.ts_code, d.pct_chg, d.vol, s.limit_status
        FROM daily_bar d
        INNER JOIN stock_limit_status s
          ON d.ts_code = s.ts_code AND d.trade_date = s.trade_date
        WHERE d.trade_date = ?
          AND d.vol IS NOT NULL
          AND d.vol > 0
        {constituent_filter}
        """,
        params,
    ).fetchall()
    result: list[tuple[str, float | None, float | None, int | None]] = []
    for ts_code, pct_chg, vol, limit_status in rows:
        result.append(
            (
                str(ts_code),
                _as_float(pct_chg),
                _as_float(vol),
                int(limit_status) if limit_status is not None else None,
            )
        )
    return result


def fetch_breadth_limit_series(
    start_date: str, end_date: str, index_code: str | None = None
) -> list[tuple[str, int, int]]:
    conn = get_conn()
    constituent_filter = _BREADTH_CONSTITUENT_FILTER if index_code else ""
    params: list[str] = [start_date, end_date]
    if index_code:
        params.extend([index_code, index_code])
    rows = conn.execute(
        f"""
        SELECT d.trade_date,
               SUM(CASE WHEN s.limit_status IN (2, 3) THEN 1 ELSE 0 END) AS limit_up_count,
               SUM(CASE WHEN s.limit_status IN (5, 6) THEN 1 ELSE 0 END) AS limit_down_count
        FROM daily_bar d
        INNER JOIN stock_limit_status s
          ON d.ts_code = s.ts_code AND d.trade_date = s.trade_date
        WHERE d.trade_date >= ?
          AND d.trade_date <= ?
          AND d.vol IS NOT NULL
          AND d.vol > 0
        {constituent_filter}
        GROUP BY d.trade_date
        ORDER BY d.trade_date
        """,
        params,
    ).fetchall()
    result: list[tuple[str, int, int]] = []
    for trade_date, limit_up_count, limit_down_count in rows:
        result.append((str(trade_date), int(limit_up_count or 0), int(limit_down_count or 0)))
    return result


def latest_index_trade_date(ts_code: str) -> str | None:
    conn = get_conn()
    row = conn.execute(
        "SELECT MAX(trade_date) FROM index_daily WHERE ts_code = ?",
        [ts_code],
    ).fetchone()
    if not row or row[0] is None:
        return None
    return str(row[0])


def latest_limit_trade_date() -> str | None:
    conn = get_conn()
    row = conn.execute("SELECT MAX(trade_date) FROM stock_limit_status").fetchone()
    if not row or row[0] is None:
        return None
    return str(row[0])


def _index_row_to_dict(row: tuple[Any, ...]) -> dict[str, Any]:
    return {
        "ts_code": str(row[0]),
        "trade_date": str(row[1]),
        "open": _as_float(row[2]),
        "high": _as_float(row[3]),
        "low": _as_float(row[4]),
        "close": _as_float(row[5]),
        "pre_close": _as_float(row[6]),
        "change": _as_float(row[7]),
        "pct_chg": _as_float(row[8]),
        "vol": _as_float(row[9]),
        "amount": _as_float(row[10]),
    }


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def upsert_adj_factors(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    conn = get_conn()
    synced_at = _now_iso()
    table = pa.table(
        {
            "ts_code": [str(r["ts_code"]) for r in rows],
            "trade_date": [str(r["trade_date"]) for r in rows],
            "adj_factor": pa.array([r["adj_factor"] for r in rows], type=pa.float64()),
            "synced_at": [synced_at] * len(rows),
        }
    )
    view = "_tmp_adj_factor"
    conn.register(view, table)
    try:
        conn.execute(
            f"""
            INSERT OR REPLACE INTO adj_factor
              (ts_code, trade_date, adj_factor, synced_at)
            SELECT ts_code, trade_date, adj_factor, synced_at
            FROM {view}
            """
        )
    finally:
        conn.unregister(view)
    return len(rows)


def latest_index_weight_trade_date(index_code: str) -> str | None:
    conn = get_conn()
    row = conn.execute(
        "SELECT MAX(trade_date) FROM index_weight WHERE index_code = ?",
        [index_code],
    ).fetchone()
    if not row or row[0] is None:
        return None
    return str(row[0])


def upsert_index_weight(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    conn = get_conn()
    synced_at = _now_iso()
    table = pa.table(
        {
            "index_code": [str(r["index_code"]) for r in rows],
            "trade_date": [str(r["trade_date"]) for r in rows],
            "con_code": [str(r["con_code"]) for r in rows],
            "weight": pa.array([r.get("weight") for r in rows], type=pa.float64()),
            "synced_at": [synced_at] * len(rows),
        }
    )
    view = "_tmp_index_weight"
    conn.register(view, table)
    try:
        conn.execute(
            f"""
            INSERT OR REPLACE INTO index_weight
              (index_code, trade_date, con_code, weight, synced_at)
            SELECT index_code, trade_date, con_code, weight, synced_at
            FROM {view}
            """
        )
    finally:
        conn.unregister(view)
    return len(rows)


def fetch_latest_constituents(index_code: str) -> dict[str, Any]:
    as_of = latest_index_weight_trade_date(index_code)
    if not as_of:
        return {"index_code": index_code, "as_of": None, "con_codes": []}
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT con_code FROM index_weight
        WHERE index_code = ? AND trade_date = ?
        ORDER BY con_code
        """,
        [index_code, as_of],
    ).fetchall()
    return {
        "index_code": index_code,
        "as_of": as_of,
        "con_codes": [str(r[0]) for r in rows],
    }


def _is_dashboard_index_code(ts_code: str) -> bool:
    from worker.dashboard_codes import DASHBOARD_ALL_INDEX_CODES

    return ts_code in DASHBOARD_ALL_INDEX_CODES


def _query_index_ohlcv_arrow(
    ts_code: str,
    start_date: str,
    end_date: str,
    limit: int | None = None,
) -> pa.Table:
    from worker.dashboard_codes import DASHBOARD_VOLUME_OVERRIDE

    conn = get_conn()
    override_code = DASHBOARD_VOLUME_OVERRIDE.get(ts_code)
    limit_sql = "LIMIT ?" if limit is not None else ""
    if override_code:
        sql = f"""
            SELECT
              i.ts_code,
              i.trade_date,
              i.open,
              i.high,
              i.low,
              i.close,
              i.pre_close,
              i.change,
              i.pct_chg,
              COALESCE(o.vol, i.vol) AS vol,
              COALESCE(o.amount, i.amount) AS amount,
              CAST(NULL AS DOUBLE) AS ah_vol,
              CAST(NULL AS DOUBLE) AS ah_amount,
              CAST(NULL AS DOUBLE) AS adj_factor
            FROM index_daily i
            LEFT JOIN index_daily o
              ON o.ts_code = ? AND o.trade_date = i.trade_date
            WHERE i.ts_code = ?
              AND i.trade_date >= ?
              AND i.trade_date <= ?
            ORDER BY i.trade_date
            {limit_sql}
            """
        params: list[Any] = [override_code, ts_code, start_date, end_date]
    else:
        sql = f"""
            SELECT
              ts_code,
              trade_date,
              open,
              high,
              low,
              close,
              pre_close,
              change,
              pct_chg,
              vol,
              amount,
              CAST(NULL AS DOUBLE) AS ah_vol,
              CAST(NULL AS DOUBLE) AS ah_amount,
              CAST(NULL AS DOUBLE) AS adj_factor
            FROM index_daily
            WHERE ts_code = ?
              AND trade_date >= ?
              AND trade_date <= ?
            ORDER BY trade_date
            {limit_sql}
            """
        params = [ts_code, start_date, end_date]
    if limit is not None:
        params.append(limit)
    return conn.execute(sql, params).fetch_arrow_table()


def query_ohlcv_arrow(
    ts_code: str,
    start_date: str,
    end_date: str,
    adjust: str,
    limit: int | None = None,
) -> pa.Table:
    if _is_dashboard_index_code(ts_code):
        return _query_index_ohlcv_arrow(ts_code, start_date, end_date, limit)

    conn = get_conn()
    limit_sql = "LIMIT ?" if limit is not None else ""
    sql = f"""
        WITH anchors AS (
          SELECT
            (SELECT adj_factor FROM adj_factor
             WHERE ts_code = ? ORDER BY trade_date ASC LIMIT 1) AS earliest,
            (SELECT adj_factor FROM adj_factor
             WHERE ts_code = ? ORDER BY trade_date DESC LIMIT 1) AS latest
        ),
        windowed AS (
          SELECT
            d.ts_code,
            d.trade_date,
            d.open,
            d.high,
            d.low,
            d.close,
            d.pre_close,
            d.change,
            d.pct_chg,
            d.vol,
            d.amount,
            d.ah_vol,
            d.ah_amount,
            a.adj_factor
          FROM daily_bar d
          LEFT JOIN adj_factor a
            ON d.ts_code = a.ts_code AND d.trade_date = a.trade_date
          WHERE d.ts_code = ?
            AND d.trade_date >= ?
            AND d.trade_date <= ?
          ORDER BY d.trade_date
          {limit_sql}
        ),
        scaled AS (
          SELECT
            w.*,
            CASE
              WHEN ? = 'qfq' AND w.adj_factor IS NOT NULL
                   AND anc.latest IS NOT NULL AND anc.latest != 0
                THEN w.adj_factor / anc.latest
              WHEN ? = 'hfq' AND w.adj_factor IS NOT NULL
                   AND anc.earliest IS NOT NULL AND anc.earliest != 0
                THEN w.adj_factor / anc.earliest
              ELSE 1.0
            END AS scale
          FROM windowed w
          CROSS JOIN anchors anc
        )
        SELECT
          ts_code,
          trade_date,
          open * scale AS open,
          high * scale AS high,
          low * scale AS low,
          close * scale AS close,
          pre_close * scale AS pre_close,
          CASE
            WHEN ? != 'none' THEN (close * scale) - (pre_close * scale)
            ELSE change
          END AS change,
          CASE
            WHEN ? != 'none' AND pre_close IS NOT NULL AND (pre_close * scale) != 0
              THEN ((close * scale) - (pre_close * scale)) / (pre_close * scale) * 100
            WHEN ? != 'none'
              THEN NULL
            ELSE pct_chg
          END AS pct_chg,
          vol,
          amount,
          ah_vol,
          ah_amount,
          adj_factor
        FROM scaled
        ORDER BY trade_date
        """
    params: list[Any] = [ts_code, ts_code, ts_code, start_date, end_date]
    if limit is not None:
        params.append(limit)
    params.extend([adjust, adjust, adjust, adjust, adjust])
    return conn.execute(sql, params).fetch_arrow_table()


def table_to_ipc_bytes(table: pa.Table) -> bytes:
    sink = pa.BufferOutputStream()
    with pa_ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return sink.getvalue().to_pybytes()


def get_anchor_adj_factors(ts_code: str) -> tuple[float | None, float | None]:
    """Return (earliest_adj_factor, latest_adj_factor) for the stock in DB."""
    conn = get_conn()
    earliest = conn.execute(
        """
        SELECT adj_factor FROM adj_factor
        WHERE ts_code = ?
        ORDER BY trade_date ASC
        LIMIT 1
        """,
        [ts_code],
    ).fetchone()
    latest = conn.execute(
        """
        SELECT adj_factor FROM adj_factor
        WHERE ts_code = ?
        ORDER BY trade_date DESC
        LIMIT 1
        """,
        [ts_code],
    ).fetchone()
    return (
        float(earliest[0]) if earliest and earliest[0] is not None else None,
        float(latest[0]) if latest and latest[0] is not None else None,
    )


def upsert_trade_cal(rows: list[tuple[str, int]]) -> int:
    if not rows:
        return 0
    conn = get_conn()
    conn.executemany(
        """
        INSERT OR REPLACE INTO trade_cal (trade_date, is_open)
        VALUES (?, ?)
        """,
        rows,
    )
    return len(rows)


def list_open_trade_dates(start_date: str, end_date: str) -> list[str]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT trade_date FROM trade_cal
        WHERE is_open = 1
          AND trade_date >= ?
          AND trade_date <= ?
        ORDER BY trade_date
        """,
        [start_date, end_date],
    ).fetchall()
    return [str(r[0]) for r in rows]


def upsert_sync_trade_date(
    trade_date: str,
    bar_count: int,
    adj_count: int,
    status: str,
) -> None:
    conn = get_conn()
    conn.execute(
        """
        INSERT OR REPLACE INTO sync_trade_date
          (trade_date, bar_count, adj_count, status, synced_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        [trade_date, bar_count, adj_count, status, _now_iso()],
    )


def list_complete_dates(start_date: str, end_date: str) -> list[str]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT trade_date FROM sync_trade_date
        WHERE status = 'complete'
          AND bar_count > 0
          AND trade_date >= ?
          AND trade_date <= ?
        ORDER BY trade_date
        """,
        [start_date, end_date],
    ).fetchall()
    return [str(r[0]) for r in rows]


def count_complete_days() -> int:
    conn = get_conn()
    row = conn.execute(
        """
        SELECT COUNT(*) FROM sync_trade_date
        WHERE status = 'complete' AND bar_count > 0
        """
    ).fetchone()
    return int(row[0]) if row else 0


def clear_market() -> str:
    conn = get_conn()
    conn.execute("DELETE FROM daily_bar")
    conn.execute("DELETE FROM adj_factor")
    conn.execute("DELETE FROM sync_trade_date")
    conn.execute("DELETE FROM trade_cal")
    conn.execute("DELETE FROM index_daily")
    conn.execute("DELETE FROM margin")
    conn.execute("DELETE FROM stock_limit_status")
    conn.execute("DELETE FROM index_weight")
    conn.execute("DELETE FROM fut_daily")
    return str(resolve_db_path())


def get_coverage(ts_codes: list[str] | None = None) -> dict[str, Any]:
    conn = get_conn()
    complete_days = count_complete_days()

    if ts_codes is None:
        bar_row = conn.execute(
            """
            SELECT COUNT(*), COUNT(DISTINCT ts_code), MIN(trade_date), MAX(trade_date)
            FROM daily_bar
            """
        ).fetchone()
        adj_row = conn.execute("SELECT COUNT(*) FROM adj_factor").fetchone()
        total_bars = int(bar_row[0]) if bar_row else 0
        stock_count = int(bar_row[1]) if bar_row else 0
        min_date = str(bar_row[2]) if bar_row and bar_row[2] is not None else None
        max_date = str(bar_row[3]) if bar_row and bar_row[3] is not None else None
        total_adj = int(adj_row[0]) if adj_row else 0
        return {
            "total_bars": total_bars,
            "total_adj": total_adj,
            "stock_count": stock_count,
            "stocks": [],
            "min_date": min_date,
            "max_date": max_date,
            "complete_days": complete_days,
            "db_path": str(resolve_db_path()),
        }

    if not ts_codes:
        return {
            "total_bars": 0,
            "total_adj": 0,
            "stock_count": 0,
            "stocks": [],
            "min_date": None,
            "max_date": None,
            "complete_days": complete_days,
            "db_path": str(resolve_db_path()),
        }

    placeholders = ", ".join(["?"] * len(ts_codes))
    bar_rows = conn.execute(
        f"""
        SELECT ts_code,
               COUNT(*) AS bar_count,
               MIN(trade_date) AS start_date,
               MAX(trade_date) AS end_date
        FROM daily_bar
        WHERE ts_code IN ({placeholders})
        GROUP BY ts_code
        ORDER BY ts_code
        """,
        ts_codes,
    ).fetchall()
    adj_rows = conn.execute(
        f"""
        SELECT ts_code, COUNT(*) AS adj_count
        FROM adj_factor
        WHERE ts_code IN ({placeholders})
        GROUP BY ts_code
        """,
        ts_codes,
    ).fetchall()

    adj_map = {r[0]: int(r[1]) for r in adj_rows}
    per_stock = []
    total_bars = 0
    total_adj = 0
    min_date: str | None = None
    max_date: str | None = None
    for ts_code, bar_count, start_date, end_date in bar_rows:
        adj_count = adj_map.get(ts_code, 0)
        total_bars += int(bar_count)
        total_adj += adj_count
        if start_date and (min_date is None or str(start_date) < min_date):
            min_date = str(start_date)
        if end_date and (max_date is None or str(end_date) > max_date):
            max_date = str(end_date)
        per_stock.append(
            {
                "ts_code": ts_code,
                "bar_count": int(bar_count),
                "adj_count": adj_count,
                "start_date": start_date,
                "end_date": end_date,
            }
        )

    bar_codes = {p["ts_code"] for p in per_stock}
    for ts_code, adj_count in adj_map.items():
        if ts_code not in bar_codes:
            total_adj += adj_count
            per_stock.append(
                {
                    "ts_code": ts_code,
                    "bar_count": 0,
                    "adj_count": adj_count,
                    "start_date": None,
                    "end_date": None,
                }
            )

    per_stock.sort(key=lambda x: x["ts_code"])
    return {
        "total_bars": total_bars,
        "total_adj": total_adj,
        "stock_count": len(per_stock),
        "stocks": per_stock,
        "min_date": min_date,
        "max_date": max_date,
        "complete_days": complete_days,
        "db_path": str(resolve_db_path()),
    }
