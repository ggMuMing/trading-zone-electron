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
- Main 拉起长期 **Python 子进程**（`pythonBridge`），经 stdin/stdout 行协议通信；Renderer 不直连 Python / SQLite。
- Python 随应用启停；异常退出时最多自动重启 1 次。

## 协议演进
- **现状（Sprint1）**：控制面为 Main↔Python 的 **NDJSON（JSON 行协议）**；小结果（如股票列表）可经 IPC 回传 UI。
- **目标态**：控制面升级为 **MessagePack**；行情等大数据走 **Arrow IPC / DuckDB 窗口读**，避免 IPC 塞全量 OHLCV。
- 跨语言 schema 放 `contracts/`，Python 与 Main 共用（JSON Schema + TS 类型 + Pydantic），避免口口相传。

## 配置与密钥
- Tushare Token 读取优先级：环境变量 `TUSHARE_TOKEN` > `{userData}/config/config.json`。
- SQLite 业务库路径：`{userData}/data/trading-zone.db`。
- 后续可演进为加密存储或系统密钥环；当前为明文配置文件 + 环境变量。

## 技术栈
- 壳子
  - electron+electron builder（单实例、appData、托盘）
- UI
  - 根据`package-backup.json`中的react+vite+MUI+lightweight-charts，做纯展示
- 业务
  - Main内TypeScript+SQlite。业务逻辑+业务数据管理。
- 数据/计算
  - 嵌入式python+duckdb+pandas/numpy
  - tushare获取历史数据
- 协议
  - 控制面：现状 NDJSON，目标 MessagePack
  - 数据面：目标 Arrow IPC / DuckDB 窗口读
- 分发
  - 附带 python-build-standalone 或 PyInstaller，用户无 venv/端口

## 逻辑接口（契约先于实现）
- Data：sync.market / query.ohlcv → handle / query.window / meta.coverage
- Compute：compute.indicator → result_handle / compute.batch / cancel（缓存键含 params_hash + 代码版本）
- Application：编排「读业务配置 → 调计算 → 窗读给图表」；CRUD 只碰 SQLite
