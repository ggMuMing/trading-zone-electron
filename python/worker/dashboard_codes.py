"""Index / dashboard constants. Keep in sync with src/shared/constants/dashboard.ts."""

from __future__ import annotations

DASHBOARD_MARKET_INDICES: list[tuple[str, str]] = [
    ("000001.SH", "上证指数"),
    ("399001.SZ", "深证成指"),
    ("399006.SZ", "创业板指"),
    ("000680.SH", "科创综指"),
    ("899050.BJ", "北证50"),
]

DASHBOARD_BROAD_INDICES: list[tuple[str, str]] = [
    ("000016.SH", "上证50"),
    ("000688.SH", "科创50"),
    ("399673.SZ", "创业板50"),
    ("000300.SH", "沪深300"),
    ("000905.SH", "中证500"),
    ("000852.SH", "中证1000"),
    ("932000.CSI", "中证2000"),
    ("930050.CSI", "中证A50"),
    ("000510.SH", "中证A500"),
]

DASHBOARD_DISPLAY_INDICES: list[tuple[str, str, str]] = [
    *[(code, name, "market") for code, name in DASHBOARD_MARKET_INDICES],
    *[(code, name, "broad") for code, name in DASHBOARD_BROAD_INDICES],
]

DASHBOARD_VOLUME_SOURCE_CODES: tuple[str, ...] = ("399107.SZ", "399102.SZ")

DASHBOARD_VOLUME_OVERRIDE: dict[str, str] = {
    "399001.SZ": "399107.SZ",
    "399006.SZ": "399102.SZ",
}

DASHBOARD_TURNOVER_CODES: tuple[str, ...] = ("000001.SH", "399107.SZ", "899050.BJ")

DASHBOARD_DEFAULT_TS_CODE = "000001.SH"

DASHBOARD_ALL_INDEX_CODES: tuple[str, ...] = tuple(
    [code for code, _name, _group in DASHBOARD_DISPLAY_INDICES] + list(DASHBOARD_VOLUME_SOURCE_CODES)
)

INDEX_NAME_BY_CODE: dict[str, str] = {
    code: name for code, name, _group in DASHBOARD_DISPLAY_INDICES
}

AMOUNT_QIANYUAN_TO_YI = 1e5
YUAN_TO_YI = 1e8

BREADTH_BIN_LABELS: tuple[str, ...] = (
    "涨停",
    "涨停~5%",
    "5%~1%",
    "1%~0%",
    "平盘",
    "0%~-1%",
    "-1%~-5%",
    "-5%~跌停",
    "跌停",
)
