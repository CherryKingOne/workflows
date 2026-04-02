# 项目注释规范与交接指南 (Project Commenting & Handoff Guidelines)

## 1. 核心要求 (Core Requirements)

**目标对象**：本项目将交接给可能对项目架构或复杂技术不够熟悉的新手/小白开发人员。
**核心原则**：
1. **代码即文档**：尽可能通过清晰的命名减少阅读负担。
2. **极度详尽的注释**：任何非基础逻辑、涉及领域驱动设计(DDD)的概念、跨层调用的地方、状态管理、业务流程必须逐行或逐段注释。
3. **保留历史注释**：除非逻辑发生根本性重构，否则**严禁删除原有注释**。
4. **不波及原则**：修改系统其他模块时，**坚决不能修改**已稳定的核心页面(如`ProjectList`)及其后端函数，除非明确收到硬性业务需求变更。

## 2. 前端注释规范 (Frontend Commenting Guidelines)

在前端（特别是使用 React + TypeScript + DDD 架构的地方），必须包含以下注释：

*   **文件头部**：说明此文件的作用、所属 DDD 分层（如 Domain/Application/Presentation）。
*   **Hooks 调用**：解释为什么要调用这个 Hook，返回的状态代表什么业务含义。
*   **状态与变量**：解释 `useState` 中每一个状态控制了页面的哪部分 UI（如 `isCreateModalOpen` 控制新建项目弹窗显示）。
*   **事件处理函数**：如 `handleCreateSubmit`，需要按步骤注释：（1）验证输入，（2）开启 Loading 状态，（3）调用后端/Application 层，（4）关闭弹窗及清理数据。
*   **UI 渲染**：复杂的 Tailwind CSS 样式不需要解释，但需要注释区块的作用（例如 `/* 新建项目弹窗 */`、`/* 提示区域 - 缺失 API Key */`）。

## 3. 后端 (Rust) 注释规范 (Backend Commenting Guidelines)

后端采用 Tauri + Rust 并遵循 DDD。

*   **Tauri Commands (入口函数)**：必须明确写明这是供前端调用的 API。指明参数含义、返回值结构，以及它调用了哪个 Application 层的用例。
*   **Application 层 (UseCase)**：解释业务流程的编排。
*   **Domain 层 (实体与值对象)**：解释这些数据结构在现实业务中代表什么（如 `Project` 实体代表一个完整的分镜项目）。
*   **Infrastructure 层 (仓储实现)**：如果在读写文件/数据库，需解释存储的位置和数据的序列化方式。

## 4. 后续修改纪律 (Modification Discipline)

*   **白名单机制**：目前 `app/(routes)/projects` 页面及其依赖的 `src/domain/project`、`src/application/project` 和关联的 Rust 后端函数，属于**稳定区域**。
*   **防误伤**：在开发新功能（例如“画布编辑器”或“设置页”）时，不要图省事修改“项目管理”领域的代码。如果新功能需要用到项目数据，请通过暴露只读接口 (Query) 的方式获取，或者创建新的专门的用例 (Command)，绝不能破坏原有业务逻辑。
*   **修改确认**：如果一定要修改本指南覆盖的代码，必须在注释中增加 `[Update YYYY-MM-DD]` 标记，并说明修改原因。
