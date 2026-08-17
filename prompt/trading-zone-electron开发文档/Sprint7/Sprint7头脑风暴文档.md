# Sprint7 头脑风暴文档

> 状态：头脑风暴（非正式迭代文档）  
> 来源：Sprint6 / 6.1 落地之后，关于「如何封装 lightweight-charts」的讨论  
> 关联：[Sprint6 迭代文档](../Sprint6/Sprint6迭代文档.md)、[Sprint6.1 迭代文档](../Sprint6/Sprint6.1迭代文档.md)、[架构文档](../trading-zone-electron架构文档.md)

本文只沉淀讨论结论，不代替 Sprint7 启动摘要与迭代文档。参考项目仅作功能对照，**不作为本仓库图表架构的蓝本**。

---

# 第一部分　分析参考项目

## 1. 讨论从哪来

Sprint6 已用 `lightweight-charts` v5 做图表页最小实现：`ChartPage` 负责选股与 `market.query`，`KlineChart` 负责主图 K 线 + 同 pane 成交量。Sprint6.1 在同一组件内叠了十字光标 `PriceLegend`。启动时明确：**不搬参考项目 1600+ 行 `ChartComponent`**，只取创建图与 `setData`。

随后的问题是：若要把这张图做成可复用组件，该参考什么、该封装什么。对照对象是 `back-trade-app-main` 的 `ChartComponent`（及工具栏、状态栏、指标弹窗、分组侧栏等）。

结论先说：**参考项目适合对照「图上有哪些实用功能」，不适合对照「组件该怎么分层」。沿它的路径封装，复杂度会过高。**

## 2. 参考项目实际长什么样

参考实现把「出现在图表附近的东西」收进同一套组件树，核心文件约 1600+ 行，职责包括：

| 混在一起的能力 | 参考位置（示意） |
|---|---|
| 建图、K 线、成交量、`setData` | `ChartComponent.tsx` 的 `createBaseChart` / `applyKlineVolumeData` |
| 指标 layout diff、主图叠加与副图 pane | 同一文件 + `chartUtils.ts` |
| 十字光标状态栏（主图 / 副图） | `StatusBar/mainChartStatusBar.tsx` 等；portal 进库内部 pane DOM |
| 框选区间统计、键盘逐根移动 | `ChartComponent.tsx` + `ChartIntervalStatsDialog` |
| 策略买卖点 markers | `createSeriesMarkers` |
| 选股、分组、指标配置弹窗 | `StockGroupSidebar`、`IndicatorSelectDialog`、`AddToStockGroupDialog` |
| 布局与增量更新开关 | `ChartComponentProxy`、`incrementalChartUpdate` |

对外 props 已开始膨胀：`chartData`、`stockCode`、`adjust`、指标配置回调、`tradeMarkers`、`statRange`、是否增量更新、是否裁剪指标到当前 K 线日期，等等。

它能跑，是因为把 **计算、绘图、页面壳、读数 UI** 绑成一个产品功能包。代价是：无法只复用「那张图」，换场景只能整包复制或继续往同一文件加开关。

## 3. 若沿这条路径封装，通常会摊开的方面

下面这些并不是「本仓库应当照做的清单」，而是 **顺着参考项目去包一层 React 组件时，会被迫面对的问题面**。正是这份清单说明路径过重。

### 3.1 职责边界被一次次突破

可复用的本应是图表引擎，不是整页 `ChartPage`。参考项目把选股、复权、指标、状态栏、框选、买卖点都视为「图表组件」的一部分，边界一旦打开就收不回来。

本仓库当时已有正确苗头：`ChartPage` 查数据，`KlineChart` 只吃 `bars`。沿参考项目走，会把工具栏、空态、复权、IPC 重新吸进去。

### 3.2 生命周期与实例策略变复杂

`lightweight-charts` 是命令式库。合理做法是：创建一次，数据用 `setData`，卸载时 `remove`。参考项目额外引入：

- 换标的是否重建图（`stockCode` / `adjust` 进建图依赖）
- 数据变长是否只更新（`incrementalChartUpdate`）
- 空数据时拆实例还是 `setData([])`
- 切侧栏卸载后，可见区间存在哪

每一项单独成立，叠在一起就变成大量 effect 与开关。

### 3.3 数据契约与库细节绑死

图表真正要的是：有序唯一的 `time`、蜡烛 OHLC、与蜡烛对齐的成交量。`OhlcvBar`、复权类型、Arrow 窗读都是上游的事。参考项目把业务行数据、指标行、裁剪规则、颜色规则写在绘图组件里，换数据源就要改图。

