import { IChatModelProvider } from '../services/IChatModelProvider';

/**
 * 聊天模型注册表接口
 * 负责管理所有可用的聊天模型提供者
 *
 * 设计原则：
 * - 依赖倒置：应用层依赖此接口，而非具体实现
 * - 注册表模式：动态管理模型的注册、获取和移除
 */
export interface IChatModelRegistry {
  /**
   * 注册一个聊天模型提供者
   * @param provider 实现了 IChatModelProvider 的模型实例
   */
  register(provider: IChatModelProvider): void;

  /**
   * 根据模型ID获取对应的提供者
   * @param modelId 模型唯一标识
   * @returns 对应的模型提供者实例
   * @throws 如果模型不存在则抛出错误
   */
  getProvider(modelId: string): IChatModelProvider;

  /**
   * 从注册表中移除指定模型
   * @param modelId 要移除的模型ID
   */
  removeProvider(modelId: string): void;

  /**
   * 获取所有已注册的模型ID列表
   * @returns 模型ID数组
   */
  getAllModelIds(): string[];
}
