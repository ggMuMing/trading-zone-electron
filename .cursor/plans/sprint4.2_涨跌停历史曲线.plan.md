---
name: Sprint4.2 涨跌停历史曲线
overview: 查询层对已入库的 stock_limit_status 按日聚合涨停/跌停家数，在统计格九档直方图下方用双曲线展示；不新拉 Tushare、不改同步、不建日级汇总表。
todos:
  - id: query-series
    content: market_db 增加按日 GROUP BY 涨停/跌停家数；dashboard_query 写入 breadth.series
    status: completed
  - id: contracts
    content: 同步 TS / Pydantic / dashboard.query.response.json 的 breadth.series
    status: completed
  - id: fixture
    content: seed_dashboard_fixture 再写一个交易日的 limit_status，保证序列至少 2 点
    status: completed
  - id: ui-chart
    content: BreadthHistoryChart 双 LineSeries；StatsPanel 放在九档直方图下方
    status: completed
  - id: acceptance
    content: runV02Sprint4 断言 series 长度与末日等于当日涨停/跌停；跑 typecheck
    status: completed
isProject: false
---

# Sprint4.2 开发计划

## 背景

Sprint4 已把 `daily_basic.limit_status` 写入 `stock_limit_status`，查询只对最新一日现算四数 + 九档。两融 / 成交额已按 `start_date`–`end_date` 出 `series`，涨跌停没有。明细在、日汇总不在；本迭代用查询层聚合补序列，不改「更新数据」路径。

产品口径见 [Sprint4.2需求文档](docs/releases/v0.2/Sprint4/Sprint4.2需求文档.md)，迭代骨架见 [Sprint4.2迭代文档](docs/releases/v0.2/Sprint4/Sprint4.2迭代文档.md)。

## 目标

1. `data.query.dashboard` 返回 `breadth.series[{ trade_date, limit_up_count, limit_down_count }]`
2. 统计格：四数 → 九档 → **涨停 / 跌停两条历史曲线**
3. 末日序列点 = 当日四数里的涨停、跌停

## 不做

- 新 Tushare 接口、新明细表、日级汇总表
- 上涨 / 下跌 / 九档历史曲线、盘中实时、个股下钻
- 改同步、改三格布局、隔离验收库

## 实现要点

### 查询

在 [`market_db.py`](python/worker/db/market_db.py) 增加 `fetch_breadth_limit_series(start_date, end_date)`：

- `daily_bar INNER JOIN stock_limit_status`（同 `fetch_breadth_rows`）
- `vol IS NOT NULL AND vol > 0`
- `SUM(limit_status IN (2,3))` / `SUM(limit_status IN (5,6))`
- `GROUP BY trade_date ORDER BY trade_date`

[`dashboard_query.py`](python/worker/handlers/dashboard_query.py) 保持 `_compute_breadth(latest)`，再把序列挂上。窗口用已有 `parsed.start_date` / `end_date`（Main 默认 `MARKET_SYNC_START`～今天）。

不要按日循环 `_compute_breadth`。

### 契约

新增 `DashboardBreadthPoint`，`DashboardBreadth.series` 默认 `[]`。同步：

- [`src/shared/types/dashboard.ts`](src/shared/types/dashboard.ts)
- [`python/worker/models.py`](python/worker/models.py)
- [`contracts/dashboard.query.response.json`](contracts/dashboard.query.response.json)（`breadth` 现为宽松 `object`，至少在类型层写清）

不复用 `DashboardSeriesPoint`。IPC 名不变。

### fixture

[`seed_dashboard_fixture`](python/worker/handlers/market_seed.py) 现在只在 `days[-1]` 写入 10 条涨跌样本。再选 `days[-2]` 写另一组可区分的涨停/跌停家数（例如涨停 2、跌停 1），两日都要有对应 `daily_bar` 且 `vol > 0`。

### UI

新建 [`BreadthHistoryChart.tsx`](src/renderer/src/pages/dashboard/BreadthHistoryChart.tsx)：

- 单 `createChart`，两条 `LineSeries`
- 涨停 `#ef5350`，跌停 `#26a69a`（与现四数颜色一致）
- 图例：色线 +「涨停家数」「跌停家数」（对齐 Sprint4.1）
- 不复用 `AlignedStatChart`（那是余额/成交额 + 变化柱）

[`StatsPanel.tsx`](src/renderer/src/pages/dashboard/StatsPanel.tsx) 的 `BreadthBlock`：直方图下增加该图，给足 `minHeight`，随右侧统计区滚动。

`DashboardPage` 查询入参不用改。

### 验收

在 [`runV02Sprint4.ts`](src/main/acceptance/runV02Sprint4.ts) 增加：

- `series.length >= 2`
- 最后一点 `trade_date === breadth.trade_date`
- 最后一点两个家数 === `limit_up_count` / `limit_down_count`

保留原四数 + 九档断言。有实盘数据时旧断言仍可能炸（已知），本迭代不擦库。

```bash
npm run typecheck
npm run acceptance:v02s4
npm run dev
```

窗内：打开仪表盘 → 右侧滚到涨跌家数 → 直方图下有红绿双曲线；无 `limit_status` 时图空、四数可为 0。

## 任务顺序

1. SQL + 查询挂载 `series`
2. 三端类型
3. fixture 第二日
4. 双曲线 UI
5. 验收断言 + typecheck + 点验

## 风险

| 风险 | 处理 |
|---|---|
| 本机涨跌状态回填不齐，曲线短于两融 | 文档说明；用「更新数据」补缺失日，不改同步 |
| 全窗口 GROUP BY 偏慢 | 先测；慢再考虑日级汇总表（中期） |
| 验收污染实盘库 | 承接 4.1；只加 `series` 断言 |
