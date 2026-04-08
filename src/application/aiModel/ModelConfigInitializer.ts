import { ModelConfigApi, InitConfigRequest } from '@/src/infrastructure/aiModel/api/ModelConfigApi';

/**
 * 模型配置初始化服务
 * 负责在应用启动时将代码注册表中的模型同步到 SQLite
 */
export class ModelConfigInitializer {
  /**
   * 获取所有需要初始化的模型配置
   */
  private static getDefaultConfigs(): InitConfigRequest[] {
    return [
      // 图像模型
      {
        model_id: 'doubao-seedream-5-0-260128',
        model_name: 'Doubao Seedream 5.0',
        model_type: 'image',
        base_url: 'https://ark.cn-beijing.volces.com/api/v3',
        api_key: process.env.NEXT_PUBLIC_DOUBAO_API_KEY || '',
        api_url: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
      },
      // 聊天模型
      {
        model_id: 'deepseek-chat',
        model_name: 'DeepSeek Chat',
        model_type: 'chat',
        base_url: 'https://api.deepseek.com/v1',
        api_key: process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || '',
        api_url: 'https://api.deepseek.com/v1/chat/completions',
      },
      {
        model_id: 'doubao-seed-2-0-pro-260215',
        model_name: 'Doubao Seed 2.0 Pro',
        model_type: 'chat',
        base_url: 'https://ark.cn-beijing.volces.com/api/v3',
        api_key: process.env.NEXT_PUBLIC_DOUBAO_API_KEY || '',
        api_url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      },
    ];
  }

  /**
   * 初始化模型配置
   * 将注册表中的模型同步到数据库（如果不存在）
   */
  static async initialize(): Promise<void> {
    try {
      console.log('[ModelConfigInitializer] 开始初始化模型配置...');

      const defaultConfigs = this.getDefaultConfigs();

      // 检查每个模型是否已存在，只初始化不存在的
      const configsToInit: InitConfigRequest[] = [];

      for (const config of defaultConfigs) {
        const existing = await ModelConfigApi.getConfig(config.model_id);
        if (!existing) {
          configsToInit.push(config);
          console.log(`[ModelConfigInitializer] 发现新模型: ${config.model_id}`);
        }
      }

      if (configsToInit.length > 0) {
        await ModelConfigApi.initConfigs(configsToInit);
        console.log(`[ModelConfigInitializer] 成功初始化 ${configsToInit.length} 个模型配置`);
      } else {
        console.log('[ModelConfigInitializer] 所有模型配置已存在，无需初始化');
      }
    } catch (error) {
      console.error('[ModelConfigInitializer] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取图像模型列表
   */
  static async getImageModels() {
    return await ModelConfigApi.getAllConfigs('image');
  }

  /**
   * 获取聊天模型列表
   */
  static async getChatModels() {
    return await ModelConfigApi.getAllConfigs('chat');
  }
}
