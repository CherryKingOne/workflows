# DDD 目录结构设计

## 一、设计原则

### 1.1 核心思想
- **以业务为核心**：目录结构反映业务领域划分，而非技术分层
- **单一职责**：每个目录/文件只负责一件事
- **高内聚低耦合**：相关业务逻辑放在一起，减少跨模块依赖

### 1.2 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│                    (前端组件/页面/UI)                         │
├─────────────────────────────────────────────────────────────┤
│                      Application Layer                       │
│                    (用例/服务编排/Command)                    │
├─────────────────────────────────────────────────────────────┤
│                        Domain Layer                          │
│                 (实体/值对象/领域服务/接口)                    │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                     │
│              (持久化/外部服务/基础设施实现)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、目录结构

### 2.1 整体结构

```
workflow/
├── src/                              # 前端核心代码
│   ├── domain/                       # 领域层 - 业务核心
│   │   ├── project/                  # 项目聚合
│   │   │   ├── entities/             # 实体
│   │   │   │   └── Project.ts        # 项目实体
│   │   │   ├── valueObjects/         # 值对象
│   │   │   │   ├── ProjectId.ts      # 项目ID
│   │   │   │   └── ProjectMeta.ts    # 项目元信息
│   │   │   ├── repositories/        # 仓储接口
│   │   │   │   └── IProjectRepo.ts  # 项目仓储接口
│   │   │   └── services/            # 领域服务
│   │   │       └── ProjectDomainService.ts
│   │   │
│   │   ├── node/                     # 分镜节点聚合
│   │   │   ├── entities/
│   │   │   │   └── Node.ts
│   │   │   ├── valueObjects/
│   │   │   │   ├── NodeId.ts
│   │   │   │   ├── NodePosition.ts
│   │   │   │   └── NodeContent.ts
│   │   │   ├── repositories/
│   │   │   │   └── INodeRepo.ts
│   │   │   └── services/
│   │   │       └── NodeDomainService.ts
│   │   │
│   │   ├── ai/                       # AI 功能聚合
│   │   │   ├── entities/
│   │   │   │   └── AIConfig.ts
│   │   │   ├── valueObjects/
│   │   │   │   └── ApiKey.ts
│   │   │   └── services/
│   │   │       └── AIService.ts
│   │   │
│   │   └── shared/                  # 共享领域
│   │       ├── base/                 # 基类
│   │       │   ├── Entity.ts
│   │       │   ├── ValueObject.ts
│   │       │   └── AggregateRoot.ts
│   │       └── types/                # 通用类型
│   │           └── index.ts
│   │
│   ├── application/                  # 应用层 - 用例编排
│   │   ├── project/
│   │   │   ├── commands/            # 命令 (写操作)
│   │   │   │   ├── CreateProjectCommand.ts
│   │   │   │   ├── UpdateProjectCommand.ts
│   │   │   │   └── DeleteProjectCommand.ts
│   │   │   └── queries/              # 查询 (读操作)
│   │   │       ├── GetProjectListQuery.ts
│   │   │       └── GetProjectByIdQuery.ts
│   │   │
│   │   ├── node/
│   │   │   ├── commands/
│   │   │   │   ├── CreateNodeCommand.ts
│   │   │   │   ├── UpdateNodeCommand.ts
│   │   │   │   └── DeleteNodeCommand.ts
│   │   │   └── queries/
│   │   │       └── GetNodesByProjectQuery.ts
│   │   │
│   │   └── useCases/                # 组合用例
│   │       └── index.ts
│   │
│   ├── infrastructure/              # 基础设施层
│   │   ├── persistence/             # 持久化实现
│   │   │   ├── repositories/
│   │   │   │   ├── LocalStorageProjectRepo.ts
│   │   │   │   └── LocalStorageNodeRepo.ts
│   │   │   └── migrations/          # 数据迁移
│   │   │
│   │   ├── api/                    # 外部API
│   │   │   ├── AIApiClient.ts       # AI 服务调用
│   │   │   └── tauri/               # Tauri IPC
│   │   │       └── commands.ts
│   │   │
│   │   └── config/                 # 配置
│   │       └── store.ts             # 状态管理
│   │
│   ├── presentation/               # 展示层 - UI
│   │   ├── components/             # 公共组件
│   │   │   ├── common/              # 通用组件
│   │   │   │   ├── Button/
│   │   │   │   ├── Input/
│   │   │   │   └── Modal/
│   │   │   └── layout/              # 布局组件
│   │   │       └── Header.tsx
│   │   │
│   │   ├── pages/                  # 页面
│   │   │   ├── projects/            # 项目列表页
│   │   │   │   ├── ProjectsPage.tsx
│   │   │   │   └── components/      # 页面专属组件
│   │   │   │       ├── ProjectCard.tsx
│   │   │   │       └── ProjectList.tsx
│   │   │   │
│   │   │   ├── canvas/              # 画布页
│   │   │   │   ├── CanvasPage.tsx
│   │   │   │   └── components/
│   │   │   │       ├── NodeCanvas.tsx
│   │   │   │       ├── NodeItem.tsx
│   │   │   │       └── Toolbar.tsx
│   │   │   │
│   │   │   └── settings/            # 设置页
│   │   │       └── SettingsPage.tsx
│   │   │
│   │   ├── hooks/                   # 自定义 Hooks
│   │   │   ├── useProjects.ts
│   │   │   ├── useNodes.ts
│   │   │   └── useAI.ts
│   │   │
│   │   ├── context/                 # React Context
│   │   │   ├── ThemeContext.tsx
│   │   │   └── ProjectContext.tsx
│   │   │
│   │   └── styles/                 # 样式
│   │       ├── variables.css
│   │       └── themes.css
│   │
│   └── app/                        # Next.js App Router
│       ├── (routes)/               # 路由分组
│       │   ├── page.tsx            # / 首页 -> 项目列表
│       │   ├── canvas/
│       │   │   └── page.tsx        # /canvas 画布页
│       │   └── settings/
│       │       └── page.tsx        # /settings 设置页
│       │
│       ├── layout.tsx               # 根布局
│       ├── globals.css              # 全局样式
│       └── loading.tsx              # 加载状态
│
├── src-tauri/                      # Tauri 后端 (Rust)
│   └── src/
│       ├── domain/                 # 领域层
│       │   └── mod.rs
│       ├── application/            # 应用层
│       │   └── mod.rs
│       ├── infrastructure/         # 基础设施
│       │   ├── persistence/        # 文件存储
│       │   └── commands/           # Tauri 命令
│       └── lib.rs
│
├── public/                         # 静态资源
│   ├── icons/                      # 应用图标
│   └── images/                     # 图片资源
│
└── docs/                           # 文档
    └── ddd-guide.md               # DDD 开发指南
```

