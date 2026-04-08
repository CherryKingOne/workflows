# Tauri 模型配置管理系统

## 架构说明

通过 Tauri Commands 调用 Rust 后端操作 SQLite，实现模型配置的持久化管理。

### 技术栈

- **前端**: TypeScript + React + Tauri API
- **后端**: Rust + rusqlite + Tauri Commands
- **数据库**: SQLite

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (TypeScript)                    │
│  ┌──────────────┐      ┌──────────────────────────────┐    │
│  │ useModelConfig│ ───> │ ModelConfigApi (Tauri API)  │    │
│  │    (Hook)     │      │   invoke('get_all_configs') │    │
│  └──────────────┘      └──────────────────────────────┘    │
└─────────────────────────────────────┬───────────────────────┘
                                      │ Tauri IPC
┌─────────────────────────────────────▼───────────────────────┐
│                      后端 (Rust)                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Commands (model_config.rs)                          │   │
│  │  - get_all_model_configs                             │   │
│  │  - get_model_config                                  │   │
│  │  - update_model_config                               │   │
│  │  - init_model_configs                                │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │  Infrastructure (model_config_repository.rs)         │   │
│  │  - SqliteModelConfigRepository                       │   │
│  │  - CRUD operations                                   │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│                       ▼                                      │
│                  SQLite Database                             │
│              (app_data_dir/models.db)                        │
└──────────────────────────────────────────────────────────────┘
```

## 文件结构

### Rust 后端

```
src-tauri/src/
├── domain/
│   └── model_config.rs              # 模型配置实体
├── infrastructure/
│   └── model_config_repository.rs   # SQLite 仓储实现
├── commands/
│   └── model_config.rs              # Tauri Commands
└── lib.rs                           # 注册 Commands 和状态
```

### TypeScript 前端

```
src/
├── infrastructure/aiModel/api/
│   └── ModelConfigApi.ts            # Tauri API 封装
├── application/aiModel/
│   └── ModelConfigInitializer.ts    # 初始化服务
└── presentation/hooks/
    └── useModelConfig.ts            # React Hook
```

## 使用方法

### 1. 应用启动时初始化

在应用入口（如 `_app.tsx` 或 `layout.tsx`）中调用：

```typescript
import { ModelConfigInitializer } from '@/src/application/aiModel/ModelConfigInitializer';

useEffect(() => {
  // 初始化模型配置
  ModelConfigInitializer.initialize().catch(console.error);
}, []);
```

### 2. 前端获取配置列表

```tsx
import { useModelConfig } from '@/src/presentation/hooks/useModelConfig';

export const ModelConfigPanel = () => {
  const { configs, loading, error, updateConfig } = useModelConfig('image');

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;

  return (
    <div>
      {configs.map(config => (
        <div key={config.model_id}>
          <h3>{config.model_name}</h3>
          <p>Base URL: {config.base_url}</p>
          <input
            type="password"
            value={config.api_key}
            onChange={(e) => updateConfig(config.model_id, {
              api_key: e.target.value
            })}
          />
        </div>
      ))}
    </div>
  );
};
```

### 3. 直接调用 API

```typescript
import { ModelConfigApi } from '@/src/infrastructure/aiModel/api/ModelConfigApi';

// 获取所有图像模型
const imageModels = await ModelConfigApi.getAllConfigs('image');

// 获取单个配置
const config = await ModelConfigApi.getConfig('DeepSeek-Chat');

// 更新配置
await ModelConfigApi.updateConfig('DallE-3', {
  api_key: 'sk-new-key',
  enabled: true
});
```

## Tauri Commands

### get_all_model_configs

获取所有模型配置列表。

```typescript
invoke<ModelConfig[]>('get_all_model_configs', {
  modelType: 'image' | 'chat' | null
})
```

### get_model_config

根据ID获取单个模型配置。

```typescript
invoke<ModelConfig | null>('get_model_config', {
  modelId: 'DallE-3'
})
```

### update_model_config

更新模型配置。

```typescript
invoke('update_model_config', {
  modelId: 'DallE-3',
  request: {
    api_key: 'new-key',
    enabled: true
  }
})
```

### init_model_configs

批量初始化模型配置。

```typescript
invoke('init_model_configs', {
  configs: [
    {
      model_id: 'DallE-3',
      model_name: 'DALL-E 3',
      model_type: 'image',
      base_url: 'https://api.openai.com',
      api_key: 'sk-xxx',
      api_url: 'https://api.openai.com/v1/images/generations'
    }
  ]
})
```

### delete_model_config

删除模型配置（仅供内部清理）。

```typescript
invoke('delete_model_config', {
  modelId: 'DallE-3'
})
```

## 数据库位置

SQLite 数据库文件位置：
- **macOS**: `~/Library/Application Support/com.yourapp.dev/models.db`
- **Windows**: `C:\Users\<username>\AppData\Roaming\com.yourapp.dev\models.db`
- **Linux**: `~/.local/share/com.yourapp.dev/models.db`

## 工作流程

### 模型注册流程

1. 在 TypeScript 中创建模型类（如 `DeepSeekChat.ts`）
2. 在注册表中注册模型（`ChatModelRegistry.ts`）
3. 在 `ModelConfigInitializer.ts` 中添加默认配置
4. 应用启动时自动同步到 SQLite
5. 前端可以查看和修改配置

### 模型删除流程

1. 从 TypeScript 注册表中移除
2. 从 `ModelConfigInitializer.ts` 中移除默认配置
3. 调用 `delete_model_config` 从数据库删除
4. 删除模型文件

## 注意事项

1. **API Key 安全**: 生产环境建议加密存储
2. **环境变量**: 使用 `NEXT_PUBLIC_` 前缀的环境变量
3. **错误处理**: 所有 Tauri Commands 都返回 `Result<T, String>`
4. **并发安全**: Rust 使用 `Mutex` 保证线程安全

## 编译和运行

```bash
# 开发模式
npm run tauri:dev

# 构建生产版本
npm run tauri:build
```
