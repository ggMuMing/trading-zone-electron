> 完整说明见：[Sprint7.1 迭代文档](./Sprint7.1迭代文档.md)。来源见 [Sprint7 迭代文档](./Sprint7迭代文档.md) 第 6.1 节短期目标 2 / 3。

# Sprint7.1 启动：通道 series diff + 光标/图例

## 来源

Sprint7 已把绘图入口换成可校验的 `ChartInput`，门外临时生产者固定画主图 MA(20) + 副图 MACD。通道仍只会按已有 `primitive.id` 做 `setData`；光标图例仍只显示主图 OHLC / 量额。短期改进 2、3 是 CRUD 与副图读数的硬门槛；Python plot API（短期目标 1）放到 Sprint7.2。

## 现状

- `KlineChart` 建图时一次性 `addSeries`；`input` 变化只对已有 id `setData`，新 id 跳过、删掉的 id 不卸。
- `PriceLegend` 只读 candle 的 OHLC / VOL / AMT；副图无读数条。
- 工具栏「指标」仍占位。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 按 primitive id 增删 series | 关 MACD → 副图与 dif/dea/macd 消失；再开 → 恢复；换股仍不整表重建为空白 |
| G2 | 光标读出全部 `primitives[].id` | 指向某日可见 MA20；副图条可见 DIF / DEA / MACD；离开回退最新有效值 |

## 已拍板

1. 图例视觉沿用现有浅色 `PriceLegend`；信息结构对齐参考项目主图两行 + 副图一条；禁止 portal 进 LWC 内部 DOM。
2. ChartPage 增加「MACD」显隐开关，仅作通道 diff 验收夹具，不是指标 CRUD。
3. 本轮不做 Python plot API、布局持久化、指标弹窗。

## 本文件不包含

- Python `line` / `histogram` / `subplot` / `output`
- 布局实例 CRUD、脚本编辑器、`compute.indicator`
- 设置 / 删除 / 上下移按钮、portal `findTargetPaneTd`
