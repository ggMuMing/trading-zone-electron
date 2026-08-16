> 完整说明见：[Sprint5.1 迭代文档](./Sprint5.1迭代文档.md)。来源备忘见 [Sprint5 迭代文档](./Sprint5迭代文档.md) 第 6.1 节。

# Sprint5.1 启动：行情页全量股票列表

## 来源

Sprint5 启动文档「行情页面」第一条：当前只显示 10 支股票，要求全量显示。迭代会上确认：**挪到 5.1，不进 Sprint5。**

## 现状

- 行情页左侧读 SQLite `market_pool`，由 `MARKET_POOL_SIZE = 10` 与 `ensureMarketPool()` 填入股票列表前 10 支。
- 全量代码/名称已在 SQLite `stocks`（配置页板块统计即全表）。
- DuckDB 已按日拉全市场日线；限制只在 UI 选股列表，不在行情覆盖。

## 目标（5.1 再拆）

- 左侧改为全量 `stocks`，不再只展示 10 支池子。
- 约 5000 只：需要虚拟列表，以及代码/名称过滤，否则不可用。
- 保留 `market_pool` 与 Sprint2 `data.sync.market_pool` 验收路径，不要为了全量列表删池子协议。

## 本文件不包含

- 日线字段对齐、可选列、排序分页（Sprint5）。
- 同步取消、限流可配。
