---
name: Sprint5.2 股指期货基差
overview: 新建 fut_daily 只存 IH/IF/IC/IM 主力收盘；更新数据时拉 Tushare fut_daily；查询 JOIN 已有现货收盘算基差；涨跌家数下方四宫格双窗格展示。
todos:
  - id: schema-constants
    content: 四品种常量 + DuckDB fut_daily 表（ts_code/trade_date/close）及 upsert/clear
    status: completed
  - id: sync
    content: dashboard_sync 按日增量与窗口回填四条主力收盘，复用限流与空窗成功
    status: completed
  - id: query-contract
    content: dashboard_query JOIN 现货算出 basis；同步 TS / Pydantic / JSON Schema
    status: completed
  - id: fixture
    content: seed_dashboard_fixture 写入四品种至少两日主力收盘，保证基差可算且互异
    status: completed
  - id: ui-grid
    content: BasisGrid 2x2 + BasisProductChart 双窗格（曲线 + 直方图标注）
    status: completed
  - id: acceptance
    content: runV02Sprint52 断言顺序、公式、序列长度；挂 typecheck 脚本
    status: completed
isProject: false
---

# Sprint5.2 开发计划

## 背景

对话结论：现货已在 `index_daily`；只看基差时新数据只要主力收盘。另加 IH。看板在涨跌家数下加「基差」四宫格（IH、IF、IC、IM），每格上为期现收盘曲线、下为基差直方图并标值。

产品口径见 [Sprint5.2需求文档](docs/releases/v0.2/Sprint5/Sprint5.2需求文档.md)，迭代骨架见 [Sprint5.2迭代文档](docs/releases/v0.2/Sprint5/Sprint5.2迭代文档.md)。Tushare 已实测：`fut_daily(ts_code='IF.CFX')` 等连续主力可出日线，2000 积分可用；中金所后缀 `.CFX`。

## 目标

1. 新表 `fut_daily`，四码主力 `close`
2. 「更新数据」补期货，不新增按钮
3. `data.query.dashboard` 增加 `basis`（查询期现算，不落基差表）
4. 统计区最下方四宫格双窗格

## 不做

- `IFL*` / `fut_mapping` / `settle` / 年化贴水 / 分钟与实时
- 改涨跌家数选择器、两融、成交额、左侧 K 线
- 图表页期货宇宙

## 实现要点

### 常量

在 [`dashboard.ts`](src/shared/constants/dashboard.ts) 与 [`dashboard_codes.py`](python/worker/dashboard_codes.py) 对齐：

| product | fut_code | spot_code | name |
|---|---|---|---|
| IH | IH.CFX | 000016.SH | 上证50 |
| IF | IF.CFX | 000300.SH | 沪深300 |
| IC | IC.CFX | 000905.SH | 中证500 |
| IM | IM.CFX | 000852.SH | 中证1000 |

现货四码已在 `DASHBOARD_BROAD_INDICES`，回填指数时不必为基差再拉一遍。

### 存储

[`market_db.py`](python/worker/db/market_db.py) `_SCHEMA_SQL` 增加 `fut_daily`。`CREATE TABLE IF NOT EXISTS` 对旧库足够（新表）。提供 `upsert_fut_daily`、`fetch_fut_closes(ts_code, start, end)`、`list_fut_dates` / `latest_fut_trade_date`。[`clear_market`](python/worker/db/market_db.py) 增加 `DELETE FROM fut_daily`。

不要复用 `index_daily`：期货 `amount` 单位是万元，且看板指数查询会扫到陌生码。

### 同步

改 [`dashboard_sync.py`](python/worker/handlers/dashboard_sync.py)：

- **按日**（`sync_dashboard_for_date`）：四码各一次 `fut_daily(ts_code, trade_date)`，或一次 `exchange='CFFEX'` 再过滤四码。空窗当成功。
- **回填**（`dashboard_backfill`）：按码 + `start_date/end_date` 各一次（与指数回填同策略）。门控：目标开市日里四码是否都已有行；缺哪码补哪码。
- 字段只要 `ts_code, trade_date, close`。
- `DashboardBackfillResult` 可加 `fut_count` / `fut_fetched`（可选，便于验收日志）。

沿用 `wait_for_tushare_slot`。Main「更新数据」编排不用改入口，只是 Python 内部多拉期货。

### 查询

[`dashboard_query.py`](python/worker/handlers/dashboard_query.py) 在 breadth 之后：

