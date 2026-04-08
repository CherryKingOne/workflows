import { ModelConfig } from '../entities/ModelConfig';

/**
 * 模型配置仓储接口
 * 负责模型配置的持久化操作
 *
 * 设计原则：
 * - 依赖倒置：应用层依赖此接口，而非具体实现
 * - 只支持查询和更新，不支持创建和删除（通过代码注册表管理）
 */
export interface IModelConfigRepository {
  /**
   * 根据模型ID获取配置
   * @param modelId 模型ID
   * @returns 模型配置，如果不存在返回 null
   */
  findById(modelId: string): Promise<ModelConfig | null>;

  /**
   * 获取所有模型配置列表
   * @param modelType 可选的模型类型过滤
   * @returns 模型配置数组
   */
  findAll(modelType?: 'image' | 'chat'): Promise<ModelConfig[]>;

  /**
   * 保存或更新模型配置
   * @param config 模型配置实体
   */
  save(config: ModelConfig): Promise<void>;

  /**
   * 更新模型配置
   * @param modelId 模型ID
   * @param data 要更新的字段
   */
  update(modelId: string, data: Partial<{
    modelName: string;
    baseUrl: string;
    apiKey: string;
    apiUrl: string;
    enabled: boolean;
  }>): Promise<void>;

  /**
   * 删除模型配置（仅供内部清理使用）
   * @param modelId 模型ID
   */
  delete(modelId: string): Promise<void>;

  /**
   * 批量初始化模型配置（用于注册表同步）
   * @param configs 模型配置数组
   */
  batchUpsert(configs: ModelConfig[]): Promise<void>;
}
