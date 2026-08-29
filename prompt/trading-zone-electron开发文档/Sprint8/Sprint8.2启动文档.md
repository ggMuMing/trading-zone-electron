> 完整说明见：[Sprint8.2 迭代文档](./Sprint8.2迭代文档.md)。来源见 [Sprint8.1 迭代文档](./Sprint8.1迭代文档.md) 第 6.1 节短期目标 1。

# Sprint8.2 启动：选股两跳 worker 合并

## 来源

Sprint7.2 起，图表选股就是 `queryOhlcv` + 计算两跳 Python worker。Sprint8 / 8.1 把第二跳换成 `compute.indicator`，摩擦仍在：同一份 OHLCV 先 Arrow 出 Python、Main 解码成行数组，再 MessagePack JSON 送回去算指标。

## 现状

`ApplicationService.buildChartInput`：

1. `pythonBridge.call('data.query.ohlcv')` → Arrow IPC → Main `decodeOhlcvArrow` → `bars[]`
2. `pythonBridge.call('compute.indicator', { bars, instances })` → `ChartInput`

`data.query.ohlcv` 仍被行情表 `market:query` 与验收脚本使用，不能删。

## 方案结论（已拍板）

**合并图表路径，不在本轮做缓存。**

选股每次都是新窗口，bars 缓存必然 miss；真正的浪费是 bars 两次过桥，不是 DuckDB 再查一次。布局仍由 Main 读 SQLite 后传入；Python 不读布局库。`compute.indicator` 生产入口改为 `query + instances`；保留 `bars + instances` 给 smoke。`data.query.ohlcv` 不动。

不做：Main / Python 的 bars 或 ChartInput 缓存；句柄 / 批处理 / 取消 / 缓存键。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 选股一跳 | `chart:build` 只 `pythonBridge.call` 一次；payload 无 `bars[]` |
| G2 | 行情表不动 | `market:query` 仍走 `data.query.ohlcv`；验收脚本不改语义 |
| G3 | 行为不变 | 无 bar → `null`；instances 仍由 Main 读库；图与 8.1 一致 |

## 本文件不包含

- bars / ChartInput 缓存与失效
- `compute.indicator` 句柄 / 批处理 / 取消 / 缓存键
- 同种指标多条、多套布局、自定义脚本、Arrow 传 `series`
