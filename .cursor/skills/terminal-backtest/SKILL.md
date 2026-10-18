---
name: terminal-backtest
description: >-
  在波动策略研究目录实现并扩展终端回测系统：start.py 目录树交互、标的单选、
  两级验证内容、scripts 分类脚本、CSV 与图导出、控制台打印。
  在用户要求终端回测、回测入口、start.py、选择标的、验证内容、因子研究脚本、
  STD20、波动压缩，或修改
  python/statisticscripts/statistic_study/波动策略研究 下的研究脚本时使用。
---

# 终端回测系统

在 `python/statisticscripts/statistic_study/波动策略研究/` 实现终端研究入口。规格以该目录 `0.基础设施.md` 为准；某一条验证算什么，以 `2.因子研究.md` 对应小节为准；买卖公式以 `1.策略描述.md` 为准，见 [reference.md](reference.md)。

三份文档与本 skill 冲突时，以三份文档为准。

## 何时使用

- 新建或修改 `start.py`、目录树菜单、标的选择、验证内容
- 按因子研究新增或改写 `scripts/` 下的分类脚本
- 用户说「终端回测」「执行验证」「STD20」「波动压缩」

未要求时，不要实现 `1.策略描述.md` 里尚未写入 `2.因子研究.md` 的买卖规则。

## 目录

```
python/statisticscripts/statistic_study/波动策略研究/
  start.py                 # 唯一入口
  scripts/
    catalog.py             # 1 级 / 2 级登记
    menu.py                # 目录树
    data.py                # 只读行情与股票名称
    std20_percentile.py    # 已点名：STD20大类
    <其他1级脚本>.py
  output/                  # 运行产物，不手写进仓库说明以外的提交
```

`python/statisticscripts/` 已被 `.gitignore` 忽略。研究脚本默认不提交。

分类脚本禁止独立执行：

```python
if __name__ == "__main__":
    print("请从 start.py 进入，不要直接运行分类脚本。")
    raise SystemExit(1)
```

对外只暴露：

```python
def run(ts_code: str, name: str, items: list[str]) -> None:
    """items 为选中的 2 级 id。未出现的 id 不执行。"""
```

`start.py` 把菜单选中项传给 `run`。1 级脚本内部按 2 级 id 分支。2 级之下的细分只在打印分节里体现，不进菜单。

## 入口交互

在 `波动策略研究/` 下执行 `python start.py`。Windows 下入口先 `sys.stdout.reconfigure(encoding="utf-8", errors="replace")`。

初始画面：

- 默认列表：`1.选择标的`、`2.选择验证内容`、`3.执行`
- 选中内容：
  - `已选择: ` + 标的（`代码+名称`，未选则留空）
  - 每个已选 1 级一行 `已选择: ` + 1 级名称，其下缩进打印已选 2 级名称

目录树：

- 根节点是默认列表
- 进入下级时直接列出内容，不要在列表顶部放 `返回上一级`
- `Space` 进入下一级，`Enter` 选中。返回上一级只使用 `Backspace`
- 单选、多选行前都有 checkbox：`[x]` / `[ ]`
- 当前行用 `>` 标出。每次按键重绘整屏

标的是单选：`Enter` 选中新项并清掉上一项。验证内容是多选：`Enter` 切换当前行。

`3.执行`：没有标的，或没有任何 1 级被选中时，打印原因并留在菜单。有选中则按登记顺序调用对应 `run`。

## 标的

单选。选中后在根画面显示 `代码+名称`。

宽基：用 `worker.dashboard_codes.DASHBOARD_BROAD_INDICES`，再与 `index_daily` 里实际有 K 线的 `ts_code` 取交集后列出。名称用该常量里的中文名。

个股：菜单项 `输入个股代码`。读入 6 位数字，到 SQLite `stocks.symbol` 精确匹配。

