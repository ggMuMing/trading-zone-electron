# Sprint9 股票日线：停牌与退市 Review

> 状态：准备会产出（对照代码 + 本机库快照，日期 2026-09-19）
> 关联：[Sprint7 迭代文档](../Sprint7/Sprint7迭代文档.md)、[Sprint6 数据获取可行性分析](../Sprint6/Sprint6数据获取可行性分析.md)
> 可交互原稿：Cursor canvas `daily-bar-suspend-delist-review.canvas.tsx`（聊天旁打开）
> 官方入口：[日线行情 `daily`](https://tushare.pro/document/2?doc_id=27)、[每日停复牌 `suspend_d`](https://tushare.pro/document/2?doc_id=214)

对照 Tushare `daily` 官方口径、同步 / 入库 / 查询代码，以及本机 userData 库快照（`20160104`–`20260918`，11,178,448 根日线）。

---

## 1. 结论

| 指标 | 结果 |
|---|---|
| 停牌在日线里的形态 | **缺行**，不是 `vol=0` |
| 日线有、`stocks` 没有的代码 | **253** |
| 最新日有因子无日线（在市停牌） | **12** |
| `vol=0` / 空 OHLC 行 | **0** |

**总评：源数据比清洗层更干净，语义却没有落地。** 停牌没有单独处理——Tushare 缺行，本地照单全收。退市历史日线其实已经进了 DuckDB，但股票主表只保留 `list_status=L`，图表选不到。对 K 线展示这套「有成交才有 bar」通常够用；对策略滚动窗口和「全市场宇宙」不够。

### 1.1 怎样处理停牌？

**不处理，也不补齐。** Tushare 文档写明「停牌期间不提供数据」。`pro.daily(trade_date=…)` 当天没有该股就没有行；`_fetch_daily` 不会插入昨收，也不会写停牌标记。

看板涨跌家数用 `vol > 0` 当代理；本机库里根本没有 `vol=0` 行，真正起作用的是「没有 `daily_bar` 行」。复权因子在停牌日仍在，最新日 12 只对得上这个模式。

### 1.2 退市数据有没有包含？

**行情有、名单没有。** 按日全市场拉取会带上「当时还在交易、后来退市」的代码，DuckDB 里有 253 只不在 SQLite `stocks` 中。股票列表接口写死 `list_status='L'`，字段也不含退市日。

选股器 / 申万成员 / 指数成分都按 `stocks` 裁，所以 UI 看不到这些票。若直接用 `ts_code` 查 `query_ohlcv`，历史 K 线仍在。

---

## 2. 获取链路

配置页「更新数据」走 `syncMarketWindow`。股票池 `market_sync.py` 仍按 `ts_code` 循环，是 Sprint2 遗留，不是全市场主路径。

| 步骤 | 文件 | 做什么 |
|---|---|---|
| 1. 股票主表 | `stock_list.py` | `stock_basic(list_status='L')` → SQLite `stocks`。只上市、只 upsert、不删退市 |
| 2. 交易日历 | `market_plan.py` | `trade_cal(SSE, is_open=1)`。只决定拉哪些日历日，不判断个股停牌 |
| 3. 按日全市场 | `market_day.py` | `pro.daily(trade_date)` + `adj_factor`。不按股票循环，也不过滤 vol / 停牌 |
| 4. 原样入库 | `market_db.py` | `INSERT OR REPLACE daily_bar`。清洗只有 NaN→NULL，没有停牌标记列 |
| 5. 下游分叉 | query / dashboard / UI | K 线原样出缺口；看板用 `vol>0`；选股/行业 INNER JOIN `stocks` 丢掉退市码 |

---

## 3. 停牌：每一层实际做什么

| 层 | 实现 | 效果 | 判断 |
|---|---|---|---|
| Tushare daily | 官方：停牌期间不提供数据 | 缺行，不是 `vol=0` 行 | 符合源口径 |
| 入库 `market_day` | 无 `suspend_d`，无 `is_halted`，不过滤 vol | 停牌日不会被补成昨收 | 无显式处理 |
| DuckDB 实测 | `vol=0` / `vol NULL` / OHLC NULL 均为 0 行 | 源数据本身干净 | 本机库干净 |
| 复权因子 | 停牌日仍有 `adj_factor` | 412,927 条因子没有对应日线 | 可作停牌代理 |
| K 线 / 策略 | `query_ohlcv` 原样返回，滚动按相邻 bar | 停牌被当成「昨天」接到复牌 | 策略语义错 |
| 看板涨跌统计 | INNER JOIN `limit_status` 且 `vol>0` | 停牌自然不计，但没有显式口径文档 | 代理过滤 |

官方口径：Tushare daily「未复权行情，停牌期间不提供数据」。专用接口 `suspend_d` 本仓库零引用。最新日缺 bar 的 12 只包括 `000016.SZ`、`002731.SZ`、`601238.SH`、`688496.SH` 等，末笔停在 `20260828`–`20260914`。

### 3.1 对计算的影响

**K 线展示：** lightweight-charts 按 time 对齐，停牌日就是缺口。这通常是对的，不会画出一根「假昨收」。

**策略 / 指标：** `MingSystemVer1` 把 daily 设成 `trade_date` 索引后直接 rolling。停牌 20 天复牌后，`vol_ma` 的「过去 5 根」是停牌前的成交，不是日历 5 日。`prepare_ohlcv` 只丢 OHLC 不全的行，不插停牌占位。

---

## 4. 退市：两张表的口径分裂

| 层 | 实现 | 本机库 | 判断 |
|---|---|---|---|
| 股票主表 `stocks` | `list_status` 默认 `L`，无 `delist_date` | 5565 只，名称含「退市」= 0 | 只要上市 |
| 日线 `daily_bar` | 按 `trade_date` 全市场拉，含当时还在交易的退市股 | 5818 只代码，其中 253 只不在 `stocks` | 历史已入库 |
| 最新交易日 `20260918` | 当日 bar 5553，全部能对上 `stocks` | 当天已退市的不会再出现 | 当日一致 |
| 最早交易日 `20160104` | 2592 根里有 195 根代码已不在 `stocks` | 历史宽度统计会计入后来退市的票 | 历史含退市 |
| 图表选股 / 行业 / 成分 | `list()` 或 INNER JOIN `stocks` | 253 只退市历史票 UI 选不到 | 宇宙被裁掉 |
| 按代码查 K 线 | `query_ohlcv` 不 JOIN `stocks` | 若已知 `ts_code`，历史 bar 仍在 | 底层能查到 |

### 4.1 253 只「日线孤儿」按末笔年份

| 末笔年份 | 代码数 |
|---|---|
| 2016–2018 | 13 |
| 2019–2021 | 50 |
| 2022 | 42 |
| 2023 | 48 |
| 2024 | 49 |
| 2025 | 31 |
| 2026 | 20 |

来源：`daily_bar LEFT JOIN stocks`。后缀 SZ 147 / SH 101 / BJ 5。这不是脏数据，是按日快照留下的历史退市股。

Sprint6 文档写过申万成员「INNER JOIN `stocks`，自动去掉退市」——这是产品口径，不是行情丢失。日线同步从未按 `stocks` 过滤，所以 DuckDB 比选股宇宙更大。

看板全市场宽度用 `daily_bar` ⋈ `stock_limit_status`，**不** JOIN `stocks`。`20160104` 那种历史日会把后来退市的 195 只算进涨跌家数；最新日则 0 只孤儿，和当前上市宇宙一致。

`adj_factor` 有 258 只不在 `stocks`，比 daily 还多 5 只——退市后因子可能比日线多活几天。

---

## 5. 发现项

| ID | 问题 | 位置 | 说明 |
|---|---|---|---|
| H1 | 停牌日在策略/均线里被粘成相邻 bar | `query_ohlcv` / `MingSystemVer1` / `prepare_ohlcv` | Tushare 停牌不返回行，入库也不补。K 线和策略拿到的是「有成交的日子」序列。5 日均量、滚动 STD 会把停牌前最后一个交易日当成 t-1 |
| H2 | 没有停牌日历，只能靠缺行反推 | 全链路未调用 `suspend_d` | 最新日 12 只仍在 `stocks`、有 `adj_factor`、但无 `daily_bar`（如 `000016.SZ`、`601238.SH`）。这是当前停牌的实证，但库里没有 `suspend_type` / 停牌区间 |
| D1 | 退市历史行情在 DuckDB，不在选股宇宙 | `stock_list.py` + `stocksRepository` + `ChartPage` | `daily_bar` 有 253 只当前 `stocks` 没有的代码（样本 `300029.SZ`、`600599.SH`，末笔多在 2025–2026）。图表宇宙、申万成员、指数成分都按 `stocks` 裁掉 |
| D2 | `stocks` 只增改不删除，退市残留取决于同步时机 | `stocksRepository.upsertMany` | 下次 `list_status=L` 不再返回已退市代码，旧行仍留在 SQLite。当前库碰巧没有「退市」字样，不代表机制会清掉 |
| C1 | 入库清洗几乎只有 NaN→NULL | `market_day._fetch_daily` / `_nullable_float` | 不校验 `high≥low`、不丢 `vol=0`、不校验 `ts_code` 后缀。本机 1117 万行碰巧 0 条脏 OHLC，但不能当契约。`dashboard_sync` 的 `_nullable_float` 还处理了 inf，日线路径没有 |
| C2 | 「complete 日」不核对应到只数 | `market_day` `status=complete` | `bar_count>0` 且 `adj_count>0` 就算完整。停牌再多、当天少几百只，只要接口非空就会跳过重拉 |

---

## 6. 建议改什么（按优先级）

1. **先定口径再改代码。** 停牌：K 线继续缺行可以，但策略需要「按日历」还是「按有成交 bar」必须写进需求。退市：历史回测要不要看已退市票，和选股器要不要列出，是两件事。
2. 若策略要日历语义：拉 `suspend_d` 或用「有 adj 无 daily」做停牌日，查询时插占位 / 给 `is_halted`，避免 rolling 把停牌前后粘在一起。
3. 若回测需要退市股：`stock_basic` 加 `list_status='D'`（及 P），主表存 `list_status` / `delist_date`；选股器默认 L，可选「含退市」。不要只靠 DuckDB 里的孤儿代码。
4. `upsertMany` 应对本次未返回的 L 代码标记或删除，避免退市后名字永远停在最后一次上市状态。
5. 入库侧把 `_nullable_float` 与 dashboard 对齐（nan/inf），并抽一份 daily 映射，去掉 `market_day` / `market_sync` 双份拷贝。complete 日可加「当日只数 vs 近 20 日中位数」告警，而不是 `bar_count>0`。

---

## 附录

- 代码：`python/worker/handlers/market_day.py`、`stock_list.py`、`market_db.py`、`dashboard_query.py`；`src/main/db/stocksRepository.ts`、`applicationService.ts`
- 库快照：`%APPDATA%/trading-zone-electron/data`，只读副本查询于 2026-09-19
- Tushare：daily `doc_id=27`；停复牌 `suspend_d` `doc_id=214`
