# PRODUCT.md

## Product
GeekGeekRun 架构课 —— 一个面向个人开发者的教学工作区，以开源项目 GeekGeekRun（BOSS 直聘自动开聊工具，pnpm monorepo）的真实代码为教材，教授可迁移的架构与工程模式（tapable 插件架构、Puppeteer 数据获取、monorepo 分层、Electron 多进程、持久层、LLM 集成）。产物形态：静态 HTML 课程页、参考速查表与交互动画，无后端、无构建链，直接用浏览器打开。

## Audience
单一学习者：JS/Node 熟练的前端开发者，Puppeteer / Electron / tapable / TypeORM 零实战。中文阅读，代码与术语保留英文。

## Job to be done
在多个会话中逐课建立对项目架构的理解，最终能独立修改该项目并把这些模式迁移到自己的项目里（详见 MISSION.md，其为本文件的使命细则）。

## Surfaces
- `lessons/*.html` —— 课程页（讲解 + 检索练习 + 实战任务）
- `reference/*.html` —— 可打印速查表（长期复习）
- `animations/*.html` —— 交互动画（单概念演示，六拍步进）
- `assets/` —— 课程共享样式与组件（视觉世界的唯一权威：米纸底 #fffdf9、宋体、赭红 #8a2c2c、Tufte 排版）

## Constraints & brand commitments
- 教学语言中文；每个产物必须引用真实 `file:line` 出处
- 视觉世界统一继承 `assets/course.css`，不另起体系
- 离线可用：不依赖任何 CDN/网络资源
- 教学文件均不入 git（untracked）

## Assumptions（init 无采访通道，由既有事实推定）
以上内容全部来自教学工作区既有文件（MISSION.md、NOTES.md、lessons/、assets/）的既成事实，无虚构。
