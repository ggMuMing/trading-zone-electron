# trading-zone-electron-sprint3

> 完整迭代说明见：[Sprint3迭代文档.md](./Sprint3迭代文档.md)

## 概述

- 升级 Main↔Python 传输：控制面由 NDJSON 改为长度前缀 MessagePack；行情查询改为 DuckDB 窗口读 + Arrow IPC。表格 UI 仍消费行数组。

## 实现内容

1. stdin/stdout 使用 `uint32be length + MessagePack` 成帧；RPC 信封不变
2. `data.query.ohlcv` 按日期窗口（可选 `limit`）从 DuckDB 出列，回 `arrow_ipc`
3. Main 用 `apache-arrow` 解码后转成 `OhlcvBar[]`，现有 `market:query` / 表格不改行为

## 最终实现目标

1. ready / 普通 RPC / 带二进制的 OHLCV 查询均可走 MessagePack
2. 查询不再把 `bars[]` 塞进控制面 JSON
3. 复权数值与 Sprint2 fixture 一致；`limit` 能截断窗口
