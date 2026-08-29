> 完整说明见：[Sprint9.3 迭代文档](./Sprint9.3迭代文档.md)。来源见 [Sprint9.2 迭代文档](./Sprint9.2迭代文档.md) 第 6.1 节、[Sprint9 头脑风暴文档](./Sprint9头脑风暴文档.md) 档 D。开发计划 Cursor plan `sprint9.3_档d上图_73e326ef`。

# Sprint9.3 启动：布局 kind + ref 上图

## 来源

Sprint9.2（档 C）已能在独立子进程跑一份源码得到 `PlotFragment`，并与内置 fragment 合成同一份 `ChartInput`。图上仍只跑布局里的内置指标。头脑风暴档 D：布局项拆 `kind + ref`；`chart:build` 由 Main 注入 `source`；仍被引用的脚本禁止删除。

## 现状

- 布局行仍是 `{ id, builtin, params }`；`chartLayout:add` 只收 `{ builtin }`。
- `chart:build` / `compute.indicator` 只吃内置 instances，不读脚本表。
- 弹窗能列出用户脚本，但不能添加到当前布局；删除一律允许。
- 默认新建骨架仍是 `NotImplementedError`；验收用可跑的用户 MACD 源码。

## 方案结论（已拍板）

- 布局不存 `source`；脚本全局身份是脚本表主键，不是 `class.key`。
- Python 仍不碰 SQLite；`source` 只出现在过桥 Instance 上，且仅 `kind=script`。
- `chartLayout:add` 改为 `{ kind, ref }`，不再保留 `builtin` 别名。
- `compute.indicator` / `compose` 过桥同样改为 `kind + ref`。
- 单条脚本失败只丢掉该实例，内置与其它脚本仍出图。
- 添加脚本时 `params` 拷 `manifest.defaultParams`（当前为 `{}`）；脚本行本轮无「设置」。

## 目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 布局项 kind + ref | 旧行迁移为 `kind=builtin, ref=原 builtin`；种子 `ma` / `macd` 的 id 不改写；`chartLayout:add` 为 `{ kind, ref }` |
| G2 | 脚本上图 | 弹窗可添加；`chart:build` 后见图；删一条只少该实例；同一脚本加两次前缀不撞 |
| G3 | 引用保护 | 布局仍引用时禁止删除；弹窗删除按钮禁用 |

## 本文件不包含

- Monaco、「跑一次」、保存时 load 类抽 manifest、按 `manifest.fields` 渲染设置表单
- 改 `ChartInput` Schema、Arrow 传 series、多套命名布局
- 改默认新建骨架；脚本实例参数设置窗
