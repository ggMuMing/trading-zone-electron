# Sprint4 tushare 目标数据接口文档

> 状态：准备会产出（已用本机 Token 实测，日期以 2025-09-05 / 2025-09-08 为准）
> 关联：[Sprint4 需求文档](./Sprint4需求文档.md)
> 官方入口：[指数日线](https://tushare.pro/document/2?doc_id=95)、[指数基本信息](https://tushare.pro/document/2?doc_id=94)、[两融汇总](https://tushare.pro/document/2?doc_id=58)、[每日指标](https://tushare.pro/document/2?doc_id=32)、[涨跌停价](https://tushare.pro/document/2?doc_id=183)

本文只回答准备会目标：**Sprint4 要入库的四类数据，分别走哪条 Tushare 接口、用哪个 `ts_code`、字段和口径怎么对齐看板。** 不涉及页面布局实现。

---

## 1. 结论总表

| 需求 | 主接口 | 调用方式 | 本机权限 | 入库建议 |
|---|---|---|---|---|
| 大盘 / 宽基指数日线（OHLCV） | `index_daily` | **必须**带 `ts_code`，按指数循环；可再加 `trade_date` 或 `start_date/end_date` | 通过 | 新表或与日线分表，**不要**写入现有股票 `daily_bar`（无复权、代码空间不同） |
| 深证成指 / 创业板指的「全市场成交量」 | 仍用 `index_daily`，换代码 | 成指价格用自身代码；成交用 `399107.SZ` / `399102.SZ` | 通过 | 两个成交量源指数也要入库 |
| 两融余额 | `margin` | 按 `trade_date` 一次拿沪/深/北三所；或 `start_date/end_date` 批量 | 通过 | 按交易所分行入库，看板再 `sum(rzrqye)` |
| 每日涨跌停 + 涨跌家数 + 涨跌分布 | **不新拉涨跌停列表** | 上涨/下跌/平盘、分布直方图：已有 `daily` / `daily_bar.pct_chg`；涨停/跌停：`daily_basic.limit_status`（推荐）或 `stk_limit` + 收盘价 | `daily` / `daily_basic` / `stk_limit` 通过；`limit_list_d` **无权限**（需 5000 积分） | 推荐按日入库 `limit_status`（或日级统计表） |
| 沪深京三市总成交额 | **不必新接口** | `000001.SH.amount + 399107.SZ.amount + 899050.BJ.amount`；或对已入库 `daily_bar` 按后缀汇总 | 通过 | 查询期聚合即可 |

现有股票同步仍走 `pro.daily` + `pro.adj_factor`（`python/worker/handlers/market_day.py`），Sprint4 在同一「按交易日循环」上追加指数、两融、涨跌状态即可。

---

## 2. 指数代码清单（`index_basic` 实测）

`index_daily` 的 `ts_code` **必须带后缀**。下列代码均已 `index_basic(symbol=...)` 核对，并用 `index_daily(start_date=20250801, end_date=20250908)` 拉到 27 根日线。

### 2.1 大盘指数（看板列表 + K 线）

| 展示名 | 需求代码 | Tushare `ts_code` | market | 价格 / 涨跌 | 成交量 / 成交额 | 说明 |
|---|---|---|---|---|---|---|
| 上证指数 | 000001 | `000001.SH` | SSE | 自身 | 自身 | 成交口径接近沪市全部 A 股（含科创板） |
| 深证成指 | 399001 | `399001.SZ` | SZSE | 自身 | **改用 `399107.SZ` 深圳 A 指** | 成指仅 500 成分股；与需求、Tushare 官方说明一致 |
| 创业板指 | 399006 | `399006.SZ` | SZSE | 自身 | **改用 `399102.SZ` 创业板综** | 成指仅 100 成分股 |
| 科创综指 | 000680 | `000680.SH` | SSE | 自身 | 自身 | 综指，成交即科创板整体；`000680.CSI` 为空。2025-01-20 起才有行情 |
| 北证 50 | 899050 | `899050.BJ` | BSE | 自身 | 自身 | `899050.SH` / `.CSI` 为空。2025-09-05 的 `amount` **等于**当日全部 `.BJ` 个股 `daily.amount` 之和 |

### 2.2 成交量替换源（不进大盘列表，但必须入库）

| 用途 | `ts_code` | 名称 | 实测 |
|---|---|---|---|
| 深市全 A 成交，替换深证成指 vol/amount | `399107.SZ` | 深证 A 指 | 2025-09-05 `amount` 与全部 `.SZ` 个股日线成交额之和一致 |
| 创业板全市场成交，替换创业板指 vol/amount | `399102.SZ` | 创业板综 | 有完整 OHLCV |

### 2.3 宽基指数

| 展示名 | 需求代码 | Tushare `ts_code` | 备注 |
|---|---|---|---|
| 上证 50 | 000016 | `000016.SH` | |
| 科创 50 | 000688 | `000688.SH` | |
| 创业板 50 | 399673 | `399673.SZ` | |
| 沪深 300 | 000300 | `000300.SH` | `399300.SZ` 行情数值相同，统一用 `.SH`；`000300.CSI` 为空 |
| 中证 500 | 000905 | `000905.SH` | `000905.CSI` 为空 |
| 中证 1000 | 000852 | `000852.SH` | `000852.CSI` 为空 |
| 中证 2000 | 932000 | `932000.CSI` | `932000.SH` 为空 |
| 中证 A50 | 930050 | `930050.CSI` | `930050.SH` 为空 |
| 中证 A500 | 000510 | `000510.SH` | `000510.CSI` 为空 |

后缀规则：交易所指数用 `.SH` / `.SZ` / `.BJ`；仅中证 2000、中证 A50 用 `.CSI`。不要用裸代码。

**入库指数全集（16 只）：** 上表大盘 5 + 成交源 2 + 宽基 9。

---

## 3. 接口明细

### 3.1 指数基本信息 `index_basic`

- 文档：https://tushare.pro/document/2?doc_id=94
- 用途：确认 `symbol → ts_code`，本迭代拉一次即可，不必每日同步。
- 入参：`symbol`（可多值逗号分隔）或 `ts_code` / `market`。
- 关键出参：`ts_code`, `name`, `market`, `publisher`, `category`, `list_date`。

```python
df = pro.index_basic(symbol="000001,399001,000300,932000,899050")
```

### 3.2 指数日线 `index_daily`（主接口）

- 文档：https://tushare.pro/document/2?doc_id=95
- 权限：约 2000 积分；`ts_code` **必填**（不能像 `daily` 那样只传 `trade_date` 拿全市场）。
- 限量：单次约数千行；16 只指数按代码拉区间足够。
- 指数**无** `adj_factor`，不要复用股票复权逻辑。
- 官方已写明：深证成指 / 创业板指的成交是成分股合计，全市场成交分别用深圳 A 指、创业板综。

**入参**

| 名称 | 必选 | 说明 |
|---|---|---|
| ts_code | 是 | 带后缀 |
| trade_date | 否 | `YYYYMMDD`，按日增量 |
| start_date / end_date | 否 | 历史回填 |

**出参（入库这些即可）**

| 字段 | 含义 | 单位 |
|---|---|---|
| ts_code | 指数代码 | |
| trade_date | 交易日 | YYYYMMDD |
| open / high / low / close | 点位 | 点 |
| pre_close | 昨收 | 点 |
| change | 涨跌点 | 点 |
| pct_chg | 涨跌幅 | % |
| vol | 成交量 | 手 |
| amount | 成交额 | **千元** |

```python
df = pro.index_daily(ts_code="000001.SH", start_date="20240101", end_date="20250908")
# 按日增量
df = pro.index_daily(ts_code="399107.SZ", trade_date="20250905")
```

**展示合成（仅深证成指、创业板指）：**

- K 线 OHLC、涨跌：成指 `index_daily`。
- 列表/图上的成交量、成交额：替换源指数同日 `vol` / `amount`。
- 不要改成指自己的 `close`。

### 3.3 融资融券汇总 `margin`

- 文档：https://tushare.pro/document/2?doc_id=58
- 权限：2000 积分；单次最多约 4000 行。
- 更新：交易所约 08:30 出上一日；接口约 09:05 齐。**深交所、北交所周五数据常到下周一才更新。**
- 不要用 `margin_detail`（个股明细），看板只要全市场余额。

**入参：** `trade_date` 或 `start_date/end_date`；可选 `exchange_id=SSE|SZSE|BSE`。

**出参**

| 字段 | 含义 | 单位 |
|---|---|---|
| trade_date | 交易日 | |
| exchange_id | `SSE` / `SZSE` / `BSE` | |
| rzye | 融资余额 | **元** |
| rqye | 融券余额 | 元 |
| rzrqye | 融资融券余额 | 元 |
| rzmre / rzche / rqmcl / rqyl | 买入、偿还、融券量等 | 见官方 |

实测 2025-09-05：一天 3 行（沪、深、北）。区间 20250801–20250905：78 行。

**看板计算（本地，不请求新接口）**

```text
两融余额(日)     = Σ rzrqye（SSE + SZSE + BSE）
较上一交易日变化 = 当日余额 - 上一交易日余额
曲线             = 两融余额 + 上证指数 close（000001.SH）
柱状图           = 当日变化；>0 红柱在零轴上，<0 绿柱在零轴下
```

### 3.4 涨跌停与涨跌家数

需求要四个数（上涨、涨停、下跌、跌停）以及九档涨跌分布。Tushare **没有**「一天一行的涨跌家数表」。

#### 方案 A（推荐）：已有日线 + `daily_basic.limit_status`

- 接口：`daily_basic`，https://tushare.pro/document/2?doc_id=32
- 权限：2000 积分；按 `trade_date` 一次约 5400 行，覆盖当日 A 股（含北证）。
- `limit_status` 默认不返回，必须写进 `fields`。

| 值 | 含义 |
|---|---|
| 0 | 平盘 |
| 1 | 上涨（不含涨停） |
| 2 | 涨停（非一字） |
| 3 | 一字涨停 |
| 4 | 下跌（不含跌停） |
| 5 | 跌停（非一字） |
| 6 | 一字跌停 |

看板映射：

| 指标 | 计算 |
|---|---|
| 上涨家数 | `limit_status ∈ {1,2,3}` |
| 涨停家数 | `limit_status ∈ {2,3}` |
| 下跌家数 | `limit_status ∈ {4,5,6}` |
| 跌停家数 | `limit_status ∈ {5,6}` |
| 平盘 | `limit_status = 0` |

2025-09-05 实测：0→87，1→4749，2→104，3→4，4→466，5→2，6→5。与同日 `daily.pct_chg` 的上/下/平（4857 / 473 / 87）一致。

九档直方图（需求：上涨左闭右开，下跌左开右闭）用已入库 `daily_bar.pct_chg`，涨停/跌停两档用 `limit_status` 优先占位，剩余再按涨跌幅分箱：

```text
涨停
涨停 ~ 5%     pct_chg ≥ 5 且非涨停
5% ~ 1%       1 ≤ pct_chg < 5
1% ~ 0%       0 < pct_chg < 1
平盘          pct_chg == 0（或 limit_status == 0）
0% ~ -1%      -1 < pct_chg < 0
-1% ~ -5%     -5 < pct_chg ≤ -1
-5% ~ 跌停    pct_chg ≤ -5 且非跌停
跌停
```

停牌、`vol=0` 是否计入，实现时与现有 `daily_bar` 过滤规则对齐即可。

```python
df = pro.daily_basic(
    trade_date="20250905",
    fields="ts_code,trade_date,limit_status",
)
```

#### 方案 B：`stk_limit` + 收盘价

- 接口：`stk_limit`，https://tushare.pro/document/2?doc_id=183
- 2000 积分；按日返回涨停价 / 跌停价。
- 判定：`close >= up_limit` 涨停，`close <= down_limit` 跌停。
- 注意：该接口含基金等，2025-09-05 为 5507 行，多于 A 股日线 5417 行，入库后需用股票列表或 `.SH/.SZ/.BJ` 过滤。

#### 方案 C：`limit_list_d`（本账号不可用）

- 文档：https://tushare.pro/document/2?doc_id=298
- 5000 积分；从 2020 年起；**不含 ST**。
- 本机调用返回无权限。不作为 Sprint4 主路径。后续若升级积分，可补炸板、连板、封单，当前看板不需要这些字段。

### 3.5 沪深京总成交额（衍生，不单独立接口）

| 来源 | 沪 | 深 | 京 | 评价 |
|---|---|---|---|---|
| 指数 `amount`（推荐） | `000001.SH` | `399107.SZ` | `899050.BJ` | 2025-09-05：深、京与个股加总一致；沪与 `.SH` 个股加总相差约 0.02% |
| 已有 `daily_bar` | `*.SH` 求和 | `*.SZ` 求和 | `*.BJ` 求和 | 与现有同步完全同源；全天成交可加 `ah_amount` |
| `daily_info` | `SH_A`+`SH_STAR` | `SZ_MARKET` | 无北交所板块 | 单位是**亿元**；`SZ_A` 当日为空；不覆盖京市 |

不要用 `899001.CSI`（北证综指）的 `amount`：同日只有约 2.16 亿元，远小于北证个股合计约 440.6 亿元。

单位换算：`index_daily.amount` / `daily.amount` 为千元；亿元 = 千元 / 1e5。

较上一交易日变化、曲线、红绿柱算法与两融相同，数据换成三市成交额合计。

### 3.6 明确不采用的接口

| 接口 | 原因 |
|---|---|
| `index_dailybasic` | 只有部分宽基的 PE/换手，不含目标 16 只指数的完整 OHLCV |
| `margin_detail` | 个股两融，看板不需要 |
| `daily_info` | 无北交所；深市板块代码与文档 `SZ_A` 不完全一致 |
| `limit_list`（旧） | 接口名无效 |
| `limit_list_d` | 当前 Token 无权限，且不含 ST |
| 股票 `daily` 当指数用 | `000001.SZ` 是平安银行，不是上证指数 |

---

## 4. 同步与入库建议

与现有 `market_day` 一样按交易日推进，每个交易日额外：

1. 对 16 个指数各调一次 `index_daily(ts_code, trade_date=...)`（可再复用 `wait_for_tushare_slot`）。
2. 一次 `margin(trade_date=...)`，写入沪深北三行。
3. 一次 `daily_basic(trade_date=..., fields='ts_code,trade_date,limit_status')`（若只存日级统计，拉完立即聚合再丢明细）。

历史回填：指数按 `ts_code` + 日期区间（每指数一次即可）；两融用 `start_date/end_date`；`daily_basic` 仍须按日循环。日期范围建议与股票日线一致（当前常量 `MARKET_SYNC_START/END`）。

科创综指、中证 A500 等上市/发布较晚的指数，更早日期接口返回空，按空窗处理，不要当失败。

---

## 5. 单位与限流

| 数据 | 成交额 / 余额单位 |
|---|---|
| `index_daily.amount`、`daily.amount` | 千元 |
| `margin.rzye` / `rzrqye` | 元 |
| `daily_info.amount` | 亿元（仅对照，不入库） |

现有限流：`python/worker/rate_limit.py`，400 次/分、间隔 150ms。Sprint4 每个交易日大约 +18 次 HTTP（16 指数 + 1 两融 + 1 涨跌状态），可沿用。

---

## 6. 实测摘要（2025-09-05，除非注明）

| 检查项 | 结果 |
|---|---|
| 16 只目标指数 `index_daily` | 20250801–20250908 均有 27 根（科创综指等若区间早于发布日会变少，本次窗口内齐全） |
| `.CSI` 误用 | `000300/000905/000852/000510/000680` 的 `.CSI` 均为空 |
| `margin` | 沪深北 3 行；`rzrqye` 可加总 |
| `limit_list_d` | 无权限 |
| `daily_basic.limit_status` | 5417 行，与 `daily` 行数一致 |
| 北证 50 `amount` | 44,058,608.739 千元，等于全部 `.BJ` 个股 `amount` 之和 |
| 深圳 A 指 `amount` | 1.325452e9 千元，等于全部 `.SZ` 个股之和 |

---

## 7. 实现时注意

1. 深证成指、创业板指：库里同时存成指与成交源，查询层拼装；不要在入库时覆盖成指 `vol`。
2. 两融、成交额的「较上一交易日」用交易日历，不要用自然日。
3. 涨跌分布分箱边界以需求为准；涨停/跌停个股不要再计入 5% 档。
4. `index_daily` 与股票 `daily` 的 `ts_code` 会撞号段（如 `000001`），必须分表或加 `asset_type`。
5. 本文 `ts_code` 以本次 `index_basic` 为准；若 Tushare 以后改后缀，先查 `index_basic` 再改常量。
