# 需求一：优化UI图表页面布局和交互逻辑
## Epic1：图表上方的状态栏（symbol、复权、选择指标按钮）调整
- 调整状态栏布局：当前布局是symbol单独在最左侧，其他按钮放在最右侧。现在统一调整为都放在左侧按顺序onebyone地排列，并且中间用竖线隔开。排列顺序是symbol、分组、周期（新加入）、复权、指标
- 加入分组按钮的标题缩减为两个字：“分组”
- 新加入“周期”按钮，并配一个图标。默认为“日”，点击按钮显示下拉菜单，暂时提供“日、周、月、季、年”五个选项，除了日，其余四个设为不可选
- 复权从当前三种复权并列改为【单个按钮，点击菜单选择】的方式

## Epic2：在图例上添加功能按钮
- 阅读`E:\Trading\trading-zone-electron\参考frontend\src\components\ChartComponent\StatusBar\indicatorChartStatusBar.tsx`和`E:\Trading\trading-zone-electron\参考frontend\src\components\ChartComponent\StatusBar\mainChartStatusBar.tsx`代码，参考其实现
- 添加删除按钮图标、添加修改按钮图标。这两个功能和指标弹框中相同
- 上移下移副图窗格功能。
  - tradingview支持窗格以任何顺序排序。我们的应用有主图副图之分。主图必须始终排列在首位，多个副图支持随意调整顺序。
  - 需要检查代码是否支持保存布局顺序
  - 添加上移下移窗格的图标按钮

## Epic3 调整自定义指标编辑器
- tradingview中pine脚本编辑器是一个z-index在主图之上，从右侧弹出的独立视图：E:\Trading\trading-zone-electron\docs\releases\v0.2\Sprint2\trading-pine视图.png
- 在当前项目中，在指标弹框中点击创建指标按钮，结果是弹出一个弹框。目标是改成tradingview的样式。点击创建->关闭弹框->从右侧弹出脚本编辑器
- 脚本编辑器需要同时支持创建新脚本和修改脚本的功能

- 新的脚本编辑器视图布局如下：
  - 左上方显示标题：`脚本编辑器`
  - 右上方显示“❌”关闭图标
  - 下方一行采用space-between布局，包括下列元素：
    - 最左侧：一个下拉菜单按钮
      - 按钮文本显示：`当前脚本名称`
      - 下拉菜单可以：
        - 修改脚本名称:弹出对话框，里面包括一个修改脚本名称的输入表单、保存取消按钮
        - 选择已创建的指标进行修改
    - 按钮右侧是`执行按钮图标`：功能是测试代码
    - 最右侧：`发布脚本`按钮——根据判断新创建还是修改执行对应的操作
  - 剩下部分是编辑器
  - 脚本编辑器容器可以通过拖拽调整宽度，允许覆盖整个可视窗口宽度

---

# 需求二：对齐 TradingView 触发执行脚本的事件驱动模型

> 承接 [v0.2 release §3.4](../release文档.md)。
>
> 对照对象：图表上**已经挂载的脚本实例**何时重新「开采 + 加工」（`chart:build` → `compute.indicator`）。脚本编辑器里的「执行」走 `indicatorScript:try`，是干跑/试跑，**不属于**本事件表。

## Why

当前 ChartPage 用 React `useEffect` + `applyLayoutAndReload` 隐式决定何时重算，没有一份可对照的事件表。结果是：该触发的（切周期、点刷新）没触发，不该整表重算的（改名、移窗格）却整表重跑。要对齐 TradingView，先把「什么用户动作发出执行事件」写死，再让代码只从这一张表出发。

## What

图表上已加载的脚本，**只**在下列用户动作发生时重新执行；一次动作对应一次「执行脚本」事件，由 UI Controller（`ChartPage`）向 Script / Protocol 下单，Chart（`KlineChart`）不发单。

### 必须触发（与 release 3.4 一一对应）

| 事件 ID | 用户动作 | 项目语义 | 执行范围 |
|---|---|---|---|
| E1 | 在图表上加载一个新的 Symbol | 左侧选股 / 切换 `ts_code` | 布局内全部实例 |
| E2 | 切换时间框架 | 顶栏「周期」变更 | 布局内全部实例 |
| E3 | 切换复权 | 顶栏复权菜单变更（项目自身需求，TV 无对等项） | 布局内全部实例 |
| E4 | 添加指标到图表 | 指标弹框 / 其它入口把脚本实例写入 layout | 布局内全部实例（含新实例） |
| E5 | 脚本「设置」对话框中修改了一个参数 | 设置弹框**保存**后，`params.inputs` 或 `params.styles` 相对打开时有变化 | 布局内全部实例 |
| E6 | 页面刷新 | Electron 窗口刷新 / Chart 页重新挂载；以及顶栏「刷新」按钮 | 布局内全部实例 |

