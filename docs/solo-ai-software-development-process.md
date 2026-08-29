# 一人领导 AI 开发的软件项目管理流程

> 本文整理自与 ChatGPT 的讨论，目标是把传统敏捷开发思路改造成适合「一个人 + AI」的软件开发流程，并进一步拆分成适合 Cursor Agent 使用的项目规范。

---

## 1. 背景与目标

当前目标：

- 一个人负责产品、架构、开发与最终决策
- 使用 AI Agent / AI 助手承担分析、设计、编码、测试、审查、文档等工作
- 使用敏捷开发的思想规范整个软件开发过程
- 保留项目管理、迭代、复盘、版本管理等概念
- 避免引入过重的流程和文档负担
- 最终形成一套可复用的 Solo AI Software Development Process

核心思想：

> **Human 负责方向、取舍和最终决策；AI 负责执行、分析、实现、测试、审查和文档。**

---

# 2. 整体体系

建议把项目管理分成 6 个层级：

```text
Product Vision
    ↓
Product Roadmap
    ↓
Release / Version
    ↓
Iteration
    ↓
Epic / Feature
    ↓
Story
    ↓
Task / Subtask
    ↓
Git Commit
```

同时增加一条贯穿全生命周期的：

```text
Decision Log / ADR
```

核心关系：

```text
Release
  ↓
多个 Iteration

Iteration
  ↓
多个 Story

Story
  ↓
多个 Task

Task
  ↓
多个 Git Commit
```

需要明确区分：

- **Release / Product Version**：产品层面的交付版本，例如 `v0.1 MVP`、`v1.0`
- **Iteration**：开发节奏，例如一周一个 Iteration
- **Git Version / Commit**：代码历史状态
- **Feature / Story / Task**：需求和执行粒度

---

# 3. 产品层：Product Discovery

## 3.1 Product Vision

在写代码之前明确：

- 我到底在做什么？
- 解决什么问题？
- 为谁解决？
- 提供什么价值？
- 大致采用什么方案？

示例：

```markdown
# Product Vision

## Problem

现在的个人开发者很难管理多个 AI Agent 协作开发的软件项目。

## Target User

独立软件开发者。

## Solution

提供一个轻量级 AI Software Factory。

## Value

降低个人开发者管理 AI 开发流程的成本。
```

---

# 4. Product Backlog

所有可能的想法进入 Backlog。

例如：

```text
BACKLOG

Ideas
├── 支持 GitHub
├── 支持 Jira
├── AI 自动生成测试
├── AI Code Review
├── 自动部署
└── Dashboard

Planned
├── 用户登录
├── Project CRUD
└── Task Management

In Progress
└── Authentication

Done
├── Project Creation
└── Database Setup
```

重要原则：

> **Backlog 是“所有可能做的事情”，不是“我要做的事情”。**

---

# 5. Product Roadmap

Roadmap 描述产品未来方向，不应该细化到具体 Task。

例如：

```text
2026 Q3

v0.1 MVP
├── 用户登录
├── Project
├── Task
└── Git integration

v0.2
├── AI Agent
├── Agent Task
└── Agent execution

v0.3
├── CI/CD
└── Deployment

v1.0
└── Public release
```

Roadmap 应该表达：

```text
方向
 ↓
能力
 ↓
版本
```

而不是：

```text
写 LoginController
修改 UserRepository
修复 JWT bug
```

---

# 6. Release Planning

每一个 Release 应该有明确目标。

例如：

```text
v0.1 MVP
```

Release Goal：

> 用户能够创建项目，并通过 AI Agent 完成一个简单的软件开发任务。

然后定义 Epic：

```text
v0.1

Epic 1 — User Management
Epic 2 — Project Management
Epic 3 — AI Agent
Epic 4 — Git Integration
```

---

# 7. Epic → Story → Task

## 7.1 Epic

例如：

```text
AI Agent
```

Epic 描述一个较大的产品能力。

## 7.2 Story

例如：

> 作为项目负责人，我希望创建一个 AI Agent，从而让 AI 帮我执行开发任务。

Story 应该从用户价值和行为出发。

## 7.3 Acceptance Criteria

例如：

```text
Given 用户已经创建 Project

When 用户创建 Agent

Then Agent 应该拥有：

- name
- model
- system prompt
- capabilities
- status
```

## 7.4 Task

再拆成工程任务：

```text
Task 1
设计 Agent 数据模型

Task 2
实现 Agent API

Task 3
实现 Agent UI

Task 4
实现 Agent execution

Task 5
编写测试

Task 6
Code Review
```

---

# 8. AI Task

传统开发：

```text
Story
 ↓
Task
 ↓
Developer
```

Solo AI 开发：

```text
Story
 ↓
Task
 ↓
AI Agent
 ↓
Human Review
```

