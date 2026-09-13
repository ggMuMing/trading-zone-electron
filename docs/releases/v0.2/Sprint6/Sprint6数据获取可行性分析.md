# Sprint6 申万行业数据获取可行性分析

> 状态：准备会产出（已用本机 Token 实测，日期 2026-09-12）
> 关联：[Sprint6 需求文档](./Sprint6需求文档.md)
> 官方入口：[申万行业分类 `index_classify`](https://tushare.pro/document/2?doc_id=181)、[申万行业成分 `index_member_all`](https://tushare.pro/document/2?doc_id=335)

本文只回答需求第 1 节：**分类树和成分映射怎么拉、存在哪、股票反向查行业选哪条路。** 选择器弹框与面包屑交互不在本文展开。

---

## 1. 结论

| 问题 | 结论 |
|---|---|
| 接口能不能用 | **能。** 本机 Token 已调通；门槛 2000 积分，与现有 `index_daily` / `index_weight` 同级 |
| 版本 | **SW2021**。一次 `index_classify(src='SW2021')` 拿到 31 / 134 / 346，共 511 行 |
| 成分怎么拉才完整 | **按 31 个一级分类循环** `index_member_all(l1_code, is_new='Y')`。无筛选一次调用会被截断 |
| 数据放哪 | **`trading-zone.db` 新建两张表**，不要改 `stocks.industry`，也不要运行时打 Tushare |
| 股票反向查行业 | 读本地成员表 `ts_code → l1/l2/l3`，再 join 分类表拿名称 |

推荐同步量：1 次分类 + 31 次成分 ≈ **32 次 HTTP**，限流沿用 `wait_for_tushare_slot`，约数秒。只存最新成分（`is_new='Y'`），不回填历史调入调出。

---

## 2. 本机实测

### 2.1 `index_classify`

| 调用 | 行数 | 结果 |
|---|---|---|
| `src='SW2021'`（不带 level） | **511** | 一次拿全树，L1=31 / L2=134 / L3=346 |
| `level='L1'/'L2'/'L3'` | 31 / 134 / 346 | 与一次全量一致，实现时不必拆三次 |

字段（实测列）：`index_code`, `industry_name`, `level`, `industry_code`, `is_pub`, `parent_code`, `src`。

**必须按两套码建模，不要混用：**

| 字段 | 示例 | 用途 |
|---|---|---|
| `index_code` | `801010.SI` / `850111.SI` | 与 `index_member_all` 的 `l1_code` / `l2_code` / `l3_code` 对齐；选择器 universe id |
| `industry_code` | `110000` / `110100` / `110101` | **树的父子键**。L2/L3 的 `parent_code` 100% 等于父节点 `industry_code` |
| `parent_code` | L1 为 `0`，否则为父级 `industry_code` | 不能拿 `index_code` 当父键——实测 L2.parent ∈ L1.index_code 为 **0%** |

`is_pub` 表示该行业是否发布指数行情。成分数 &lt; 5 的三级行业官方不发行情，但不影响「列表筛选 / 面包屑」；Sprint6 全部入库。

### 2.2 `index_member_all`

| 调用 | 行数 | 是否完整 |
|---|---|---|
| 无 `l*_code`，仅 `is_new='Y'` | **3000**（文档写单次最大 2000，现网已放到 3000） | **不完整。** 31 个一级都出现了，但全市场约 5900 只，缺近一半。看起来像全量，最危险 |
| `l1_code='801080.SI'`（电子） | 528 | 完整（远低于上限） |
| `l1_code='801030.SI'`（基础化工） | 463 | 完整 |
| 31 个 L1 循环合计 | **5902**，`ts_code` 唯一 | 完整 |
| `ts_code='000001.SZ'` | 1 | 平安银行 → 银行 / 股份制银行Ⅱ / 股份制银行Ⅲ |

按 L1 循环时：最大一级是机械设备 `801890.SI` **628** 行，最小美容护理 `801980.SI` **32** 行，全部远低于 3000 上限。无需再按 L2/L3 拆。

其它口径：

- 一只股票当前只属于 **一个** 三级行业（5902 行 = 5902 个 `ts_code`，无交叉）
- 后缀：`.SZ` 3087 / `.SH` 2466 / `.BJ` 349
- 名称含「退市」约 338 只；与本地 `stocks`（5562）对比：**本地股票 100% 能命中**，成员表多出 340 只（基本是退市股）
- `000001.SZ` 的 `stocks.industry` 是扁平值「银行」，与申万三级不是同一套分类

### 2.3 权限与频次

- 两接口均为 **2000 积分门槛**，不消耗积分
- 本机已用于 Sprint4/5 的指数/成分接口，本次同样通过
- 2000 积分档常见上限约 200 次/分钟；本项目限流 400 次/分 + 150ms 间隔，32 次调用无压力

---

## 3. 三种反向查询方案

需求列出的三条路，按桌面端用法（选择器切宇宙、面包屑点击、离线可看）评估：

| 方案 | 可行性 | 建议 |
|---|---|---|
| A. 写入现有 `stocks` 表 | 技术能做，语义错 | **不采用** |
| B. 新建表 | 可行，且与现有分层一致 | **采用** |
| C. 不入库，用时打 Tushare | 接口支持按 `ts_code` 查，但不适合本产品 | **不采用** |

### 3.1 不采用 A：塞进 `stocks`

`stocks.industry` 来自 `stock_basic`，是约 **110 个扁平行业名**（电气设备、元器件、专用机械…），和申万 2021 三级树不是同一套。覆盖写入会丢掉现有字段，也和 `stock_list` 同步互相踩。

即便加 `sw_l1_* / sw_l2_* / sw_l3_*` 列：

- 分类树仍要另存，选择器才能展开 31→134→346
- 成员关系与股票基础资料的更新节奏不同（基础资料跟上市，行业跟调样）
- `stocks` 会变成「身份表 + 关系表」，和 Sprint5 把成分放独立表的做法不一致

面包屑需要的是 **关系**，不是股票主数据的又一个文本列。

### 3.2 采用 B：两张新表，放 `trading-zone.db`

放 SQLite 而不是 `market.duckdb`，因为：

- 这是维度 / 宇宙数据，不是日线时序
- 图表页已经从 Main 读 `stocks`；树、筛选、面包屑都是高频 UI 读，走 IPC + SQLite 即可
- DuckDB 留给 `daily_bar` / `index_weight` 这类行情；行业筛选不必再绕 Python
- 量级可忽略：511 + 约 5562 行（只保留仍在 `stocks` 里的）

建议表结构：

```sql
CREATE TABLE IF NOT EXISTS sw_industry (
  index_code    TEXT PRIMARY KEY NOT NULL, -- 801010.SI
  industry_code TEXT NOT NULL UNIQUE,      -- 110000，父子键
  parent_code   TEXT NOT NULL,             -- 0 或父 industry_code
  level         TEXT NOT NULL,             -- L1 / L2 / L3
  name          TEXT NOT NULL,
  is_pub        TEXT,
  src           TEXT NOT NULL DEFAULT 'SW2021',
  synced_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sw_industry_member (
  ts_code   TEXT PRIMARY KEY NOT NULL,     -- 当前一只股票一行
  l1_code   TEXT NOT NULL,                 -- 801780.SI
  l2_code   TEXT NOT NULL,
  l3_code   TEXT NOT NULL,
  in_date   TEXT,
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sw_industry_parent ON sw_industry(parent_code);
CREATE INDEX IF NOT EXISTS idx_sw_industry_level  ON sw_industry(level);
CREATE INDEX IF NOT EXISTS idx_sw_member_l1       ON sw_industry_member(l1_code);
CREATE INDEX IF NOT EXISTS idx_sw_member_l2       ON sw_industry_member(l2_code);
CREATE INDEX IF NOT EXISTS idx_sw_member_l3       ON sw_industry_member(l3_code);
```

查询约定：

- 树：`sw_industry` 按 `parent_code` 展开
- 列表：`sw_industry_member` 按所选 `l1/l2/l3_code` 滤，再 **INNER JOIN `stocks`**（与 Sprint5 成分股同一口径：保持股票表原序，自动去掉退市）
- 面包屑：`sw_industry_member` 按 `ts_code` 取三个 code，再 join `sw_industry` 取名

成员表不必冗余三级名称；511 行的分类表 join 成本可忽略。名称变更时只更新分类表。

### 3.3 不采用 C：用时打接口

`index_member_all(ts_code=...)` 单票只要 1 次，看起来轻，但：

- 这是 Electron 本地研判客户端，现有股票列表 / 成分股都是「先同步、后离线读」
- 切选择器要一次拿到整级成分（最大一级 628，全市场 5562），运行时拉网既慢又受 3000 行截断约束
- 每点一只股票打一次面包屑，浏览时会打爆限流
- 无网或 Token 失效时第 2 节 UI 直接不可用

按票查询只适合做验收探针，不适合当产品数据面。

---

## 4. 同步策略

与 Sprint5「更新成分股」同一套路：配置页显式同步，不在启动时打 Tushare。

1. 先保证 `stocks` 是新的（可复用现有股票列表同步，或规定本任务必须在其后）
2. `wait_for_tushare_slot()` + `index_classify(src='SW2021')` → 整表替换 `sw_industry`
3. 对 31 个 L1 `index_code` 循环 `index_member_all(l1_code, is_new='Y')`
4. 只 upsert `ts_code IN stocks` 的行；同步结束删掉本次未出现的成员（换行业 / 退市）
5. 记录 `synced_at`；分类树几乎不变，仍与成员一起拉，避免两套版本

不做：

- 不拉 `is_new='N'` 历史进出
- 不按 346 个三级、也不按 5000+ 只股票去打
- 不把无筛选 3000 行结果当全量
- 不把 `.SI` 行业指数写进 `stocks`

失败策略：单次 L1 失败记入 `errors`，已成功的 L1 仍可入库；与 `index_weight` 的「一指数一结果」一致。

---

## 5. 指数和股票能否区分（数据侧）

能，而且必须分开：

| 对象 | 代码空间 | 现有落点 |
|---|---|---|
| A 股 | `.SH` / `.SZ` / `.BJ` | `stocks` + `daily_bar` |
| 宽基 / 大盘指数 | `.SH` / `.SZ` / `.BJ` / `.CSI` | `index_daily` + `index_weight` |
| 申万行业 | `.SI` | 本迭代新表；**不是**股票，也 **尚未** 当指数行情标的 |

`ChartUniverseKind` 已有 `all | index | constituents`。行业应新增第四种宇宙（例如 `industry:801080.SI`），行为对齐「成分股」：列表是股票、K 线走个股日线。不要把行业节点塞进指数行情组，除非后续明确要看申万行业指数 K 线（需另接行情接口，本迭代不做）。

---

## 6. 建议落地顺序（仅数据）

1. SQLite 迁移：`sw_industry` + `sw_industry_member`
2. Python `data.sync.sw_industry`：classify 一次 + 31 个 L1，限流与契约对齐 Sprint5
3. Main repository + 配置页「更新行业分类」按钮（或并入现有更新，但不要绑死日线回填）
4. 查询 API：按层级列成员、按 `ts_code` 取面包屑
5. 验收：511 节点；本地 5562 只股票行业覆盖率 100%；无筛选 3000 行不得当全量 fixture

UI（弹框选择器、面包屑）等数据面稳定后再做。
