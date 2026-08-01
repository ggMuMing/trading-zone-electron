# 示例：如何从素材填六段结构

以下摘自 Sprint1 的写法，说明每段应有的密度（非完整粘贴）。

## 文首

```markdown
# Sprint1 迭代文档

> 状态：**已完成**
> 关联：[`sprint1启动.md`](./sprint1启动.md)、[架构文档](../trading-zone-electron架构文档.md)、[开发计划](…)
```

## 1. 目标 — 验收口径要可测

```markdown
| # | 目标 | 验收口径 |
|---|---|---|
| G1 | Electron + React UI，经 Main/SQLite 交互 | `npm run dev` 起窗；UI 可读写业务库 |
| G3 | UI → Main → Python → SQLite → UI | 同步后表有数据，重启仍可加载 |
```

范围边界单独列出「本迭代不做」，防止和架构愿景混淆。

## 2. 功能 — ID + 状态

```markdown
| ID | 功能 | 优先级 | 状态 |
|---|---|---|---|
| F03 | Python NDJSON worker + data.sync.stock_list | P0 | 已完成 |
| F09 | 无头验收脚本 npm run acceptance | P1 | 已完成 |
```

## 3. 设计 — 写真实路径

- 画 Renderer → IPC → ApplicationService → SQLite / Python
- 写出真实文件：`src/main/bridge/pythonBridge.ts`、`contracts/stock_list.request.json`
- 协议给最小 JSON 示例，勿空谈「消息队列」

## 4. 任务 — 与开发顺序一致

```markdown
| 步骤 | 任务 | 产出 | 状态 |
|---|---|---|---|
| 1 | 脚手架 | 可 dev 的壳 | 已完成 |
| 4 | pythonBridge + ApplicationService | stocks:sync | 已完成 |
```

## 5. 测试 — 允许 skip，禁止假 PASS

```markdown
| 检查项 | 结果 | 说明 |
|---|---|---|
| 无 Token 同步报错 | 通过 | acceptance 断言 |
| 有 Token 真同步 | 待补跑 | 环境未配置 TUSHARE_TOKEN |
```

## 6. 改进 — 能变成下一 Sprint 的 G/F

```markdown
### 6.1 短期
1. 补跑有 Token 端到端验收
2. 架构文档补进程拓扑与 Token 存放

### 6.2 中期
1. 行情数据面：DuckDB + Arrow 窗读
```

## 完整参考

仓库内已落地文档：

`prompt/trading-zone-electron开发文档/Sprint1/Sprint1迭代文档.md`
