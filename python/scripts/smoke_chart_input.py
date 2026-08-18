"""Smoke: plot dialect + default_chart produce a valid ChartInput."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from worker.indicators import default_chart, indicator_ma, indicator_macd
from worker.plot import ChartInputValidationError, validate_chart_input


def synth_bars(n: int = 40) -> list[dict]:
    bars: list[dict] = []
    price = 100.0
    for i in range(n):
        day = 1 + i
        # Stay within Jan 2024 for simple YYYYMMDD
        trade_date = f"202401{day:02d}" if day <= 31 else f"202402{day - 31:02d}"
        open_ = price
        close = price + (1.0 if i % 2 == 0 else -0.5)
        high = max(open_, close) + 0.3
        low = min(open_, close) - 0.3
        bars.append(
            {
                "ts_code": "000001.SZ",
                "trade_date": trade_date,
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "vol": 1000.0 + i,
                "amount": 1_000_000.0 + i,
            }
        )
        price = close
    return bars


def main() -> int:
    bars = synth_bars(40)
    chart = default_chart(bars)
    validated = validate_chart_input(chart.model_dump(exclude_none=True))

    panes = sorted({p.pane for p in validated.primitives})
    print(
        "default_chart:",
        f"times={len(validated.timeDomain)}",
        f"ma={len(validated.series['ma20'])}",
        f"dif={len(validated.series['dif'])}",
        f"dea={len(validated.series['dea'])}",
        f"macd={len(validated.series['macd'])}",
        f"panes={panes}",
    )

    ma_only = indicator_ma(bars, 20)
    assert any(p.id == "ma20" for p in ma_only.primitives)
    assert not any(p.pane == "macd" for p in ma_only.primitives)

    macd_only = indicator_macd(bars)
    assert {p.id for p in macd_only.primitives} == {"dif", "dea", "macd"}

    # Reject main-pane histogram
    bad = validated.model_dump(exclude_none=True)
    bad["primitives"].append({"id": "bad_hist", "pane": "main", "kind": "histogram"})
    bad["series"]["bad_hist"] = [{"time": validated.timeDomain[0], "value": 1.0}]
    try:
        validate_chart_input(bad)
        print("FAIL: expected main histogram rejection")
        return 1
    except ChartInputValidationError as exc:
        assert any("histogram on pane main" in issue["message"] for issue in exc.issues)
        print("validate rejects main histogram: ok")

    # Expected point counts match former TS producer for n=40
    assert len(validated.series["ma20"]) == 21
    assert len(validated.series["dif"]) == 15
    assert len(validated.series["dea"]) == 7
    assert len(validated.series["macd"]) == 7
    print("point counts aligned with Sprint7 TS fixture: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
