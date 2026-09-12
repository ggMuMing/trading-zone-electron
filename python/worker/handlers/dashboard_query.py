from __future__ import annotations

from typing import Literal, cast

from worker.dashboard_codes import (
    AMOUNT_QIANYUAN_TO_YI,
    BREADTH_BIN_LABELS,
    DASHBOARD_BASIS_PRODUCTS,
    DASHBOARD_DEFAULT_TS_CODE,
    DASHBOARD_DISPLAY_INDICES,
    DASHBOARD_TURNOVER_CODES,
    DASHBOARD_VOLUME_OVERRIDE,
    YUAN_TO_YI,
)

_BREADTH_UNIVERSE_ALL = "all"
_BREADTH_INDEX_UNIVERSES = frozenset({"000300.SH", "932000.CSI"})
from worker.db import market_db
from worker.models import (
    DashboardBar,
    DashboardBasisPoint,
    DashboardBasisProduct,
    DashboardBreadth,
    DashboardBreadthPoint,
    DashboardIndexQuote,
    DashboardQueryParams,
    DashboardQueryResult,
    DashboardSeriesPoint,
    DashboardStatBlock,
)


def query_dashboard(params: dict) -> DashboardQueryResult:
    parsed = DashboardQueryParams.model_validate(params)
    market_db.init_schema()
    selected = (parsed.ts_code or "").strip() or DASHBOARD_DEFAULT_TS_CODE

    latest_rows = market_db.fetch_latest_index_rows(
        [code for code, _name, _group in DASHBOARD_DISPLAY_INDICES]
        + list(DASHBOARD_VOLUME_OVERRIDE.values())
    )
    latest_by_code = {row["ts_code"]: row for row in latest_rows}

    indices: list[DashboardIndexQuote] = []
    for ts_code, name, group in DASHBOARD_DISPLAY_INDICES:
        row = latest_by_code.get(ts_code)
        vol, amount = _synthesized_volume(ts_code, row, latest_by_code)
        group_name: Literal["market", "broad"] = "market" if group == "market" else "broad"
        indices.append(
            DashboardIndexQuote(
                ts_code=ts_code,
                name=name,
                group=group_name,
                trade_date=None if row is None else str(row["trade_date"]),
                close=None if row is None else row.get("close"),
                pct_chg=None if row is None else row.get("pct_chg"),
                change=None if row is None else row.get("change"),
                vol=vol,
                amount=_scale(amount, AMOUNT_QIANYUAN_TO_YI),
            )
        )

    raw_bars = market_db.fetch_index_bars(selected, parsed.start_date, parsed.end_date)
    override_code = DASHBOARD_VOLUME_OVERRIDE.get(selected)
    override_by_date: dict[str, dict] = {}
    if override_code:
        for row in market_db.fetch_index_bars(override_code, parsed.start_date, parsed.end_date):
            override_by_date[str(row["trade_date"])] = row

    bars: list[DashboardBar] = []
    for row in raw_bars:
        day = str(row["trade_date"])
        source = override_by_date.get(day, row)
        bars.append(
            DashboardBar(
                trade_date=day,
                open=row.get("open"),
                high=row.get("high"),
                low=row.get("low"),
                close=row.get("close"),
                pct_chg=row.get("pct_chg"),
                vol=source.get("vol"),
                amount=source.get("amount"),
            )
        )

    shanghai = {
        str(row["trade_date"]): row.get("close")
        for row in market_db.fetch_index_bars(
            DASHBOARD_DEFAULT_TS_CODE, parsed.start_date, parsed.end_date
        )
    }
    margin_series = _stat_series(
        market_db.fetch_margin_totals(parsed.start_date, parsed.end_date),
        YUAN_TO_YI,
        shanghai,
    )
    turnover_series = _stat_series(
        market_db.fetch_turnover_totals(list(DASHBOARD_TURNOVER_CODES), parsed.start_date, parsed.end_date),
        AMOUNT_QIANYUAN_TO_YI,
        None,
    )

    as_of = market_db.latest_index_trade_date(DASHBOARD_DEFAULT_TS_CODE)
    breadth_date = market_db.latest_limit_trade_date() or as_of
    universe, filter_index_code, constituent_as_of = _resolve_breadth_universe(
        parsed.breadth_universe
    )
    force_empty = universe != _BREADTH_UNIVERSE_ALL and constituent_as_of is None
    if force_empty:
        breadth = _empty_breadth(breadth_date)
    else:
        breadth = _compute_breadth(breadth_date, filter_index_code)
    breadth.universe = universe
    breadth.constituent_as_of = constituent_as_of
    breadth.series = (
        []
        if force_empty
        else [
            DashboardBreadthPoint(
                trade_date=trade_date,
                limit_up_count=limit_up_count,
                limit_down_count=limit_down_count,
            )
            for trade_date, limit_up_count, limit_down_count in market_db.fetch_breadth_limit_series(
                parsed.start_date, parsed.end_date, filter_index_code
            )
        ]
    )

    return DashboardQueryResult(
        as_of=as_of,
        selected_ts_code=selected,
        indices=indices,
        bars=bars,
        margin=_block_from_series(margin_series),
        turnover=_block_from_series(turnover_series),
        breadth=breadth,
        basis=_query_basis(parsed.start_date, parsed.end_date),
    )


