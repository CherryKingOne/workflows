/**
 * 模型配置实体
 * 存储模型的基本配置信息
 */
export class ModelConfig {
  /** 模型唯一标识 */
  modelId: string;

  /** 模型显示名称 */
  modelName: string;

  /** 模型类型：image | chat */
  modelType: 'image' | 'chat';

  /** API 基础 URL */
  baseUrl: string;

  /** API Key */
  apiKey: string;

  /** 完整的 API URL（可选） */
  apiUrl?: string;

  /** 是否启用 */
  enabled: boolean;

  /** 创建时间 */
  createdAt: Date;

  /** 更新时间 */
  updatedAt: Date;

  constructor(data: {
    modelId: string;
    modelName: string;
    modelType: 'image' | 'chat';
    baseUrl: string;
    apiKey: string;
    apiUrl?: string;
    enabled?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.modelId = data.modelId;
    this.modelName = data.modelName;
    this.modelType = data.modelType;
    this.baseUrl = data.baseUrl;
    this.apiKey = data.apiKey;
    this.apiUrl = data.apiUrl;
    this.enabled = data.enabled ?? true;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * 更新配置
   */
  update(data: Partial<{
    modelName: string;
    baseUrl: string;
    apiKey: string;
    apiUrl: string;
    enabled: boolean;
  }>): void {
    if (data.modelName !== undefined) this.modelName = data.modelName;
    if (data.baseUrl !== undefined) this.baseUrl = data.baseUrl;
    if (data.apiKey !== undefined) this.apiKey = data.apiKey;
    if (data.apiUrl !== undefined) this.apiUrl = data.apiUrl;
    if (data.enabled !== undefined) this.enabled = data.enabled;
    this.updatedAt = new Date();
  }
}
