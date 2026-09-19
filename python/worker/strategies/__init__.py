from __future__ import annotations

from worker.strategies.MingSystemVer1 import MingSystemVer1
from worker.strategies.Strategy import StrategyClass

STRATEGY_REGISTRY: dict[str, tuple[type[StrategyClass], str]] = {
    "ming_system_ver1": (MingSystemVer1, "MingSystemVer1"),
}


def list_strategies() -> list[dict[str, str]]:
    return [{"id": strategy_id, "name": name} for strategy_id, (_, name) in STRATEGY_REGISTRY.items()]
