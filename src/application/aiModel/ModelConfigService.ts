import { IModelConfigRepository } from '@/src/domain/aiModel/repositories/IModelConfigRepository';
import { ModelConfig } from '@/src/domain/aiModel/entities/ModelConfig';
import { ImageModelRegistry } from '@/src/infrastructure/aiModel/registry/LocalModelRegistry';
import { ChatModelRegistry } from '@/src/infrastructure/aiModel/registry/ChatModelRegistry';

/**
 * 模型配置应用服务
 * 负责模型配置的业务逻辑编排
 *
 * 核心功能：
 * 1. 优先从 SQLite 获取配置
 * 2. 如果 SQLite 没有，则使用注册表中的默认配置
 * 3. 支持配置的查询和更新
 * 4. 不支持创建和删除（通过代码注册表管理）
 */
export class ModelConfigService {
  private configRepository: IModelConfigRepository;
  private imageRegistry: ImageModelRegistry;
  private chatRegistry: ChatModelRegistry;

  constructor(configRepository: IModelConfigRepository) {
    this.configRepository = configRepository;
    this.imageRegistry = new ImageModelRegistry();
    this.chatRegistry = new ChatModelRegistry();
  }

  /**
   * 初始化：将注册表中的模型同步到数据库（如果不存在）
   */
  async initializeConfigs(): Promise<void> {
    const defaultConfigs: ModelConfig[] = [];

    // 图像模型默认配置
    const imageModelIds = this.imageRegistry.getAllModelIds();
    for (const modelId of imageModelIds) {
      const existing = await this.configRepository.findById(modelId);
      if (!existing) {
        // 根据模型ID设置默认配置
        const defaultConfig = this.getDefaultConfigForModel(modelId, 'image');
        if (defaultConfig) {
          defaultConfigs.push(defaultConfig);
        }
      }
    }

    // 聊天模型默认配置
    const chatModelIds = this.chatRegistry.getAllModelIds();
    for (const modelId of chatModelIds) {
      const existing = await this.configRepository.findById(modelId);
      if (!existing) {
        const defaultConfig = this.getDefaultConfigForModel(modelId, 'chat');
        if (defaultConfig) {
          defaultConfigs.push(defaultConfig);
        }
      }
    }

    // 批量保存默认配置
    if (defaultConfigs.length > 0) {
      await this.configRepository.batchUpsert(defaultConfigs);
    }
  }

  /**
   * 获取模型的默认配置
   */
  private getDefaultConfigForModel(modelId: string, modelType: 'image' | 'chat'): ModelConfig | null {
    // 根据模型ID返回默认配置
    const configMap: Record<string, Partial<ModelConfig>> = {
      'doubao-seedream-5-0-260128': {
        modelName: 'Doubao Seedream 5.0',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
        apiKey: process.env.DOUBAO_API_KEY || '',
      },
      'deepseek-chat': {
        modelName: 'DeepSeek Chat',
        baseUrl: 'https://api.deepseek.com',
        apiUrl: 'https://api.deepseek.com/v1/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY || '',
      },
      'doubao-seed-2-0-pro-260215': {
        modelName: 'Doubao Seed 2.0 Pro',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        apiKey: process.env.DOUBAO_API_KEY || '',
      },
    };

    const defaultData = configMap[modelId];
    if (!defaultData) return null;

    return new ModelConfig({
      modelId,
      modelType,
      modelName: defaultData.modelName!,
      baseUrl: defaultData.baseUrl!,
      apiKey: defaultData.apiKey!,
      apiUrl: defaultData.apiUrl,
    });
  }

  /**
   * 获取模型配置（优先从数据库，否则使用默认配置）
   */
  async getModelConfig(modelId: string): Promise<ModelConfig | null> {
    // 1. 优先从数据库获取
    const dbConfig = await this.configRepository.findById(modelId);
    if (dbConfig) {
      return dbConfig;
    }

    // 2. 检查注册表中是否存在该模型
    const imageModelIds = this.imageRegistry.getAllModelIds();
    const chatModelIds = this.chatRegistry.getAllModelIds();

    if (imageModelIds.includes(modelId)) {
      return this.getDefaultConfigForModel(modelId, 'image');
    }

    if (chatModelIds.includes(modelId)) {
      return this.getDefaultConfigForModel(modelId, 'chat');
    }

    return null;
  }

  /**
   * 获取所有模型配置列表
   */
  async getAllConfigs(modelType?: 'image' | 'chat'): Promise<ModelConfig[]> {
    return await this.configRepository.findAll(modelType);
  }

  /**
   * 更新模型配置
   */
  async updateConfig(modelId: string, data: Partial<{
    modelName: string;
    baseUrl: string;
    apiKey: string;
    apiUrl: string;
    enabled: boolean;
  }>): Promise<void> {
    // 检查模型是否在注册表中
    const imageModelIds = this.imageRegistry.getAllModelIds();
    const chatModelIds = this.chatRegistry.getAllModelIds();

    if (!imageModelIds.includes(modelId) && !chatModelIds.includes(modelId)) {
      throw new Error(`Model ${modelId} not found in registry. Cannot update config for unregistered model.`);
    }

    await this.configRepository.update(modelId, data);
  }

  /**
   * 获取图像模型配置列表
   */
  async getImageModelConfigs(): Promise<ModelConfig[]> {
    return await this.getAllConfigs('image');
  }

  /**
   * 获取聊天模型配置列表
   */
  async getChatModelConfigs(): Promise<ModelConfig[]> {
    return await this.getAllConfigs('chat');
  }
}
