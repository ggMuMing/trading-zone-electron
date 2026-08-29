"""Smoke: user-script indicators compose ChartInput (5-line MA example / MACD script)."""

from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from pydantic import ValidationError

from worker.handlers.compute_indicator import compute_indicator
from worker.indicators import Ohlcv, compose, run_script, to_chart_input, try_source
from worker.handlers.try_script import try_script
from worker.plot import ChartInputValidationError, validate_chart_input

EXAMPLE_MA_PATH = _ROOT / "worker" / "indicators" / "examples" / "ma.py"
MA_SOURCE = EXAMPLE_MA_PATH.read_text(encoding="utf-8")

MACD_PARAMS = {
    "fast": 12,
    "slow": 26,
    "signal": 9,
    "difColor": "#f5a623",
    "deaColor": "#4a90d9",
    "difLineWidth": 1,
    "deaLineWidth": 1,
    "histUpColor": "#ef5350",
    "histDownColor": "#26a69a",
}

USER_MACD_SOURCE = """
class UserMACD(Indicator):
    key: ClassVar[str] = "macd"
    title: ClassVar[str] = "MACD"
    fast: int = Field(default=12, ge=1, json_schema_extra={"widget": "int", "title": "快线"})
    slow: int = Field(default=26, ge=1, json_schema_extra={"widget": "int", "title": "慢线"})
    signal: int = Field(default=9, ge=1, json_schema_extra={"widget": "int", "title": "信号"})
    difColor: str = Field(default="#f5a623", min_length=1, json_schema_extra={"widget": "color", "title": "DIF 颜色"})
    deaColor: str = Field(default="#4a90d9", min_length=1, json_schema_extra={"widget": "color", "title": "DEA 颜色"})
    difLineWidth: int = Field(default=1, ge=1, le=4, json_schema_extra={"widget": "lineWidth", "title": "DIF 线宽"})
    deaLineWidth: int = Field(default=1, ge=1, le=4, json_schema_extra={"widget": "lineWidth", "title": "DEA 线宽"})
    histUpColor: str = Field(default="#ef5350", min_length=1, json_schema_extra={"widget": "color", "title": "柱涨颜色"})
    histDownColor: str = Field(default="#26a69a", min_length=1, json_schema_extra={"widget": "color", "title": "柱跌颜色"})

    def compute(self, ohlcv: Ohlcv) -> PlotFragment:
        closes = ohlcv.close
        ema_fast = ema(closes, self.fast)
        ema_slow = ema(closes, self.slow)
        dif = [
            None if fast_v is None or slow_v is None else fast_v - slow_v
            for fast_v, slow_v in zip(ema_fast, ema_slow, strict=True)
        ]
        dif_for_signal = []
        dif_index = []
        for i, value in enumerate(dif):
            if value is not None:
                dif_for_signal.append(value)
                dif_index.append(i)
        signal_on_dif = ema(dif_for_signal, self.signal)
        dea = [None] * len(closes)
        for j, idx in enumerate(dif_index):
            dea[idx] = signal_on_dif[j]
        hist = [
            None if dif_v is None or dea_v is None else (dif_v - dea_v) * 2
            for dif_v, dea_v in zip(dif, dea, strict=True)
        ]
        return subplot(
            "macd",
            line("dif", dif, times=ohlcv.time, color=self.difColor, line_width=self.difLineWidth),
            line("dea", dea, times=ohlcv.time, color=self.deaColor, line_width=self.deaLineWidth),
            histogram("macd", hist, times=ohlcv.time, color_by_sign=(self.histUpColor, self.histDownColor)),
        )


indicator = UserMACD
"""

SKELETON_SOURCE = """class MyIndicator(Indicator):
    key: ClassVar[str] = "custom"
    title: ClassVar[str] = "未命名"

    def compute(self, ohlcv: Ohlcv) -> PlotFragment:
        raise NotImplementedError


indicator = MyIndicator
"""


def synth_bars(n: int = 40) -> list[dict]:
    bars: list[dict] = []
    price = 100.0
    start = date(2024, 1, 1)
    for i in range(n):
        trade_date = (start + timedelta(days=i)).strftime("%Y%m%d")
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


def expect_error(label: str, fn) -> None:
    try:
        fn()
    except (ValueError, ChartInputValidationError, ValidationError) as exc:
        print(f"{label}: ok ({exc})")
        return
    raise AssertionError(f"FAIL: expected error for {label}")


def script_instance(instance_id: str, source: str, params: dict, ref: str = "seed-ma") -> dict:
    return {"id": instance_id, "kind": "script", "ref": ref, "params": dict(params), "source": source}