建议每个 AI Task 明确：

```yaml
id: TASK-123
title: Implement User Authentication

owner: AI-Coder
reviewer: Human

objective:
  Allow users to login with email/password.

input:
  - product requirement
  - API specification
  - database schema

constraints:
  - TypeScript
  - PostgreSQL
  - REST API

expected_output:
  - implementation
  - unit tests
  - integration tests
  - documentation

acceptance_criteria:
  - valid user can login
  - invalid password rejected
  - inactive user rejected
  - brute force protection enabled

definition_of_done:
  - implementation complete
  - tests pass
  - lint passes
  - build passes
  - review completed
```

---

# 9. 不要让 AI 自由开发

不要简单地说：

> “帮我把用户系统做出来。”

推荐流程：

```text
Human
 ↓
Define Objective
 ↓
AI Analysis
 ↓
AI Proposal
 ↓
Human Approval
 ↓
AI Implementation
 ↓
Automated Test
 ↓
AI Review
 ↓
Human Review
 ↓
Merge
```

原则：

> **AI 可以自主执行，但不能自主决定产品方向和关键架构。**

---

# 10. Task 生命周期

建议固定状态：

```text
BACKLOG
   ↓
READY
   ↓
ANALYZING
   ↓
DESIGNING
   ↓
IMPLEMENTING
   ↓
TESTING
   ↓
REVIEWING
   ↓
DONE
```

异常状态：

```text
BLOCKED
CANCELLED
```

---

# 11. Task 的输入与输出

每个 Task 都应该有明确 Input / Output。

例如：

```yaml
id: TASK-123
title: Implement user login

objective:
  Allow users to login with email/password.

input:
  - product requirement
  - API specification
  - database schema

constraints:
  - TypeScript
  - PostgreSQL
  - REST API

expected_output:
  - implementation
  - unit tests
  - integration tests
  - documentation

acceptance_criteria:
  - valid user can login
  - invalid password rejected
  - inactive user rejected
  - brute force protection enabled
```

目标是避免 AI：

> “让我猜你想让我干什么。”

---

# 12. Definition of Ready

Story / Task 开始前必须满足：

```text
Definition of Ready

□ 目标明确
□ 背景明确
□ Acceptance Criteria 明确
□ Dependencies 明确
□ 技术约束明确
□ 输入资料存在
□ 没有明显阻塞
```

没有达到 DoR：

> 不允许进入开发。

---

# 13. Definition of Done

AI 说“写完了”不代表 Done。

建议：

```text
Definition of Done

□ Implementation completed
□ Unit tests passed
□ Integration tests passed
□ Lint passed
□ Build passed
□ Security checked
□ Documentation updated
□ Acceptance Criteria satisfied
□ AI Code Review completed
□ Human Review completed
□ Git committed
□ Merged
```

最后才进入：

```text
DONE
```

---

# 14. Iteration

对于一个人 + AI，建议：

> **1 周一个 Iteration**

例如：

```text
Iteration 2026-W36

Goal:
完成用户认证 MVP

Planned:
US-001 Login
US-002 Logout
US-003 Refresh Token
```

每个 Iteration 开始：

1. 查看 Product Backlog
2. 确定本周目标
3. 选择 Story
4. 拆 Task
5. 估算工作量
6. 开始执行

---

# 15. 不要过度依赖 Story Points

一个人 + AI 的情况下，Story Points 的价值有限。

更值得关注：

```text
Cycle Time
```

即：

> 一个 Task 从开始到 Done 花了多久？

例如：

```text
TASK-101
Started: 09:30
Done: 11:10

Cycle Time = 100 min
```

长期可以统计：

```text
平均 Task Cycle Time
AI Coding Time
Human Review Time
Rework Time
Bug Rate
```

---

# 16. 工作流看板

建议：

```text
BACKLOG
   ↓
READY
   ↓
AI ANALYSIS
   ↓
HUMAN APPROVAL
   ↓
AI IMPLEMENTATION
   ↓
TESTING
   ↓
AI REVIEW
   ↓
HUMAN REVIEW
   ↓
DONE
```

工具可以使用 GitHub Projects、Linear、Jira、Notion 等，但工具不是重点。

重点是：

> **状态 + 状态转换规则。**

---

# 17. Git 处于整个系统底层

推荐：

```text
Project Management
       ↓
Task
       ↓
Branch
       ↓
Commit
       ↓
Pull Request
       ↓
Review
       ↓
Merge
```

例如：

```text
TASK-123
   ↓
feature/TASK-123-user-login
   ↓
commit
   ↓
PR #42
   ↓
AI Review
   ↓
Human Review
   ↓
Merge
```

这样可以建立完整追踪：

```text
Release
 ↓
Story
 ↓
Task
 ↓
PR
 ↓
Commit
 ↓
Code
```

