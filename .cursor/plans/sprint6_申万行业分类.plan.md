---
name: Sprint6 申万行业分类
overview: 申万 2021 三级行业入库 SQLite；配置页独立同步；图表页弹框选择行业宇宙，主窗格面包屑反向切列表。
todos:
  - id: schema-repo
    content: SQLite sw_industry / sw_industry_member + swIndustryRepository（树、成分、面包屑）
    status: completed
  - id: sync
    content: Python classify 一次 + 31 个 L1 member_all；Main 整表替换并 JOIN stocks
    status: completed
  - id: contract-ipc
    content: 契约 / IPC industry:sync|tree|members|breadcrumb + 配置页「更新行业分类」
    status: completed
  - id: universe-dialog
    content: industry:{index_code} 宇宙 + StockPicker 弹框（全市场/指数/成分股/三级行业树）
    status: completed
  - id: breadcrumb
    content: ChartToolbar 右侧三级面包屑，点击切宇宙并刷新列表
    status: completed
  - id: acceptance
    content: fixture + runV02Sprint6 + acceptance:v02s6 + typecheck
    status: completed
isProject: false
---

# Sprint6 开发计划

## 背景

需求见 [Sprint6需求文档](docs/releases/v0.2/Sprint6/Sprint6需求文档.md)，口径见 [可行性分析](docs/releases/v0.2/Sprint6/Sprint6数据获取可行性分析.md)，迭代骨架见 [Sprint6迭代文档](docs/releases/v0.2/Sprint6/Sprint6迭代文档.md)。

本机已实测（2026-09-12）：

- `index_classify(src='SW2021')` 一次 511 行
- 无筛选 `index_member_all` 截断为 3000，不能当全量
- 按 31 个 L1 循环合计 5902；本地 5562 只股票 100% 覆盖
- 树的 `parent_code` 对齐 `industry_code`，成员的 `l*_code` 对齐 `index_code`

## 目标

1. 两张 SQLite 表入库分类树与当前成分
2. 配置页「更新行业分类」，约 32 次 HTTP，不绑日线回填
3. 本地四步查询：全部分类、层级展开、分类成分、股票反向三级
4. 选择器改弹框，加入三级行业
5. 个股主窗格面包屑，点击切宇宙

## 不做

- 改 `stocks.industry`；运行时打 Tushare
- 申万 `.SI` 当指数行情
- 历史调样、MarketPage、仪表盘板块总览
- 2014 版

## 实现要点

### 分层

同步学 `stocks:sync`：Python 拉 Tushare → 把行返回 Main → 写入 `trading-zone.db`。

查询学 `stocks:list`：Main 读 SQLite。**不要**把树/成员放进 `market.duckdb`，也**不要**为列表筛选再开 `data.query.*`。

### 存储

[`sqlite.ts`](src/main/db/sqlite.ts) 的 `MIGRATION_SQL` 追加两表（`CREATE TABLE IF NOT EXISTS` 对旧库足够）：

```sql
CREATE TABLE IF NOT EXISTS sw_industry (
  index_code    TEXT PRIMARY KEY NOT NULL, -- 801010.SI
  industry_code TEXT NOT NULL UNIQUE,      -- 110000
  parent_code   TEXT NOT NULL,             -- 0 或父 industry_code
  level         TEXT NOT NULL,             -- L1 / L2 / L3
  name          TEXT NOT NULL,
  is_pub        TEXT,
  src           TEXT NOT NULL DEFAULT 'SW2021',
  synced_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sw_industry_member (
  ts_code   TEXT PRIMARY KEY NOT NULL,
  l1_code   TEXT NOT NULL,
  l2_code   TEXT NOT NULL,
  l3_code   TEXT NOT NULL,
  in_date   TEXT,
  synced_at TEXT NOT NULL
);
```

新文件 [`swIndustryRepository.ts`](src/main/db/swIndustryRepository.ts)：

