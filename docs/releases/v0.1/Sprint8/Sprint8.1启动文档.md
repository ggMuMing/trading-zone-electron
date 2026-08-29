> 完整说明见：[Sprint8.1 迭代文档](./Sprint8.1迭代文档.md)。来源见 [Sprint8 迭代文档](./Sprint8迭代文档.md) 第 6.1 节短期目标 1。开发计划 Cursor plan `sprint8.1_布局参数_f1ee2728`。

# Sprint8.1 启动：改布局实例参数

## 来源

Sprint8 已把 MA / MACD 做成可持久化的增删读；布局 `params` 只在添加时从目录拷默认，弹窗不能改。颜色与线宽写死在 Python 常量里。本轮补上实例的「改」：周期、颜色、线宽。

## 现状

- `chart_layout_item.params` 仅算法字段：MA `{period}`、MACD `{fast,slow,signal}`。
- 无 `chartLayout:update`；IndicatorDialog 只有添加 / 删除。
- `ChartInput.primitives[].style` 已支持 `color` / `lineWidth`（1–4）；通道只在新建 series 时读取，同 id 改色宽不会 `applyOptions`。
- 选股仍是 `queryOhlcv` + `compute.indicator` 两跳（本轮不做）。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 改算法参数并落库 | 已挂 MA/MACD 可改周期类参数；重启仍在；MA 周期变化后 primitive id 为 `ma{n}` |
| G2 | 颜色与线宽进 params | 经 `compute.indicator` 进 `style` / 柱逐根色；同 id 改色宽图上立刻变 |
| G3 | 弹窗「设置」 | 当前实例可打开表单保存；已挂项仍不能再加 |

## 已拍板

1. 算法参数与样式混存在现有 `params` JSON，不另开 `style` 列。
2. MACD 走宽样式：DIF/DEA 色+宽，柱涨跌两色。
3. 旧库行缺样式字段时读出补目录默认；不强制 SQL 迁移。
4. 表单按 builtin 写死两套，不做通用 schema 生成器。

## 本文件不包含

- 选股两跳 worker 合并或缓存
- 同种指标多条、多套布局、按股票记忆
- 自定义脚本、编辑器、`compute.indicator` 句柄 / 批处理
- 改 `ChartInput` Schema 词汇