- 对四个 product 取 `fut_daily.close` 与对应 `index_daily.close`
- 内连接交易日：`basis = fut_close - spot_close`
- 顺序固定 IH → IF → IC → IM
- 窗口 = `parsed.start_date` / `end_date`（Main 默认 `MARKET_SYNC_START`～今天）

### 契约

新增类型，例如：

```ts
interface DashboardBasisPoint {
  trade_date: string
  fut_close: number
  spot_close: number
  basis: number
}

interface DashboardBasisProduct {
  product: 'IH' | 'IF' | 'IC' | 'IM'
  fut_code: string
  spot_code: string
  name: string
  series: DashboardBasisPoint[]
}
```

`DashboardQueryResult.basis: DashboardBasisProduct[]`。同步：

- [`src/shared/types/dashboard.ts`](src/shared/types/dashboard.ts)
- [`python/worker/models.py`](python/worker/models.py)
- [`contracts/dashboard.query.response.json`](contracts/dashboard.query.response.json)

IPC `dashboard:query` 不变。无期货时 `series: []`，不要让整页 query 失败。

### fixture

[`seed_dashboard_fixture`](python/worker/handlers/market_seed.py) 已为全部看板指数写了 `20240102/20240103` 收盘。再写入四条主力收盘，使基差可区分，例如末日：

- IH：现货约 1000+i，主力 = 现货 − 10
- IF：现货 − 20
- IC：现货 + 5
- IM：现货 − 30

两日都写，acceptance 才能断言 `series.length >= 2`。

### UI

新建 [`BasisProductChart.tsx`](src/renderer/src/pages/dashboard/BasisProductChart.tsx)：

- 对齐 [`StatCharts.tsx`](src/renderer/src/pages/dashboard/StatCharts.tsx)：`createChart` + `addPane(false)`，上窗格 stretch 大于下窗格
- 上：两条 `LineSeries`（主力、现货），颜色可复用 `STAT_VALUE_COLOR` / `STAT_CLOSE_COLOR`
- 下：`HistogramSeries`，`basis >= 0` 用 `UP_COLOR`，否则 `DOWN_COLOR`
- 标注：LWC 无原生柱顶文字，用 `createSeriesMarkers`（正 `aboveBar`、负 `belowBar`）或等价 primitive
- 过密：只标可见范围，或最多约 20 个（按步长抽稀）；`crosshair` 仍显示当日基差
- 图例：期指收盘 / 现货收盘（格内标题已有品种名）

新建 [`BasisGrid.tsx`](src/renderer/src/pages/dashboard/BasisGrid.tsx)：2×2。[`StatsPanel.tsx`](src/renderer/src/pages/dashboard/StatsPanel.tsx) 在 `BreadthBlock` **下方**加一块，`minHeight` 给足（建议整块 ≥ 420），随右侧统计区滚动。

`DashboardPage` 查询入参不用为基差新增 state。

### 验收

新增 [`runV02Sprint52.ts`](src/main/acceptance/runV02Sprint52.ts)，[`index.ts`](src/main/index.ts) 与 [`package.json`](package.json) 增加 `acceptance:v02s52`。

断言：

- `basis.length === 4` 且 product 顺序 IH、IF、IC、IM
- 每项 `fut_code` / `spot_code` 正确
- 末日点 `basis === fut_close - spot_close`（允许浮点误差）
- `series.length >= 2`
- 无期货 fixture 时（可选清表）`series` 为空且 query 仍成功

保留 `seed_dashboard_fixture` 后跑，避免破坏 v02s4 / v02s51 的前提下只加字段。

```bash
npm run typecheck
npm run acceptance:v02s52
npm run dev
```

窗内：打开仪表盘 → 右侧滚过涨跌家数 → 基差四宫格；无期货时格空、涨跌家数仍在。有 Token 时「更新数据」后四格应有 2024 起曲线（IM 亦从 20240102 有数）。

## 任务顺序

1. 常量 + 表 + upsert/clear
2. 同步
3. 查询 + 契约
4. fixture
5. UI
6. 验收 + typecheck + 点验

## 风险

| 风险 | 处理 |
|---|---|
| 柱标注在全年日线上重叠 | 可见范围抽稀；需求仍是「正上负下标值」，不是 600 根全打 |
| 用户口述「正=现货升水」与公式相反 | 公式以对话为准：`期货 − 现货`；正柱向上 |
| 旧 DuckDB 无新表 | `init_schema` 的 `CREATE TABLE IF NOT EXISTS` |
| 按日 4 次 HTTP 变慢 | 回填走区间；增量可改当日 CFFEX 一次过滤 |
| 验收污染实盘库 | 承接 5.1；只加 basis 断言，不擦库 |
