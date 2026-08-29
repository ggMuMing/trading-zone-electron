# trading-zone-electron-sprint2

> 完整迭代说明见：[Sprint2迭代文档.md](./Sprint2迭代文档.md)

## 概述

- 打通股票池行情通路：一键拉取 → DuckDB 存日线/复权因子 → 前端列表查看单股日线（未/前/后复权）

## 实现内容

1. 同步 A 股列表后取前 10 支构成股票池
2. 拉取 20240101–20251231 日线与复权因子，分表写入 DuckDB
3. 前端空态「开始拉取数据」；选股后表格展示并切换复权类型

## 最终实现目标

1. UI → ApplicationService → Python(tushare) → DuckDB 全链路可跑
2. 重启后行情仍可从本地 DuckDB 查询
3. 未复权 / 前复权 / 后复权查询结果可区分
