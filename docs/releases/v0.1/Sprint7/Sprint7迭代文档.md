# Sprint7 迭代文档

> 状态：**进行中**
> 关联：[启动摘要](./sprint7启动.md)、[头脑风暴](./Sprint7头脑风暴文档.md)、[Sprint7.1](./Sprint7.1迭代文档.md)、[Sprint7.2](./Sprint7.2迭代文档.md)、[架构文档](../trading-zone-electron架构文档.md)

---

## 1. 当前迭代目标

把绘图通道入口从 `OhlcvBar[]` 换成可校验的 `ChartInput`；用门外临时生产者把当前日线编成主图 MA(20) 与副图 MACD(12,26,9)，选股后图表上可见。不接指标 CRUD，不接 Python plot API。

### 1.1 目标声明

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | `ChartInput` 跨语言契约 | JSON Schema + TS 类型 + `validateChartInput`；非法 input 不画半截 |
| G2 | 通道只吃声明 | `KlineChart` 不再 import `OhlcvBar`；成交量由通道写死压底 |
| G3 | 主图 MA + 副图 MACD | 有日线时可见 MA20；下方同一时间轴 MACD 三根共一 pane；换股 / 切复权只 `setData` |

### 1.2 范围边界（本迭代不做）

- 指标弹窗、布局实例 CRUD、自定义脚本、编辑器、`compute.indicator`
- Python `line` / `histogram` / `subplot` / `output`、Pydantic 模型
- 主图自定义 histogram、多副图、markers、画线、框选
- Arrow 直传 Renderer、增量更新策略、新的 acceptance 套件
- 副图光标读数 UI（`PriceLegend` 仍只显示主图 OHLC / 量额）

### 1.3 技术选型（本迭代）

| 层 | 选型 |
|---|---|
| 壳 / 构建 | Electron + electron-vite（沿用） |
| UI | React + MUI；`lightweight-charts` v5 `addSeries(..., paneIndex)` |
| 业务 | 已有 `stocks:list`、`market:query`；不新增 ApplicationService / IPC |
| 数据 / 计算 | Renderer 门外临时 `ohlcvToChartInput`（SMA20 + MACD 12/26/9）；下一步迁 Python |
| 协议 | 新增 `ChartInput` JSON Schema；不改 Python worker 方法 |

### 1.4 已拍板结论

| # | 议题 | 结论 |
|---|---|---|
| 1 | 入口类型 | `ChartInput`；代码里不用 `PlotSpec` 当入口名 |
| 2 | 成交量 | 一等公民 `volume` 槽；通道写死主 pane 独立轴压底；无 `overlay: "bottom"` |
| 3 | 主 K 线 | 一等公民 `candle`，定义 `timeDomain` |
| 4 | primitives | 只表达主图叠加与副图；v1 禁止 `pane: "main"` + `kind: "histogram"` |
| 5 | 本轮指标 | 始终画 MA(20) + MACD(12,26,9)；工具栏「指标」仍占位 |
| 6 | 计算放哪 | 门外 TS 临时生产者；不进 `KlineChart`，不新增 IPC |
| 7 | 校验 | JSON Schema 管结构；手写语义校验；不引入 Ajv；本轮无 Pydantic |
| 8 | CRUD 接入 | 本轮不做。门槛：通道只认 `ChartInput` 且能按 id 增删 series，且内置函数能当生产者 |

---

## 2. 功能需求

### 2.1 用户故事

1. 作为用户，选中有日线的股票后，主图能看到均线叠在 K 线上。
2. 作为用户，主图下方能看到 MACD 副图（DIF、DEA、柱），与 K 线共用时间轴。
3. 作为用户，换股或切换复权后，均线与 MACD 跟着新数据变，图不会整表拆掉重建为空白。
4. 作为用户，成交量仍压在主图底部，不占独立副图。

### 2.2 功能清单

