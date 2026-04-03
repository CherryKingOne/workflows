/**
 * ============================================================================
 * API Config Entity
 * ============================================================================
 * 
 * 【领域层 - 实体层 / Domain Layer - Entity】
 * 
 * 【职责说明】
 * 本文件定义了 API 配置实体（ApiConfig），是领域层的核心业务对象。
 * 
 * 【实体与值对象的区别】
 * - 实体有唯一标识（ID），通过 ID 区分不同实例
 * - 值对象通过属性值区分，无唯一标识
 * 
 * 【设计意图】
 * - 封装 API 配置的所有业务规则和行为
 * - 保证实体的完整性和一致性
 * - 提供业务方法（如验证、更新、测试连接状态管理）
 * 
 * 【新手须知】
 * - 实体不应直接暴露 setter，应通过业务方法修改状态
 * - 所有状态变更都应通过实体的方法，保证业务规则不被破坏
 * - 实体是纯业务逻辑层，不涉及任何 UI 或持久化细节
 * 
 * 【后续扩展预留】
 * - 可能需要添加 rateLimit 属性（限流配置）
 * - 可能需要添加 timeout 属性（超时配置）
 * - 可能需要添加 retryPolicy 属性（重试策略）
 * - 可能需要添加 priority 属性（优先级，用于多配置时选择）
 */

import { ApiConfigId, ModelId, ApiKey, BaseUrl, ApiType } from '../valueObjects';

/**
 * API 配置实体
 * 
 * 【业务语义】
 * 代表一条完整的 API 配置记录，包含模型标识、认证密钥、服务端点和类型。
 * 
 * 【不变量（必须始终满足的业务规则）】
 * 1. modelId 不能为空
 * 2. baseUrl 必须是有效的 HTTP/HTTPS URL
 * 3. apiKey 可以为空（某些本地模型不需要）
 * 4. apiType 必须是系统支持的类型
 * 
 * 【生命周期】
 * - 创建：用户提供完整配置 -> 验证 -> 持久化
 * - 更新：用户修改配置 -> 验证 -> 更新持久化
 * - 删除：用户确认 -> 从持久化存储中移除
 * - 测试：临时验证连接，不改变配置状态
 * 
 * 【后续对接说明】
 * 与后端对接时：
 * 1. 实体通过 Tauri invoke 调用后端应用层服务
 * 2. 后端返回 DTO（数据传输对象）
 * 3. 前端将 DTO 映射回实体（通过 fromDto 静态方法）
 * 4. 实体通过 toDto 方法转换为可序列化的格式
 */
export class ApiConfig {
  constructor(
    /**
     * 配置唯一标识
     * 
     * 【说明】
     * - 由后端生成（通常为 UUID）
     * - 前端不应修改此值
     * - 用于区分同一模型的不同配置
     */
    public readonly id: ApiConfigId,

    /**
     * 模型标识
     * 
     * 【说明】
     * - 如 "gpt-5.4"、"gpt-5.4-pro"
     * - 应与 AI 服务提供商的模型名称一致
     * - 用户可在 UI 中修改
     */
    public modelId: ModelId,

    /**
     * API 密钥
     * 
     * 【说明】
     * - 用于身份验证
     * - 可以为空（本地部署模型可能不需要）
     * - 存储时应加密，展示时应掩码
     * - 用户可在 UI 中修改
     * 
     * 【安全注意】
     * 此字段包含敏感信息，处理时应遵循最小暴露原则
     */
    public apiKey: ApiKey,

    /**
     * 基础 URL
     * 
     * 【说明】
     * - API 服务端点，如 "https://api.openai.com"
     * - 必须为有效的 HTTP/HTTPS URL
     * - 用户可在 UI 中修改
     * - 后端将基于此 URL 拼接完整请求路径
     */
    public baseUrl: BaseUrl,

    /**
     * API 类型
     * 
     * 【说明】
     * - 标识此配置用于哪种类型的 API（Chat/Image/Video）
     * - 用于 UI 分组展示
     * - 用于后端路由到不同的处理逻辑
     */
    public apiType: ApiType,

    /**
     * 配置是否启用
     * 
     * 【说明】
     * - 禁用的配置不会在自动选择时使用
     * - 用户可在 UI 中切换启用/禁用状态
     * - 默认值为 true（启用）
     */
    public isEnabled: boolean = true
  ) {}

  /**
   * 更新模型标识
   * 
   * 【业务规则】
   * - 新 modelId 必须有效
   * - 更新后应重新验证整个配置
   * 
   * @param newModelId - 新的模型标识
   */
  updateModelId(newModelId: ModelId): void {
    this.modelId = newModelId;
  }

