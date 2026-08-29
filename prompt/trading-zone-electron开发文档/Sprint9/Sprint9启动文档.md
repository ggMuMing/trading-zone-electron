> 完整说明见：[Sprint9 迭代文档](./Sprint9迭代文档.md)。后续档 B 见 [Sprint9.1 迭代文档](./Sprint9.1迭代文档.md)，档 C 见 [Sprint9.2 迭代文档](./Sprint9.2迭代文档.md)。来源见 [Sprint9 头脑风暴文档](./Sprint9头脑风暴文档.md)、[Sprint8.3 迭代文档](../Sprint8/Sprint8.3迭代文档.md) 第 6.2 节中期目标 1。开发计划 Cursor plan `sprint9_指标模型_56cd4152`。

# Sprint9 启动：指标模型第一档

## 来源

Sprint8.3 已把同种内置多实例、compose 前缀铺完。自定义脚本仍是中期目标，但作者单元还不是类：均线拆在 catalog JSON / TS `MaParams` / Python `MaParams` / `indicator_ma()` 四处。头脑风暴档 A：先把 `Indicator` 收成单一来源，再做编辑器。

## 现状

- `compose.REGISTRY` 是 `(times, closes, params) → PlotFragment` 函数；`MaParams` / `MacdParams` 写在 compose 里。
- 内置入口是 `indicator_ma` / `indicator_macd`，只拿 close。
- 目录默认 params 在 TS `INDICATOR_CATALOG`；Python 无 `manifest()`。
- IPC / 布局仍是 `{ id, builtin, params }`。

## 方案结论（已拍板）

**构造这个对象就是创建指标，调用 `compute` 就能上图。**

- `Indicator` 子类字段 = params；`manifest()` 从 Field 抽出，禁止手写第二份 Python schema。
- `compute(ohlcv)` 只返回 `PlotFragment`；`to_chart_input` 在类外合并并加实例前缀。
- compose 仍吃 `{ id, builtin, params }`；`params` 键集合必须等于 `manifest.fields`。
- 内置 catalog 双份暂时保留：Python 类是作者单元，TS 目录用 smoke 锁死 `manifest().defaultParams`。
- `MA()` / `MACD()` 构造可用 Field 默认值。

不做：脚本表、子进程、编辑器、布局 `kind + ref`、改 Dialog 写死表单、改 `ChartInput` Schema。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 作者单元是类 | `to_chart_input(bars, [("ma", MA()), ("macd", MACD())])` 与满字段 compose 出口一致 |
| G2 | 内置仍走现入口 | `compute.indicator` / `compose({ id, builtin, params })` 前缀、双实例、未知 builtin 与 8.3 一致 |
| G3 | schema 单一来源 | `manifest()` 从 Field 抽出；`key` / `title` / `defaultParams` 与 TS 目录对齐 |

## 本文件不包含

- 脚本表 / IPC CRUD、布局拆 `kind + ref`、`chart:build` 带源码
- 独立脚本子进程、同进程 `exec`、Pyodide、Monaco
- 按 `manifest.fields` 渲染表单、图例美化、删 TS 目录
- 改 `ChartInput` Schema、Arrow 传 `series`
