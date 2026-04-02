# 项目管理模块后端 (Rust) 设计与开发规划

为了支撑前端页面并遵循 DDD（领域驱动设计），我们需要在 `src-tauri/src` 下开发对应的 Rust 代码。本指南详细梳理了后续需要开发的后端函数及其作用。

## 1. 架构概览 (Architecture Overview)

后端同样采用四层架构：
*   **Presentation / Commands (`src/commands/project.rs`)**: Tauri 的命令入口，接收前端调用，解析参数并转发给 Application 层。
*   **Application (`src/application/project/`)**: 应用服务层，包含用例 (Use Cases)，负责编排领域模型和持久化操作。例如：`create_project_use_case`。
*   **Domain (`src/domain/project/`)**: 领域层，包含 `Project` 实体，代表项目的核心业务数据（ID，名称，描述，创建时间，修改时间）。
*   **Infrastructure (`src/infrastructure/persistence/`)**: 基础设施层，负责将 `Project` 数据保存到本地文件系统（如 SQLite, JSON 文件或 Tauri 的 AppData 目录）。

## 2. 需要提供的核心后端函数 (Tauri Commands)

这些是前端将直接通过 `@tauri-apps/api/core` 的 `invoke` 调用的函数。

### 2.1 获取项目列表 (Get Projects)
*   **函数名**: `get_projects`
*   **参数**: 无 (或者后续增加排序参数 `sort_by`)
*   **返回值**: `Result<Vec<ProjectDto>, String>`
*   **说明**: 从基础设施层读取所有已保存的项目数据，转换为 DTO 格式返回给前端页面用于列表展示。

### 2.2 创建项目 (Create Project)
*   **函数名**: `create_project`
*   **参数**:
    *   `name`: String (项目名称)
    *   `description`: String (项目描述)
*   **返回值**: `Result<ProjectDto, String>`
*   **说明**: 接收前端传来的基础信息，在 Domain 层生成带有唯一 ID 和时间戳的新 `Project` 实体，然后通过 Infrastructure 层持久化保存。

### 2.3 更新项目 (Update Project)
*   **函数名**: `update_project`
*   **参数**:
    *   `id`: String (要更新的项目ID)
    *   `name`: String (新的项目名称)
    *   `description`: String (新的项目描述)
*   **返回值**: `Result<ProjectDto, String>`
*   **说明**: 根据 ID 查找项目，如果存在则更新其元数据并刷新 `updated_at` 时间戳，然后保存回存储系统。

### 2.4 删除项目 (Delete Project)
*   **函数名**: `delete_project`
*   **参数**:
    *   `id`: String (要删除的项目ID)
*   **返回值**: `Result<(), String>`
*   **说明**: 根据 ID 在存储系统中永久移除该项目及其可能关联的所有节点数据。此操作不可逆。

## 3. 开发路径建议 (Development Path)

1.  **定义实体**: 首先在 `src/domain/project/entities.rs` 中定义 `Project` 结构体，并实现 `Serialize` 和 `Deserialize`。
2.  **定义仓储接口**: 在 `src/domain/project/repositories.rs` 定义 `ProjectRepository` trait (接口)。
3.  **实现存储**: 在 `src/infrastructure/persistence/file_repository.rs` (或者使用 SQLite) 中实现上述 trait，完成真实的读写文件逻辑。
4.  **编写应用服务**: 在 `src/application/project/services.rs` 中编写编排逻辑（依赖注入 Repository）。
5.  **暴露命令**: 在 `src/commands/project.rs` 中编写带有 `#[tauri::command]` 宏的函数，供前端调用。
6.  **注册命令**: 在 `src/main.rs` (或 `lib.rs`) 中的 `tauri::Builder::default().invoke_handler(...)` 注册上述所有的 commands。

## 4. 前端对接指南 (Frontend Integration)

一旦后端这些接口开发完毕，前端 `src/infrastructure/persistence/repositories/LocalStorageProjectRepo.ts` 的实现就可以废弃。
需要新建一个 `TauriProjectRepository.ts`，在里面使用：
```typescript
import { invoke } from '@tauri-apps/api/core';

// 例如创建项目的实现将变为：
async save(project: Project): Promise<void> {
  await invoke('create_project', { 
    name: project.meta.name, 
    description: project.meta.description 
  });
}
```
并且在 `useProjects` hook 中，将实例化的 Repository 切换为 `TauriProjectRepository`，所有的前端 UI (`ProjectList`, `ProjectCard` 等) 将**完全不需要做任何修改**，这就是 DDD 架构带来的巨大优势。
