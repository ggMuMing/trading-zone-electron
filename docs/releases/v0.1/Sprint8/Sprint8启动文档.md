> 完整说明见：[Sprint8 迭代文档](./Sprint8迭代文档.md)。来源见 [Sprint7.2 迭代文档](../Sprint7/Sprint7.2迭代文档.md) 短期改进「布局实例第一档 CRUD」。后续改参见 [Sprint8.1](./Sprint8.1迭代文档.md)。

# Sprint8 启动：布局实例第一档 CRUD

## 来源

Sprint7.2 已把 MA / MACD 算进 Python，出口为 `ChartInput`。图表仍走写死的 `default_chart`；工具栏「指标」占位；MACD Chip 在 Renderer 剥 pane。本轮把「这张图挂了哪些内置实例」做成可持久化的增删读。

## 现状

- `ChartInput` + `KlineChart` 按 primitive id diff；plot 方言与内置 MA / MACD 已在 worker。
- `compute.chart_input({ bars })` 永远产出 MA20 + MACD。
- SQLite 无布局表；目录未显式化。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 布局落库 | 头表 + 实例表；首次种子 MA+MACD；删光后重启仍为空图 |
| G2 | 同步合成 | `compute.indicator({ bars, instances })` 按布局合并；空数组只出 K 线 + 量 |
| G3 | 工具栏真 CRUD | 「指标」可增删读内置 MA / MACD；去掉 MACD Chip；只留 MA 后重启仍只有 MA |

## 已拍板

1. 目录只读（`contracts/indicator_catalog.json`）；用户 CRUD 只打布局实例。
2. `UNIQUE(layout_id, builtin)`；实例 `id` = 目录 `key`。
3. 同步 `compute.indicator` 替换 `compute.chart_input`；不做 handle / batch / cancel。
4. UI 最小弹窗；不改 `ChartInput` Schema、不改 `KlineChart`。

## 本文件不包含

- 改周期 / 颜色、多套布局、按股票记忆
- 目录表用户 CRUD、自定义脚本、编辑器
- `compute.indicator` 句柄 / 批处理 / 取消
- Arrow 传 `series`、改 `ChartInput` 词汇