| 方法 | SQL 要点 |
|---|---|
| `replaceTree(rows)` | 事务：`DELETE` + 插入 511 行 |
| `replaceMembers(rows)` | 事务：只留 `ts_code IN stocks`，再整表替换 |
| `listTree()` | 全表，弹框一次加载 |
| `listChildren(parentIndustryCode)` | `parent_code = ?` |
| `listMemberCodes(indexCode)` | 先查节点 `level`，再滤 `l1/l2/l3_code` |
| `getBreadcrumb(tsCode)` | member 三码 join 三次 `sw_industry` |

`stocks.industry` 不动。`market:clear` 不删这两张表。

### 同步

新 handler [`python/worker/handlers/sw_industry_sync.py`](python/worker/handlers/sw_industry_sync.py)，方法名 `data.sync.sw_industry`。

1. `wait_for_tushare_slot` + `index_classify(src='SW2021')`
2. 用返回的 31 个 L1 `index_code` 循环 `index_member_all(l1_code, is_new='Y')`
3. 单次 L1 失败写入 `errors`，其余继续
4. 返回 classify 行 + member 行（含退市），**不要**在 Python 里 JOIN stocks

Main [`applicationService.syncSwIndustry`](src/main/services/applicationService.ts)：

1. `requireToken()`
2. 调 Python
3. `replaceTree` + `replaceMembers`（过滤 `stocksRepository.listAll()` 的 code 集合）
4. 返回 `classify_count`、`member_fetched`、`member_count`、`skipped_not_in_stocks`、`errors`

按钮点击即全量替换。32 次调用很短，不必做「当月 skip」。防呆：按钮 `disabled={busy}`。

禁止：无筛选一次拉取；按 346 个 L3 或按票拉取。

### 契约与 IPC

新类型 [`src/shared/types/swIndustry.ts`](src/shared/types/swIndustry.ts)：

```ts
interface SwIndustryNode {
  index_code: string
  industry_code: string
  parent_code: string
  level: 'L1' | 'L2' | 'L3'
  name: string
  is_pub: string | null
}

interface SwIndustryBreadcrumb {
  ts_code: string
  l1: { index_code: string; name: string }
  l2: { index_code: string; name: string }
  l3: { index_code: string; name: string }
}

interface SwIndustrySyncResult {
  classify_count: number
  member_fetched: number
  member_count: number
  skipped_not_in_stocks: number
  errors: string[]
}
```

| IPC | Main |
|---|---|
| `industry:sync` | `syncSwIndustry()` |
| `industry:tree` | `listTree()` |
| `industry:members` | `listMemberCodes(index_code)` → `{ index_code, con_codes }` |
| `industry:breadcrumb` | `getBreadcrumb(ts_code)` → 对象或 `null` |

Preload 挂 `window.api.industry.*`。Python 侧同步 `models.py` + `contracts/sw_industry.sync.response.json`。

配置页在「更新成分股」旁加「更新行业分类」，busy 标志独立，文案带 `member_count` / `errors`。

### 宇宙

[`chartUniverse.ts`](src/shared/constants/chartUniverse.ts)：

- `ChartUniverseKind` 增加 `'industry'`
- `industryUniverseId(indexCode)` → `industry:801780.SI`
- `parseIndustryIndexCode(universeId)` 对偶于 `parseConstituentsIndexCode`

[`ChartPage.resolvePickerStocks`](src/renderer/src/pages/ChartPage.tsx) 增加分支：解析出 code 后 `window.api.industry.members`，用 `con_codes` 过滤 `listed`。空列表提示「尚无行业数据，请到配置页更新行业分类」。

指数宇宙（`index:market` / `index:broad`）逻辑不变。`.SI` 不进入指数列表，也不走 `index_daily`。

### 选择器弹框

当前 [`StockPicker.tsx`](src/renderer/src/pages/StockPicker.tsx) 顶部是分组 `Select`，选项一长就难加三级树。

