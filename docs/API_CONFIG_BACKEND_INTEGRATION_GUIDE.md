# API 设置功能后端对接指南

> 本文档为后续开发人员提供完整的后端对接步骤说明。
> 前端代码已全部完成，仅需按照以下步骤实现后端即可。

## 📋 目录

- [整体架构概](#整体架构概览)
- [前端已完成的工作](#前端已完成的工作)
- [后端需要实现的内容](#后端需要实现的内容)
- [对接步骤（逐步）](#对接步骤逐步)
- [数据库设计建议](#数据库设计建议)
- [Tauri 命令实现示例](#tauri-命令实现示例)
- [测试清单](#测试清单)
- [常见问题](#常见问题)

---

## 整体架构概览

当前项目采用 **DDD（领域驱动设计）** 架构，数据流如下：

```
用户操作
  ↓
CanvasBoard（页面组件）
  ↓
useApiConfigs（Hook - 状态管理）
  ↓
ApiConfigApplicationService（应用服务）
  ↓
IApiConfigRepository（仓库接口）
  ↓
TauriApiConfigRepo（仓库实现 - 需创建）
  ↓
Tauri Commands（Rust 后端 - 需实现）
  ↓
SQLite 数据库
```

**分层说明**：

| 层级 | 位置 | 状态 | 职责 |
|------|------|------|------|
| 领域层 | `src/domain/apiConfig/` | ✅ 已完成 | 定义实体、值对象、仓库接口 |
| 应用层 | `src/application/apiConfig/` | ✅ 已完成 | 实现用例（Queries/Commands） |
| 展示层 | `src/presentation/` | ✅ 已完成 | UI 组件和 Hook |
| 基础设施层 | `src/infrastructure/` | ❌ 需创建 | 仓库实现（调用 Tauri 命令） |
| Tauri 后端 | `src-tauri/src/` | ❌ 需实现 | Rust 命令处理 |

---

## 前端已完成的工作

### 1. 领域层（Domain Layer）

**文件位置**：`src/domain/apiConfig/`

```
src/domain/apiConfig/
├── entities/
│   └── ApiConfig.ts          # API 配置实体（含 DTO 接口）
├── valueObjects/
│   └── index.ts              # 值对象（ModelId, ApiKey, BaseUrl 等）
└── repositories/
    └── IApiConfigRepository.ts  # 仓库接口（定义持久化操作契约）
```

**关键内容**：
- `ApiConfig` 实体：包含所有业务逻辑和验证规则
- 值对象：`ModelId`, `ApiKey`, `BaseUrl`, `ApiType`, `ApiConfigId`
- 仓库接口：定义 `findAll`, `create`, `update`, `delete`, `testConnection` 等方法

### 2. 应用层（Application Layer）

**文件位置**：`src/application/apiConfig/`

```
src/application/apiConfig/
├── ApiConfigApplicationService.ts  # 应用服务（统一入口）
├── queries/
│   └── GetApiConfigsQuery.ts       # 查询用例
└── commands/
    └── CreateUpdateDeleteApiConfigCommands.ts  # 命令用例
```

**关键内容**：
- `GetApiConfigsQuery`：获取配置列表
- `CreateApiConfigCommand`：创建配置
- `UpdateApiConfigCommand`：更新配置
- `DeleteApiConfigCommand`：删除配置
- `TestConnectionCommand`：测试连接

### 3. 展示层（Presentation Layer）

**文件位置**：`src/presentation/`

```
src/presentation/
├── pages/canvas/components/
│   ├── CanvasBoard.tsx              # 主画布组件（已集成弹窗调用）
│   └── modals/
│       └── ApiSettingsModal.tsx     # API 设置弹窗组件
└── hooks/
    └── useApiConfigs.ts             # 数据管理 Hook
```

**关键内容**：
- `ApiSettingsModal`：完整的 UI 组件，支持 Tab 切换、编辑、测试连接
- `useApiConfigs` Hook：当前使用 Mock 数据，需切换为真实模式

---

## 后端需要实现的内容

### 第一步：创建仓库实现（TypeScript）

**目标**：创建 `TauriApiConfigRepo` 类，实现 `IApiConfigRepository` 接口。

**文件位置**：`src/infrastructure/persistence/repositories/TauriApiConfigRepo.ts`

**实现代码**：

```typescript
import { invoke } from '@tauri-apps/api/core';
import { IApiConfigRepository, TestConnectionResult } from '../../../domain/apiConfig/repositories/IApiConfigRepository';
import { ApiConfig, ApiConfigDto } from '../../../domain/apiConfig/entities/ApiConfig';
import { ApiType } from '../../../domain/apiConfig/valueObjects';

/**
 * Tauri API 配置仓库实现
 * 
 * 【职责】
 * 此类负责调用 Tauri 后端命令，完成前后端数据交互。
 * 
 * 【对接说明】
 * - 每个方法内部调用对应的 Tauri 命令
 * - 将后端返回的 DTO 转换为领域实体
 * - 处理错误并向上抛出
 */
export class TauriApiConfigRepo implements IApiConfigRepository {
  /**
   * 获取所有 API 配置
   * 
   * 对应 Tauri 命令：get_api_configs
   */
  async findAll(): Promise<ApiConfig[]> {
    try {
      const dtos = await invoke<ApiConfigDto[]>('get_api_configs');
      return dtos.map((dto) => ApiConfig.fromDto(dto));
    } catch (error) {
      throw new Error(`Failed to fetch API configs: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 按类型获取 API 配置
   * 
   * 对应 Tauri 命令：get_api_configs_by_type
   */
  async findByType(apiType: ApiType): Promise<ApiConfig[]> {
    try {
      const dtos = await invoke<ApiConfigDto[]>('get_api_configs_by_type', { apiType });
      return dtos.map((dto) => ApiConfig.fromDto(dto));
    } catch (error) {
      throw new Error(`Failed to fetch API configs by type: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 根据 ID 获取单个配置
   * 
   * 对应 Tauri 命令：get_api_config
   */
  async findById(id: string): Promise<ApiConfig | null> {
    try {
      const dto = await invoke<ApiConfigDto | null>('get_api_config', { id });
      return dto ? ApiConfig.fromDto(dto) : null;
    } catch (error) {
      throw new Error(`Failed to fetch API config: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 创建新配置
   * 
   * 对应 Tauri 命令：create_api_config
   */
  async create(config: ApiConfig): Promise<ApiConfig> {
    try {
      const dto = await invoke<ApiConfigDto>('create_api_config', {
        modelId: config.modelId.value,
        apiKey: config.apiKey.value,
        baseUrl: config.baseUrl.value,
        apiType: config.apiType,
      });
      return ApiConfig.fromDto(dto);
    } catch (error) {
      throw new Error(`Failed to create API config: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 更新配置
   * 
   * 对应 Tauri 命令：update_api_config
   */
  async update(config: ApiConfig): Promise<ApiConfig> {
    try {
      const dto = await invoke<ApiConfigDto>('update_api_config', {
        id: config.id.value,
        modelId: config.modelId.value,
        apiKey: config.apiKey.value,
        baseUrl: config.baseUrl.value,
        apiType: config.apiType,
        isEnabled: config.isEnabled,
      });
      return ApiConfig.fromDto(dto);
    } catch (error) {
      throw new Error(`Failed to update API config: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 删除配置
   * 
   * 对应 Tauri 命令：delete_api_config
   */
  async delete(id: string): Promise<boolean> {
    try {
      return await invoke<boolean>('delete_api_config', { id });
    } catch (error) {
      throw new Error(`Failed to delete API config: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 测试 API 连接
   * 
   * 对应 Tauri 命令：test_api_connection
   */
  async testConnection(config: ApiConfig): Promise<TestConnectionResult> {
    try {
      return await invoke<TestConnectionResult>('test_api_connection', {
        modelId: config.modelId.value,
        apiKey: config.apiKey.value,
        baseUrl: config.baseUrl.value,
        apiType: config.apiType,
      });
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
```

### 第二步：修改 Hook 切换到真实模式

**文件位置**：`src/presentation/pages/canvas/components/CanvasBoard.tsx`

**修改位置**：找到以下代码行并修改参数

```typescript
// 当前（Mock 模式）
const { configs, loading, testConnection, saveConfig, deleteConfig } = useApiConfigs(true);

// 修改为（真实模式）
const { configs, loading, testConnection, saveConfig, deleteConfig } = useApiConfigs(false);
```

**同时修改**：`src/presentation/hooks/useApiConfigs.ts`

在 `useEffect` 中初始化仓库实例：

```typescript
useEffect(() => {
  if (!useMockData) {
    // 取消注释以下代码
    const repo = new TauriApiConfigRepo();
    setService(new ApiConfigApplicationService(repo));
  }
}, [useMockData]);
```

### 第三步：实现 Tauri 命令（Rust）

**目标**：在 Rust 后端实现所有 Tauri 命令。

**文件位置**：`src-tauri/src/commands/api_config.rs`（新建）

**完整实现示例**：

```rust
use serde::{Deserialize, Serialize};
use tauri::command;
use uuid::Uuid;
use std::time::Instant;
use reqwest::Client;

// ============================================================================
// 数据传输对象（DTO）
// ============================================================================

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApiConfigDto {
    pub id: String,
    pub model_id: String,
    pub api_key: String,
    pub base_url: String,
    pub api_type: String,
    pub is_enabled: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TestConnectionResult {
    pub success: bool,
    pub message: String,
    pub latency: Option<u64>,
}

// ============================================================================
// Tauri 命令实现
// ============================================================================

/// 获取所有 API 配置
#[command]
pub async fn get_api_configs(app: tauri::AppHandle) -> Result<Vec<ApiConfigDto>, String> {
    // 1. 获取数据库连接
    let db_state = app.state::<crate::infrastructure::DatabaseState>();
    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
    
    // 2. 查询所有配置
    let mut stmt = conn.prepare(
        "SELECT id, model_id, api_key, base_url, api_type, is_enabled 
         FROM api_configs 
         ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let configs = stmt.query_map([], |row| {
        Ok(ApiConfigDto {
            id: row.get(0)?,
            model_id: row.get(1)?,
            api_key: row.get(2)?, // 注意：返回时应考虑掩码
            base_url: row.get(3)?,
            api_type: row.get(4)?,
            is_enabled: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let configs: Vec<ApiConfigDto> = configs.collect::<Result<_, _>>().map_err(|e| e.to_string())?;
    
    Ok(configs)
}

/// 按类型获取 API 配置
#[command]
pub async fn get_api_configs_by_type(
    app: tauri::AppHandle,
    api_type: String,
) -> Result<Vec<ApiConfigDto>, String> {
    let db_state = app.state::<crate::infrastructure::DatabaseState>();
    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, model_id, api_key, base_url, api_type, is_enabled 
         FROM api_configs 
         WHERE api_type = ? 
         ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let configs = stmt.query_map([&api_type], |row| {
        Ok(ApiConfigDto {
            id: row.get(0)?,
            model_id: row.get(1)?,
            api_key: row.get(2)?,
            base_url: row.get(3)?,
            api_type: row.get(4)?,
            is_enabled: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let configs: Vec<ApiConfigDto> = configs.collect::<Result<_, _>>().map_err(|e| e.to_string())?;
    
    Ok(configs)
}

/// 根据 ID 获取单个配置
#[command]
pub async fn get_api_config(
    app: tauri::AppHandle,
    id: String,
) -> Result<Option<ApiConfigDto>, String> {
    let db_state = app.state::<crate::infrastructure::DatabaseState>();
    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, model_id, api_key, base_url, api_type, is_enabled 
         FROM api_configs 
         WHERE id = ?"
    ).map_err(|e| e.to_string())?;
    
    let config = stmt.query_row([&id], |row| {
        Ok(ApiConfigDto {
            id: row.get(0)?,
            model_id: row.get(1)?,
            api_key: row.get(2)?,
            base_url: row.get(3)?,
            api_type: row.get(4)?,
            is_enabled: row.get(5)?,
        })
    });
    
    match config {
        Ok(c) => Ok(Some(c)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// 创建新配置
#[command]
pub async fn create_api_config(
    app: tauri::AppHandle,
    model_id: String,
    api_key: String,
    base_url: String,
    api_type: String,
) -> Result<ApiConfigDto, String> {
    // 1. 验证输入
    if model_id.trim().is_empty() {
        return Err("Model ID cannot be empty".to_string());
    }
    if base_url.trim().is_empty() {
        return Err("Base URL cannot be empty".to_string());
    }
    
    // 2. 生成 UUID
    let id = Uuid::new_v4().to_string();
    
    // 3. 加密 API Key（如果有）
    let encrypted_api_key = if !api_key.is_empty() {
        // TODO: 实现加密逻辑
        // 建议使用 AES-256 加密
        api_key
    } else {
        api_key
    };
    
    // 4. 插入数据库
    let db_state = app.state::<crate::infrastructure::DatabaseState>();
    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO api_configs (id, model_id, api_key, base_url, api_type, is_enabled, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, 1, datetime('now'), datetime('now'))",
        [&id, &model_id, &encrypted_api_key, &base_url, &api_type],
    ).map_err(|e| e.to_string())?;
    
    // 5. 返回 DTO
    Ok(ApiConfigDto {
        id,
        model_id,
        api_key, // 注意：返回时应考虑掩码
        base_url,
        api_type,
        is_enabled: true,
    })
}

/// 更新配置
#[command]
pub async fn update_api_config(
    app: tauri::AppHandle,
    id: String,
    model_id: String,
    api_key: String,
    base_url: String,
    api_type: String,
    is_enabled: bool,
) -> Result<ApiConfigDto, String> {
    // 1. 验证输入
    if model_id.trim().is_empty() {
        return Err("Model ID cannot be empty".to_string());
    }
    if base_url.trim().is_empty() {
        return Err("Base URL cannot be empty".to_string());
    }
    
    // 2. 检查配置是否存在
    let db_state = app.state::<crate::infrastructure::DatabaseState>();
    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
    
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM api_configs WHERE id = ?1",
        [&id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())? > 0;
    
    if !exists {
        return Err(format!("API config with ID '{}' not found", id));
    }
    
    // 3. 更新数据库
    conn.execute(
        "UPDATE api_configs 
         SET model_id = ?2, api_key = ?3, base_url = ?4, api_type = ?5, is_enabled = ?6, updated_at = datetime('now')
         WHERE id = ?1",
        [&id, &model_id, &api_key, &base_url, &api_type, &(is_enabled as i32)],
    ).map_err(|e| e.to_string())?;
    
    // 4. 返回更新后的 DTO
    Ok(ApiConfigDto {
        id,
        model_id,
        api_key,
        base_url,
        api_type,
        is_enabled,
    })
}

/// 删除配置
#[command]
pub async fn delete_api_config(
    app: tauri::AppHandle,
    id: String,
) -> Result<bool, String> {
    let db_state = app.state::<crate::infrastructure::DatabaseState>();
    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
    
    let result = conn.execute(
        "DELETE FROM api_configs WHERE id = ?1",
        [&id],
    );
    
    match result {
        Ok(rows) => Ok(rows > 0),
        Err(e) => Err(e.to_string()),
    }
}

/// 测试 API 连接
#[command]
pub async fn test_api_connection(
    model_id: String,
    api_key: String,
    base_url: String,
    api_type: String,
) -> Result<TestConnectionResult, String> {
    // 1. 构建测试 URL
    let test_url = match api_type.as_str() {
        "Chat" => format!("{}/v1/models", base_url.trim_end_matches('/')),
        "Image" => format!("{}/v1/images/generations", base_url.trim_end_matches('/')),
        "Video" => format!("{}/v1/videos", base_url.trim_end_matches('/')),
        _ => return Err(format!("Unsupported API type: {}", api_type)),
    };
    
    // 2. 创建 HTTP 客户端
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10)) // 10 秒超时
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    // 3. 发起测试请求
    let start = Instant::now();
    let response = client
        .get(&test_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await;
    
    let latency = start.elapsed().as_millis() as u64;
    
    // 4. 处理响应
    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                Ok(TestConnectionResult {
                    success: true,
                    message: "Connection successful".to_string(),
                    latency: Some(latency),
                })
            } else {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                Ok(TestConnectionResult {
                    success: false,
                    message: format!("HTTP {}: {}", status, body.chars().take(100).collect::<String>()),
                    latency: Some(latency),
                })
            }
        }
        Err(e) => Ok(TestConnectionResult {
            success: false,
            message: format!("Connection failed: {}", e),
            latency: Some(latency),
        }),
    }
}
```

### 第四步：注册 Tauri 命令

**文件位置**：`src-tauri/src/lib.rs`

在现有的命令注册处添加新的命令：

```rust
// 在 generate_handler! 中添加
.generate_handler![
    // ... 现有命令 ...
    crate::commands::api_config::get_api_configs,
    crate::commands::api_config::get_api_configs_by_type,
    crate::commands::api_config::get_api_config,
    crate::commands::api_config::create_api_config,
    crate::commands::api_config::update_api_config,
    crate::commands::api_config::delete_api_config,
    crate::commands::api_config::test_api_connection,
]
```

同时需要创建模块声明：

```rust
pub mod commands {
    pub mod project;
    pub mod api_config; // 添加此行
}
```

---

## 对接步骤（逐步）

### 步骤 1：创建数据库表

**操作**：在 SQLite 数据库中创建 `api_configs` 表。

**SQL 语句**：

```sql
CREATE TABLE IF NOT EXISTS api_configs (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    api_key TEXT,
    base_url TEXT NOT NULL,
    api_type TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 创建索引以加速按类型查询
CREATE INDEX IF NOT EXISTS idx_api_configs_type ON api_configs(api_type);
```

**建议位置**：在应用启动时执行，例如在 `src-tauri/src/infrastructure/mod.rs` 中的数据库初始化逻辑。

### 步骤 2：创建 TypeScript 仓库实现

**操作**：创建 `TauriApiConfigRepo.ts` 文件。

**文件位置**：`src/infrastructure/persistence/repositories/TauriApiConfigRepo.ts`

**参考代码**：见上方"第一步：创建仓库实现（TypeScript）"

### 步骤 3：实现 Rust Tauri 命令

**操作**：创建 `api_config.rs` 文件并实现所有命令。

**文件位置**：`src-tauri/src/commands/api_config.rs`

**参考代码**：见上方"第三步：实现 Tauri 命令（Rust）"

### 步骤 4：注册命令

**操作**：在 `lib.rs` 中注册所有 Tauri 命令。

**参考代码**：见上方"第四步：注册 Tauri 命令"

### 步骤 5：切换 Hook 到真实模式

**操作 1**：修改 `CanvasBoard.tsx`

```typescript
// 找到此行并修改
const { ... } = useApiConfigs(false); // 改为 false
```

**操作 2**：修改 `useApiConfigs.ts`

在 Hook 中初始化仓库实例（参考上方说明）。

### 步骤 6：测试

按照下方"测试清单"逐项测试。

---

## 数据库设计建议

### 表结构

```sql
CREATE TABLE api_configs (
    id TEXT PRIMARY KEY,              -- UUID，唯一标识
    model_id TEXT NOT NULL,           -- 模型标识，如 "gpt-5.4"
    api_key TEXT,                     -- API 密钥（建议加密存储）
    base_url TEXT NOT NULL,           -- 基础 URL
    api_type TEXT NOT NULL,           -- 类型：Chat/Image/Video
    is_enabled INTEGER NOT NULL DEFAULT 1,  -- 是否启用（0 或 1）
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX idx_api_configs_type ON api_configs(api_type);
CREATE INDEX idx_api_configs_enabled ON api_configs(is_enabled);
```

### 加密建议

对于 `api_key` 字段，建议：

1. 使用 AES-256-GCM 加密
2. 密钥存储在环境变量或系统密钥链中
3. 不要在日志或错误消息中输出完整密钥
4. 返回前端时部分掩码（如 `sk-abc****xyz`）

---

## 测试清单

### 功能测试

- [ ] 打开 API 设置弹窗，能看到 Mock 数据（前端测试）
- [ ] 切换到真实模式后，能从数据库加载配置
- [ ] 切换 Tab（Chat/Image/Video）能正确过滤配置
- [ ] 编辑配置字段，能保存到数据库
- [ ] 点击"测试连接"，能发起真实的 HTTP 请求
- [ ] 测试成功时显示绿色提示和延迟时间
- [ ] 测试失败时显示红色错误消息
- [ ] 新增配置能成功插入数据库
- [ ] 删除配置能从数据库移除
- [ ] 关闭弹窗后再次打开，数据保持一致

### 边界测试

- [ ] Model ID 为空时，保存应失败并提示
- [ ] Base URL 格式不正确时，保存应失败
- [ ] API Key 可以为空（某些本地模型不需要）
- [ ] 网络断开时，测试连接应返回失败
- [ ] 数据库为空时，显示空状态提示
- [ ] 并发保存操作不应导致数据损坏

### 安全测试

- [ ] API Key 在数据库中应加密存储
- [ ] 返回前端的 API Key 应部分掩码
- [ ] 错误消息不应暴露敏感信息（如完整密钥、数据库路径）
- [ ] SQL 注入攻击应被防止（使用参数化查询）

---

## 常见问题

### Q1: 如何切换 Mock 模式和真实模式？

**A**: 在 `CanvasBoard.tsx` 中找到：

```typescript
const { ... } = useApiConfigs(true); // true = Mock 模式
```

改为：

```typescript
const { ... } = useApiConfigs(false); // false = 真实模式
```

### Q2: 测试连接时返回 401 错误怎么办？

**A**: 这通常表示 API Key 不正确。检查：
1. API Key 是否正确复制到输入框
2. Base URL 是否正确
3. 该 API Key 是否有权限访问对应端点

### Q3: 如何实现 API Key 加密？

**A**: 推荐使用 `aes-gcm` crate（Rust）：

```rust
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::{Engine as _, engine::general_purpose};

// 加密
fn encrypt_api_key(key: &str) -> String {
    let cipher = Aes256Gcm::new_from_slice(&get_encryption_key()).unwrap();
    let nonce = generate_nonce();
    let ciphertext = cipher.encrypt(&nonce, key.as_bytes()).unwrap();
    // 返回 nonce + ciphertext 的 Base64 编码
    format!("{}:{}", base64_encode(nonce), base64_encode(ciphertext))
}
```

### Q4: 数据库文件存储在哪里？

**A**: Tauri 应用的数据目录由平台决定：
- macOS: `~/Library/Application Support/com.tauri.dev/`
- Windows: `%APPDATA%/com.tauri.dev/`
- Linux: `~/.config/com.tauri.dev/`

使用 `tauri::api::path::app_data_dir()` 获取。

### Q5: 如何处理数据库迁移？

**A**: 对于当前项目，由于是本地应用，可以：
1. 在启动时执行 `CREATE TABLE IF NOT EXISTS`
2. 使用版本表跟踪当前数据库版本
3. 启动时检查版本并执行迁移脚本

---

## 后续扩展建议

### 短期（1-2 周）

- [ ] 实现新增配置按钮和表单
- [ ] 实现删除配置确认弹窗
- [ ] 添加启用/禁用切换开关
- [ ] 优化错误提示（使用 Toast 通知）

### 中期（1-2 月）

- [ ] 支持批量导入/导出配置
- [ ] 支持配置分组和标签
- [ ] 添加配置搜索功能
- [ ] 支持配置优先级排序

### 长期（3 月+）

- [ ] 支持云同步（多设备共享）
- [ ] 支持配置模板
- [ ] 支持自动选择最佳配置
- [ ] 添加使用统计和监控

---

## 联系与支持

如果在对接过程中遇到问题，请查看：

1. 各文件顶部的详细注释
2. `src/domain/apiConfig/` 中的领域模型定义
3. `src/application/apiConfig/` 中的应用层用例
4. Tauri 官方文档：https://v2.tauri.app/

---

**文档版本**：v1.0  
**最后更新**：2026-04-03  
**适用项目**：Workflow（Next.js + Tauri 2.x + SQLite）
