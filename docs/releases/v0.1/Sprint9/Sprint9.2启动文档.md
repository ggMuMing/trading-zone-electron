> 完整说明见：[Sprint9.2 迭代文档](./Sprint9.2迭代文档.md)。来源见 [Sprint9.1 迭代文档](./Sprint9.1迭代文档.md) 第 6.1 节、[Sprint9 头脑风暴文档](./Sprint9头脑风暴文档.md) 档 C。

# Sprint9.2 启动：脚本子进程 → PlotFragment

## 来源

Sprint9.1（档 B）已把用户脚本落成独立资产（CRUD + 弹窗列出），还不能算、不能挂图。头脑风暴档 C：独立子进程跑一份源码 → `PlotFragment`；compose 能把这份 fragment 与内置 fragment 合成同一份 `ChartInput`。

## 现状

- 内置：`REGISTRY[builtin](**params).compute(ohlcv)` → 局部 `PlotFragment` → `_prefix_fragment` → `output()`。
- 用户脚本只存在 SQLite；`chart:build` / `compute.indicator` 仍只吃 `{ id, builtin, params }`。
- 新建脚本模板仍 `from worker.indicators.model import …`，沙箱默认不允许 `import worker.*`。

## 方案结论（已拍板）

- 子进程默认执行隔离；否决同进程 `exec`、Renderer Pyodide。
- 子进程注入：`Indicator` / `Ohlcv` / plot 方言（`line` / `histogram` / `overlay` / `subplot`）以及 typing / pydantic `Field`。允许 `import numpy`。禁止 `os` / `socket` / `worker.*` / DuckDB / 文件系统。
- 子进程只返回 `PlotFragment`（局部短名）。前缀、`candle` / `volume`、`output()` 仍在主 worker。
- `to_chart_input` 的 items 可混 `Indicator` 实例与已算好的 `PlotFragment`；同一套 `_prefix_fragment`。
- 本轮不改 IPC / 布局 / `compute.indicator` 入参。验收走 Python smoke，不挂图。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 子进程跑一份源码 | `run_script(source, ohlcv, params)` 得到与内置同类局部短名的 `PlotFragment` |
| G2 | compose 能合并 | `to_chart_input(bars, [("ma", MA()), ("macd", script_fragment)])` 与满字段内置 compose 出口一致 |
| G3 | 沙箱边界 | `import os` / `import worker` 失败；语法错误以子进程 stderr 回主进程，不污染主 worker |

## 本文件不包含

- 布局拆 `kind + ref`、`chart:build` 带 `source`、脚本挂到当前布局
- 保存时 load 类抽 manifest、按 `manifest.fields` 渲染表单
- Monaco、「跑一次」按钮、图上画用户脚本
- 改 `ChartInput` Schema、改 `compute.indicator` 过桥形状
- 一张图里多个脚本、超时策略细化到「只丢掉该实例」（本轮一份源码；崩了整次失败）