### 3.4 尺寸、pane、内部 DOM

`ResizeObserver`、父级必须有确定高度，这是库的用法，应当藏起来。参考项目为了把状态栏塞进副图，去查询库内部 `table` / `td`（`findTargetPaneTd`），依赖私有 DOM 结构，脆弱且无法作为稳定 API。

### 3.5 交互出口变成「把 `IChartApi` 露出去」

十字光标、可见范围、点击、`fitContent` 都需要对外。参考项目的解决方式是组件内部直接握着 `IChartApi` 和一堆 series ref，页面逻辑写进同一文件。结果是库版本（v5 的 `addSeries`、markers 插件）泄漏到所有功能。

### 3.6 「可扩展」做成了上帝对象

后续功能（MA、MACD 副图、买卖点、画线）在参考项目里都是同一组件的新分支：layout diff、series map、pane stretch、portal 状态栏。扩展的代价是文件继续变长，而不是「再声明一条序列」。

### 3.7 性能与窗读被 API 形状堵住

全量 `setData`、指标全量计算后按日期裁剪、可见范围变化触发逻辑——都可以做。但若组件入口是「整页业务对象」而不是「序列」，后面 Arrow 窗读进 Renderer 时，只能继续往组件里加数据加载，而不是只换输入。

## 4. 对本仓库的判断

Sprint6 已拍板不搬 `ChartComponent`，这次讨论把它上升到架构原则：

1. **参考项目：实用功能清单。** 例如主图 K 线 + 量、十字光标读 OHLC/量额、主图叠加均线、副图 MACD、买卖点、框选统计。这些可以对照「用户最终能看见什么」。
2. **参考项目：不是组件设计。** 不复制其文件切分、不复制 portal 进 pane、不复制 layout diff、不把分组/选股/公式配置塞进绘图组件。
3. **本仓库当前 `KlineChart` 的问题不是「不够像参考项目」，而是尚未形成稳定的绘图入口。** 它已经具备内核（建视口、两条序列、resize、光标），同时开始混入映射、成交量着色、图例展示。Sprint 切片可以接受；下一阶段要改的是入口形状，不是往里面堆功能开关。

页面壳（`StockPicker` + 分隔条）是另一条复用线，与图表通道无关，不在本次头脑风暴的「图表组件」范围内。

---

# 第二部分　第一性原理

## 1. 一张图到底在做什么

任何图（K 线、折线、散点）都是同一件事：

```
数据  ──编码──►  几何  ──投影──►  像素
                    ▲
                    │
              视口（看哪一段、画多大）
```

对日线 K 线：域是离散交易日（不是连续 UTC）；值是 OHLC（蜡烛只是画法）；视口是「现在看见哪段时间、容器有多大」。

拿掉成交量、图例、MA、副图，它仍是一张图。拿掉「时间轴 + 价格轴 + 视口」，就什么都不是。

因此内核不是「K 线组件」，而是一个 **共享时间轴的视口**。

## 2. 不可再拆的四件原语

| 原语 | 含义 | 库已经做了什么 |
|---|---|---|
| **时间域** | 有序、唯一的 `time[]` | 要求 `setData` 升序且唯一 |
| **序列** | 一种画法 + 对齐到时间域的数据 + 自己的值轴 | `addSeries`（蜡烛 / 柱 / 线 / 面积） |
| **视口** | 可见时间范围 × 容器尺寸 → 像素 | `createChart`、缩放平移、`resize` |
| **光标查询** | 给定一个 time（或像素 x），返回该时刻所有序列的值 | `subscribeCrosshairMove` |

少一件，图就残；多出来的，都是应用。

`lightweight-charts` **已经实现了这套第一性原理**。React 侧不该再造图引擎，只该托管这一个视口：把序列喂进去，把尺寸告诉它，把光标问出来。

## 3. 用这个尺子，什么不是内核

- **数据从哪来**：`market.query`、复权、Arrow 窗读——页面 / 主进程。图只接收已经对齐的序列。
- **值怎么算**：MA、MACD、复权因子——计算层（Python `compute.indicator`）。算完仍是「一条对齐到同一时间域的序列」。
- **读数怎么展示**：`PriceLegend` 是光标查询的显示器，不是投影本身。
- **页面壳**：选股、分组、工具栏——与坐标系无关。

