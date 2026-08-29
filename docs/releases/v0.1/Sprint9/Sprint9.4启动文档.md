> 完整说明见：[Sprint9.4 迭代文档](./Sprint9.4迭代文档.md)。来源见 [Sprint9.3 迭代文档](./Sprint9.3迭代文档.md) 第 6.1 节、[Sprint9 头脑风暴文档](./Sprint9头脑风暴文档.md) 档 E。开发计划 Cursor plan `sprint9.4_档e编辑器_b134c03e`。

# Sprint9.4 启动：Renderer 编辑器（只编辑）

## 来源

Sprint9.3（档 D）已能把用户脚本挂到当前布局并出图。编辑器仍是 TextField：没有高亮、「跑一次」、traceback 回标。头脑风暴档 E：Renderer 编辑器只编辑；保存 / 跑一次 / traceback 回标。验收：语法错误标到行；图不画半截。

## 现状

- 脚本 Dialog 源码是等宽 `TextField`，保存直接写 SQLite，不 load 类。
- 没有「跑一次」；坏脚本只能在 `chart:build` 时被 compose 丢掉，编辑器看不见 traceback。
- `compute.indicator` / compose 仍会吞掉单条脚本错误，不能拿来做试跑。
- 默认新建骨架仍是 `NotImplementedError`。

## 方案结论（已拍板）

- 编辑器只编辑文本；执行仍走档 C 子进程。禁止 Pyodide，禁止复用 `compute.indicator` 做试跑。
- **保存**：先 `load`（compile + `indicator = 子类`），失败不入库；不调用 `compute()`，不抽 `manifest()`（仍 `emptyScriptManifest`）。默认骨架可以保存。
- **跑一次**：对当前草稿（不必先保存）；用当前选股窗口 `query` + `params={}`；不写布局、不替换当前图。无选股 / 空窗口 → 控制面错误，无行号。
- **traceback 回标**：Python 解析 `<user_indicator>` 帧，返回 `line` / `column`；Monaco marker + 底部错误文本。
- Monaco 本地打包（`monaco-editor` + `@monaco-editor/react` + `loader.config({ monaco })`），禁止 CDN。
- 新 worker 方法 `compute.script_try`：信封 `ok: true`，用户脚本对错放在 result 里。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | Monaco 源码编辑 | 脚本 Dialog 用 Monaco 替换源码 TextField；Python 高亮；不嵌进 KlineChart |
| G2 | 保存先 load | load 失败不入库，traceback 标到行；成功则走现有 create/update |
| G3 | 跑一次 | 当前窗口试跑；通过只提示；失败标到行；图不画半截 |

## 本文件不包含

- 保存时 load 类抽 `manifest.fields`、按 schema 渲染设置表单（档 F）
- plot API 补全、LSP、调试器
- 改默认新建骨架、改 `chart:build` 丢实例策略、改 `ChartInput`
