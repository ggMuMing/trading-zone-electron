# trading-zone-electron架构文档

## 项目简介
- trading-zone-electron是一个本地化的交易复盘软件
  - 是一个基于electron的厚客户端
  - 支持行情数据的本地保存
  - 支持本地使用python进行数据获取、处理
  - 支持node+sqlite做业务和业务数据的管理
  - 基于react+electron的ui

## 架构目标
- 创建一个ApplicationService+IPC适配层的桌面应用

## 进程拓扑
- 三进程壳：`Renderer`（React 纯展示）↔ `Preload`（`contextBridge` 白名单）↔ `Main`（ApplicationService + SQLite）。
- Main 拉起长期 **Python 子进程**（`pythonBridge`），经 stdin/stdout **长度前缀 MessagePack** 通信；Renderer 不直连 Python / SQLite。
- Python 随应用启停；异常退出时最多自动重启 1 次。

## 协议演进
- **现状（Sprint4）**：控制面为 Main↔Python 的 **长度前缀 MessagePack**（`uint32be length + body`）；小结果（股票列表、同步摘要、coverage 摘要、按日同步）走控制面 map/array。
- **数据面（Sprint3）**：`data.query.ohlcv` 经 **DuckDB 窗口读** 产出 Arrow Table，以 **Arrow IPC stream** 作为 MessagePack `bin` 回传 Main；Main 解码为行数组再经 Electron IPC 给表格 UI。
- **行情同步（Sprint4）**：`data.sync.market_plan` + 逐日 `data.sync.market_day` 按交易日补齐 `[start_date, end_date]`；覆盖表 `sync_trade_date` 仅 `complete` 跳过。全市场按 `trade_date` 拉 daily / adj_factor，不再按股票循环。`data.meta.market_coverage` 在无 `ts_codes` 时只回摘要，禁止全市场 `stocks[]`。
- **后续**：Arrow bytes Transfer 到 Renderer；图表视口直接消费列式窗口。勿经 IPC 塞全量 OHLCV JSON。
- 跨语言 schema 放 `contracts/`，Python 与 Main 共用（JSON Schema + TS 类型 + Pydantic），避免口口相传。

## 配置与密钥
- Tushare Token 读取优先级：环境变量 `TUSHARE_TOKEN` > `{userData}/config/config.json`。
- SQLite 业务库路径：`{userData}/data/trading-zone.db`。
- 后续可演进为加密存储或系统密钥环；当前为明文配置文件 + 环境变量。

## 技术栈
- 壳子
  - electron+electron builder（单实例、appData、托盘）
- UI
  - React + MUI：两列壳（左图标导航 + 右页面内滚动）；配置页 / 行情表。后续 lightweight-charts 做纯展示
- 业务
  - Main内TypeScript+SQlite。业务逻辑+业务数据管理。
- 数据/计算
  - 嵌入式python+duckdb+pandas/numpy
  - tushare获取历史数据
- 协议
  - 控制面：长度前缀 MessagePack（Sprint1/2 曾为 NDJSON）
  - 数据面：Arrow IPC / DuckDB 窗口读（Main 解码；目标态传到 Renderer）
- 分发
  - 附带 python-build-standalone 或 PyInstaller，用户无 venv/端口

## 逻辑接口（契约先于实现）
- Data：sync.stock_list / sync.market_plan / sync.market_day / query.ohlcv → window / meta.coverage / admin.clear_market
- Compute：compute.indicator → result_handle / compute.batch / cancel（缓存键含 params_hash + 代码版本）
- Application：编排「读业务配置 → 调计算 → 窗读给图表」；CRUD 只碰 SQLite