def main() -> int:
    load_ma = try_script({"source": MA_SOURCE})
    assert load_ma.get("ok") is True, load_ma
    ma_manifest = load_ma.get("manifest") or {}
    assert ma_manifest.get("key") == "ma", load_ma
    assert ma_manifest.get("title") == "均线", load_ma
    field_names = [field["name"] for field in ma_manifest.get("fields", [])]
    assert field_names == [
        "period1",
        "color1",
        "lineWidth1",
        "period2",
        "color2",
        "lineWidth2",
        "period3",
        "color3",
        "lineWidth3",
        "period4",
        "color4",
        "lineWidth4",
        "period5",
        "color5",
        "lineWidth5",
    ], load_ma
    ma_params = ma_manifest.get("defaultParams") or {}
    assert ma_params["period1"] == 5
    assert ma_params["period2"] == 10
    assert ma_params["period3"] == 20
    assert ma_params["period4"] == 60
    assert ma_params["period5"] == 250
    print("try_script load example MA manifest: ok")

    bars = synth_bars(40)
    ma = script_instance("ma", MA_SOURCE, ma_params)
    macd = script_instance("macd", USER_MACD_SOURCE, MACD_PARAMS, ref="user-macd")

    both = compose(bars, [ma, macd])
    validated = validate_chart_input(both.model_dump(exclude_none=True))
    panes = sorted({p.pane for p in validated.primitives})
    print(
        "compose ma+macd scripts:",
        f"times={len(validated.timeDomain)}",
        f"ma5={len(validated.series['ma:ma5'])}",
        f"ma10={len(validated.series['ma:ma10'])}",
        f"ma20={len(validated.series['ma:ma20'])}",
        f"ma60={len(validated.series['ma:ma60'])}",
        f"ma250={len(validated.series['ma:ma250'])}",
        f"dif={len(validated.series['macd:dif'])}",
        f"panes={panes}",
    )
    assert len(validated.series["ma:ma5"]) == 36
    assert len(validated.series["ma:ma10"]) == 31
    assert len(validated.series["ma:ma20"]) == 21
    assert len(validated.series["ma:ma60"]) == 0
    assert len(validated.series["ma:ma250"]) == 0
    assert len(validated.series["macd:dif"]) == 15
    assert panes == ["macd", "main"]
    print("point counts for 5-line MA + script MACD: ok")

    ohlcv = Ohlcv.from_bars(bars)
    ma_fragment = run_script(MA_SOURCE, ohlcv, ma_params)
    assert [item.id for item in ma_fragment.primitives] == ["ma5", "ma10", "ma20", "ma60", "ma250"]
    class_chart = to_chart_input(bars, [("ma", ma_fragment)])
    ma_only = compose(bars, [ma])
    assert class_chart.model_dump(exclude_none=True) == ma_only.model_dump(exclude_none=True)
    print("to_chart_input matches compose MA: ok")

    empty = compose(bars, [])
    assert empty.primitives == []
    assert len(empty.candle) == 40
    assert empty.series == {}
    print("compose empty: ok")

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

    expect_error(
        "builtin kind rejected",
        lambda: compose(
            bars,
            [{"id": "ma", "kind": "builtin", "ref": "ma", "params": dict(ma_params)}],
        ),
    )
    expect_error("duplicate id", lambda: compose(bars, [ma, {**ma, "params": {**ma_params, "period3": 8}}]))
    expect_error(
        "missing id",
        lambda: compose(bars, [{"kind": "script", "ref": "seed-ma", "params": dict(ma_params), "source": MA_SOURCE}]),
    )

    two_ma = compose(
        bars,
        [
            script_instance("inst_a", MA_SOURCE, {**ma_params, "period3": 8}),
            script_instance("inst_b", MA_SOURCE, ma_params),
        ],
    )
    assert "inst_a:ma8" in two_ma.series
    assert "inst_b:ma20" in two_ma.series
    assert {p.pane for p in two_ma.primitives} == {"main"}
    print("compose two MA scripts: ok")

    styled = compose(
        bars,
        [
            script_instance(
                "ma",
                MA_SOURCE,
                {**ma_params, "period3": 8, "color3": "#112233", "lineWidth3": 3},
            )
        ],
    )
    ma8 = next(item for item in styled.primitives if item.id == "ma:ma8")
    assert ma8.style is not None
    assert ma8.style.color == "#112233"
    assert ma8.style.lineWidth == 3
    assert "ma:ma20" not in styled.series
    print("compose MA custom period3: ok")

    long_bars = synth_bars(260)
    long_ma = compose(long_bars, [ma])
    assert len(long_ma.series["ma:ma5"]) == 256
    assert len(long_ma.series["ma:ma10"]) == 251
    assert len(long_ma.series["ma:ma20"]) == 241
    assert len(long_ma.series["ma:ma60"]) == 201
    assert len(long_ma.series["ma:ma250"]) == 11
    print("compose MA 250-day on long bars: ok")

    handler_chart = compute_indicator({"bars": bars, "instances": [ma, macd]})
    assert handler_chart is not None
    assert len(handler_chart["series"]["ma:ma20"]) == 21
    print("compute.indicator bars path: ok")

    expect_error(
        "neither bars nor query",
        lambda: compute_indicator({"instances": [ma]}),
    )
    expect_error(
        "both bars and query",
        lambda: compute_indicator(
            {
                "bars": bars,
                "query": {
                    "ts_code": "000001.SZ",
                    "start_date": "20240101",
                    "end_date": "20240131",
                },
                "instances": [ma],
            }
        ),
    )

    script_fragment = run_script(USER_MACD_SOURCE, ohlcv, dict(MACD_PARAMS))
    assert [item.id for item in script_fragment.primitives] == ["dif", "dea", "macd"]
    assert {item.pane for item in script_fragment.primitives} == {"macd"}
    print("run_script user MACD fragment: ok")

    mixed = to_chart_input(bars, [("ma", ma_fragment), ("macd", script_fragment)])
    assert mixed.model_dump(exclude_none=True) == both.model_dump(exclude_none=True)
    print("to_chart_input merges MA + MACD fragments: ok")

    expect_error(
        "script import os",
        lambda: run_script("import os\nindicator = os\n", ohlcv, {}),
    )
    expect_error(
        "script import worker",
        lambda: run_script("import worker\nindicator = worker\n", ohlcv, {}),
    )
    expect_error(
        "script syntax",
        lambda: run_script("class Broken(\n", ohlcv, {}),
    )

    two_script = compose(bars, [macd, {**macd, "id": "macd2"}])
    assert {p.pane for p in two_script.primitives} == {"macd", "macd2"}
    print("compose two script MACD instances: ok")

    dropped = compose(
        bars,
        [
            ma,
            {
                "id": "broken",
                "kind": "script",
                "ref": "broken",
                "params": {},
                "source": "class Broken(\n",
            },
        ],
    )
    assert {p.id for p in dropped.primitives} == {"ma:ma5", "ma:ma10", "ma:ma20", "ma:ma60", "ma:ma250"}
    assert "broken:dif" not in dropped.series
    print("compose drops failed script: ok")

    load_ok = try_script({"source": SKELETON_SOURCE})
    assert load_ok.get("ok") is True, load_ok
    assert load_ok.get("manifest", {}).get("key") == "custom", load_ok
    assert load_ok.get("manifest", {}).get("fields") == [], load_ok
    print("try_script load skeleton: ok")

    load_macd = try_script({"source": USER_MACD_SOURCE})
    assert load_macd.get("ok") is True, load_macd
    assert load_macd.get("manifest", {}).get("defaultParams") == MACD_PARAMS, load_macd
    print("try_script load user MACD manifest: ok")

    bad_field = try_script(
        {
            "source": (
                "class Broken(Indicator):\n"
                '    key: ClassVar[str] = "x"\n'
                '    title: ClassVar[str] = "x"\n'
                "    period: int = 20\n"
                "    def compute(self, ohlcv: Ohlcv) -> PlotFragment:\n"
                "        raise NotImplementedError\n"
                "indicator = Broken\n"
            )
        }
    )
    assert bad_field.get("ok") is False, bad_field
    print("try_script missing widget field: ok")

    syntax = try_script({"source": "class Broken(\n"})
    assert syntax.get("ok") is False, syntax
    assert syntax.get("line") == 1, syntax
    print("try_script syntax line: ok")

    missing = try_script({"source": "x = 1\n"})
    assert missing.get("ok") is False, missing
    print("try_script missing export: ok")

    unimplemented = try_source(SKELETON_SOURCE, {}, ohlcv)
    assert unimplemented.get("ok") is False, unimplemented
    assert unimplemented.get("line") == 6, unimplemented
    print("try_source NotImplementedError line: ok")

    macd_try = try_source(USER_MACD_SOURCE, dict(MACD_PARAMS), ohlcv)
    assert macd_try.get("ok") is True, macd_try
    print("try_source user MACD: ok")

    ma_try = try_source(MA_SOURCE, ma_params, ohlcv)
    assert ma_try.get("ok") is True, ma_try
    print("try_source example MA: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
