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
    timings_ms: MarketSyncDayTimings = Field(default_factory=MarketSyncDayTimings)


class MarketClearResult(BaseModel):
    ok: bool
    db_path: str
