# Trading Zone Electron

本地化交易复盘桌面应用（Electron 厚客户端）。

## 技术栈（Sprint 1 脚手架）

| 层 | 技术 |
| --- | --- |
| 壳 | Electron + electron-vite + electron-builder |
| UI | React + TypeScript + MUI |
| 业务（后续） | Main 进程 + SQLite |
| 数据/计算（后续） | 嵌入式 Python + Tushare / pandas / DuckDB |

目录：

```
src/main       # Electron 主进程
src/preload    # contextBridge 白名单 API
src/renderer   # React UI
frontend/      # 历史依赖备份（package-backup.json）
prompt/        # 架构与迭代文档
```

## 环境要求

- Node.js **20.19+**（当前 electron-vite 5 / Vite 7 要求）
- npm 10+

若 `npm run dev` 报 `Electron uninstall`，执行：

```bash
node node_modules/electron/install.js
```

国内网络可设镜像后再安装：

```bash
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
node node_modules/electron/install.js
```

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（热更新）
npm run dev
```

可选：复制环境变量模板（后续 Python / Tushare 使用）：

```bash
copy .env.example .env
# 编辑 .env，填入 TUSHARE_TOKEN
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发窗口 |
| `npm run typecheck` | 主进程 + 渲染进程类型检查 |
| `npm run build` | 编译到 `out/` |
| `npm run build:win` | Windows 安装包 |

## 架构要点

- Renderer 仅展示；经 preload `window.api` 调用 Main
- Main 编排业务（SQLite）与 Python worker（后续迭代）
- 控制面先用 JSON；大数据面再演进 Arrow / DuckDB 窗读

详见 `prompt/trading-zone-electron开发文档/`。
