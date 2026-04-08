import { IModelRegistry } from '@/src/domain/aiModel/repositories/IModelRegistry';
import { IImageModelProvider } from '@/src/domain/aiModel/services/IImageModelProvider';
import { InvokeImageGenerationCommand } from './commands/InvokeImageGenerationCommand';
import { ImageModelRegistry } from '@/src/infrastructure/aiModel/registry/LocalModelRegistry';

export interface ImageModelParamRecommendations {
  resolution?: Array<{ value: string; label?: string; supported?: boolean }>;
  aspectRatio?: Record<string, Array<{ value: string; size?: string | null; supported?: boolean }>>;
  n?: { min: number; max: number; default: number };
}

interface ParamRecommendationCapableProvider extends IImageModelProvider {
  getParamRecommendations?: () => ImageModelParamRecommendations;
}

/**
 * AI 模型应用服务
 * 负责协调领域层和基础设施层，为表示层提供统一的调用入口
 *
 * 设计原则：
 * - 应用层不关心模型的具体实现
 * - 只依赖领域层的抽象接口
 * - 处理业务流程编排和错误处理
 */
export class AiModelApplicationService {
  private registry: IModelRegistry;

  constructor() {
    // 实例化注册表
    this.registry = new ImageModelRegistry();
  }

  /**
   * 调用图像生成模型
   * @param command 包含模型ID、提示词和参数的命令对象
   * @returns 生成的图片URL或Base64字符串
   */
  async invokeImageModel(command: InvokeImageGenerationCommand): Promise<string> {
    // 1. 从注册表获取指定模型
    const provider = this.registry.getProvider(command.modelId);

    // 2. 执行模型（将UI层传来的参数透传给底层独立模型去处理）
    const resultUrl = await provider.generateImage(command.prompt, command.modelParams);

    return resultUrl;
  }

  /**
   * 获取所有可用的模型ID列表
   * @returns 模型ID数组
   */
  getAvailableModels(): string[] {
    return this.registry.getAllModelIds();
  }

  /**
   * 获取模型参数推荐（如果模型提供了该能力）
   *
   * 说明：
   * - 返回值为模型专属配置建议，供展示层动态渲染参数选项
   * - 若模型未实现该能力，则返回 null
   */
  getImageModelParamRecommendations(modelId: string): ImageModelParamRecommendations | null {
    try {
      const provider = this.registry.getProvider(modelId) as ParamRecommendationCapableProvider;
      if (typeof provider.getParamRecommendations !== 'function') {
        return null;
      }
      return provider.getParamRecommendations();
    } catch {
      return null;
    }
  }
}

// 单例导出供前端Hook使用
export const aiModelService = new AiModelApplicationService();
