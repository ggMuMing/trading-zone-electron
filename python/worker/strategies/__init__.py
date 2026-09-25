from __future__ import annotations

from typing import Any

from worker.strategies.MingSystemVer1 import MingSystemVer1
from worker.strategies.Strategy import StrategyClass

STRATEGY_REGISTRY: dict[str, tuple[type[StrategyClass], str]] = {
    "ming_system_ver1": (MingSystemVer1, "MingSystemVer1"),
}


def list_strategies() -> list[dict[str, Any]]:
    return [
        {
            "id": strategy_id,
            "name": name,
            "parameters": [param.to_dict() for param in cls.parameters],
        }
        for strategy_id, (cls, name) in STRATEGY_REGISTRY.items()
    ]
