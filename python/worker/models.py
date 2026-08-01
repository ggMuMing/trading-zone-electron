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