---

## 三、前后端通信机制

### 3.1 核心原则

**本项目基于 Tauri 桌面应用框架,前后端通信采用函数调用方式,不使用 HTTP 接口。**

#### 通信方式对比

| 传统 Web 应用 | 本项目 (Tauri 桌面应用) |
|--------------|----------------------|
| 前端通过 HTTP/HTTPS 调用后端 API | 前端直接调用后端函数 |
| 需要定义 RESTful API 路由 | 通过 Tauri Command 注册函数 |
| 存在网络延迟 | IPC 通信,性能更高 |
| 需要处理跨域、鉴权等 | 同进程内调用,更安全简单 |

### 3.2 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Web)                      │
│                  TypeScript/React/Next.js                │
├─────────────────────────────────────────────────────────┤
│                     Tauri Bridge                        │
│              (@tauri-apps/apiinvoke)                    │
│                  invoke(command, args)                  │
├─────────────────────────────────────────────────────────┤
│                   Backend (Rust)                        │
│                   Tauri Commands                        │
│             #[tauri::command] fn xxx()                  │
└─────────────────────────────────────────────────────────┘
```

### 3.3 前端调用示例

```typescript
// src/infrastructure/api/tauri/commands.ts
import { invoke } from '@tauri-apps/api/tauri';

// 调用后端函数 - 创建项目
export async function createProject(name: string): Promise<Project> {
  return await invoke<Project>('create_project', { name });
}

// 调用后端函数 - 获取项目列表
export async function getProjects(): Promise<Project[]> {
  return await invoke<Project[]>('get_projects');
}

