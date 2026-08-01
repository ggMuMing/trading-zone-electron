---
name: sprint-iteration-doc
description: >-
  Create or update trading-zone-electron sprint iteration docs using the fixed
  six-section structure (goals, requirements, design, tasks, test results,
  improvements). Use when the user asks to write Sprint docs, 迭代文档,
  SprintN 文档, or to archive a finished sprint under
  prompt/trading-zone-electron开发文档/.
---

# Sprint 迭代文档

为 `trading-zone-electron` 撰写可复用的 Sprint 迭代文档。结构以 Sprint1 为准，后续迭代只替换内容，不改章节骨架。

## 何时使用

- 用户要求「写 / 整理 / 归档」某次 Sprint 迭代文档
- 迭代结束需要沉淀目标、设计、测试与改进项
- 新开 Sprint 需要先写文档骨架

## 输出位置与命名

```
prompt/trading-zone-electron开发文档/
  trading-zone-electron架构文档.md          # 总架构（按需引用，非本 skill 主产出）
  Sprint{N}/
    Sprint{N}迭代文档.md                    # 主文档（必须）
    sprint{N}启动.md                        # 可选：最初目标摘要；主文档顶部互链
```

规则：

- `{N}` 为迭代号，如 `1`、`2`
- 主文件名：`Sprint{N}迭代文档.md`
- 若目录已有启动摘要，主文档「关联」区链过去；启动摘要顶部链回主文档
- 文档用中文撰写

## 工作流程

复制并跟踪：

```
进度:
- [ ] 1. 确认 Sprint 号与状态（进行中 / 已完成）
- [ ] 2. 收集输入：启动目标、计划、代码实现、验收结果
- [ ] 3. 按六段结构写主文档（见下方 + template.md）
- [ ] 4. 补齐关联链接与附录命令
- [ ] 5. 若存在启动摘要，加双向链接
```

### 1. 收集输入（先读后写）

按存在情况读取：

1. 启动目标：`prompt/.../Sprint{N}/sprint{N}启动.md` 或用户给定目标
2. 计划：`.cursor/plans/` 下相关 plan
3. 架构：`prompt/.../trading-zone-electron架构文档.md`
4. 实现：`src/`、`python/`、`contracts/`、`package.json` scripts
5. 测试：acceptance 日志、手工验收记录、用户反馈

未完成项如实标「待完成 / 待补跑」，禁止编造通过结果。

### 2. 写主文档

严格使用下列 **六个一级章节**（编号与标题固定，可增减小节小节）：

| # | 标题 | 写什么 |
|---|---|---|
| 1 | 当前迭代目标 | 一句话目标；G1..Gn 与验收口径；范围边界（不做）；技术选型 |
| 2 | 功能需求 | 用户故事；功能清单表（ID/功能/优先级/状态）；非功能需求 |
| 3 | 详细设计说明 | 架构/数据流（可用 mermaid）；目录；关键模型/协议/IPC/服务/UI/契约 |
| 4 | 任务步骤 | 有序任务表（步骤/任务/产出/状态）；本地复现命令 |
| 5 | 测试结果 / 总结反馈 | 验收清单对照表；关键命令输出摘要；做得好的点 + 暴露的问题 |
| 6 | 改进目标 | 短期 / 中期 / 长期；尽量可执行，并指向下一 Sprint |

文首元信息：

```markdown
# Sprint{N} 迭代文档

> 状态：**进行中** | **已完成**
> 关联：[启动摘要](./sprint{N}启动.md)、[架构文档](../trading-zone-electron架构文档.md)、[开发计划](相对路径)
```

完整骨架见 [template.md](template.md)。示例见 [examples.md](examples.md)。

### 3. 写作约束

- **对齐实现**：设计节描述当前代码真实路径与 API，不写未落地的假接口
- **契约与分层**：涉及跨进程时写清 Renderer → Preload/IPC → ApplicationService → SQLite / Python
- **表格优先**：目标、功能、任务、测试用表，便于下轮 diff
- **范围边界必写**：明确本迭代不做项，避免范围膨胀
- **测试诚实**：skip / 待补跑单独标注原因（如无 Token）
- **改进可承接**：第 6 节条目应能直接变成下一 Sprint 的目标候选
- 不要把整个架构文档复制进迭代文档；只写本迭代增量与关键切片

### 4. mermaid 注意

- 节点 ID 用 camelCase，勿用空格
- 避免在标签中使用未转义的特殊字符
- 不要加 `style` / 点击事件

## 完成后自检

- [ ] 六个一级标题齐全且顺序正确
- [ ] 路径落在 `prompt/trading-zone-electron开发文档/Sprint{N}/`
- [ ] 功能/任务状态与代码一致
- [ ] 测试结果有依据（命令或日志），无虚构 PASS
- [ ] 改进目标可指导下一次迭代
- [ ] 与启动摘要 / 架构文档已互链（若存在）