参考项目的失败可以收成一句：没有「视口」这个概念，只有「图表页这个功能包」。

## 4. 库是乐高，组件是通道

第一性原理在库里已经齐了，但库更像乐高基础件：不知道拼法，就无法从「我想看 MACD」走到正确的 pane / series / 坐标轴配置。例如：

- 成交量不是「再做一个 Histogram」，而是同一 pane、独立 `priceScaleId`、用 `scaleMargins` 压在底部
- 日线 `time` 必须是业务日字符串，不能用 UTC 时间戳
- 换股是 `setData`，不是拆掉 `createChart`
- 光标上的成交额不在 Histogram 里，要回到原始 bar

这些是库的用法，不是金融概念。图表组件的重点因此不是「再实现一张图」，而是 **构建一条函数通道**：

- **通道外侧**：金融用户熟知的概念——数据、柱状图、曲线、主图 / 副图、颜色与线宽
- **通道内侧**：把声明翻译成 lightweight-charts 的积木拼法
- **使用者**：只掌握通道入口，不必成为 LWC 专家

这与通达信 / TradingView「写了就能看见」的体验相似，但相似的是 **使用者活在金融词汇里**，不是在 Renderer 里再做一套公式语言。

## 5. 必须拆开的两条通道

入口上容易把两类概念收成一条：

| 外侧说法 | 它是什么 | 该进哪 |
|---|---|---|
| 数据 | 已经对齐的时间序列 | **绘图通道**的输入 |
| 算法 | 从 OHLC 算出新序列（MA、MACD） | **计算层**（Python），不进绘图组件 |
| 柱状图 / 曲线 | 序列怎么画、画在哪 | **绘图通道**的输入 |

通达信 / Pine 把计算语言和绘图声明绑在同一个产品里：公式负责算，`PLOT` / `DRAWLINE` 负责画。参考项目膨胀的一半原因，是在 React 组件里同时干这两件事。

本仓库进程边界已经是：Renderer 纯展示，计算在 Python。图表通道若再解释算法，会变成第三套公式引擎。

稳定形状：

```
数据 + 图元声明  →  绘图通道  →  LWC 积木
     ▲
     └── 算法的产出也只是数据
```

用户掌握的是：有哪些图元、数据怎么对齐、画在主图还是副图。「怎么算 MACD」不是这个入口的知识。

## 6. 通道入口的词汇（绘图方言，不是公式语言）

不是一门语言，是一份很小的声明表：

1. **主序列**：K 线（OHLC），定义时间域。
2. **附属序列**：量、均线、MACD 柱……每条声明画法（蜡烛 / 柱 / 线 / 面积）和位置（主图叠加或新副图），以及颜色、线宽等样式。柱状图可以带 **逐根颜色**（例如 MACD 柱正负）。
3. **光标读数**：通道吐出「这一根上各序列的值」；图例只是显示器。

内侧独吞、外侧永不出现的词：`createChart`、`priceScaleId`、`stretchFactor`、`ResizeObserver`、`seriesData.get`、markers 插件 API。

换股、切复权、加 MA、加副图，对通道来说都是同一句话的变体：**换一批序列 / 改一条序列。** 不是新架构。

副图不是第二张图，只是 **同一时间视口上的另一条值轴、另一块垂直槽**。时间域和光标仍然只有一份。

## 7. 通道要守住的不变量

- 只有 **一个时间域**（主 K 线说了算）。
- 所有图元必须对齐到这个域；对不齐的点丢掉或留空，通道不负责重算。
- 只有 **一个光标**（同一个 time 去问所有序列）。
- 视口（缩放、平移、尺寸）交给 LWC，通道不做投影。

## 8. 用 MACD 验证入口（讨论中的用例）

绘制 MACD 的正确用法：

1. **门外算完**：得到已对齐到同一批交易日的 `dif`、`dea`、`macd`。
2. **通道口声明**：
   - 位置：新副图（与主图共用时间轴，自己的值轴）
   - `dif`、`dea`：线；颜色、线宽
   - `macd`：柱；大于零红色、小于零绿色（逐根颜色，不是整条序列一个色）
3. **三根挂在同一个副图上**，不要各开一个 pane。
4. **组件内部翻译**成 LWC 的 pane + 两条 `LineSeries` + 一条 `HistogramSeries`。
5. 换股时重新计算再送数；声明可以不变。
6. 光标移到某一天，通道把当天的 dif / dea / macd 一起还出来，副图读数才能接上。