- 0 条：打印未找到，停在输入，不改变已选标的
- 1 条：选中，显示 `ts_code` + `name`（6 位代码只用于查询）
- 多条：把候选项作为单选子列表

## 验证内容登记

1 级缺省一个都不选。首次进入某 1 级时，其 2 级缺省全选。1 级取消选中后，2 级选择保留，执行时忽略未选中的 1 级。

当前登记（计算口径见 [reference.md](reference.md)）：

| 1 级 id | 菜单名 | 脚本 | 2 级 id | 菜单名 |
|---|---|---|---|---|
| `std20` | STD20大类 | `std20_percentile.py` | `percentile` | STD20历史分位数 |
| | | | `distribution` | STD20分布 |
| `vol_compression` | 波动压缩因子研究 | `vol_compression.py` | `bb_inside_keltner` | 布林通道压缩到肯特那通道内 |
| `wr_cross50` | 威廉指标下穿50事件研究 | `wr_cross50.py` | `expected_return` | 下穿50后预期收益 |
| `mix_entry` | 混合变量研究 | `mix_entry.py` | `expected_return` | 混合买入后预期收益 |

`0.基础设施.md` 已写明的脚本名优先。新增 1 级时：一条 1 级对应一个脚本，在 `catalog.py` 登记，菜单从登记表生成，不要在 `start.py` 里写死中文列表。

## 导出与打印

导出目录是 `start.py` 所在目录下的 `output/`，与 shell 的 cwd 无关。

研究步骤的结果默认导出 csv。因子研究里的额外说明优先（指定字段、不导出、要图）。未指定字段时，把该步骤终端里的统计表各写一个 csv。

文件名：`{ts_code}_{1级id}_{2级id}.csv`（图则同名 `.png`）。终端打印保存路径。

打印遵守 `.cursor/rules/python-print-format.mdc`：`tabulate`、分段、键值对齐、超过约 30 行先摘要再表头。图用 matplotlib `Agg` 存 png，不弹窗。价格/波动 6 位小数，比率与分位 4 位，计数为整数。

## 数据

只读，不建表、不写入行情库。

- 行情库：`%APPDATA%/trading-zone-electron/data/market.duckdb`。环境变量 `TRADING_ZONE_USER_DATA` 优先，缺省时按 `python/worker/strategies/main.py` 的平台规则补齐。`duckdb.connect(path, read_only=True)`。不要调用 `market_db.get_conn()`（读写，会和 Electron 抢锁）。
- 股票名称：同目录 `trading-zone.db`，`sqlite3.connect(uri=True)` 只读。表 `stocks(ts_code, symbol, name)`。
- 宽基指数：`index_daily`，字段 `trade_date, open, high, low, close, vol`，不复权。指数没有除权缺口，禁止对指数 JOIN `adj_factor` 或乘复权因子。
- 个股：`daily_bar` JOIN `adj_factor`（`ts_code` + `trade_date`）。研究必须前复权（qfq），与图表页缺省一致。`scale = adj_factor / 该股最新 adj_factor`（最新为 `ORDER BY trade_date DESC LIMIT 1`）；`open/high/low/close/pre_close` 乘 scale，`vol` 不乘。缺因子当日 scale=1。按 `trade_date` 升序。未复权个股价格不得用于 STD、ATR、通道、威廉等价格类计算。
- `start.py` 把 `python/` 插入 `sys.path`，以便读取 `worker.dashboard_codes`。

## 新增一条验证

1. 在 `2.因子研究.md` 找到 1 级、2 级标题；没有则先问用户，不把策略描述里的「待研究」项做成菜单。
2. `catalog.py` 加登记；新脚本放 `scripts/`，实现 `run`，并挡住直接执行。
3. 按 reference 与因子研究小节计算、打印、导出。文档没写的统计口径，在该步骤打印元信息里写明所用定义。
4. 从 `start.py` 走一遍：选标的、勾选该 2 级、执行，确认终端表格和 `output/` 文件。