---

# 18. Git Commit 规范

建议：

```text
feat(auth): add user login
fix(auth): handle expired token
test(auth): add login integration tests
refactor(auth): extract token service
docs(auth): update authentication spec
```

也可以加入 Task ID：

```text
feat(auth): add user login [TASK-123]
```

---

# 19. AI 开发需要 Context Management

AI 开发特别容易发生：

> Context Drift

即 AI 做着做着忘记为什么这么设计。

因此建议：

```text
/docs
    /product
        vision.md
        roadmap.md

    /requirements
        auth.md
        project.md

    /architecture
        overview.md
        database.md
        api.md

    /decisions
        ADR-001.md
        ADR-002.md

    /development
        conventions.md
        testing.md

    /operations
        deployment.md
```

---

# 20. AGENTS.md：项目开发宪法

建议建立：

```text
AGENTS.md
```

示例：

```markdown
# Project Development Rules

## Architecture

Use Clean Architecture.

## Language

TypeScript.

## Database

PostgreSQL.

## Testing

Every business logic change must include tests.

## Git

Never commit directly to main.

## API

REST API.

## Documentation

Update documentation when public behavior changes.

## Security

Never hardcode secrets.

## AI Behavior

Before implementation:
1. inspect existing architecture
2. identify dependencies
3. propose implementation plan
4. wait for approval when architectural changes are involved
```

它相当于：

> **给 AI 一份开发团队工程规范。**

---

# 21. AI 不应该只有一个角色

建议建立虚拟团队：

```text
You
│
└── Product Owner
        │
        ├── AI Product Analyst
        ├── AI Architect
        ├── AI Developer
        ├── AI Tester
        ├── AI Code Reviewer
        └── AI Documentation
```

关键原则：

> **不要让同一个 AI 同时负责写代码和证明自己的代码正确。**

例如：

```text
AI Developer
       ↓
写代码
       ↓
AI Tester
       ↓
测试
       ↓
AI Reviewer
       ↓
审查
       ↓
Human
       ↓
最终决策
```

---

# 22. AI Review Gate

AI Developer 完成后输出：

```text
Implemented:
...

Files changed:
...

Tests:
...

Known limitations:
...

Potential risks:
...
```

AI Reviewer 检查：

```text
1. 是否满足 Acceptance Criteria？
2. 有没有违反架构？
3. 有没有安全问题？
4. 有没有边界条件？
5. 有没有测试缺失？
6. 有没有引入不必要复杂度？
7. 有没有破坏现有功能？
```

Human 最终只需要：

```text
Approve
Request Changes
Reject
```

最终目标是让 Human 从“亲自写代码的人”逐渐成为：

> **Product Owner + System Architect + Tech Lead**

---

# 23. Bug 管理

不要：

> 发现 bug → 直接叫 AI 修。

应该：

```text
Bug
 ↓
Report
 ↓
Triage
 ↓
Priority
 ↓
Root Cause Analysis
 ↓
Fix
 ↓
Regression Test
 ↓
Review
 ↓
Done
```

Bug 至少记录：

```text
Expected Behavior
Actual Behavior
Reproduction Steps
Environment
Severity
Priority
Root Cause
Fix
Regression Test
```

---

# 24. 优先级

推荐简单的 P0-P4：

```text
P0 — System unusable
P1 — Major functionality broken
P2 — Important bug
P3 — Minor bug
P4 — Nice to have
```

Feature 也可以使用：

```text
Must
Should
Could
Won't
```

即 MoSCoW。

---

# 25. Daily Log

一个人没必要模拟传统 Scrum Daily Standup。

建议每天结束记录：

```markdown
# 2026-08-29

## Completed

- TASK-101
- TASK-102

## In Progress

- TASK-103

## Blocked

- Payment API credentials

## Decisions

- Selected PostgreSQL

## Problems

- Authentication integration test unstable

## Tomorrow

- Fix integration test
- Start TASK-104
```

5 分钟即可。

---

# 26. Retrospective

每个 Iteration 结束后复盘：

```text
What went well?
What went wrong?
What should change?
What should we automate?
```

针对 AI 开发，增加：

```text
AI Failure Analysis
```

例如：

```text
□ Context 不足
□ Requirement 不清晰
□ Architecture 不明确
□ Prompt 不好
□ Task 太大
□ 测试不足
□ AI 能力不足
□ 工具问题
□ Human Review 太晚
```

最终产生：

```text
Process Improvement
```

例如：

> Task 太大 → 每个 Task 控制在半天 AI 工作量以内。

---

# 27. 最终闭环

完整闭环：