- 触发器：仍显示当前宇宙名称（全市场 / 上证50 / 银行 / …）
- 点击打开 `UniversePickerDialog`（或 Popover）
- 区块顺序：全市场 → 指数行情（大盘 / 宽基）→ 成分股（14 只）→ **行业**（树）
- 行业树：`industry:tree` 一次取 511，前端按 `parent_code` 建成 `Map`，L1 默认收起，点开再展 L2/L3
- 点叶子或任意节点都可选中（一级 = 该级全部股票）
- 选中后关弹框，走现有 `onUniverseChange`

不要把 31+134+346 平铺进 `MenuItem`。

### 面包屑

新组件 [`IndustryBreadcrumb.tsx`](src/renderer/src/pages/chart/IndustryBreadcrumb.tsx)，挂在 [`ChartToolbar`](src/renderer/src/pages/chart/ChartToolbar.tsx) **右侧**（主窗格右上）。

- `selectedCode` 变化且标的不是指数时，调 `industry:breadcrumb`
- 渲染 `银行 / 股份制银行Ⅱ / 股份制银行Ⅲ`，每级可点
- 点击 → `onUniverseChange(industryUniverseId(level.index_code))`，与选择器同一条路径（列表变、选中第一只）
- `null` / 指数标的：不渲染，不报错

### fixture 与验收

新 [`runV02Sprint6.ts`](src/main/acceptance/runV02Sprint6.ts)，[`index.ts`](src/main/index.ts) 与 [`package.json`](package.json) 增加 `acceptance:v02s6`（`V02_SPRINT6_ACCEPTANCE=1`）。

查询全在 SQLite，fixture 由 repository 写入即可，不必经 Python：

- 树：至少 L1 银行 `801780.SI` / `480000`，其下 L2、L3 各一；再加一个无关 L1（电子）确认不会串
- 股票：沿用 Sprint5 写法 upsert `000001.SZ` 等
- 成员：`000001.SZ` → 银行三级；另可加一只只属于电子的票

断言：

1. `listTree` 含三级且 L2/L3 的 `parent_code` 等于父 `industry_code`
2. `listChildren('480000')` 只返回银行的二级
3. `listMemberCodes('801780.SI')` 含 `000001.SZ`，不含电子股
4. `getBreadcrumb('000001.SZ')` 三级名称与 code 正确
5. 不在 stocks 里的退市码即使写入也会在 `replaceMembers` 后消失（可选）
6. 有 Token：真同步 `classify_count === 511` 且 `member_count` 等于当前 `stocks.count`（无 Token 则 skip，与 v02s5 相同）

```bash
npm run typecheck
npm run acceptance:v02s6
npm run dev
```

窗内：配置页更新行业分类 → 图表页弹框能展开银行 → 列表只剩银行股 → 点进平安银行看到三级面包屑 → 点「银行」列表回到一级。

## 任务顺序

1. 表 + repository（可先用 fixture 把四步查询测通）
2. Python 同步 + Main 写入 + 配置页按钮
3. 契约 / IPC
4. 宇宙 + 弹框
5. 面包屑
6. 验收 + typecheck + 点验

数据面未绿之前不要改选择器交互，避免 UI 和空表缠在一起。

## 风险

| 风险 | 处理 |
|---|---|
| 无筛选 3000 行当全量 | 代码只走 31 个 L1；验收禁止这种 fixture |
| `parent_code` 误用 `index_code` | repository / 前端建树都用 `industry_code` |
| 同步时 stocks 为空 | 树仍写入；成员为 0；UI 提示先更新股票列表 |
| 弹框信息架构过载 | 行业树独立一区，默认收起；不要和 14 只成分股平铺 |
| 面包屑与选择器各写一套切宇宙 | 只走 `handleUniverseChange` |
| 旧库无新表 | `CREATE TABLE IF NOT EXISTS` |
| 验收污染实盘库 | `--user-data-dir` 隔离，对齐 Sprint5 |
