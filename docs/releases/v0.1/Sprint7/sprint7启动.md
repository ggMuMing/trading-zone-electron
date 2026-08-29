> 完整说明见：[Sprint7 迭代文档](./Sprint7迭代文档.md)。来源见 [Sprint7 头脑风暴文档](./Sprint7头脑风暴文档.md)、[Sprint6.1 迭代文档](../Sprint6/Sprint6.1迭代文档.md)。

# Sprint7 启动：ChartInput 契约与主图 MA / 副图 MACD

## 来源

Sprint6 / 6.1 已有图表页：`ChartPage` 查 `OhlcvBar[]`，`KlineChart` 画主图 K 线 + 同 pane 成交量 + 十字光标图例。头脑风暴结论：下一刀先稳定绘图通道入口（`ChartInput`），再用硬编码/门外生产者走通「声明 → 主图线 + 副图三根」。本轮交付要求：选股后图上能看见主图 MA 与副图 MACD。

## 现状

- 通道入口仍是业务行 `OhlcvBar[]`，映射、成交量着色、图例回查都在 `KlineChart` 内。
- 没有 `PlotSpec` / `ChartInput` 契约，没有副图 pane。
- 工具栏「指标」占位，无布局 CRUD、无 Python `compute.indicator`。

## 目标

把 `ChartInput` 写成跨语言契约（JSON Schema + TS + 语义校验），`KlineChart` 只吃已校验的声明；门外临时生产者把当前日线编成主图 MA(20) + 副图 MACD(12,26,9)。选股 / 切复权后图上可见。

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 契约 | `contracts/chart_input.json` + `src/shared/types/chart.ts` + `validateChartInput` |
| G2 | 通道 | `KlineChart` 只吃 `ChartInput`，不再 import `OhlcvBar` |
| G3 | 可见 | 换股 / 切复权后主图 MA、副图 MACD 三根共一 pane；成交量仍压主图底 |

## 已拍板

1. 入口是 `ChartInput`，不是 `OhlcvBar[]`，也不是 Python 源码。
2. 成交量是一等公民（专用 `volume` 槽），位置由通道写死；无 `overlay: "bottom"`；v1 禁止主图 histogram。
3. 主 K 线是一等公民（专用 `candle`），定义 `timeDomain`；`primitives` 只表达叠加与副图。
4. 本轮始终画 MA + MACD；工具栏「指标」仍占位。布局 CRUD 不在本轮。
5. MA / MACD 由 Renderer 门外临时计算（`ohlcvToChartInput`），不进 `KlineChart`，不新增 IPC / Python。
6. 本轮不做 Pydantic；契约以 JSON Schema + TS + 手写语义校验为准。

## 本文件不包含

- 指标弹窗、布局实例 CRUD、脚本编辑器、`compute.indicator`
- Python `line` / `subplot` / Pydantic
- 主图自定义 histogram、多副图、markers、画线
- Arrow 直传 Renderer、增量 `setData` 策略、新的 acceptance 套件
