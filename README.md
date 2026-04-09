# Workflow

一款基于 Tauri 2 + Next.js 16 (A2 协议) 构建的现代化工作流应用。

![Logo](./public/logo.png)

## 项目简介

Workflow 是一个跨平台桌面应用，采用 A2 版本协议技术栈开发，支持可视化的工作流编排与管理。

## 技术栈 (A2 协议)

- **前端框架**: Next.js 16 + React 19
- **桌面框架**: Tauri 2
- **流程图**: React Flow (@xyflow/react)
- **样式**: Tailwind CSS 4
- **数据库**: SQLite (better-sqlite3)
- **AI 集成**: OpenAI API

## 快速开始

### 环境要求

- Node.js 18+
- Rust (用于 Tauri)
- pnpm / yarn / npm

### 安装依赖

```bash
npm install
# 或
yarn install
# 或
pnpm install
```

### 开发模式

```bash
# 启动 Web 开发服务器
npm run dev

# 启动 Tauri 开发模式
npm run tauri:dev
```

### 构建发布

```bash
# 构建 Tauri 应用
npm run tauri:build
```

## 项目结构

```
workflows/
├── app/                    # Next.js App Router 页面
├── src/
│   ├── application/        # 应用层 - 命令与查询处理
│   ├── domain/             # 领域层 - 实体、仓储、值对象
│   ├── infrastructure/     # 基础设施层 - 外部服务集成
│   └── presentation/       # 展示层 - UI 组件与 Hooks
├── src-tauri/              # Tauri 后端代码
│   ├── src/
│   │   ├── application/    # 应用层
│   │   ├── domain/         # 领域层
│   │   └── infrastructure/ # 基础设施层
│   └── icons/              # 应用图标资源
└── public/                 # 静态资源
```

## 架构设计

本项目采用领域驱动设计 (DDD) 的分层架构：

- **展示层 (Presentation)**: 负责用户界面展示与交互
- **应用层 (Application)**: 协调领域对象完成业务用例
- **领域层 (Domain)**: 核心业务逻辑与领域模型
- **基础设施层 (Infrastructure)**: 技术实现与外部服务集成

## 功能特性

- 项目管理与配置
- 可视化画布编辑
- AI 模型集成
- 多平台支持 (Windows / macOS / Linux)

## 开发指南

### 代码规范

- 遵循 TypeScript 严格模式
- 组件使用函数式写法
- 遵循 DDD 分层架构原则

### 提交规范

- feat: 新功能
- fix: 修复问题
- docs: 文档更新
- refactor: 代码重构
- test: 测试相关
- chore: 构建/工具相关

## 许可证

Apache License 2.0

## 注意事项

严禁删除或修改控制台中的 LOGO 和版权声明。
