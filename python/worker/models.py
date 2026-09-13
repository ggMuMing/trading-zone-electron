from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class WorkerRequest(BaseModel):
    id: str
    method: str
    params: dict[str, Any] = Field(default_factory=dict)


class WorkerError(BaseModel):
    code: str
    message: str


class WorkerResponse(BaseModel):
    id: str
    ok: bool
    result: Any | None = None
    error: WorkerError | None = None


class ReadyMessage(BaseModel):
    type: Literal["ready"] = "ready"
    imports: dict[str, bool]
    python: str


class StockBasicRow(BaseModel):
    """Aligned with SQLite stocks table (without synced_at; Main fills it)."""

    ts_code: str
    symbol: str
    name: str
    area: str | None = None
    industry: str | None = None
    market: str | None = None
    list_date: str | None = None


class StockListParams(BaseModel):
    token: str = Field(min_length=1)
    exchange: str = ""
    list_status: str = "L"


class StockListResult(BaseModel):
    stocks: list[StockBasicRow]
    count: int


class MarketPoolSyncParams(BaseModel):
    token: str = Field(min_length=1)
    ts_codes: list[str] = Field(min_length=1)
    start_date: str = Field(min_length=8, max_length=8)
    end_date: str = Field(min_length=8, max_length=8)


class MarketPoolSyncError(BaseModel):
    ts_code: str
    stage: str
    message: str


class MarketPoolSyncResult(BaseModel):
    pool_size: int
    bar_count: int
    adj_count: int
    ts_codes: list[str]
    errors: list[MarketPoolSyncError] = Field(default_factory=list)


class MarketQueryParams(BaseModel):
    ts_code: str = Field(min_length=1)
    start_date: str = Field(min_length=8, max_length=8)
    end_date: str = Field(min_length=8, max_length=8)
    adjust: Literal["none", "qfq", "hfq"] = "none"
    limit: int | None = Field(default=None, ge=1)


class MarketQueryResult(BaseModel):
    ts_code: str
    adjust: Literal["none", "qfq", "hfq"]
    count: int
    arrow_ipc: bytes


class MarketCoverageStock(BaseModel):
    ts_code: str
    bar_count: int
    adj_count: int
    start_date: str | None = None
    end_date: str | None = None


class MarketCoverageParams(BaseModel):
    ts_codes: list[str] | None = None


class MarketCoverageResult(BaseModel):
    total_bars: int
    total_adj: int
    stock_count: int
    stocks: list[MarketCoverageStock]
    min_date: str | None = None
    max_date: str | None = None
    complete_days: int = 0
    db_path: str


class MarketSyncPlanParams(BaseModel):
    start_date: str = Field(min_length=8, max_length=8)
    end_date: str = Field(min_length=8, max_length=8)
    token: str | None = None


class MarketSyncPlanResult(BaseModel):
    start_date: str
    end_date: str
    trade_dates: list[str]
    complete_dates: list[str]
    pending_dates: list[str]
    total_days: int
    complete_count: int
    pending_count: int


class MarketSyncDayParams(BaseModel):
    token: str = Field(min_length=1)
    trade_date: str = Field(min_length=8, max_length=8)


class MarketSyncDayTimings(BaseModel):
    wait: int = 0
    daily: int = 0
    upsert_daily: int = 0
    adj: int = 0
    upsert_adj: int = 0


class MarketSyncDayResult(BaseModel):
    trade_date: str
    bar_count: int
    adj_count: int
    status: Literal["complete", "partial"]
    error: str | None = None
    index_count: int = 0
    margin_count: int = 0
    limit_count: int = 0
    timings_ms: MarketSyncDayTimings = Field(default_factory=MarketSyncDayTimings)


class MarketClearResult(BaseModel):
    ok: bool
    db_path: str


class DashboardBackfillParams(BaseModel):
    token: str = Field(min_length=1)
    start_date: str = Field(min_length=8, max_length=8)
    end_date: str = Field(min_length=8, max_length=8)