| ID | 功能 | 优先级 | 状态 |
|---|---|---|---|
| F01 | `ChartInput` JSON Schema + TS 类型 | P0 | 已完成 |
| F02 | `validateChartInput` 语义校验 | P0 | 已完成 |
| F03 | `ohlcvToChartInput`：K/量 + SMA20 + MACD | P0 | 已完成 |
| F04 | `KlineChart` 吃 `ChartInput`：一等公民量 + primitives 翻译 | P0 | 已完成 |
| F05 | `ChartPage` 编映已校验 input；非法不渲染 | P0 | 已完成 |
| F06 | `PriceLegend` 改从 candle 读 vol/amount | P0 | 已完成 |

### 2.3 非功能需求

- Renderer 不直连 DuckDB / SQLite / Python；本轮不新增通道。
- `KlineChart` 不出现 `OhlcvBar`、算法名（「MACD」不是通道词汇）。
- 内侧独吞：`createChart`、`priceScaleId`、`scaleMargins`、`stretchFactor`、`ResizeObserver`。
- 缺口用省略点，禁止 NaN 进入 series。

---

## 3. 详细设计说明

### 3.1 进程与数据流

行情查询路径不变。本轮增量只在 Renderer：查到的 `OhlcvBar[]` 在门外编成 `ChartInput`，校验通过后交给通道。

```mermaid
flowchart LR
  query[market.query] --> bars[OhlcvBar]
  bars --> mapper[ohlcvToChartInput]
  mapper --> validate[validateChartInput]
  validate --> kline[KlineChart]
  kline --> lwc[lightweightCharts]
```

IPC / Python / SQLite 不改。

### 3.2 目录 / 模块（本迭代涉及）

```
contracts/chart_input.json                         # JSON Schema
src/shared/types/chart.ts                          # ChartInput / PlotPrimitive
src/shared/chart/validateChartInput.ts             # 语义校验
src/shared/chart/ohlcvToChartInput.ts              # 门外临时生产者
src/renderer/src/pages/chart/KlineChart.tsx        # 改吃 ChartInput
src/renderer/src/pages/ChartPage.tsx               # 编映 + 校验后传入
```

### 3.3 数据模型 / 存储

无新表。`ChartInput` 是内存 / fixture 逻辑形状，不是新 IPC 方法。大数据 Arrow 传输另开数据面，不改 primitives 词汇。

### 3.4 协议 / API / IPC

不新增 Python 方法、不新增 Electron IPC。`market:query` 仍回 `OhlcvBar[]`。

`ChartInput` v1：

```text
ChartInput
  schemaVersion: 1
  timeDomain: ["2024-01-02", ...]
  candle: [{ time, open, high, low, close, vol?, amount? }, ...]
  volume?: [{ time, value, color }, ...]
  primitives: [
    { id, pane: "main" | subplotKey, kind: "line" | "histogram", style? }
  ]
  series: { [primitiveId]: [{ time, value, color? }, ...] }
```

### 3.5 核心编排（ApplicationService 等）

本轮无 Application 编排。`ChartPage`：

1. 选股 / 切复权 → `market.query` → `bars`
2. `ohlcvToChartInput(bars)` → `validateChartInput`
3. 通过则 `<KlineChart input={value} />`；失败不渲染通道

### 3.6 UI

图表页壳不变。有日线且校验通过时：主图 K + 量 + MA20；下方 MACD 副图。`PriceLegend` 仍叠在容器左上角，字段仍为日期 / OHLC / 涨跌 / VOL / AMT。

### 3.7 契约

| 层级 | 位置 |
|---|---|
| JSON Schema | `contracts/chart_input.json` |
| TypeScript | `src/shared/types/chart.ts`、`src/shared/chart/validateChartInput.ts` |
| Python | 本轮不写 Pydantic |

语义校验（Schema 写不全的）：`primitives[].id` 唯一且与 `series` key 恰好对应；`candle.time` 序列等于 `timeDomain`（升序、唯一、`YYYY-MM-DD`）；点 time ∈ 域；缺口省略；`pane === "main"` 不得 `histogram`。

---

## 4. 任务步骤

