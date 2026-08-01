# Trading Zone Electron

本地化交易复盘桌面应用（Electron 厚客户端）。

## 技术栈（Sprint 1 脚手架）

| 层 | 技术 |
| --- | --- |
| 壳 | Electron + electron-vite + electron-builder |
| UI | React + TypeScript + MUI |
| 业务 | Main 进程 + better-sqlite3 |
| 数据/计算 | Python worker + Tushare / pandas / numpy / DuckDB |

目录：

```
src/main       # Electron 主进程（含 db/、ipc/）
src/preload    # contextBridge 白名单 API
src/renderer   # React UI
src/shared     # 跨进程共享类型
python/        # NDJSON worker（venv + tushare）
contracts/     # 跨语言 JSON Schema 契约
frontend/      # 历史依赖备份（package-backup.json）
prompt/        # 架构与迭代文档
```

## 环境要求

| 运行时 | 要求 | 说明 |
| --- | --- | --- |
| Node.js | **≥ 20.19.0**（推荐 **22 LTS**） | `package.json` → `engines.node` 强制声明；低于此版本安装时会出现 `EBADENGINE`，且 electron-vite 5 / Vite 7 可能异常 |
| npm | **≥ 10** | 随 Node 20.19+ / 22 LTS 自带即可 |
| Python | **≥ 3.11**（推荐 3.12 / 3.13） | 用于 `python/.venv` worker |

安装前请确认：

```bash
node -v   # 期望 v20.19.x 或 v22.x
npm -v    # 期望 10+
python --version
```

本地可用 `nvm` / `fnm` 切换到 22 LTS。若仍使用 Node 20，请至少升到 **20.19+**，勿停留在 20.16 等旧补丁。

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

原生模块（`better-sqlite3`）需按 Electron ABI 编译。若启动报 NODE_MODULE_VERSION 不匹配：

```bash
npx @electron/rebuild -f -w better-sqlite3
```

### Python worker

```bash
cd python
python -m venv .venv

# Windows
.venv\Scripts\activate
pip install -r requirements.txt

# 冒烟：ready + 库 import（不拉行情）
python scripts\smoke_worker.py

# 可选：带 Tushare token 拉 A 股列表
set TUSHARE_TOKEN=你的token
python scripts\smoke_worker.py
```

可选：复制环境变量模板：

```bash
copy .env.example .env
# 编辑 .env，填入 TUSHARE_TOKEN
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发窗口 |
| `npm run acceptance` | Sprint1 无头验收（Python + SQLite 同步） |
| `npm run typecheck` | 主进程 + 渲染进程类型检查 |
| `npm run build` | 编译到 `out/` |
| `npm run build:win` | Windows 安装包 |
| `python python/scripts/smoke_worker.py` | Python worker 冒烟 |

## 架构要点

- Renderer 仅展示；经 preload `window.api` 调用 Main
- Main `ApplicationService` 编排：`stocks:sync` → Python `data.sync.stock_list` → SQLite upsert
- Python worker 由 `pythonBridge` 拉起（`python/.venv`），stdin/stdout NDJSON；崩溃自动重启 1 次
- Token：环境变量 `TUSHARE_TOKEN` 优先，否则读 `userData/config/config.json`
- 契约见 `contracts/`；TS 对照类型在 `src/shared/types/pythonProtocol.ts`

详见 `prompt/trading-zone-electron开发文档/`。
