> 完整说明见：[Sprint8.3 迭代文档](./Sprint8.3迭代文档.md)。来源见 [Sprint8.2 迭代文档](./Sprint8.2迭代文档.md) 第 6.1 节短期目标 1。

# Sprint8.3 启动：同种指标多条

## 来源

Sprint8 第一档把布局实例与目录条目绑死：`UNIQUE(layout_id, builtin)`，行 `id` = catalog key。弹窗已挂则不能再加；`compose` 按 builtin 去重。用户无法在同一张图上挂 MA5+MA20，或两套不同参数的 MACD。

## 现状

- SQLite `chart_layout_item`：`UNIQUE(layout_id, builtin)`；种子 `id` = `ma` / `macd`。
- 过桥 `instances: [{ builtin, params }]`，无实例 id。
- 内置图元短名写死：`ma{period}`、`dif` / `dea` / `macd`；MACD pane 写死 `"macd"`。
- 通道按 `primitive.id` 全局唯一做 series diff。

## 方案结论（已拍板）

**实例 id 与 catalog key 分离；primitive id 带实例前缀。**

- 新加布局行 `id` = 去掉横线的 uuid；种子 `ma` / `macd` 不改写。
- `builtin` 可重复；compose 按实例 id 去重。
- `primitive.id = {instanceId}:{localName}`；副图 `pane = {instanceId}`；主图叠加仍 `main`。
- MA 短名固定 `ma`（不再 `ma20`）。
- 图例本轮仍 `primitive.id.toUpperCase()`，不美化。

不做：多套命名布局、按股票记忆、自定义脚本、改 `ChartInput` Schema。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 同种可多条 | 弹窗可连续加两条 MA / 两条 MACD；库无 `UNIQUE(layout_id, builtin)` |
| G2 | 图元不撞 | 两条 MACD 分属两个 pane；id 为 `{id}:dif` 等；删一条只带走该前缀 |
| G3 | 旧布局仍能画 | 已有 `id=ma\|macd` 的行照常 compose（前缀后为 `ma:ma`、`macd:dif`） |

## 本文件不包含

- 多套命名布局、按股票记忆
- 图例改显示 localName / 参数
- 自定义脚本、编辑器、Arrow 传 `series`
- `compute.indicator` 句柄 / 批处理 / 取消 / 缓存键
