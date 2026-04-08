# 模型配置管理系统

## 架构说明

模型配置管理系统负责将注册表中的模型信息持久化到 SQLite，并提供前端可视化配置能力。

### 核心原则

1. **双重保险机制**：优先从 SQLite 获取配置，如果没有则使用代码中的默认配置
2. **只读注册表**：模型的创建和删除只能通过代码注册表管理
3. **可更新配置**：前端可以更新模型的 API Key、URL 等配置信息

### 目录结构

```
src/
├── domain/aiModel/
│   ├── entities/
│   │   └── ModelConfig.ts              # 模型配置实体
│   └── repositories/
│       └── IModelConfigRepository.ts   # 配置仓储接口
│
├── infrastructure/aiModel/
│   └── persistence/
│       └── SqliteModelConfigRepository.ts  # SQLite 实现
│
├── application/aiModel/
│   └── ModelConfigService.ts           # 配置管理服务
│
└── presentation/hooks/
    └── useModelConfig.ts               # React Hook
```

## 使用方法

### 1. 初始化配置（首次运行）

```typescript
import { ModelConfigService } from '@/src/application/aiModel/ModelConfigService';
import { SqliteModelConfigRepository } from '@/src/infrastructure/aiModel/persistence/SqliteModelConfigRepository';

const repository = new SqliteModelConfigRepository();
const service = new ModelConfigService(repository);

// 将注册表中的模型同步到数据库
await service.initializeConfigs();
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
        <div key={config.modelId}>
          <h3>{config.modelName}</h3>
          <p>Base URL: {config.baseUrl}</p>
          <p>API Key: {config.apiKey.substring(0, 10)}...</p>
          <button onClick={() => updateConfig(config.modelId, {
            apiKey: 'new-key',
            enabled: true
          })}>
            更新配置
          </button>
        </div>
      ))}
    </div>
  );
};
```

### 3. 更新模型配置

```typescript
const { updateConfig } = useModelConfig();

await updateConfig('DallE-3', {
  apiKey: 'sk-new-key',
  baseUrl: 'https://api.openai.com',
  enabled: true
});
```

### 4. 获取单个模型配置

```typescript
const { getConfig } = useModelConfig();

const config = await getConfig('DeepSeek-Chat');
console.log(config?.apiKey);
```

## 数据库结构

### model_configs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| model_id | TEXT | 主键，模型唯一标识 |
| model_name | TEXT | 模型显示名称 |
| model_type | TEXT | 模型类型：image 或 chat |
| base_url | TEXT | API 基础 URL |
| api_key | TEXT | API Key |
| api_url | TEXT | 完整 API URL（可选） |
| enabled | INTEGER | 是否启用（0/1） |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

## 工作流程

### 模型注册流程

1. 在代码中创建模型类（如 `DeepSeekChat.ts`）
2. 在注册表中注册模型（`ChatModelRegistry.ts`）
3. 运行 `initializeConfigs()` 将模型信息同步到 SQLite
4. 前端可以查看和修改配置

### 模型删除流程

1. 从注册表中移除注册行
2. 删除模型文件
3. 从 SQLite 中删除配置记录
4. 完成彻底删除

## 配置优先级

```
SQLite 配置 > 代码默认配置 > 环境变量
```

## 注意事项

1. **数据库路径**：默认为 `./data/models.db`，可通过构造函数参数自定义
2. **API Key 安全**：生产环境建议加密存储
3. **并发控制**：SQLite 使用事务保证数据一致性
4. **初始化时机**：应用启动时调用 `initializeConfigs()`

## 依赖安装

```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```
