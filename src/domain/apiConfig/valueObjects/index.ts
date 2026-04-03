/**
 * ============================================================================
 * API Config Value Objects
 * ============================================================================
 * 
 * 【领域层 - 值对象层 / Domain Layer - Value Objects】
 * 
 * 【职责说明】
 * 本文件定义了 API 配置相关的所有值对象（Value Objects）。
 * 值对象是不可变的、通过其属性值而非身份标识来区分的领域概念。
 * 
 * 【设计意图】
 * - 使用值对象封装业务规则，确保无效状态无法表示
 * - 提供验证逻辑，在创建时即保证数据合法性
 * - 使实体类保持简洁，将验证逻辑内聚在值对象中
 * 
 * 【新手须知】
 * - 值对象应该是不可变的（readonly）
 * - 如果业务规则变更，只需修改对应值对象的验证逻辑
 * - 新增字段时应同步更新验证规则
 * 
 * 【后续扩展预留】
 * - 可能需要添加 RateLimitConfig 值对象（限流配置）
 * - 可能需要添加 TimeoutConfig 值对象（超时配置）
 * - 可能需要添加 RetryPolicy 值对象（重试策略）
 */

/**
 * API 类型枚举
 * 
 * 【业务语义】
 * 定义系统支持的 API 接口类型，不同类别的 API 可能对应不同的模型提供商或用途。
 * 
 * 【边界说明】
 * - 当前仅支持 Chat、Image、Video 三种类型
 * - 新增类型时应在此枚举中添加，并同步更新 UI 展示逻辑
 * - 类型值应与后端保持一致（通过 Tauri IPC 调用时作为字符串传递）
 */
export enum ApiType {
  CHAT = 'Chat',
  IMAGE = 'Image',
  VIDEO = 'Video',
}

/**
 * 模型标识值对象
 * 
 * 【业务语义】
 * 唯一标识一个 AI 模型实例，如 "gpt-5.4"、"gpt-5.4-pro"
 * 
 * 【验证规则】
 * - 不能为空字符串
 * - 长度限制 1-100 字符
 * - 仅允许字母、数字、点号、连字符、下划线
 * 
 * 【后续对接说明】
 * 后端对接时，此字段将作为模型标识符传递给 AI 服务提供商
 */
export class ModelId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Model ID cannot be empty');
    }
    if (value.length > 100) {
      throw new Error('Model ID must be less than 100 characters');
    }
    // 验证格式：仅允许字母、数字、点号、连字符、下划线
    const validPattern = /^[a-zA-Z0-9.\-_]+$/;
    if (!validPattern.test(value)) {
      throw new Error('Model ID can only contain letters, numbers, dots, hyphens, and underscores');
    }
  }
}

/**
 * API 密钥值对象
 * 
 * 【业务语义】
 * 封装用于身份验证的 API Key，通常由服务提供商生成。
 * 
 * 【安全注意事项】
 * - 此值在传输和存储时应加密处理
 * - 前端展示时应部分掩码（如显示前 7 个字符，其余用 * 代替）
 * - 不应在日志或错误信息中完整输出
 * 
 * 【验证规则】
 * - 可以为空（某些本地模型可能不需要 key）
 * - 如果提供，长度必须在 10-500 字符之间
 * 
 * 【后续对接说明】
 * 后端对接时：
 * 1. 存储前应使用加密算法（如 AES-256）加密
 * 2. 返回前端时应部分掩码
 * 3. 测试连接时需解密后使用
 */
export class ApiKey {
  constructor(public readonly value: string) {
    // API Key 可以为空（某些本地部署模型不需要认证）
    if (value && value.length > 0) {
      if (value.length < 10 || value.length > 500) {
        throw new Error('API Key must be between 10 and 500 characters if provided');
      }
      // 基本格式验证：应以字母或数字开头
      const validPattern = /^[a-zA-Z0-9]/;
      if (!validPattern.test(value)) {
        throw new Error('API Key should start with a letter or number');
      }
    }
  }

  /**
   * 获取掩码版本的 API Key
   * 
   * 【用途】
   * 用于前端展示，避免完整暴露敏感信息
   * 
   * 【返回值示例】
   * - "sk-abc****xyz" (显示前7位和后3位)
   * - "****" (如果 key 为空或太短)
   */
  getMaskedValue(): string {
    if (!this.value || this.value.length < 10) {
      return '****';
    }
    const prefix = this.value.substring(0, 7);
    const suffix = this.value.substring(this.value.length - 3);
    return `${prefix}****${suffix}`;
  }
}

/**
 * 基础 URL 值对象
 * 
 * 【业务语义】
 * 封装 API 服务端点地址，应为有效的 URL 格式。
 * 
 * 【验证规则】
 * - 不能为空
 * - 必须是有效的 HTTP/HTTPS URL
 * - 不应包含路径参数或查询字符串（由后端拼接）
 * 
 * 【后续对接说明】
 * 后端对接时：
 * 1. 将作为请求的基础 URL
 * 2. 实际请求 URL = baseUrl + '/v1/chat/completions' (或其他路径)
 * 3. 应验证 URL 可达性（通过测试连接功能）
 */
export class BaseUrl {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Base URL cannot be empty');
    }
    // URL 格式验证
    try {
      new URL(value);
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        throw new Error('Base URL must start with http:// or https://');
      }
    } catch {
      throw new Error('Invalid URL format');
    }
  }
}

/**
 * API 配置标识值对象
 * 
 * 【业务语义】
 * 唯一标识一条 API 配置记录，通常由系统自动生成（UUID）。
 * 
 * 【后续对接说明】
 * - 新增配置时由后端生成
 * - 用于区分同一模型的不同配置（如不同 key 对应不同账号）
 */
export class ApiConfigId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('ApiConfig ID cannot be empty');
    }
  }
}
