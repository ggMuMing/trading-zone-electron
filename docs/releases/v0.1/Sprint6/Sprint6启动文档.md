> 完整说明见：[Sprint6 迭代文档](./Sprint6迭代文档.md)。来源见 [Sprint5 迭代文档](../Sprint5/Sprint5迭代文档.md) 第 6.2 节与架构文档「后续 lightweight-charts」。

# Sprint6 启动：图表页最小实现

## 来源

Sprint6 开始基于 `lightweight-charts` 画图。迭代会确认：**本轮只做图表页面布局的最小实现**，不接指标、分组与图表高级交互。参考实现见 `E:\Trading\back-trade-app-main` 的图表页工具栏与主图 K 线/成交量，不搬整份 `ChartComponent`。

## 现状

- 侧栏只有配置 / 行情；行情页右侧是日线表，没有图表页。
- 左侧全量选股（`StockPicker` + 虚拟列表）与 `market:query`（含复权）已在 Sprint5 / 5.1 就绪。
- `package.json` 尚未加入 `lightweight-charts`。
- 仓库没有分组、指标计算或图表组件。

## 目标

侧栏进入新「图表」页；布局与行情页相同（左股票列表、右内容）。右侧换为：工具栏占位 + 主图日线 K 线与成交量。

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 新入口与两列布局 | 侧栏可进图表页；左 `StockPicker` + 可拖拽分隔条 + 右内容，不改行情日线表 |
| G2 | 左列选股换图 | 全量列表点选后，右侧展示该股日线 |
| G3 | 工具栏 | 可见股票名/code、复权、加入分组、指标；复权接通；后两项无业务 |
| G4 | 主图 K 线 + 成交量 | 同 pane 蜡烛与成交量柱；无数据/未选有空态；窗口缩放图表跟着变 |

## 已拍板

1. 新页面 `chart`，不替换行情日线表。
2. 复权本轮接通（`none` / `qfq` / `hfq`），走现有 `market:query`。
3. 「加入分组」「指标」仅占位。
4. 成交量与 K 线同一 pane，用 `scaleMargins` 压在底部。
5. 先复制行情页分隔条，不抽公共 hook；不搬参考项目 1600+ 行 `ChartComponent`。

## 本文件不包含

- 指标计算、分组、副图、十字光标状态栏、画线、买卖点。
- Arrow 直传 Renderer、改同步协议、改行情表。
- 新的 acceptance 脚本。
