> 完整说明见：[Sprint9.1 迭代文档](./Sprint9.1迭代文档.md)。后续档 C 见 [Sprint9.2 迭代文档](./Sprint9.2迭代文档.md)。来源见 [Sprint9 迭代文档](./Sprint9迭代文档.md) 第 6.1 节、[Sprint9 头脑风暴文档](./Sprint9头脑风暴文档.md) 档 B。开发计划 Cursor plan `sprint9.1_脚本表_f9565f3c`。

# Sprint9.1 启动：脚本表 + 图例

## 来源

Sprint9（档 A）已把 MA / MACD 收成 `Indicator` 类并对上 compose。头脑风暴档 B：脚本表 + IPC CRUD，弹窗能列出用户脚本（还不能算）。Sprint9 短期目标 2：图例显示 localName / 参数，不要把 uuid 展示给用户。

## 现状

- 三份存储里脚本表尚未建；布局仍是 `{ id, builtin, params }`。
- IndicatorDialog 只有内置「可添加」与「当前布局」。
- `chart:build` 只跑内置 compose；本轮继续如此。
- KlineChart 已用 `localName` 去掉 `{id}:` 前缀，图例仍无参数（两条均线都叫 MA）。

## 方案结论（已拍板）

- SQLite `indicator_script`：id / title / source / manifest / updated_at。manifest 本轮写空壳，不 load 类、不调 worker。
- IPC `indicatorScript:list|create|update|remove`，走 ApplicationService；删除本轮一律允许（布局尚未引用脚本）。
- 弹窗加「用户脚本」分区：新建 / 编辑 title+source（TextField，不是 Monaco）/ 删除；不能添加到布局。
- 图例：`MA{period}` / `MA{period5}` / `MA{period250}`；副图标题 `MACD {fast}/{slow}/{signal}`。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 脚本表 + IPC CRUD | 新建 / 改 title+source / 删后重启仍在；不调 Python |
| G2 | 弹窗列出用户脚本 | 「用户脚本」分区可列出；有新建/编辑/删除；不能添加到当前布局 |
| G3 | 图例 localName/参数 | 主图 `MA20`/`MA5`/`MA250`；副图标题 `MACD 12/26/9`；不出现 uuid |

## 本文件不包含

- 独立脚本子进程、同进程 `exec`、保存时抽 manifest
- 布局拆 `kind + ref`、`chart:build` 带 source
- Monaco、按 `manifest.fields` 渲染表单
- 改 `ChartInput` Schema、改 compose
