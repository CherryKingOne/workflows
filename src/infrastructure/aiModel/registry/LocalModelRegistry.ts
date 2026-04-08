import { IModelRegistry } from '@/src/domain/aiModel/repositories/IModelRegistry';
import { IImageModelProvider } from '@/src/domain/aiModel/services/IImageModelProvider';

// 手动引入模型文件
import { DoubaoSeedream50Provider } from '../providers/image/DoubaoSeedream50';

/**
 * 图像模型注册表实现
 *
 * 设计原则：
 * - 增加模型：创建新文件 + 在此注册
 * - 删除模型：删除文件 + 移除注册行
 * - 所有图像模型通过此注册表统一管理
 */
export class ImageModelRegistry implements IModelRegistry {
  private providers: Map<string, IImageModelProvider> = new Map();

  constructor() {
    // 【注册图像模型】增加或删除模型，只需要改这里和对应文件夹即可
    this.register(new DoubaoSeedream50Provider());
  }

  register(provider: IImageModelProvider): void {
    this.providers.set(provider.getModelId(), provider);
  }

  getProvider(modelId: string): IImageModelProvider {
    const provider = this.providers.get(modelId);
    if (!provider) {
      throw new Error(`Image model ${modelId} not found in registry. Available models: ${this.getAllModelIds().join(', ')}`);
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
