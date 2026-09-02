# Windows 打包实战手册（Electron + electron-builder）

> 适用范围：`packages/ui`（electron-vite + electron-builder + NSIS）
> 验证环境：Windows 10 19045 x64，Node v22，electron 39.2.7，electron-builder 24.9.1
> 最后更新：2026-09-01

---

## 一、一句话结论

**打包命令（推荐，无管理员权限、无签名证书）**

```bat
cd E:\resume\boss-run\packages\ui

:: 1. 构建前端产物（会自动先构建 sqlite-plugin）
set "CSC_IDENTITY_AUTO_DISCOVERY=false"
set "WIN_CSC_LINK="
set "WIN_CSC_SUBJECT_NAME="
npm run build

:: 2. 打包 NSIS 安装包（跳过签名，绕开 winCodeSign 符号链接权限问题）
npx electron-builder --win --config.win.signAndEditExecutable=false
```

产物：`packages/ui/dist/geekgeekrun-ui_<version>_x64_setup.exe`（约 110 MB）

---

## 二、两个必踩的坑及绕法

### 坑 1：winCodeSign 解压失败（无管理员权限必现）

**现象**：

```
ERROR: Cannot create symbolic link : 客户端没有所需的特权。
  : ...\winCodeSign\xxx\darwin\10.12\lib\libcrypto.dylib
```

electron-builder 打包 win 目标时会下载 winCodeSign 工具包，其中含 macOS（darwin）符号链接。Windows 非管理员账户无创建符号链接权限，7za 解压即失败并重试 4 次后整体报错。

**绕法**：不要直接跑 `npm run build:win`（它会走签名流程），改用：

```bat
npx electron-builder --win --config.win.signAndEditExecutable=false
```

`signAndEditExecutable=false` 会跳过代码签名和 rcedit 编辑 exe 的步骤，不再需要 winCodeSign。代价：exe 无签名、无图标版本信息注入（对个人自用无影响）。

**注意**：`CSC_IDENTITY_AUTO_DISCOVERY=false` + 空 `WIN_CSC_LINK` 也必须设，否则 electron-builder 仍会尝试解析证书（`WIN_CSC_LINK` 被设成相对路径还会报 "not a file"）。

### 坑 2：app.asar 内文件缺失 → 主进程启动即崩

**现象**（用户安装后报错）：

```
Error: ENOENT, out\main\default-storage-file\greeting-message-template.md 未找到
  ...\resources\app.asar
```

**根因**：`packages/ui/electron.vite.config.ts` 里 `copyStorageFilesPlugin` 只复制了 `match-report-template.md`。新增的 storage 模板文件（如 `greeting-message-template.md`）没有同步加到复制清单，打进 asar 后运行时 `fs.readFileSync` 读不到。

**排查方法**（用 asar 工具检查打包内容）：

```bash
node -e "
const asar = require('@electron/asar');
const list = asar.listPackage('dist/win-unpacked/resources/app.asar');
console.log(list.filter(p => p.includes('default-storage-file')).join('\n'));
"
```

**修复**：新增任何 `default-storage-file/*` 文件时，必须同步修改 `electron.vite.config.ts` 的 `copyStorageFilesPlugin`，两者一一对应。当前清单：

| 源码目录 | 打包位置（asar 内） |
|---|---|
| `../geek-auto-start-chat-with-boss/default-storage-file/match-report-template.md` | `out/main/default-storage-file/` |
| `../geek-auto-start-chat-with-boss/default-storage-file/greeting-message-template.md` | `out/main/default-storage-file/` |

**验证**：`npm run build` 后检查 `packages/ui/out/main/default-storage-file/` 目录内容齐全，再打包。

---

## 三、打包全流程（含前置检查）

### 3.1 改动前置检查（每次打包前）

```bat
cd /d E:\resume\boss-run

:: mjs 语法检查
node --check packages/geek-auto-start-chat-with-boss/index.mjs
node --check packages/geek-auto-start-chat-with-boss/llm-match-evaluator.mjs

:: sqlite-plugin TS 编译检查
cd packages\sqlite-plugin && npx tsc --noEmit

:: UI 类型检查（web 部分）
cd ..\ui && npx vue-tsc --noEmit -p tsconfig.web.json --composite false
```

