from __future__ import annotations

from typing import Any

import tushare as ts

from worker.models import (
    SwIndustryMemberRow,
    SwIndustryNode,
    SwIndustrySyncParams,
    SwIndustrySyncResult,
)
from worker.rate_limit import wait_for_tushare_slot

CLASSIFY_FIELDS = "index_code,industry_name,level,industry_code,is_pub,parent_code,src"
MEMBER_FIELDS = "l1_code,l2_code,l3_code,ts_code,in_date"
LEVELS = frozenset({"L1", "L2", "L3"})


def _nullable_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    return text


def _required_str(value: object) -> str | None:
    text = _nullable_str(value)
    return text or None


def _map_classify_row(row: Any) -> SwIndustryNode | None:
    index_code = _required_str(getattr(row, "index_code", None))
    industry_code = _required_str(getattr(row, "industry_code", None))
    parent_code = _required_str(getattr(row, "parent_code", None))
    level = _required_str(getattr(row, "level", None))
    name = _required_str(getattr(row, "industry_name", None))
    if not index_code or not industry_code or not parent_code or not name:
        return None
    if level not in LEVELS:
        return None
    return SwIndustryNode(
        index_code=index_code,
        industry_code=industry_code,
        parent_code=parent_code,
        level=level,  # type: ignore[arg-type]
        name=name,
        is_pub=_nullable_str(getattr(row, "is_pub", None)),
        src=_nullable_str(getattr(row, "src", None)) or "SW2021",
    )


def _map_member_row(row: Any) -> SwIndustryMemberRow | None:
    ts_code = _required_str(getattr(row, "ts_code", None))
    l1_code = _required_str(getattr(row, "l1_code", None))
    l2_code = _required_str(getattr(row, "l2_code", None))
    l3_code = _required_str(getattr(row, "l3_code", None))
    if not ts_code or not l1_code or not l2_code or not l3_code:
        return None
    return SwIndustryMemberRow(
        ts_code=ts_code,
        l1_code=l1_code,
        l2_code=l2_code,
        l3_code=l3_code,
        in_date=_nullable_str(getattr(row, "in_date", None)),
    )


def _fetch_classify(pro: Any) -> list[SwIndustryNode]:
    wait_for_tushare_slot()
    df = pro.index_classify(src="SW2021", fields=CLASSIFY_FIELDS)
    if df is None or df.empty:
        return []
    nodes: list[SwIndustryNode] = []
    for row in df.itertuples(index=False):
        mapped = _map_classify_row(row)
        if mapped:
            nodes.append(mapped)
    return nodes


def _fetch_l1_members(pro: Any, l1_code: str) -> list[SwIndustryMemberRow]:
    wait_for_tushare_slot()
    df = pro.index_member_all(l1_code=l1_code, is_new="Y", fields=MEMBER_FIELDS)
    if df is None or df.empty:
        return []
    members: list[SwIndustryMemberRow] = []
    for row in df.itertuples(index=False):
        mapped = _map_member_row(row)
        if mapped:
            members.append(mapped)
    return members


def sync_sw_industry(params: dict) -> SwIndustrySyncResult:
    parsed = SwIndustrySyncParams.model_validate(params)
    pro = ts.pro_api(parsed.token)

    classify = _fetch_classify(pro)
    members: list[SwIndustryMemberRow] = []
    seen: set[str] = set()
    errors: list[str] = []

    for node in classify:
        if node.level != "L1":
            continue
        try:
            rows = _fetch_l1_members(pro, node.index_code)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{node.index_code}: {exc}" if str(exc) else f"{node.index_code} failed")
            continue
        for row in rows:
            if row.ts_code in seen:
                continue
            seen.add(row.ts_code)
            members.append(row)

    return SwIndustrySyncResult(classify=classify, members=members, errors=errors)