// 调用后端函数 - 保存节点
export async function saveNode(node: Node): Promise<void> {
  return await invoke('save_node', { node });
}
```

### 3.4 后端函数定义

```rust
// src-tauri/src/commands/project.rs
use tauri::command;

#[command]
pub async fn create_project(name: String) -> Result<Project, String> {
    // 业务逻辑实现
    let project = Project::new(name);
    // 持久化操作...
    Ok(project)
}

#[command]
pub async fn get_projects() -> Result<Vec<Project>, String> {
    // 查询项目列表
    let projects = ProjectRepository::find_all()?;
    Ok(projects)
}
```

```rust
// src-tauri/src/lib.rs
mod commands;

use commands::project::{create_project, get_projects};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            create_project,
            get_projects,
            // 注册更多命令...
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3.5 优势说明

1. **性能优势**
   - 无网络请求开销
   - IPC 通信延迟极低
   - 数据传输更高效

2. **开发体验**
   - 前后端类型可共享
   - 无需处理跨域问题
   - 调试更方便

3. **安全性**
   - 无需暴露 HTTP 端口
   - 同进程内通信
   - 减少攻击面

4. **简化架构**
   - 无需 API 网关
   - 无需处理 RESTful 规范
   - 直接函数调用更直观

### 3.6 注意事项

- **类型定义**: 前端 TypeScript 和后端 Rust 的类型需要保持一致
- **错误处理**: 后端返回 `Result<T, String>`,前端需要处理可能的错误
- **异步调用**: 所有 Tauri Command 默认支持异步
- **数据序列化**: 依赖 `serde` 自动序列化/反序列化

---

## 四、领域模型设计

### 4.1 核心聚合

#### Project (项目聚合根)
```typescript
// 领域层
class Project {
  private id: ProjectId;
  private name: string;
  private nodes: Node[];
  private createdAt: Date;
  private updatedAt: Date;

  // 领域行为
  addNode(node: Node): void
  removeNode(nodeId: NodeId): void
  rename(newName: string): void
}
```

#### Node (分镜节点聚合根)
```typescript
class Node {
  private id: NodeId;
  private projectId: ProjectId;
  private content: NodeContent;
  private position: NodePosition;

  // 领域行为
  updateContent(content: NodeContent): void
  moveTo(position: NodePosition): void
}
```

### 4.2 限界上下文 (Bounded Contexts)

1. **项目管理上下文** - 项目的 CRUD 操作
2. **分镜编辑上下文** - 节点的创建、编辑、布局
3. **AI 集成上下文** - AI 配置和调用
4. **主题上下文** - 主题切换和持久化

---

## 五、开发流程

### 5.1 新增功能步骤

1. **定义领域模型** (`domain/`)
   - 创建/修改实体
   - 定义值对象
   - 编写领域服务

2. **实现应用层** (`application/`)
   - 编写 Command/Query
   - 编排领域服务

3. **实现基础设施** (`infrastructure/`)
   - 实现仓储接口
   - 对接外部服务

4. **开发展示层** (`presentation/`)
   - 创建/复用组件
   - 编写 Hooks
   - 实现页面

### 5.2 依赖规则

```
Presentation → Application → Domain → Infrastructure
                    ↑              ↑
                    └──────────────┘
              (依赖接口，不依赖实现)
```

---

## 六、命名规范

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 实体 | PascalCase + Entity 后缀 | `ProjectEntity` |
| 值对象 | PascalCase | `ProjectId` |
| 仓储接口 | `I` + 名称 + Repo | `IProjectRepo` |
| 命令 | 操作 + Command | `CreateProjectCommand` |
| 查询 | 操作 + Query | `GetProjectListQuery` |
| 组件 | PascalCase | `ProjectCard` |
| Hooks | `use` + 名称 | `useProjects` |

---

## 七、总结

这套 DDD 目录结构设计：
- **业务导向**：目录反映业务领域划分
- **层次清晰**：Domain → Application → Infrastructure → Presentation
- **职责明确**：每层只做该做的事
- **易于维护**：相关逻辑集中，便于定位和修改
- **适合演进**：随着业务复杂可以轻松扩展

开始开发时，建议从 `domain` 层入手，先明确业务实体和关系，再逐层向上构建。
