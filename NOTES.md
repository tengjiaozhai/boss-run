# 教学笔记

## 用户偏好
- 教学语言：中文；代码、命令、标识符保留英文
- 期望以仓库真实代码为主要教材，注重"可迁移的模式"而非业务细节

## 技术背景（2026-08-23 首次确认）
- JS/Node 熟练：可直接用 Promise、事件循环、模块系统作类比
- 零实战：Puppeteer、Electron、tapable、TypeORM —— 这些库的 API 要从零讲
- pnpm workspace 用过（能跑起本项目），monorepo 分层设计是学习点而非障碍

## 工作区说明
- 教学工作区位于项目仓库根目录（boss-run/），MISSION.md、RESOURCES.md、NOTES.md、lessons/、reference/、assets/、learning-records/ 均为 untracked 教学文件，不应提交进 git
- 引用代码一律给出 `packages/.../file.mjs:行号` 便于跳转

## 课程规划（随进度修订）
1. ✅ 0001 tapable 插件架构（核心库与插件解耦的地基）
2. ✅ 0002 数据获取三层模式（用户主动点题；网络层三姿势 / __vue__ 直读 / DOM 只做操作）
3. pnpm monorepo 分层与 workspace 协议
4. Electron 多进程：pm 守护进程与 JSONL 协议
5. TypeORM + better-sqlite3 持久层模式
6. LLM 集成模式（多模型加权池、结构化输出、prompt 模板化）