### 3.2 构建 + 打包

```bat
cd packages\ui
set "CSC_IDENTITY_AUTO_DISCOVERY=false"
set "WIN_CSC_LINK="
set "WIN_CSC_SUBJECT_NAME="
npm run build          :: 自动先构建 sqlite-plugin，再 electron-vite build
npx electron-builder --win --config.win.signAndEditExecutable=false
```

### 3.3 产物验证

```bat
:: 安装包
dir packages\ui\dist\*.exe

:: 解包检查（如需确认文件是否打进 asar）
node -e "const asar=require('@electron/asar');const c=asar.extractFile('packages/ui/dist/win-unpacked/resources/app.asar','out\\main\\runtime-file-utils-aJEI_rTu.js').toString();console.log(c.includes('__GGR_CONFIG_DIR__'))"
```

---

## 四、打包后的常见运行问题排查

### 4.1 主进程报 `[object Object]`

多为 worker 进程启动即崩。优先怀疑：
1. **DB migration 非幂等**：`ALTER TABLE ADD COLUMN` 在列已存在时抛 `duplicate column name`。新增 migration 必须用 try-catch 逐列包裹（参考 `1767100000000-AddSubScoresToMatchReport.ts`）。
2. 原生模块（better-sqlite3）NODE_MODULE_VERSION 与 Electron 不匹配（`npmRebuild: false` 时不会自动重编译，需 `electron-builder install-app-deps` 或手动 rebuild）。

### 4.2 配置目录路径（`__GGR_CONFIG_DIR__`）

`electron.vite.config.ts` 在构建期把**开发机绝对路径**注入 `globalThis.__GGR_CONFIG_DIR__`（如 `E:\resume\boss-run\...\config`）。打包后该路径在别的机器不存在，靠 `runtime-file-utils.mjs` 的 `firstCreatableDirPath` 回退到 `~/.geekgeekrun/config`。

- 开发机本机运行打包版：命中第一个路径（开发目录仍在）→ 行为与 dev 一致
- 其他机器：自动回退用户目录，功能正常，仅 config 位置不同
- 若需要发布给他人：应改为打包期注入相对 `app.getAppPath()` 的路径或直接去掉该 define

### 4.3 数据库/配置真实位置

- 用户数据根目录：`C:\Users\<user>\.geekgeekrun\`
  - `config/` → boss.json、llm.json、resumes.json 等
  - `storage/` → public.db、match-report-template.md、greeting-message-template.md 等
- 安装目录：`C:\Users\<user>\AppData\Local\Programs\geekgeekrun-ui\`

---

## 五、本次迭代的改动清单速查（可复用检查项）

打包前对照检查以下文件是否有改动且**已同步到打包内容**：

| 文件 | 打包注意点 |
|---|---|
| `geek-auto-start-chat-with-boss/default-storage-file/*.md` | 必须在 `electron.vite.config.ts` copyStorageFilesPlugin 中有对应复制项 |
| `sqlite-plugin/src/migrations/*` | migration 必须幂等（try-catch 包裹）；`index.ts` 注册；dist 由 build 自动重建 |
| `sqlite-plugin/src/entity/*` | entity 字段与 migration 列一致 |
| `geek-auto-start-chat-with-boss/*.mjs` | electron-vite 会把 import 的包打进 out/main（externalizeDepsPlugin 排除列表外），无需手动复制 |
| `config/boss.json` 等运行时配置 | **不会**打进安装包，改的是开发机 `~/.geekgeekrun/config`；要随包分发改 `default-config-file/` |
| `ui/electron-builder.yml` | 已含 `asarUnpack: resources/**`、`npmRebuild: false` |

---

## 六、修改默认行为/配置的正确位置速查

| 目的 | 改哪里 |
|---|---|
| 新装用户的默认配置 | `geek-auto-start-chat-with-boss/default-config-file/*.json` |
| 本机立即生效的配置 | `~/.geekgeekrun/config/*.json`（或 packages/.../config/，取决于路径回退） |
| 默认 storage 模板（提示词等） | `geek-auto-start-chat-with-boss/default-storage-file/*` + electron.vite.config.ts 复制项 |
| 本机立即生效的模板 | `~/.geekgeekrun/storage/*.md` |