主图均线是同一句话：算好数值，声明「主图、线、颜色线宽」。组件不解释「MACD 是什么」或「MA 怎么算」。

## 9. 对当前实现的含义

现有 `KlineChart` 已经碰到内核（建视口、蜡烛 + 成交量两条序列、`setData`、resize、光标），并混入了非内核（`OhlcvBar` 映射、成交量涨跌色、`PriceLegend`）。

下一阶段要守住的中心：

**组件的中心是「一个时间视口 + 若干序列 + 一次光标查询」。**  
序列可以变多，显示器可以变多，数据源可以换，这个中心不要变。

落地顺序上：先稳定绘图通道的入口（时间域、图元声明、光标读出），再往入口上加 MA / 副图；不要先做公式解释器，也不要按参考项目把页面功能搬进组件。

---

# 第三部分　图元声明：Python 脚本是否可行

> 讨论起点：通道最具体的环节是「金融图元声明 → LWC 拼装」。作者希望像在 Cursor / VS Code 里写 Python 那样编写指标脚本，保存后画到图上；并考虑在 Renderer 放一个 Python 编辑器，用 Python 充当通达信 / TradingView 那样的脚本语言。

## 1. 先把三个问题拆开

这句话里叠了三件不同的事：

| # | 问题 | 它其实是什么 |
|---|---|---|
| A | Renderer 里要不要有 Python 编辑器 | **作者体验**（语法高亮、保存、报错），与图表引擎无关 |
| B | 指标脚本用 Python 写，算完还能上图 | **脚本运行时**（在已有 Python worker 里 exec） |
| C | 绘图通道的入口是不是 Python 源码 | **图元声明的形状**（通道吃什么） |

A 和 B 可行，而且和现有进程边界对齐。C 不行：图表组件如果去读 / 跑 Python，就把「翻译通道」做成了第三套公式引擎，第二部分的结论会被推翻。

结论先说：

- **可以**用 Python 写「能上图的指标」，体验对齐通达信 / Pine 的「写了就能看见」。
- **不可以**让 LWC 通道直接解释 Python。Python 是声明的**生产者**，不是声明本身。
- Renderer 里的编辑器只编辑文本；**运行发生在 Python worker**。不要在 Chromium 里嵌解释器（Pyodide 等）。

## 2. 图元声明是契约，不是语言

通道入口必须是一份**小而稳的数据结构**（下文称 `PlotSpec`），不是源码。理由：

1. 翻译是机械的：`kind + pane + style + 对齐数据` → LWC 的 pane / series / `priceScaleId`。入口一旦是语言，通道就要解析、求值、处理副作用。
2. 生产者可以有多个：内置 MA、点选「叠加均线」、用户脚本、以后的策略买卖点，都应吐出同一种 spec。通道不区分来源。
3. 换股、切复权、滚动窗读时，声明往往不变，变的是数据。源码每次都重新解释没有好处。
4. 契约可校验、可版本化、可走 `contracts/`；Python AST 不能当跨进程协议。

`PlotSpec` 需要覆盖的词汇仍然只有第二部分那张表：

| 字段 | 含义 | 外侧说法 |
|---|---|---|
| `id` | 这条序列的名字 | 光标读数、图例用 |
| `pane` | `main` 或某个副图键 | 主图叠加 / 新副图；同一键 = 同一副图 |
| `kind` | `candle` / `line` / `histogram` / `area` | 画法 |
| `style` | 颜色、线宽；柱可逐根色 | 样式 |
| 数据 | 已对齐到主 K 线时间域的值 | 通道不计算 |

示意（协议形态，不是最终 JSON）：

```text
ChartInput
  timeDomain: ["2024-01-02", "2024-01-03", ...]    # 主 K 线说了算
  primitives:
    - { id: "kline", pane: "main", kind: "candle" }
    - { id: "volume", pane: "main", kind: "histogram", style: { overlay: "bottom" } }
    - { id: "dif",    pane: "macd", kind: "line", color: "..." }
    - { id: "dea",    pane: "macd", kind: "line", color: "..." }
    - { id: "macd",   pane: "macd", kind: "histogram", colorPerBar: true }
  series:
    kline: [{ time, open, high, low, close }, ...]
    volume: [{ time, value, color }, ...]
    dif / dea / macd: [{ time, value }, ...]
```

通道内侧仍独吞：`createChart`、`priceScaleId`、`scaleMargins`、`stretchFactor`。`pane: "macd"` 三根挂一起、成交量压在主图底部，都是翻译规则，不出现在脚本作者的词表里。

