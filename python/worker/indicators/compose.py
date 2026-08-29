"""Compose script PlotFragments into one ChartInput."""

from __future__ import annotations

import logging
from typing import Any

from worker.indicators.model import Indicator, Ohlcv
from worker.indicators.sandbox import run_script
from worker.plot import ChartInput, PlotFragment, output
from worker.plot.models import PlotPrimitive

logger = logging.getLogger(__name__)


def _prefix_fragment(fragment: PlotFragment, instance_id: str) -> PlotFragment:
    prefix = f"{instance_id}:"
    primitives = [
        PlotPrimitive(
            id=prefix + primitive.id,
            pane=primitive.pane if primitive.pane == "main" else instance_id,
            kind=primitive.kind,
            style=primitive.style,
        )
        for primitive in fragment.primitives
    ]
    series = {prefix + key: points for key, points in fragment.series.items()}
    return PlotFragment(primitives=primitives, series=series)


def to_chart_input(
    bars: list[dict[str, Any]], items: list[tuple[str, Indicator | PlotFragment]]
) -> ChartInput:
    seen: set[str] = set()
    normalized: list[tuple[str, Indicator | PlotFragment]] = []
    for index, item in enumerate(items):
        if not isinstance(item, tuple) or len(item) != 2:
            raise ValueError(f"items[{index}] must be (instance_id, indicator)")
        instance_id, payload = item
        if not isinstance(instance_id, str) or not instance_id:
            raise ValueError(f"items[{index}] instance id must be a non-empty string")
        if not isinstance(payload, (Indicator, PlotFragment)):
            raise ValueError(f"items[{index}] must be an Indicator or PlotFragment")
        if instance_id in seen:
            raise ValueError(f"duplicate id {instance_id}")
        seen.add(instance_id)
        normalized.append((instance_id, payload))

    ohlcv = Ohlcv.from_bars(bars)
    fragments: list[PlotFragment] = []
    for instance_id, payload in normalized:
        if isinstance(payload, PlotFragment):
            fragment = payload
        else:
            fragment = payload.compute(ohlcv)
        fragments.append(_prefix_fragment(fragment, instance_id))
    return output(*fragments, candle=ohlcv.candle, volume=ohlcv.volume_points)


def compose(bars: list[dict[str, Any]], instances: list[dict[str, Any]]) -> ChartInput:
    seen: set[str] = set()
    items: list[tuple[str, Indicator | PlotFragment]] = []
    ohlcv = Ohlcv.from_bars(bars)
    for index, raw in enumerate(instances):
        if not isinstance(raw, dict):
            raise ValueError(f"instances[{index}] must be an object")
        instance_id = raw.get("id")
        kind = raw.get("kind")
        ref = raw.get("ref")
        params = raw.get("params")
        source = raw.get("source")
        if not isinstance(instance_id, str) or not instance_id:
            raise ValueError(f"instances[{index}].id must be a non-empty string")
        if kind != "script":
            raise ValueError(f"instances[{index}].kind must be script")
        if not isinstance(ref, str) or not ref:
            raise ValueError(f"instances[{index}].ref must be a non-empty string")
        if instance_id in seen:
            raise ValueError(f"duplicate id {instance_id}")
        if not isinstance(params, dict):
            raise ValueError(f"instances[{index}].params must be an object")
        seen.add(instance_id)
        if not isinstance(source, str) or not source:
            logger.warning("skip script instance %s: missing source", instance_id)
            continue
        try:
            fragment = run_script(source, ohlcv, params)
        except Exception as exc:
            logger.warning("skip script instance %s: %s", instance_id, exc)
            continue
        items.append((instance_id, fragment))

    return to_chart_input(bars, items)
