# trading-zone-electron-sprint1

> 完整迭代说明（目标 / 需求 / 设计 / 任务 / 测试 / 改进）见：[Sprint1迭代文档.md](./Sprint1迭代文档.md)

## 概述
- 实现架构的最小实现的测试

## 实现内容
1. 创建一个electron应用，使用react做UI，main/sqlite做业务层。UI可以与业务层正常交互
2、python层可以正确运行，可以使用正常使用tushare、pandas、numpy、duckdb等数据运算的库
3、ui、业务、python互通互联

## 最终实现目标
1. ui -> 中间层 -> python层 使用tushare获取完整A股股票列表
2. 股票列表保存到sqlite的表中
3. sqlite保存的股票列表 展示到 ui