**图元声明 = `PlotSpec` + 对齐数据。** 这才是「翻译通道」的入口。

## 3. Python 在这条链上的正确位置

通达信 / Pine 把「算」和「画」绑在同一种脚本里。本仓库也可以绑在**同一份用户脚本**里，但必须在脚本**返回值**上拆开：

```
Renderer 编辑器（只是文本框）
        │  保存源码
        ▼
  SQLite / userData（业务：脚本文本 + 元数据）
        │  换股 / 改参时 ApplicationService 编排
        ▼
  Python worker 执行脚本
        │  输入：已对齐的 OHLCV
        │  输出：series 数据 + PlotSpec
        ▼
  绘图通道（Renderer）
        │  只吃 PlotSpec + 数据
        ▼
  lightweight-charts
```

脚本作者的心智模型可以很像 Pine：

```python
def compute(ohlcv):
    dif, dea, hist = macd(ohlcv.close)
    return output(
        subplot("macd",
            line("dif", dif, color="#f5a623"),
            line("dea", dea, color="#4a90d9"),
            histogram("macd", hist, color_by_sign=("#ef5350", "#26a69a")),
        )
    )
```

`line` / `histogram` / `subplot` 不是给图表组件看的 Python 语法，而是 **worker 里一个很薄的绘图方言库**：调用它们只是在构造 `PlotSpec`。算（numpy / pandas）和画（plot API）可以写在同一个函数里，出 worker 之后只剩数据 + 声明。

这与第二部分不矛盾，而是把它补全：

- 「算法在门外（Python）」——脚本的计算部分。
- 「进门的只有数据」——再加一句：进门的还有这份数据对应的 `PlotSpec`。
- 「不要在 Renderer 做公式语言」——仍然成立；公式（如果有）是 CPython，不是 Chromium。

## 4. 和通达信 / Pine 的同与不同

| | 通达信 / Pine | 本仓库该怎么做 |
|---|---|---|
| 作者写什么 | 一种专用公式语言 | **Python**（计算层已经是它） |
| 算和画是否同一份脚本 | 是（`MA` + `PLOT`） | **可以是**，但返回值拆成数据 + `PlotSpec` |
| 运行在哪 | 产品内置解释器 | **已有 Python worker**，不要再造解释器 |
| 图怎么知道画什么 | 解释器边算边调绘图原语 | worker 算完一次性交出 spec；通道翻译 |
| 编辑器 | 内置公式框 | Renderer 里 Monaco 一类编辑器，**只编辑、不执行** |
| 用户学什么 | 公式语法 + 绘图函数 | Python + 一小份 plot API（pane / kind / style） |

相似的是产品体验：**写脚本 → 保存 → 图上出现线/柱**。  
不相似的是实现：不自研 DSL，不把解释器放进图表组件，不把编辑器当成运行时。

用 Python 当「公式语言」的好处是真实的：用户和仓库都已经认 Python；MA / MACD 不必先翻译成另一套语法；`compute.indicator` 的架构坑已经留好。代价也要说清楚：完整 Python 比 Pine 难沙箱，见第 7 节。

## 5. Renderer 里的 Python 编辑器：可行，但只做编辑器

在 Electron Renderer 放 Monaco / CodeMirror，Python 高亮、多文件、保存——技术上没问题，也不违反「Renderer 纯展示」：它展示和编辑的是**文本**，和展示 K 线是同一类 UI。

它**不是** Python 运行时。不要用 Pyodide / WASM 在 Renderer 跑脚本：

- 会得到第二份 Python，与 worker 的 pandas / DuckDB / 行情库脱节。
- Renderer 按规定不直连 Python / SQLite。
- 包体、内存、与主 worker 状态同步都是额外税。

「像 Cursor / VS Code 那样写」要分层，避免一上来做 IDE：

| 档位 | 能力 | 何时做 |
|---|---|---|
| 必做 | 高亮、保存、跑一次、把 worker 的 traceback 标回编辑器 | 自定义脚本真要给用户写时 |
| 有用 | 针对 plot API 的补全（`line` / `subplot` / 字段名） | 脚本 API 稳定之后 |
| 可后置 | 完整 LSP、跳转定义、调试器、AI 补全 | 不是绘图通道的事 |

