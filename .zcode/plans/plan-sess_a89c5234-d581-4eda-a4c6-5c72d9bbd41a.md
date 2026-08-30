# 配置文件内置到项目里

## 改动 1：`packages/geek-auto-start-chat-with-boss/runtime-file-utils.mjs`

- **config 目录改为包内**：`configFolderPath` 由 `~/.geekgeekrun/config` 改为 `path.join(__dirname, 'config')`（即 `packages/geek-auto-start-chat-with-boss/config/`）。解析时先 `mkdirSync(recursive)` 验证可写；失败（如打包后安装到只读目录）则回落到旧的 `~/.geekgeekrun/config`，保证打包场景不炸。
- **旧配置自动迁移**：新增函数 `migrateLegacyConfigFiles()`——对 6 个配置文件（boss.json、dingtalk.json、target-company-list.json、llm.json、common-job-condition-config.json、resumes.json），若项目 `config/` 里没有而 `~/.geekgeekrun/config` 里有，则 `copyFileSync` 复制过来。定义为可提升的 function 声明，在 `ensureConfigFileExist()` 内和模块顶部那段 import-time 迁移逻辑（写 common-job-condition-config.json 的代码块）执行前各调用一次，确保任何读取路径都先完成迁移。
- **storage 完全不动**：cookies、public.db、match-report-template.md 等仍留在 `~/.geekgeekrun/storage`。
- 所有读写方（Electron 设置页 IPC、自动开聊主流程、test-ai-match.mjs 等）都走这一个模块，改完即全部生效，无需改动其他文件。

## 改动 2：实际迁移文件

把你现有 `~/.geekgeekrun/config` 的 6 个配置文件复制到 `packages/geek-auto-start-chat-with-boss/config/`（与代码里的自动迁移等效，直接放好当前值）。

## 改动 3：git 提交（已确认为私有仓库，全部提交）

- `git add` 新增的 `config/` 目录和修改后的 `runtime-file-utils.mjs`，提交 commit：`feat: 配置文件内置到项目 config/ 目录`。
- 提醒：llm.json 的 API key 会进入 git 历史，若将来仓库转公开需先更换 key。

## 验证

1. 用 node 一行脚本验证：`configFolderPath` 指向项目内目录，`readConfigFile('boss.json')` 能读到真实配置（enableAiMatch=false 等）。
2. 重启 Electron 客户端（pnpm dev），确认设置页能正常加载和保存配置。
3. 确认 `~/.geekgeekrun/config` 旧文件保留（不删除）。

## 不做的事

- storage 文件、UI 中 5 处其他 `~/.geekgeekrun` 硬编码路径（log/cache/chrome-extensions/首启标记/浏览器记录）不动。
- `default-config-file` 默认模板机制不动（仍作为全新环境的兜底）。