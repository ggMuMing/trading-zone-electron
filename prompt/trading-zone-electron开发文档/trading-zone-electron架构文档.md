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

## 技术栈
- 壳子
  - electron+electron builder（单实例、userData、托盘）
- UI
  - 根据`package-backup.json`中的react+vite+MUI+lightweight-charts，做纯展示
- 业务
  - Main内TypeScript+SQlite。业务逻辑+业务数据管理。
- 数据/计算
  - 嵌入式python+duckdb+pandas/numpy
  - tushare获取历史数据
- 协议
  - 控制面 MessagePack；
  - 数据面 Arrow IPC / DuckDB 窗口读
- 分发
  - 附带 python-build-standalone 或 PyInstaller，用户无 venv/端口

## 逻辑接口（契约先于实现）
- Data：sync.market / query.ohlcv → handle / query.window / meta.coverage
- Compute：compute.indicator → result_handle / compute.batch / cancel（缓存键含 params_hash + 代码版本）
- Application：编排「读业务配置 → 调计算 → 窗读给图表」；CRUD 只碰 SQLite

跨语言 schema 放 contracts/，Python 与 Main 共用，避免口口相传。