编辑器保存的是业务数据（脚本文本、名称、参数 schema），走现有路径：Renderer → IPC → ApplicationService → SQLite。跑图时 Main 把「当前标的的 OHLCV + 脚本」交给 worker，再把 `PlotSpec` 送回图表。编辑器和图表是两个 UI，共用同一份脚本记录，不要把 Monaco 嵌进 `KlineChart`。

## 6. 内置指标与自定义脚本应是同一出口

点选「MACD」和用户自己写一份 MACD，通道看到的必须一样：若干 primitives + 对齐 series。差别只在 worker 里谁构造了这份 spec。

```
内置 macd.py  ──┐
用户脚本 .py  ──┼──► PlotSpec + series ──► 绘图通道
点选「主图 MA」─┘     （若点选只是填参，仍走同一内置函数）
```

因此落地顺序不是先做编辑器，而是先让**任何来源**都能交出合法 `PlotSpec`。编辑器只是最后一个生产者。

## 7. 必须单独面对的约束

**沙箱。** 用户脚本若在现有 worker 里 `exec`，同一进程里有 DuckDB、行情库、Token、文件系统。这和「公式语言只能算数列」不是一个风险级别。可选路径（由严到松）：

1. 先只跑仓库自带的内置脚本（用户不能任意 exec）——通道和 plot API 照样能验。
2. 用户脚本进**单独子进程**：只注入 OHLCV 与 plot API，不注入 worker 内部模块，算完退出；Main 只收 `PlotSpec`。
3. 同进程 `exec` + 白名单 import：实现快，逃逸面大，不建议作为默认。

**对齐。** 脚本吐出的序列必须对齐主 K 线时间域。错位的点丢掉或留空，通道不重算。plot API 应在 worker 侧就按 `ohlcv.time` 对齐，把脏数据挡在门外。

**错误回传。** 语法错误、运行时错误、`PlotSpec` 校验失败，都要作为控制面结果回到编辑器，而不是让图表吞异常或画半截。通道只接受通过校验的 spec。

**主序列仍是 K 线。** 用户脚本默认是附属图元（叠加或副图），不负责重新定义时间域。否则「一个时间域、一个光标」被打破。

## 8. 对「翻译通道」具体化意味着什么

通道的实现对象现在可以写死：

1. **入口类型**：`ChartInput = { timeDomain, primitives, series }`。
2. **翻译器**：按 `pane` 分组 → 主图 overlay vs 新 pane；按 `kind` 调 `addSeries`；逐根色走数据上的 `color`，不走「整条序列一个色」的捷径。
3. **光标**：对当前 time 把所有 `primitives[].id` 的值一并读出。
4. **非入口**：Python 源码、OHLCV 原始业务行、指标算法名（「MACD」不是通道词汇）。

Python 脚本、编辑器、保存，都属于 **Application 编排 + Compute**，不属于图表组件。图表组件仍然是：吃声明，吐像素和光标。

## 9. 落地顺序（仍先契约，后编辑器）

1. 把 `PlotSpec` / `ChartInput` 写成跨语言契约（TS + 校验），用硬编码的 MACD 数据走通「声明 → 副图三根」。
2. 在 Python worker 提供 `line` / `histogram` / `subplot` / `output`，让内置 MACD / MA **函数**返回同一 spec（此时还没有用户编辑器）。
3. ApplicationService：读布局（哪些指标实例）→ `compute.indicator` → 把 spec 交给图表。
4. 需要自定义公式时，再加脚本存储 + Renderer 编辑器 +（建议）独立脚本子进程。

若先做 Monaco，通道入口还是现在的 `KlineChart(bars)`，编辑器和上图之间仍缺那条翻译通道，编辑器会变成空壳。

---

## 附录　一句话对照

| 问题 | 结论 |
|---|---|
| 库是什么 | 图表第一性原理的实现（乐高） |
| 参考项目是什么 | 功能对照，不是架构 |
| 本组件是什么 | 金融图元声明 → LWC 拼装的翻译通道 |
| 算法在哪 | 门外（Python）；进门的只有数据 |
| 使用者学什么 | 通道入口：数据 + 画法 + 主图/副图 + 样式 |
| 入口是否等于通达信 | 否。那是计算语言；这里是绘图方言 |
| 图元声明是什么 | `PlotSpec`（数据结构），不是 Python 源码 |
| Python 脚本是什么 | `PlotSpec` 的生产者：算数列 + 调用 plot API |
| Renderer 编辑器做什么 | 只编辑/保存文本；执行在 Python worker |
| 可否在 Renderer 跑 Python | 否。不要 Pyodide；不要让图表 eval 脚本 |
