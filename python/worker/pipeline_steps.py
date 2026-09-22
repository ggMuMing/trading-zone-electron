"""Pipeline step ids and fixed windows. Keep in sync with src/shared/constants/pipeline.ts."""

from __future__ import annotations

from dataclasses import dataclass

STEP_TRADE_CAL = "trade_cal"
STEP_INDEX_DAILY = "index_daily"
STEP_STOCK_LIST = "stock_list"
STEP_DAILY_BAR = "daily_bar"
STEP_DELISTED = "delisted"
STEP_INDEX_WEIGHT = "index_weight"
STEP_SW_INDUSTRY = "sw_industry"
STEP_FUT_DAILY = "fut_daily"
STEP_MARGIN = "margin"

#: Outer bound for 全量拉取; per-instrument left edges come from their own first bar.
FULL_RANGE_START = "20000101"
#: 股票日线默认段左端。更早历史用 3 年闭区间子步，共用 sync_trade_date 水位。
DAILY_BAR_DEFAULT_START = "20240101"
DAILY_BAR_HISTORY_EARLIEST = "20000101"
DAILY_BAR_HISTORY_BLOCK_YEARS = 3


@dataclass(frozen=True)
class DailyBarHistorySegment:
    step_id: str
    start: str
    end: str
    sub_ordinal: int


def _build_daily_bar_history_segments() -> tuple[DailyBarHistorySegment, ...]:
    segments: list[DailyBarHistorySegment] = []
    exclusive_end = DAILY_BAR_DEFAULT_START
    sub_ordinal = 1

    while exclusive_end > DAILY_BAR_HISTORY_EARLIEST:
        exclusive_year = int(exclusive_end[:4])
        start_year = exclusive_year - DAILY_BAR_HISTORY_BLOCK_YEARS
        if start_year < 2000:
            start = DAILY_BAR_HISTORY_EARLIEST
            start_year = 2000
        else:
            start = f"{start_year:04d}0101"
        end_year = exclusive_year - 1
        end = f"{end_year:04d}1231"
        segments.append(
            DailyBarHistorySegment(
                step_id=f"daily_bar_hist_{start_year}",
                start=start,
                end=end,
                sub_ordinal=sub_ordinal,
            )
        )
        sub_ordinal += 1
        if start == DAILY_BAR_HISTORY_EARLIEST:
            break
        exclusive_end = start

    return tuple(segments)


DAILY_BAR_HISTORY_SEGMENTS: tuple[DailyBarHistorySegment, ...] = _build_daily_bar_history_segments()
DAILY_BAR_HISTORY_BY_ID: dict[str, DailyBarHistorySegment] = {
    seg.step_id: seg for seg in DAILY_BAR_HISTORY_SEGMENTS
}

# Order matters: the required pipeline runs top to bottom.
STEP_ORDER: tuple[str, ...] = (
    STEP_TRADE_CAL,
    STEP_INDEX_DAILY,
    STEP_STOCK_LIST,
    STEP_DAILY_BAR,
    *(seg.step_id for seg in DAILY_BAR_HISTORY_SEGMENTS),
    STEP_DELISTED,
    STEP_INDEX_WEIGHT,
    STEP_SW_INDUSTRY,
    STEP_FUT_DAILY,
    STEP_MARGIN,
)

OPTIONAL_STEP_IDS: frozenset[str] = frozenset(seg.step_id for seg in DAILY_BAR_HISTORY_SEGMENTS)

#: Steps whose `initialized` is a one-way latch set the first time `fresh` holds.
LATCHED_STEP_IDS: frozenset[str] = frozenset(
    {STEP_INDEX_DAILY, STEP_DAILY_BAR, STEP_FUT_DAILY, STEP_MARGIN}
)

#: A股 15:00 收盘，行情落库要更晚；在此之前不把「今天」算成已收盘开市日。
MARKET_CLOSE_HOUR = 17


def is_daily_bar_history_step_id(step_id: str) -> bool:
    return step_id.startswith("daily_bar_hist_")
