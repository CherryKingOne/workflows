import { IChatModelRegistry } from '@/src/domain/aiModel/repositories/IChatModelRegistry';
import { IChatModelProvider } from '@/src/domain/aiModel/services/IChatModelProvider';

// 手动引入聊天模型文件
import { DeepSeekChatProvider } from '../providers/chat/DeepSeekChat';
import { DoubaoSeed20ProProvider } from '../providers/chat/DoubaoSeed20Pro';

/**
 * 聊天模型注册表实现
 *
 * 设计原则：
 * - 增加模型：创建新文件 + 在此注册
 * - 删除模型：删除文件 + 移除注册行
 * - 所有聊天模型通过此注册表统一管理
 */
export class ChatModelRegistry implements IChatModelRegistry {
  private providers: Map<string, IChatModelProvider> = new Map();

  constructor() {
    // 注册聊天模型
    this.register(new DeepSeekChatProvider());
    this.register(new DoubaoSeed20ProProvider());
  }

  register(provider: IChatModelProvider): void {
    this.providers.set(provider.getModelId(), provider);
  }

  getProvider(modelId: string): IChatModelProvider {
    const provider = this.providers.get(modelId);
    if (!provider) {
      throw new Error(`Chat model ${modelId} not found in registry. Available models: ${this.getAllModelIds().join(', ')}`);
    }
    return provider;
  }

  removeProvider(modelId: string): void {
    this.providers.delete(modelId);
  }

  getAllModelIds(): string[] {
    return Array.from(this.providers.keys());
  }
}