class DashboardBackfillResult(BaseModel):
    start_date: str
    end_date: str
    index_count: int = 0
    margin_count: int = 0
    limit_count: int = 0
    index_fetched: bool = False
    margin_fetched: bool = False
    limit_days: int = 0
    fut_count: int = 0
    fut_fetched: bool = False
    error: str | None = None


class DashboardQueryParams(BaseModel):
    ts_code: str | None = None
    start_date: str = Field(min_length=8, max_length=8)
    end_date: str = Field(min_length=8, max_length=8)
    breadth_universe: str | None = None


class DashboardIndexQuote(BaseModel):
    ts_code: str
    name: str
    group: Literal["market", "broad"]
    trade_date: str | None = None
    close: float | None = None
    pct_chg: float | None = None
    change: float | None = None
    vol: float | None = None
    amount: float | None = None


class DashboardBar(BaseModel):
    trade_date: str
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None
    pct_chg: float | None = None
    vol: float | None = None
    amount: float | None = None


class DashboardSeriesPoint(BaseModel):
    trade_date: str
    value: float | None = None
    change: float | None = None
    close: float | None = None


class DashboardStatBlock(BaseModel):
    trade_date: str | None = None
    value: float | None = None
    change: float | None = None
    series: list[DashboardSeriesPoint] = Field(default_factory=list)


class DashboardBreadthPoint(BaseModel):
    trade_date: str
    limit_up_count: int = 0
    limit_down_count: int = 0


class DashboardBreadth(BaseModel):
    trade_date: str | None = None
    up_count: int = 0
    limit_up_count: int = 0
    down_count: int = 0
    limit_down_count: int = 0
    flat_count: int = 0
    histogram: list[int] = Field(default_factory=lambda: [0] * 9)
    labels: list[str] = Field(default_factory=list)
    series: list[DashboardBreadthPoint] = Field(default_factory=list)
    universe: str = "all"
    constituent_as_of: str | None = None


class DashboardBasisPoint(BaseModel):
    trade_date: str
    fut_close: float
    spot_close: float
    basis: float


class DashboardBasisProduct(BaseModel):
    product: Literal["IH", "IF", "IC", "IM"]
    fut_code: str
    spot_code: str
    name: str
    series: list[DashboardBasisPoint] = Field(default_factory=list)


class DashboardQueryResult(BaseModel):
    as_of: str | None = None
    selected_ts_code: str
    indices: list[DashboardIndexQuote] = Field(default_factory=list)
    bars: list[DashboardBar] = Field(default_factory=list)
    margin: DashboardStatBlock = Field(default_factory=DashboardStatBlock)
    turnover: DashboardStatBlock = Field(default_factory=DashboardStatBlock)
    breadth: DashboardBreadth = Field(default_factory=DashboardBreadth)
    basis: list[DashboardBasisProduct] = Field(default_factory=list)


class IndexWeightSyncParams(BaseModel):
    token: str = Field(min_length=1)


class IndexWeightSyncResult(BaseModel):
    updated_count: int = 0
    skipped_count: int = 0
    empty_count: int = 0
    as_of_dates: dict[str, str] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)


class IndexConstituentsParams(BaseModel):
    index_code: str = Field(min_length=1)


class IndexConstituentsResult(BaseModel):
    index_code: str
    as_of: str | None = None
    con_codes: list[str] = Field(default_factory=list)


class SwIndustryNode(BaseModel):
    index_code: str
    industry_code: str
    parent_code: str
    level: Literal["L1", "L2", "L3"]
    name: str
    is_pub: str | None = None
    src: str = "SW2021"


class SwIndustryMemberRow(BaseModel):
    ts_code: str
    l1_code: str
    l2_code: str
    l3_code: str
    in_date: str | None = None


class SwIndustrySyncParams(BaseModel):
    token: str = Field(min_length=1)


class SwIndustrySyncResult(BaseModel):
    classify: list[SwIndustryNode] = Field(default_factory=list)
    members: list[SwIndustryMemberRow] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
