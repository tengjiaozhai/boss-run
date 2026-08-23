# GeekGeekRun 架构学习资源

## Knowledge

- [GitHub: webpack/tapable README](https://github.com/webpack/tapable)
  官方权威文档。全部 10 种 Hook 类型的定义、tap/call 方法矩阵。讲 tapable 的任何知识先来这里核对。
- [webpack 中文文档：Plugin API](https://www.webpackjs.com/api/plugins/)
  中文讲解 tap/tapAsync/tapPromise 三种注册方式的区别，以及 `apply(compiler)` 插件惯例的由来。本项目复刻了这一惯例。
- [codecrumbs: Tapable library as a core of webpack architecture](https://codecrumbs.io/library/webpack-tapable-core)
  可视化拆解 Compiler 的 hooks 定义与插件监听关系，适合建立整体图景。
- [Puppeteer 官方文档](https://pptr.dev)
  Page、waitForResponse、evaluate 等核心 API。用于 Puppeteer 自动化一课。
- [TypeORM 官方文档](https://typeorm.io)
  DataSource、Entity、Migration。用于持久层一课。
- [pnpm 官方：Workspaces](https://pnpm.io/workspaces)
  workspace 协议与 monorepo 组织。用于 monorepo 一课。

## Wisdom (Communities)

- [geekgeekrun/geekgeekrun Issues](https://github.com/geekgeekrun/geekgeekrun/issues)
  上游项目社区。看真实用户反馈与 BOSS 改版导致的脚本失效案例，理解这类自动化项目的维护现实。

## Gaps
- 尚未找 tapable v2（本项目用 2.2.1）的中文系统教程，目前以官方 README + webpack 中文文档组合覆盖。