  /**
   * 更新 API 密钥
   * 
   * 【业务规则】
   * - apiKey 可以为空
   * - 如果提供，必须格式正确
   * 
   * @param newApiKey - 新的 API 密钥（可为空）
   */
  updateApiKey(newApiKey: ApiKey | null): void {
    this.apiKey = newApiKey ?? new ApiKey('');
  }

  /**
   * 更新基础 URL
   * 
   * 【业务规则】
   * - baseUrl 必须为有效的 HTTP/HTTPS URL
   * 
   * @param newBaseUrl - 新的基础 URL
   */
  updateBaseUrl(newBaseUrl: BaseUrl): void {
    this.baseUrl = newBaseUrl;
  }

  /**
   * 更新 API 类型
   * 
   * 【业务规则】
   * - 类型必须是系统支持的类型
   * - 通常用户不应修改类型（应在创建时选择）
   * 
   * @param newType - 新的 API 类型
   */
  updateType(newType: ApiType): void {
    this.apiType = newType;
  }

  /**
   * 切换启用/禁用状态
   * 
   * 【业务规则】
   * - 状态取反
   * - 用于 UI 中的快速切换
   */
  toggleEnabled(): void {
    this.isEnabled = !this.isEnabled;
  }

  /**
   * 验证配置的完整性
   * 
   * 【用途】
   * 在进行测试连接或保存操作前，应调用此方法验证配置。
   * 
   * 【验证规则】
   * 1. modelId 不能为空
   * 2. baseUrl 必须有效
   * 3. 如果 apiKey 不为空，必须格式正确
   * 
   * @returns 验证结果对象
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.modelId.value) {
      errors.push('Model ID is required');
    }

    if (!this.baseUrl.value) {
      errors.push('Base URL is required');
    }

    // 注意：apiKey 可以为空，所以不在此处验证
    // 如果需要验证 apiKey 格式（当提供时），应调用 ApiKey 构造函数

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 从 DTO 创建实体
   * 
   * 【用途】
   * 将从后端接收的 DTO 转换为领域实体。
   * 
   * 【后续对接说明】
   * - 后端返回的 DTO 应为以下格式（具体字段名可能与后端协商）
   * - 此方法应在应用层调用，而非直接在组件中调用
   * - DTO 结构应与后端达成一致（建议通过 Tauri 命令返回）
   * 
   * @param dto - 后端返回的数据传输对象
   * @returns ApiConfig 实体实例
   * 
   * @example
   * // 后端 Tauri 命令可能返回:
   * // { id: "uuid-123", modelId: "gpt-5.4", apiKey: "sk-xxx", baseUrl: "https://...", apiType: "Chat", isEnabled: true }
   * 
   * const config = ApiConfig.fromDto(dto);
   */
  static fromDto(dto: ApiConfigDto): ApiConfig {
    return new ApiConfig(
      new ApiConfigId(dto.id),
      new ModelId(dto.modelId),
      new ApiKey(dto.apiKey),
      new BaseUrl(dto.baseUrl),
      dto.apiType as ApiType, // 注意：实际应用中应验证类型安全性
      dto.isEnabled
    );
  }

  /**
   * 转换为 DTO
   * 
   * 【用途】
   * 将实体转换为可序列化的 DTO，用于向后端发送数据。
   * 
   * 【后续对接说明】
   * - 发送到后端的 DTO 格式
   * - 应仅发送必要字段，避免暴露内部实现细节
   * 
   * @returns 数据传输对象
   */
  toDto(): ApiConfigDto {
    return {
      id: this.id.value,
      modelId: this.modelId.value,
      apiKey: this.apiKey.value,
      baseUrl: this.baseUrl.value,
      apiType: this.apiType,
      isEnabled: this.isEnabled,
    };
  }
}

/**
 * API 配置 DTO 接口
 * 
 * 【用途】
 * 定义与后端交互的数据传输对象格式。
 * 
 * 【后续对接说明】
 * 后端 Tauri 命令应返回与此接口一致的结构。
 * 如果后端返回不同格式，应在此处定义适配器（Adapter）进行转换。
 * 
 * 【字段说明】
 * - id: 配置唯一标识（后端生成）
 * - modelId: 模型标识字符串
 * - apiKey: API 密钥（传输时应加密）
 * - baseUrl: API 基础 URL
 * - apiType: API 类型字符串（"Chat" | "Image" | "Video"）
 * - isEnabled: 是否启用
 */
export interface ApiConfigDto {
  id: string;
  modelId: string;
  apiKey: string;
  baseUrl: string;
  apiType: string;
  isEnabled: boolean;
}
