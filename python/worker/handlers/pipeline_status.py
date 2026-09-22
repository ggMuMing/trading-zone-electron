"""Each pipeline step answers its own two questions: `initialized` and `fresh`.

There is deliberately no shared "compare this step's end date against the calendar" rule:
step 4 reads the `sync_trade_date` watermark day by day, snapshots compare against the last
closed trade date they were refreshed at, and the full-range steps compare their own right edge.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Callable

from worker.dashboard_codes import (
    DASHBOARD_ALL_INDEX_CODES,
    DASHBOARD_DISPLAY_INDICES,
    DASHBOARD_FUT_CODES,
)
from worker.db import market_db
from worker.models import PipelineStatusParams
from worker.pipeline_steps import (
    DAILY_BAR_DEFAULT_START,
    DAILY_BAR_HISTORY_SEGMENTS,
    LATCHED_STEP_IDS,
    MARKET_CLOSE_HOUR,
    OPTIONAL_STEP_IDS,
    STEP_DAILY_BAR,
    STEP_DELISTED,
    STEP_FUT_DAILY,
    STEP_INDEX_DAILY,
    STEP_INDEX_WEIGHT,
    STEP_MARGIN,
    STEP_ORDER,
    STEP_STOCK_LIST,
    STEP_SW_INDUSTRY,
    STEP_TRADE_CAL,
)

MARGIN_EXCHANGES: tuple[str, ...] = ("SSE", "SZSE")


def resolve_last_closed_trade_date(now: datetime | None = None) -> str | None:
    """Most recent open day whose session is over. Inside trading hours today does not count."""
    moment = now or datetime.now()
    bound = moment.strftime("%Y%m%d")
    if moment.hour < MARKET_CLOSE_HOUR:
        bound = (moment.date() - timedelta(days=1)).strftime("%Y%m%d")
    return market_db.last_open_trade_date_on_or_before(bound)


class _Context:
    def __init__(self, params: PipelineStatusParams) -> None:
        self.params = params
        self.last_closed = resolve_last_closed_trade_date()
        self.resolved: dict[str, dict[str, Any]] = {}

    def state(self, step_id: str) -> dict[str, Any] | None:
        return market_db.get_step_state(step_id)


def _result(
    initialized: bool,
    fresh: bool,
    coverage_start: str | None = None,
    coverage_end: str | None = None,
    detail: str | None = None,
) -> dict[str, Any]:
    return {
        "initialized": initialized,
        "fresh": fresh,
        "coverage_start": coverage_start,
        "coverage_end": coverage_end,
        "detail": detail,
    }


def _snapshot_fresh(ctx: _Context, step_id: str, initialized: bool) -> bool:
    """Snapshots are fresh while the closed trade date they were pulled at is still the latest."""
    if not initialized or ctx.last_closed is None:
        return False
    state = ctx.state(step_id)
    return bool(state and state["last_sync_date"] == ctx.last_closed)


def _bounds_union(bounds: dict[str, tuple[str, str]]) -> tuple[str | None, str | None]:
    if not bounds:
        return None, None
    starts = [value[0] for value in bounds.values()]
    ends = [value[1] for value in bounds.values()]
    return min(starts), max(ends)


def _eval_trade_cal(ctx: _Context) -> dict[str, Any]:
    min_date, max_date, open_days = market_db.trade_cal_bounds()
    initialized = open_days > 0
    fresh = _snapshot_fresh(ctx, STEP_TRADE_CAL, initialized)
    detail = f"开市日 {open_days} 天" if initialized else None
    return _result(initialized, fresh, min_date, max_date, detail)


def _eval_right_edge_codes(
    ctx: _Context,
    bounds: dict[str, tuple[str, str]],
    codes: list[str],
    noun: str,
) -> dict[str, Any]:
    """Full-range steps: no watermark table, right edge must reach the last closed day."""
    coverage_start, coverage_end = _bounds_union(bounds)
    missing = [code for code in codes if code not in bounds]
    lagging = [
        code
        for code in codes
        if code in bounds and ctx.last_closed is not None and bounds[code][1] < ctx.last_closed
    ]
    fresh = ctx.last_closed is not None and not missing and not lagging
    parts = [f"{noun} {len(bounds)}/{len(codes)}"]
    if missing:
        parts.append(f"缺 {len(missing)} 个")
    if lagging:
        parts.append(f"滞后 {len(lagging)} 个")
    return _result(False, fresh, coverage_start, coverage_end, "，".join(parts))


def _eval_index_daily(ctx: _Context) -> dict[str, Any]:
    codes = list(DASHBOARD_ALL_INDEX_CODES)
    return _eval_right_edge_codes(ctx, market_db.index_daily_bounds(codes), codes, "指数")


def _eval_fut_daily(ctx: _Context) -> dict[str, Any]:
    codes = list(DASHBOARD_FUT_CODES)
    return _eval_right_edge_codes(ctx, market_db.fut_daily_bounds(codes), codes, "合约")


def _eval_margin(ctx: _Context) -> dict[str, Any]:
    bounds = market_db.margin_bounds_by_exchange()
    coverage_start, coverage_end = _bounds_union(bounds)
    ends = [bounds[code][1] for code in MARGIN_EXCHANGES if code in bounds]
    fresh = False
    detail = None
    if len(ends) < len(MARGIN_EXCHANGES):
        detail = f"两市 {len(ends)}/{len(MARGIN_EXCHANGES)}"
    else:
        detail = f"沪 {bounds['SSE'][1]} / 深 {bounds['SZSE'][1]}"
        if ctx.last_closed is not None:
            # The two exchanges publish at different times; one open day of slack, but they
            # must land on the same date before the step counts as aligned.
            tolerance = market_db.previous_open_trade_date(ctx.last_closed) or ctx.last_closed
            fresh = ends[0] == ends[1] and min(ends) >= tolerance
    return _result(False, fresh, coverage_start, coverage_end, detail)


def _eval_daily_bar(ctx: _Context) -> dict[str, Any]:
    """Only the watermark answers this. `MAX(trade_date)` on daily_bar must never stand in."""
    if ctx.last_closed is None:
        return _result(False, False)
    open_dates = market_db.list_open_trade_dates(DAILY_BAR_DEFAULT_START, ctx.last_closed)
    complete = set(market_db.list_complete_dates(DAILY_BAR_DEFAULT_START, ctx.last_closed))
    missing = [day for day in open_dates if day not in complete]
    fresh = bool(open_dates) and not missing
    cov_start, cov_end, cov_count = market_db.complete_date_bounds(
        DAILY_BAR_DEFAULT_START, ctx.last_closed
    )
    detail = f"水位 {cov_count}/{len(open_dates)} 个开市日"
    if missing:
        detail = f"{detail}，缺 {len(missing)} 天"
    return _result(False, fresh, cov_start, cov_end, detail)


def _eval_daily_bar_closed_interval(start: str, end: str) -> Callable[[_Context], dict[str, Any]]:
    """Closed interval: once every open day inside it is complete it never goes stale again."""

    def evaluator(ctx: _Context) -> dict[str, Any]:
        open_dates = market_db.list_open_trade_dates(start, end)
        complete = set(market_db.list_complete_dates(start, end))
        missing = [day for day in open_dates if day not in complete]
        done = bool(open_dates) and not missing
        cov_start, cov_end, cov_count = market_db.complete_date_bounds(start, end)
        detail = f"水位 {cov_count}/{len(open_dates)} 个开市日"
        if missing:
            detail = f"{detail}，缺 {len(missing)} 天"
        return _result(done, done, cov_start, cov_end, detail)

    return evaluator


def _eval_stock_list(ctx: _Context) -> dict[str, Any]:
    initialized = ctx.params.stock_count > 0
    fresh = _snapshot_fresh(ctx, STEP_STOCK_LIST, initialized)
    detail = f"在市 {ctx.params.stock_count} 只" if initialized else None
    return _result(initialized, fresh, None, None, detail)


def _eval_sw_industry(ctx: _Context) -> dict[str, Any]:
    initialized = ctx.params.industry_count > 0
    fresh = _snapshot_fresh(ctx, STEP_SW_INDUSTRY, initialized)
    detail = f"分类 {ctx.params.industry_count} 个" if initialized else None
    return _result(initialized, fresh, None, None, detail)


def _eval_index_weight(ctx: _Context) -> dict[str, Any]:
    codes = [code for code, _name, _group in DASHBOARD_DISPLAY_INDICES]
    bounds = market_db.index_weight_bounds_by_index(codes)
    coverage_start, coverage_end = _bounds_union(bounds)
    initialized = bool(bounds)
    today = datetime.now().date()
    prev_year, prev_month = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
    prev_yyyymm = f"{prev_year:04d}{prev_month:02d}"
    # Indices the account cannot fetch would otherwise pin the step stale forever; judge what we have.
    fresh = initialized and all(end[:6] >= prev_yyyymm for _start, end in bounds.values())
    detail = f"快照 {len(bounds)}/{len(codes)} 个指数"
    return _result(initialized, fresh, coverage_start, coverage_end, detail)


def _eval_delisted(ctx: _Context) -> dict[str, Any]:
    """Derived: never compared against the calendar, it follows whichever parent lags."""
    stock_list = ctx.resolved[STEP_STOCK_LIST]
    daily_bar = ctx.resolved[STEP_DAILY_BAR]
    initialized = stock_list["initialized"] and daily_bar["initialized"]
    fresh = stock_list["fresh"] and daily_bar["fresh"]
    detail = f"退市 {ctx.params.delisted_count} 只" if initialized else None
    return _result(initialized, fresh, None, None, detail)


_EVALUATORS: dict[str, Callable[[_Context], dict[str, Any]]] = {
    STEP_TRADE_CAL: _eval_trade_cal,
    STEP_INDEX_DAILY: _eval_index_daily,
    STEP_STOCK_LIST: _eval_stock_list,
    STEP_DAILY_BAR: _eval_daily_bar,
    STEP_DELISTED: _eval_delisted,
    STEP_INDEX_WEIGHT: _eval_index_weight,
    STEP_SW_INDUSTRY: _eval_sw_industry,
    STEP_FUT_DAILY: _eval_fut_daily,
    STEP_MARGIN: _eval_margin,
}
for _hist in DAILY_BAR_HISTORY_SEGMENTS:
    _EVALUATORS[_hist.step_id] = _eval_daily_bar_closed_interval(_hist.start, _hist.end)


def _apply_latch(ctx: _Context, step_id: str, evaluated: dict[str, Any]) -> bool:
    """Latched steps become initialized the first time they read fresh — including old DBs."""
    if step_id not in LATCHED_STEP_IDS:
        return evaluated["initialized"]
    state = ctx.state(step_id)
    latched = bool(state and state["initialized"])
    if evaluated["fresh"] and not latched:
        market_db.set_step_initialized(step_id)
        latched = True
    return latched


def _status_of(initialized: bool, fresh: bool) -> str:
    if not initialized:
        return "not_started"
    return "fresh" if fresh else "stale"


def pipeline_status(params: dict) -> dict[str, Any]:
    parsed = PipelineStatusParams.model_validate(params or {})
    market_db.init_schema()
    ctx = _Context(parsed)

    steps: list[dict[str, Any]] = []
    for step_id in STEP_ORDER:
        evaluated = _EVALUATORS[step_id](ctx)
        initialized = _apply_latch(ctx, step_id, evaluated)
        resolved = {**evaluated, "initialized": initialized}
        ctx.resolved[step_id] = resolved
        steps.append(
            {
                "id": step_id,
                "required": step_id not in OPTIONAL_STEP_IDS,
                "status": _status_of(initialized, resolved["fresh"]),
                "initialized": initialized,
                "fresh": resolved["fresh"],
                "coverage_start": resolved["coverage_start"],
                "coverage_end": resolved["coverage_end"],
                "detail": resolved["detail"],
                "error": None,
            }
        )

    required = [step for step in steps if step["required"]]
    if any(not step["initialized"] for step in required):
        global_state = "init"
    elif any(not step["fresh"] for step in required):
        global_state = "stale"
    else:
        global_state = "fresh"

    return {
        "global": global_state,
        "last_closed_trade_date": ctx.last_closed,
        "calendar_error": None,
        "steps": steps,
    }


def mark_step(params: dict) -> dict[str, Any]:
    """Main calls this after a snapshot step succeeds, pinning it to the current closed day."""
    step_id = str((params or {}).get("step_id") or "").strip()
    if step_id not in STEP_ORDER:
        raise ValueError(f"unknown step_id: {step_id}")
    market_db.init_schema()
    last_sync_date = (params or {}).get("last_sync_date")
    resolved = str(last_sync_date) if last_sync_date else resolve_last_closed_trade_date()
    market_db.set_step_synced(step_id, resolved)
    return {"step_id": step_id, "last_sync_date": resolved}