### 允许触发（3.4 未列，但产品合理）

| 事件 ID | 用户动作 | 说明 |
|---|---|---|
| E7 | 从图表移除一个指标实例 | 需要重建 ChartInput，去掉该实例的序列 |
| E8 | 已上图脚本的源码发布成功 | 算法变了，必须按新源码重算 |

### 禁止当作执行事件（不应走 `chart:build`）

| 动作 | 原因 |
|---|---|
| 仅调整副图上下顺序 | 只改 `sort_order` / 窗格排列，算法与行情未变 |
| 仅修改脚本标题（改名） | 元数据，不影响计算 |
| 打开设置弹框但点取消 / 保存了相同参数 | 没有参数变更 |
| 脚本编辑器「执行」按钮 | 走 `indicatorScript:try`，不改图表挂载结果 |
| 仅切换顶栏「分组」（占位） | 本迭代分组仍无业务含义 |

### 本迭代对 E2 的边界

- 需求一已把周期按钮做成 UI：默认「日」，周 / 月 / 季 / 年禁用。
- 需求二要求：**事件表必须包含 E2**；`period` 必须进入执行入口的入参 / 依赖，不能再只改按钮文案。
- 周 / 月 / 季 / 年的**真实行情聚合**仍不做（与需求一一致）。日线是当前唯一可选周期；E2 的接线先立住，其它周期启用后应自动发出同一事件。

## Epic / 用户故事

- **US4** 作为使用者，我在选股、切复权、切周期、刷新页面或点刷新后，图表上的指标按新行情重算，从而看到与当前 Symbol / 复权 / 周期一致的线。
- **US5** 作为使用者，我添加指标或在设置里改参数并保存后，图上的线立即按新实例 / 新参数重算，从而不必手动刷新。
- **US6** 作为使用者，我只改脚本名字或只上下移动副图时，图上的线不重算、不闪，从而操作轻量。

## Acceptance Criteria

```text
Given 图表已挂载至少一个脚本实例且有日线数据

When 用户切换 Symbol（E1）或切换复权（E3）
Then 发出一次执行事件，chart:build 带上新的 ts_code / adjust，图上指标更新

When 用户将来切换周期（E2）
Then 同一执行入口被调用，period 出现在入参或依赖中（本迭代仅 day 可选）

When 用户添加指标（E4）或在设置弹框保存了不同的参数（E5）
Then 发出一次执行事件，新实例或新 params 出现在 compute.indicator 的 instances 里

When 用户刷新窗口 / 重新进入图表页，或点击顶栏刷新（E6）
Then 在 selectedCode 仍有效时发出一次执行事件

When 用户只改脚本标题，或只上移/下移副图
Then 不调用 chart:build；布局或标题仍然持久化

When 用户在脚本编辑器点「执行」
Then 只走 indicatorScript:try，不改变当前图表挂载的序列
```

## How（实现约束，供任务拆解）

- UI Controller 只保留**一个**图表执行入口（现有 `loadChart` 或显式 `executeScripts`），所有 E1–E8 只调用它。
- Chart（`KlineChart` / 图例）继续不调 IPC。
- E1 / E3 / E6 用状态依赖触发时，依赖集合必须能覆盖「刷新」：不能只靠 `selectedCode + adjust + queryEnd`（三者不变时点刷新也会漏触发）。
- E5 以「保存且 params 有变化」为准，不是输入过程中的每次 keystroke。
- E7 / E8 可以继续走「改 layout / 源码后再执行」；移窗格、改名必须从这条链路拆出去（只写仓、改本地 layout，不 `loadChart`）。
- 不改 Script 方言、不改 `ChartInput` Schema；周期真实行情仍不进 `MarketQueryParams`（E2 先接线）。

## Done

- 事件表（必须 / 允许 / 禁止）写进本文件与迭代文档，并与代码路径一一对照。
- 原审计「不符合」项已改：`executeScripts` 唯一入口；E2 `period` 在依赖中；E6 刷新走 `scriptRunNonce`；E5 `paramsEqual`；改名不 build；移窗格 `setLayout` + `pane.moveTo`。
- US4–US6 的 Given / When / Then：`npm run typecheck` 已通过；Electron 窗内手工点验待单实例补跑。
