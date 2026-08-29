> 完整说明见：[Sprint9.5 迭代文档](./Sprint9.5迭代文档.md)。来源见 [Sprint9.4 迭代文档](./Sprint9.4迭代文档.md) 第 6.1 节、[Sprint9 头脑风暴文档](./Sprint9头脑风暴文档.md) 档 F。开发计划 Cursor plan `sprint9.5_档f_c33863d9`。

# Sprint9.5 启动：保存抽 manifest + 通用设置表单

## 来源

Sprint9.4（档 E）已能 Monaco 编辑、保存先 load、跑一次回标。保存仍写 `emptyScriptManifest`；设置弹窗仍按 builtin 写死 `MaForm` / `MacdForm`，脚本没有设置。头脑风暴档 F：按 `manifest.fields` 渲染设置表单；本轮把「保存抽 `manifest()`」一并做完。

## 现状

- Python `Indicator.manifest()` 已能抽出 `fields` / `defaultParams`；内置 MA / MACD 的 Field 已写全。
- 脚本保存只 load，入库空壳 `{ fields: [], defaultParams: {} }`。
- `IndicatorDialog` 按 `ref === 'ma' | 'macd'` 分支画表单；脚本布局项没有「设置」。
- `chartLayout:update` 只允许 builtin；catalog 只有 `key` / `title` / `params`，没有 `fields`。

## 方案结论（已拍板）

- **抽 manifest 挂在现有 `compute.script_try` 上**：无 query 时 load 后立刻 `cls.manifest()`；失败视为 try 失败。不新开 worker 方法。
- **入库以 Main 再抽一次为准**：`create` / `update` 仍是 `{ title, source }`；Service 内部再 try，用返回的 `manifest` 写入。Dialog 现有 try 只负责 marker。
- **`script.title` 仍是用户显示名**；`manifest.key` / `manifest.title` 来自类 ClassVar。
- **内置 fields 写进 TS catalog**，与 Python `manifest()` smoke 锁死。本轮不从 Python 启动下发 catalog。
- **widget 第一档仍只有** `int` / `float` / `color` / `lineWidth`。
- **脚本改字段后重物化已上图实例**：保留仍存在的键，缺的补 `defaultParams`，未知键丢掉。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 保存抽 manifest | load 成功后脚本表写入类 `manifest()`；坏 Field 不入库；骨架 `fields=[]` 仍可保存 |
| G2 | 通用设置表单 | 内置去掉 MaForm/MacdForm；按 `fields` 画控件；改周期后图变，重启仍在 |
| G3 | 脚本可调参 | 脚本布局项可开设置；改 Field 后已上图实例重物化；改值后上图 |

## 本文件不包含

- 启动时从 Python `manifest()` 下发内置 catalog
- 自由字符串 / 布尔 / 枚举 / 嵌套对象
- 改 `ChartInput`、compose 丢实例策略、默认新建骨架
- plot API / LSP；跑一次不读设置表单
