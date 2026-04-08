# AI 模型调用模块

基于 DDD 和极低耦合原则设计的 AI 模型调用架构。

## 架构设计

### 核心原则
1. **极低耦合**：每个模型完全独立，参数不共享
2. **注册表模式**：通过注册表统一管理模型
3. **依赖倒置**：应用层依赖领域层抽象，不依赖具体实现
4. **易于扩展**：新增/删除模型只需操作对应文件和注册表

### 目录结构

```
src/
├── domain/aiModel/                    # 领域层：定义规则和抽象
│   ├── services/
│   │   └── IImageModelProvider.ts    # 模型提供者接口
│   └── repositories/
│       └── IModelRegistry.ts         # 注册表接口
│
├── infrastructure/aiModel/            # 基础设施层：具体实现
│   ├── registry/
│   │   └── LocalModelRegistry.ts     # 注册表实现
│   └── providers/
│       └── image/                    # 图像模型
│           ├── DallE3.ts            # DallE-3 独立实现
│           └── StableDiffusion.ts   # SD-XL 独立实现
│
├── application/aiModel/               # 应用层：业务编排
│   ├── AiModelApplicationService.ts  # 应用服务
│   └── commands/
│       └── InvokeImageGenerationCommand.ts
│
└── presentation/hooks/                # 表示层：UI 调用
    └── useAiModel.ts                 # React Hook
```

## 使用方法

### 在组件中调用

```tsx
import { useAiModel } from '@/presentation/hooks/useAiModel';

export const ImageGenerationComponent = () => {
  const { generateImage, loading, error, getAvailableModels } = useAiModel();

  const handleGenerate = async () => {
    // DallE-3 参数
    const dalleConfig = {
      width: 1024,
      height: 1024,
      quality: 'hd',
      apiKey: 'sk-xxxxx'
    };

    try {
      const imageUrl = await generateImage('DallE-3', '一只可爱的猫咪', dalleConfig);
      console.log('生成的图片:', imageUrl);
    } catch (err) {
      console.error('生成失败:', error);
    }
  };

  // 获取所有可用模型
  const models = getAvailableModels(); // ['DallE-3', 'SD-XL']

  return (
    <button onClick={handleGenerate} disabled={loading}>
      {loading ? '生成中...' : '生成图片'}
    </button>
  );
};
```

## 如何新增模型

1. 在 `src/infrastructure/aiModel/providers/image/` 创建新文件，如 `Midjourney.ts`
2. 实现 `IImageModelProvider` 接口
3. 在 `LocalModelRegistry.ts` 中注册：

```typescript
import { MidjourneyProvider } from '../providers/image/Midjourney';

constructor() {
  this.register(new DallE3Provider());
  this.register(new StableDiffusionProvider());
  this.register(new MidjourneyProvider()); // 新增这行
}
```

## 如何删除模型

1. 删除对应的模型文件（如 `DallE3.ts`）
2. 在 `LocalModelRegistry.ts` 中移除注册行
3. 无需修改其他任何代码

## 设计优势

- **安全隔离**：修改一个模型不会影响其他模型
- **简单维护**：删除模型只需删除文件和注册行
- **符合 DDD**：清晰的层次边界和依赖方向
- **易于测试**：每个模型可独立测试

## 注意事项

### Tauri 环境下的网络请求
在 Tauri 环境中，建议使用 `@tauri-apps/api/http` 替代 `window.fetch` 以避免 CORS 问题：

```typescript
import { fetch } from '@tauri-apps/api/http';

// 在模型文件中使用 Tauri 的 fetch
const response = await fetch('https://api.openai.com/...', {
  method: 'POST',
  headers: { ... },
  body: { ... }
});
```