def _query_basis(start_date: str, end_date: str) -> list[DashboardBasisProduct]:
    products: list[DashboardBasisProduct] = []
    for meta in DASHBOARD_BASIS_PRODUCTS:
        product_id = cast(Literal["IH", "IF", "IC", "IM"], meta["product"])
        fut_by_date = {
            str(row["trade_date"]): row.get("close")
            for row in market_db.fetch_fut_closes(meta["fut_code"], start_date, end_date)
        }
        spot_by_date = {
            str(row["trade_date"]): row.get("close")
            for row in market_db.fetch_index_bars(meta["spot_code"], start_date, end_date)
        }
        series: list[DashboardBasisPoint] = []
        for trade_date in sorted(set(fut_by_date) & set(spot_by_date)):
            fut_close = fut_by_date[trade_date]
            spot_close = spot_by_date[trade_date]
            if fut_close is None or spot_close is None:
                continue
            series.append(
                DashboardBasisPoint(
                    trade_date=trade_date,
                    fut_close=float(fut_close),
                    spot_close=float(spot_close),
                    basis=float(spot_close) - float(fut_close),
                )
            )
        products.append(
            DashboardBasisProduct(
                product=product_id,
                fut_code=meta["fut_code"],
                spot_code=meta["spot_code"],
                name=meta["name"],
                series=series,
            )
        )
    return products


def _synthesized_volume(
    ts_code: str,
    row: dict | None,
    latest_by_code: dict[str, dict],
) -> tuple[float | None, float | None]:
    if row is None:
        return None, None
    override = DASHBOARD_VOLUME_OVERRIDE.get(ts_code)
    if override:
        source = latest_by_code.get(override)
        if source is not None:
            return source.get("vol"), source.get("amount")
    return row.get("vol"), row.get("amount")


def _scale(value: float | None, divisor: float) -> float | None:
    if value is None:
        return None
    return value / divisor


def _stat_series(
    rows: list[tuple[str, float | None]],
    divisor: float,
    close_by_date: dict[str, float | None] | None,
) -> list[DashboardSeriesPoint]:
    points: list[DashboardSeriesPoint] = []
    prev: float | None = None
    for trade_date, raw in rows:
        value = _scale(raw, divisor)
        change = None if value is None or prev is None else value - prev
        close = None if close_by_date is None else close_by_date.get(trade_date)
        points.append(
            DashboardSeriesPoint(
                trade_date=trade_date,
                value=value,
                change=change,
                close=close,
            )
        )
        if value is not None:
            prev = value
    return points


def _block_from_series(series: list[DashboardSeriesPoint]) -> DashboardStatBlock:
    if not series:
        return DashboardStatBlock()
    last = series[-1]
    return DashboardStatBlock(
        trade_date=last.trade_date,
        value=last.value,
        change=last.change,
        series=series,
    )


def _resolve_breadth_universe(
    raw: str | None,
) -> tuple[str, str | None, str | None]:
    universe = (raw or _BREADTH_UNIVERSE_ALL).strip() or _BREADTH_UNIVERSE_ALL
    if universe == _BREADTH_UNIVERSE_ALL:
        return _BREADTH_UNIVERSE_ALL, None, None
    if universe not in _BREADTH_INDEX_UNIVERSES:
        return _BREADTH_UNIVERSE_ALL, None, None
    constituents = market_db.fetch_latest_constituents(universe)
    as_of = constituents.get("as_of")
    con_codes = constituents.get("con_codes") or []
    if not as_of or not con_codes:
        return universe, None, None
    return universe, universe, str(as_of)


def _empty_breadth(trade_date: str | None) -> DashboardBreadth:
    return DashboardBreadth(trade_date=trade_date, labels=list(BREADTH_BIN_LABELS))


def _compute_breadth(trade_date: str | None, index_code: str | None = None) -> DashboardBreadth:
    empty = DashboardBreadth(labels=list(BREADTH_BIN_LABELS))
    if not trade_date:
        return empty
    rows = market_db.fetch_breadth_rows(trade_date, index_code)
    if not rows:
        return DashboardBreadth(trade_date=trade_date, labels=list(BREADTH_BIN_LABELS))

    up_count = 0
    limit_up_count = 0
    down_count = 0
    limit_down_count = 0
    flat_count = 0
    histogram = [0] * 9

    for _ts_code, pct_chg, _vol, limit_status in rows:
        is_limit_up = limit_status in {2, 3}
        is_limit_down = limit_status in {5, 6}
        if limit_status in {1, 2, 3}:
            up_count += 1
        elif limit_status in {4, 5, 6}:
            down_count += 1
        elif limit_status == 0:
            flat_count += 1
        elif pct_chg is not None:
            if pct_chg > 0:
                up_count += 1
            elif pct_chg < 0:
                down_count += 1
            else:
                flat_count += 1

        if is_limit_up:
            limit_up_count += 1
            histogram[0] += 1
            continue
        if is_limit_down:
            limit_down_count += 1
            histogram[8] += 1
            continue
        if pct_chg is None:
            continue
        if pct_chg == 0 or limit_status == 0:
            histogram[4] += 1
        elif pct_chg >= 5:
            histogram[1] += 1
        elif 1 <= pct_chg < 5:
            histogram[2] += 1
        elif 0 < pct_chg < 1:
            histogram[3] += 1
        elif -1 < pct_chg < 0:
            histogram[5] += 1
        elif -5 < pct_chg <= -1:
            histogram[6] += 1
        elif pct_chg <= -5:
            histogram[7] += 1

    return DashboardBreadth(
        trade_date=trade_date,
        up_count=up_count,
        limit_up_count=limit_up_count,
        down_count=down_count,
        limit_down_count=limit_down_count,
        flat_count=flat_count,
        histogram=histogram,
        labels=list(BREADTH_BIN_LABELS),
    )
