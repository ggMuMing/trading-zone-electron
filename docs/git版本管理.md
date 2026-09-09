# 分支管理
_Exported on 2026/9/8 at GMT+8 8:55:48 from Cursor (3.17.8)_

---

**User**

我要将本地分支v0.2.1的代码推送到远程的v0.2.1分支上，在终端用什么指令

---

**Cursor**

将本地 `v0.2.1` 推送到远程同名分支，常用命令如下。

## 如果你当前就在 `v0.2.1` 分支上

```bash
git push -u origin v0.2.1
```

`-u`（`--set-upstream`）会把本地分支和远程 `origin/v0.2.1` 关联起来，之后在同一分支上可以直接用 `git push`。

## 如果你当前不在 `v0.2.1` 分支上

先切换再推送：

```bash
git checkout v0.2.1
git push -u origin v0.2.1
```

或者不切换分支，直接推送本地 `v0.2.1`：

```bash
git push -u origin v0.2.1:v0.2.1
```

## 推送前建议先确认

```bash
git branch          # 看当前分支
git status          # 看是否有未提交改动
git remote -v       # 确认远程名是否为 origin
```

## 常见情况

| 情况 | 命令 |
|------|------|
| 远程还没有 `v0.2.1`，首次推送 | `git push -u origin v0.2.1` |
| 已设置 upstream，再次推送 | `git push` |
| 远程分支已存在且历史不一致 | 需要先 `git pull --rebase origin v0.2.1` 解决冲突后再 push |

**注意：** 如果远程已有 `v0.2.1` 且与本地历史分叉，普通 `git push` 可能被拒绝，需要先合并或 rebase，不要直接用 `git push --force`（除非你明确知道要覆盖远程历史）。

如果你告诉我当前在哪个分支、远程是否已有 `v0.2.1`，我可以帮你判断该用哪一条。

---

**User**

我要在远程将v0.2.1merge到v0.2分支上，并打上tag应该怎么做？

---

**Cursor**

先查看项目的 Git 远程配置、分支状态和 release 文档中的 tag 规范，再给出具体步骤。


按你们项目的 [项目流程规范指南](docs/project-rules/项目流程规范指南1.0.md)，完整流程是：**merge → 打 tag → 删迭代分支**。当前远程已有 `origin/v0.2` 和 `origin/v0.2.1`，`v0.2.1` 比 `v0.2` 多 1 个 commit（`TZE-v0.2-1 改进脚本语法`），尚未存在 `v0.2.1` tag。

## 推荐操作步骤（本地执行，推送到远程）

### 1. 更新远程分支信息

```powershell
git fetch origin
```

### 2. 切到中期分支 `v0.2` 并 merge 迭代分支

```powershell
git checkout v0.2
git pull origin v0.2
git merge origin/v0.2.1
```

如果 merge 成功且无冲突，继续下一步。若有冲突，先解决冲突再 `git commit` 完成 merge。

### 3. 推送 merge 后的 `v0.2` 到远程

```powershell
git push origin v0.2
```

### 4. 在 merge commit 上打 Tag

Tag 名与迭代版本一致，打在 **merge 后的 commit** 上：

```powershell
git tag -a v0.2.1 -m "v0.2.1: Sprint1 迭代交付"
git push origin v0.2.1
```

`-a` 是附注 tag（推荐），`-m` 写说明。规范要求：**Tag 一旦创建不可移动**。

### 5. 删除临时迭代分支（规范要求 merge 后删除）

```powershell
# 删远程
git push origin --delete v0.2.1

# 删本地（可选）
git branch -d v0.2.1
```

---

## 流程示意

```text
v0.2  ──────●────────────●────→  （中期分支，长期保留）
             ↑ merge
v0.2.1 ──●───┘
         tag v0.2.1
         （迭代分支，merge 后删除）
```

---

## 可选：用 GitHub Pull Request 做 merge

如果更习惯在 GitHub 网页上操作：

1. 打开仓库 → **Pull requests** → **New pull request**
2. **base**: `v0.2`，**compare**: `v0.2.1`
3. 创建 PR → 审查 → **Merge pull request**
4. 本地执行 tag 和删分支：

```powershell
git fetch origin
git checkout v0.2
git pull origin v0.2
git tag -a v0.2.1 -m "v0.2.1: Sprint1 迭代交付"
git push origin v0.2.1
git push origin --delete v0.2.1
```

GitHub 网页本身不能直接打 annotated tag，tag 仍需在本地或 CI 里创建并 push。

---

## 注意事项

| 事项 | 说明 |
|------|------|
| 当前分支 | 你在 `v0.2.1` 上，merge 前需先 `checkout v0.2` |
| 未提交改动 | 若有本地未 commit 的修改，先 stash 或 commit，避免切换分支失败 |
| 禁止 force push | 不要对 `v0.2` 或 tag 使用 `--force` |
| Tag 已存在 | 若 `v0.2.1` tag 已存在，不能覆盖，需用新版本号 |

---

如果你希望我在终端里帮你执行这套流程（merge、打 tag、删远程分支），可以说一声，我可以逐步操作；merge 前会先确认工作区是否干净。

