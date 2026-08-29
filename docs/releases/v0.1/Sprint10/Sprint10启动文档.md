> 完整说明见：[Sprint10 迭代文档](./Sprint10迭代文档.md)。来源见 [Sprint9.5 迭代文档](../Sprint9/Sprint9.5迭代文档.md) 第 6.3 节、[Sprint9 头脑风暴文档](../Sprint9/Sprint9头脑风暴文档.md)。开发计划 Cursor plan `sprint10_脚本化指标_d8c06942`。

# Sprint10 启动：删除内置指标，全流程改为自定义脚本

## 来源

Sprint9.5 已把脚本保存抽 `manifest()`、通用设置表单做完。内置 MA / MACD 仍走 `REGISTRY` + TS catalog + 图例品种分支。本轮一次拆掉特权路径：布局只挂用户脚本；用同一份 5 线均线源码作为种子、新建骨架和 smoke 金样。

## 现状

- 弹窗仍列出 catalog「均线 / MACD」，`chartLayout:add` 接受 `kind=builtin`。
- 默认布局 seed 写入 `id=ma|macd` 的 builtin 行。
- Python `compose.REGISTRY` 与 TS `INDICATOR_CATALOG` 双份 schema。
- 图例对 builtin MA / MACD 写死；脚本 overlay 只显示 `localName.toUpperCase()`。
- 沙箱未注入 `sma` / `ema`；新建骨架是 `NotImplementedError`；跑一次仍 `params={}`。

## 方案结论（已拍板）

- **不再有产品目录**。弹窗只列用户脚本；删除 `indicators:list` 与 TS `INDICATOR_CATALOG`。
- **布局只允许 `kind=script`**。IPC 拒绝 builtin。旧库 builtin 行启动时删除。
- **5 线 MA 是发版种子脚本**（主键 `seed-ma`），不是 REGISTRY。用户可改、可删；删除后不自动再种。
- **空默认布局自动挂上种子**，避免首次开机空图。已有其它脚本的布局不强制再加。
- **图例不按品种分支**。`line(f"ma{period}", ...)`，显示 `localName.toUpperCase()`。
- **沙箱注入 `sma` / `ema`**。案例与新建骨架都读 `python/worker/indicators/examples/ma.py`，禁止 TS 手抄第二份。
- **跑一次带 `manifest.defaultParams`**，不再传 `{}`。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 无内置 | 弹窗没有均线/MACD 目录项；compose / IPC 拒绝 builtin；旧库 builtin 行被删且能开机 |
| G2 | 全流程脚本 | 新建（5 线骨架）→ 保存抽 manifest → 添加到布局 → 出图 → 设置改 period3 → 图与图例变 → 重启仍在 |
| G3 | 5 线案例 | 种子「均线」默认 5/10/20/60/250 五条主图线；双挂前缀不撞；可删可改源码 |
| G4 | 回归 | smoke 与 typecheck 通过；脚本 MACD 副图 smoke 仍过 |

## 本文件不包含

- 多套命名布局、plot 新图元、LSP、Arrow
- `kind` 列删表、布尔/枚举 widget
- MACD 发版种子（smoke 可保留用户 MACD 源码作回归）
- 改 `ChartInput` v1；把 Monaco 嵌进 K 线图