```text
PRODUCT VISION
       ↓
ROADMAP
       ↓
RELEASE
       ↓
BACKLOG
       ↓
ITERATION PLAN
       ↓
STORY
       ↓
TASK
       ↓
AI ANALYSIS
       ↓
HUMAN APPROVAL
       ↓
AI IMPLEMENTATION
       ↓
AUTOMATED TEST
       ↓
AI REVIEW
       ↓
HUMAN REVIEW
       ↓
MERGE
       ↓
RELEASE
       ↓
RETROSPECTIVE
       ↓
PROCESS IMPROVEMENT
       └──────────────→ BACKLOG
```

这才是完整的敏捷闭环。

---

# 28. 推荐的项目目录

可以将项目管理资料和代码一起版本化：

```text
project/
│
├── AGENTS.md
├── README.md
│
├── docs/
│   ├── product/
│   │   ├── vision.md
│   │   ├── roadmap.md
│   │   └── personas.md
│   │
│   ├── requirements/
│   │   ├── README.md
│   │   ├── US-001.md
│   │   └── US-002.md
│   │
│   ├── architecture/
│   │   ├── overview.md
│   │   ├── database.md
│   │   └── api.md
│   │
│   ├── decisions/
│   │   ├── ADR-001.md
│   │   └── ADR-002.md
│   │
│   ├── development/
│   │   ├── conventions.md
│   │   ├── testing.md
│   │   └── workflow.md
│   │
│   └── operations/
│       ├── deployment.md
│       └── monitoring.md
│
├── project-management/
│   ├── backlog.md
│   ├── releases/
│   │   ├── v0.1.md
│   │   └── v0.2.md
│   │
│   ├── iterations/
│   │   ├── 2026-W35.md
│   │   └── 2026-W36.md
│   │
│   └── retrospectives/
│       ├── 2026-W35.md
│       └── 2026-W36.md
│
└── src/
```

---

# 29. 不要让敏捷变成文档地狱

一个人做项目，如果最后变成：

```text
写 Product Vision
写 Roadmap
写 Epic
写 Story
写 Task
写 Sprint Plan
写 Daily
写 Review
写 Retro
写 Report
写 Meeting Notes
```

然后每天花两个小时管理项目，就本末倒置了。

核心应该是：

> **Minimum Viable Process（最小可行流程）**

一个需求至少回答 5 个问题：

```text
Why?
What?
Acceptance Criteria?
How?
Done?
```

即：

```text
为什么做？
做什么？
什么叫完成？
准备怎么做？
什么条件下可以关闭？
```

---

# 30. 建议的落地阶段

## Phase 1：最小流程

先建立：

```text
Product
 ↓
Release
 ↓
Iteration
 ↓
Story
 ↓
Task
 ↓
Git
```

加上：

```text
Definition of Done
```

## Phase 2：AI 工作流

加入：

```text
AI Analyst
AI Developer
AI Tester
AI Reviewer
Human Approval
```

建立：

```text
AI Task Protocol
```

## Phase 3：工程治理

加入：

```text
Architecture
ADR
Testing
CI/CD
Security
Documentation
Git conventions
```

## Phase 4：度量和持续改进

开始统计：

```text
Cycle Time
Lead Time
AI Success Rate
Rework Rate
Bug Rate
Review Time
Release Frequency
```

然后通过 Retrospective 持续优化。

---

# 31. 最终目标

最终得到一套属于自己的：

> **AI Software Factory / Solo AI Software Development Operating System**

新项目可以直接：

```text
git clone solo-ai-development-template
        ↓
填写 Product Vision
        ↓
创建 Release
        ↓
建立 Backlog
        ↓
开始 Iteration
        ↓
AI 按协议工作
        ↓
不断迭代
```

项目管理本身也可以进入 Git：

```text
Requirement
Architecture
Decision
Task
Code
Test
Release
```

这样软件的知识、决策和代码都有历史记录。

---

# 32. 下一步：把体系真正变成 Cursor Agent 可执行规范

下一阶段不应该继续堆概念，而应该把上面的体系转换成实际文件，例如：

```text
.ai/
├── agents/
│   ├── product-analyst.md
│   ├── architect.md
│   ├── developer.md
│   ├── tester.md
│   └── reviewer.md
│
├── workflows/
│   ├── feature.md
│   ├── bugfix.md
│   ├── release.md
│   └── retrospective.md
│
└── templates/
    ├── story.md
    ├── task.md
    ├── adr.md
    ├── release.md
    └── iteration.md

AGENTS.md
PROJECT_PROCESS.md
```

最终让 Cursor Agent 能够根据这些规则自动判断：

- 当前处于哪个开发阶段
- 当前 Task 是否 Ready
- 是否需要先进行需求分析
- 是否需要 Human Approval
- 应该读取哪些上下文
- 应该修改哪些文件
- 完成后如何测试
- 如何进行 AI Review
- 什么条件下允许进入 Done
- 什么时候需要创建 ADR
- 什么时候应该更新文档
