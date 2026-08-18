> 完整说明见：[Sprint7.2 迭代文档](./Sprint7.2迭代文档.md)。来源见 [Sprint7 迭代文档](./Sprint7迭代文档.md) / [Sprint7.1](./Sprint7.1迭代文档.md) 短期改进「Python plot API」。

# Sprint7.2 启动：Python plot API → ChartInput

## 来源

Sprint7 用 Renderer 门外临时生产者编出主图 MA(20) + 副图 MACD；Sprint7.1 打通了按 id 增删 series 与主/副图例。算法仍在 Renderer，与「计算在 Python」未对齐。本轮把 plot 方言与内置指标迁到 worker，去掉临时计算。

## 现状

- `ChartInput` 契约 + TS 校验 + `KlineChart` 通道已落地。
- MA / MACD 仍由 `ohlcvToChartInput.ts` 在 Renderer 计算。
- Python worker 仅有 `data.*`；无 plot API、无 `compute.*`。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | Python `line` / `histogram` / `subplot` / `output` | 内置函数经 plot API 交出合法 `ChartInput` |
| G2 | 内置 MA / MACD 对齐现临时生产者 | 同 id / pane / 参数 / 颜色；选股可见 MA20 + MACD |
| G3 | 去掉 Renderer 临时计算 | 删除 `ohlcvToChartInput`；ChartPage 经 `chart:build` 取数 |

## 已拍板

1. Worker 方法名 `compute.chart_input`（薄同步返回整份 ChartInput；不做 `compute.indicator` 句柄 / 批处理）。
2. Main：`buildChartInput` = `queryOhlcv` + `compute.chart_input`；IPC `chart:build`。
3. ChartPage「MACD」Chip 夹具保留；不做布局 CRUD。

## 本文件不包含

- 布局实例 CRUD、指标弹窗、自定义脚本 exec / 编辑器
- `compute.indicator` result_handle / batch / cancel
- Arrow 传 `series`、改 `ChartInput` Schema 词汇
