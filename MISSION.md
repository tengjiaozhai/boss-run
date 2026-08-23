# Mission: 通过 GeekGeekRun 掌握可迁移的架构与工程模式

## Why
以这个真实运行的 BOSS 直聘自动化项目（pnpm monorepo）为教材，掌握 tapable 插件架构、Electron 多进程、Puppeteer 自动化、TypeORM 持久层等工程模式，目标是在自己的项目里能独立运用这些模式，而不是只读懂这一个仓库。

## Success looks like
- 能脱稿画出本项目的包依赖图与进程关系图，并解释每一层的职责取舍
- 能不查资料手写一个"核心库 + tapable hooks + 两个插件"的最小可运行示例
- 能独立修改 geek 核心主流程（例如给 AI 匹配补上超时控制）并说清改动影响面
- 能向别人讲清楚 pm 守护进程的 JSONL 协议、Electron worker 的装配过程

## Constraints
- 用户 JS/Node 熟练；Puppeteer、Electron、tapable、TypeORM 均无实战经验
- 教学语言中文，代码、标识符与必要术语保留英文
- 每课短小可快速完成，允许多会话推进

## Out of scope
- BOSS 直聘风控与反爬对抗的实现细节
- Vue 3 组件级 UI 开发教学
- 项目发版、分发等运营事务
