"""Load adjusted daily bars for a user strategy. The script itself never touches the database."""

from __future__ import annotations

import duckdb
import pandas as pd

from worker.db import market_db


def _is_db_lock_error(exc: BaseException) -> bool:
    text = str(exc)
    return (
        "Cannot open file" in text
        or "already open" in text.lower()
        or "IO Error" in text
        or "IOException" in type(exc).__name__
    )


def _ensure_market_db() -> None:
    try:
        market_db.init_schema()
        return
    except Exception as exc:
        if not _is_db_lock_error(exc):
            raise
    market_db.close_conn()
    path = market_db.resolve_db_path()
    market_db._conn = duckdb.connect(str(path), read_only=True)


def _apply_adj_factor(
    daily: pd.DataFrame,
    adjust: str,
    earliest: float | None,
    latest: float | None,
) -> pd.DataFrame:
    out = daily.copy()
    adj = out["adj_factor"]
    if adjust == "qfq" and latest not in (None, 0):
        scale = adj / latest
    elif adjust == "hfq" and earliest not in (None, 0):
        scale = adj / earliest
    else:
        scale = pd.Series(1.0, index=out.index)
    scale = scale.fillna(1.0)
    for col in ("open", "high", "low", "close"):
        out[col] = out[col] * scale
    return out


def _trade_date(value: object) -> str:
    text = str(value).replace("-", "")
    digits = "".join(ch for ch in text if ch.isdigit())
    return digits[:8]


def load_strategy_frame(
    ts_code: str,
    start_date: str,
    end_date: str,
    adjust: str,
) -> pd.DataFrame:
    """Same prices as MingSystemVer1.read_data: raw daily bars, then anchor adjustment."""
    columns = ["open", "high", "low", "close", "vol"]
    _ensure_market_db()
    table = market_db.query_ohlcv_arrow(ts_code, start_date, end_date, "none")
    if table.num_rows == 0:
        return pd.DataFrame(columns=columns)
    daily = table.to_pandas()
    if daily.empty or "trade_date" not in daily.columns:
        return pd.DataFrame(columns=columns)
    earliest, latest = market_db.get_anchor_adj_factors(ts_code)
    daily = _apply_adj_factor(daily, adjust, earliest, latest)
    daily["trade_date"] = daily["trade_date"].map(_trade_date)
    daily = daily.set_index("trade_date")
    for column in columns:
        if column not in daily.columns:
            daily[column] = None
    return daily[columns]


def frame_to_bars(frame: pd.DataFrame) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for trade_date, row in frame.iterrows():
        item: dict[str, object] = {"trade_date": str(trade_date)}
        for column in frame.columns:
            value = row[column]
            if value is None or (isinstance(value, float) and value != value):
                item[column] = None
            elif hasattr(value, "item"):
                item[column] = value.item()
            else:
                item[column] = value
        rows.append(item)
    return rows