| 步骤 | 任务 | 产出 | 状态 |
|---|---|---|---|
| 1 | 启动摘要 + 迭代文档骨架 | `sprint7启动.md`、`Sprint7迭代文档.md` | 已完成 |
| 2 | 契约 Schema + TS 类型 | `contracts/chart_input.json`、`src/shared/types/chart.ts` | 已完成 |
| 3 | 语义校验 | `src/shared/chart/validateChartInput.ts` | 已完成 |
| 4 | 门外生产者 | `src/shared/chart/ohlcvToChartInput.ts` | 已完成 |
| 5 | 通道翻译 | `KlineChart.tsx` 吃 `ChartInput` | 已完成 |
| 6 | 页面编映 | `ChartPage.tsx` | 已完成 |
| 7 | typecheck + 校验自检 | 见第 5 节 | 已完成 |

### 4.1 本地复现命令

```bash
npm run typecheck
npm run dev
```

图表页选有日线的股票：主图应有 MA20，下方应有 MACD 三根；切换复权后线与柱跟着变。

---

## 5. 测试结果 / 总结反馈

### 5.1 验收清单与结果

| 检查项 | 方式 | 结果 | 说明 |
|---|---|---|---|
| G1 契约 + 校验 | `npm run typecheck` | 通过 | 2026-08-18 node + web 均通过 |
| G1 语义拒主图 histogram | 脚本自检 | 通过 | 40 根合成日线编出 main+macd；主图 histogram 被拒 |
| G2 通道不依赖 OhlcvBar | 代码 | 通过 | `KlineChart.tsx` 不再 import `OhlcvBar` |
| G3 主图 MA + 副图 MACD | 手工 | 待补跑 | 需 `npm run dev` 起窗选有日线的股票 |
| 换股 / 切复权只 setData | 手工 | 待补跑 | 需起窗 |

### 5.2 关键命令记录

```
npm run typecheck
> tsc --noEmit -p tsconfig.node.json --composite false
> tsc --noEmit -p tsconfig.web.json --composite false
（2026-08-18 通过）

合成 40 根日线：times=40, ma=21, dif=15, dea=7, macd=7, panes=["main","macd"]
```

### 5.3 总结反馈

**做得好的地方**

- 成交量与 K 线收成一等公民槽，`primitives` 只表达 MA / 副图，通道不再认识 `OhlcvBar`。
- 校验把「主图 histogram」挡在门外，位置没有被可编程化。
- MA / MACD 计算留在门外生产者，图组件只翻译声明。

**暴露的问题 / 摩擦**

- 本轮 MA / MACD 仍是 Renderer 临时计算，换股能看见，但与「算法在 Python」尚未对齐。
- 通道按当前 input 的 primitive id `setData`；primitive 集合变化（CRUD）还不会增删 series，需下一刀补 diff。
- 图上可见性依赖手工起窗，本次未做 Electron 窗口验收。

---

## 6. 改进目标

### 6.1 短期（下一迭代可做）

1. Python worker 提供 `line` / `histogram` / `subplot` / `output`，内置 MA / MACD 函数返回同一 `ChartInput`；去掉 Renderer 临时计算。→ **Sprint7.2 承接**
2. 通道按 primitive id 增删 series 的 diff（CRUD 接入前必须）。→ **Sprint7.1 承接**
3. 光标读出所有 `primitives[].id` 的值，副图图例接上。→ **Sprint7.1 承接**

### 6.2 中期

1. 布局实例第一档 CRUD：工具栏指标 = 增删读内置 MA / MACD；ApplicationService 读布局 → `compute.indicator` → `ChartInput`。
2. SQLite 持久化布局；改参数（周期 / 颜色）。

### 6.3 长期

1. 自定义脚本存储 + Renderer 编辑器（只编辑）+ 独立脚本子进程。
2. Arrow 数据面传输 `series`；窗读进 Renderer。

---

## 附录

### A. 相关文档

- [sprint7启动.md](./sprint7启动.md)
- [Sprint7.1 迭代文档](./Sprint7.1迭代文档.md)
- [Sprint7.2 迭代文档](./Sprint7.2迭代文档.md)
- [Sprint7头脑风暴文档.md](./Sprint7头脑风暴文档.md)
- [架构文档](../trading-zone-electron架构文档.md)
- [Sprint6.1 迭代文档](../Sprint6/Sprint6.1迭代文档.md)
- 开发计划：Cursor plan `sprint7_图表契约_bf57e716`

### B. 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | 开发起窗 |
| `npm run typecheck` | TS 检查 |
