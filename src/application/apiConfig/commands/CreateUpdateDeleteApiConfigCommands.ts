/**
 * ============================================================================
 * Create/Update/Delete API Config Commands
 * ============================================================================
 * 
 * 【应用层 - 命令用例 / Application Layer - Commands】
 * 
 * 【职责说明】
 * 本文件实现了 API 配置的创建、更新、删除和测试连接的命令用例。
 * 
 * 【命令用例的作用】
 * - 封装一个完整的业务操作流程
 * - 协调领域层和基础设施层完成状态变更
 * - 对展示层隐藏复杂的业务规则和持久化逻辑
 * 
 * 【设计意图】
 * - 一个命令类对应一个明确的业务操作
 * - 命令类会修改领域对象状态（与查询不同）
 * - 命令类应执行业务规则验证
 * 
 * 【新手须知】
 * - 命令类通过构造函数接收依赖（依赖注入）
 * - 命令类的 execute 方法是唯一入口
 * - 命令执行成功后应返回操作结果或更新后的实体
 * 
 * 【后续扩展预留】
 * - 可能需要添加批量导入命令
 * - 可能需要添加批量删除命令
 * - 可能需要添加配置排序命令
 */

import { IApiConfigRepository, TestConnectionResult } from '../../../domain/apiConfig/repositories/IApiConfigRepository';
import { ApiConfig, ApiConfigDto } from '../../../domain/apiConfig/entities/ApiConfig';
import { ApiConfigId, ModelId, ApiKey, BaseUrl, ApiType } from '../../../domain/apiConfig/valueObjects';

/**
 * 创建 API 配置命令的输入参数
 * 
 * 【字段说明】
 * - modelId: 模型标识字符串（如 "gpt-5.4"）
 * - apiKey: API 密钥（可为空字符串）
 * - baseUrl: API 基础 URL（如 "https://api.openai.com"）
 * - apiType: API 类型（"Chat" | "Image" | "Video"）
 * 
 * 【注意】
 * - id 由后端生成，前端无需传递
 * - isEnabled 默认为 true，无需传递
 */
export interface CreateApiConfigCommandInput {
  modelId: string;
  apiKey: string;
  baseUrl: string;
  apiType: string;
}

/**
 * 更新 API 配置命令的输入参数
 * 
 * 【字段说明】
 * - id: 配置 ID（必须，用于定位待更新的配置）
 * - modelId: 模型标识字符串
 * - apiKey: API 密钥
 * - baseUrl: API 基础 URL
 * - apiType: API 类型
 * - isEnabled: 是否启用
 * 
 * 【注意】
 * - 所有字段都是必需的（全量更新）
 * - 如果需要部分更新，应创建单独的 PartialUpdate 命令
 */
export interface UpdateApiConfigCommandInput {
  id: string;
  modelId: string;
  apiKey: string;
  baseUrl: string;
  apiType: string;
  isEnabled: boolean;
}

/**
 * 删除 API 配置命令的输入参数
 * 
 * 【字段说明】
 * - id: 待删除的配置 ID
 */
export interface DeleteApiConfigCommandInput {
  id: string;
}

/**
 * 测试 API 连接命令的输入参数
 * 
 * 【字段说明】
 * - modelId: 模型标识
 * - apiKey: API 密钥
 * - baseUrl: API 基础 URL
 * - apiType: API 类型
 * 
 * 【注意】
 * - 此命令不会持久化配置，仅做临时验证
 * - 可以用于测试新配置或现有配置
 */
export interface TestConnectionCommandInput {
  modelId: string;
  apiKey: string;
  baseUrl: string;
  apiType: string;
}

/**
 * 创建 API 配置命令
 * 
 * 【业务语义】
 * 创建一条新的 API 配置并持久化。
 * 
 * 【业务流程】
 * 1. 验证输入参数（通过值对象构造函数）
 * 2. 创建 ApiConfig 实体（ID 由仓库生成）
 * 3. 调用仓库的 create 方法持久化
 * 4. 返回创建后的配置实体
 * 
 * 【业务规则】
 * - modelId 不能为空
 * - baseUrl 必须为有效 URL
 * - apiKey 可以为空
 * 
 * 【后续对接说明】
 * 此类将由 Tauri 命令调用：
 *   const command = new CreateApiConfigCommand(repository);
 *   const result = await command.execute({ modelId: "gpt-5.4", apiKey: "sk-xxx", baseUrl: "...", apiType: "Chat" });
 * 
 * 对应的 Tauri 命令可能为：
 *   #[tauri::command]
 *   async fn create_api_config(params: CreateApiConfigParams) -> Result<ApiConfigDto, String>
 */
export class CreateApiConfigCommand {
  constructor(private apiConfigRepo: IApiConfigRepository) {}

  /**
   * 执行创建命令
   * 
   * 【后续对接说明】
   * - 如果创建失败（如重复、验证失败），应抛出具体错误
   * - 错误消息应适合直接展示给用户
   * 
   * @param input - 创建输入参数
   * @returns Promise<ApiConfig> - 创建后的配置（含生成的 ID）
   * @throws 如果验证失败或创建失败，抛出错误
   */
  async execute(input: CreateApiConfigCommandInput): Promise<ApiConfig> {
    // 1. 验证输入并创建值对象
    const modelId = new ModelId(input.modelId);
    const apiKey = new ApiKey(input.apiKey);
    const baseUrl = new BaseUrl(input.baseUrl);
    const apiType = input.apiType as ApiType;

    // 2. 创建实体（临时 ID，实际 ID 由仓库生成）
    const tempId = new ApiConfigId('temp'); // 临时值，仓库会覆盖
    const config = new ApiConfig(tempId, modelId, apiKey, baseUrl, apiType);

    // 3. 验证配置完整性
    const validation = config.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // 4. 持久化
    return await this.apiConfigRepo.create(config);
  }
}

/**
 * 更新 API 配置命令
 * 
 * 【业务语义】
 * 更新已存在的 API 配置。
 * 
 * 【业务流程】
 * 1. 根据 ID 查找现有配置
   * 2. 验证输入参数
 * 3. 更新配置属性
 * 4. 调用仓库的 update 方法持久化
 * 5. 返回更新后的配置实体
 * 
 * 【业务规则】
 * - 配置必须存在
 * - 更新后的配置必须通过验证
 * 
 * 【后续对接说明】
 * 对应的 Tauri 命令可能为：
 *   #[tauri::command]
 *   async fn update_api_config(params: UpdateApiConfigParams) -> Result<ApiConfigDto, String>
 */
export class UpdateApiConfigCommand {
  constructor(private apiConfigRepo: IApiConfigRepository) {}

  /**
   * 执行更新命令
   * 
   * 【后续对接说明】
   * - 如果配置不存在，应抛出具体错误
   * - 如果更新失败，应抛出具体错误
   * 
   * @param input - 更新输入参数
   * @returns Promise<ApiConfig> - 更新后的配置
   * @throws 如果配置不存在或验证失败，抛出错误
   */
  async execute(input: UpdateApiConfigCommandInput): Promise<ApiConfig> {
    // 1. 查找现有配置
    const existingConfig = await this.apiConfigRepo.findById(input.id);
    if (!existingConfig) {
      throw new Error(`API config with ID "${input.id}" not found`);
    }

    // 2. 验证输入并更新值对象
    const modelId = new ModelId(input.modelId);
    const apiKey = new ApiKey(input.apiKey);
    const baseUrl = new BaseUrl(input.baseUrl);
    const apiType = input.apiType as ApiType;

    existingConfig.updateModelId(modelId);
    existingConfig.updateApiKey(apiKey);
    existingConfig.updateBaseUrl(baseUrl);
    existingConfig.updateType(apiType);
    if (existingConfig.isEnabled !== input.isEnabled) {
      existingConfig.toggleEnabled();
    }

    // 3. 验证配置完整性
    const validation = existingConfig.validate();
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // 4. 持久化
    return await this.apiConfigRepo.update(existingConfig);
  }
}

/**
 * 删除 API 配置命令
 * 
 * 【业务语义】
 * 从系统中移除指定的 API 配置。
 * 
 * 【业务流程】
 * 1. 调用仓库的 delete 方法
 * 2. 返回删除结果
 * 
 * 【业务规则】
 * - 删除操作不可逆
 * - 如果配置不存在，返回 false（不抛异常）
 * 
 * 【后续对接说明】
 * 对应的 Tauri 命令可能为：
 *   #[tauri::command]
 *   async fn delete_api_config(id: String) -> Result<bool, String>
 */
export class DeleteApiConfigCommand {
  constructor(private apiConfigRepo: IApiConfigRepository) {}

  /**
   * 执行删除命令
   * 
   * 【后续对接说明】
   * - 删除成功后返回 true
   * - 如果配置不存在，返回 false
   * - 如果删除操作本身失败（如数据库错误），抛出错误
   * 
   * @param input - 删除输入参数
   * @returns Promise<boolean> - 是否成功删除
   */
  async execute(input: DeleteApiConfigCommandInput): Promise<boolean> {
    return await this.apiConfigRepo.delete(input.id);
  }
}

/**
 * 测试 API 连接命令
 * 
 * 【业务语义】
 * 使用给定配置发起测试请求，验证连接是否有效。
 * 
 * 【业务流程】
 * 1. 验证输入参数
 * 2. 创建临时配置实体
 * 3. 调用仓库的 testConnection 方法
 * 4. 返回测试结果
 * 
 * 【注意】
 * - 此命令不会持久化配置
 * - 应设置合理的超时时间（如 10 秒）
 * 
 * 【后续对接说明】
 * 对应的 Tauri 命令可能为：
 *   #[tauri::command]
 *   async fn test_api_connection(params: TestConnectionParams) -> Result<TestConnectionResult, String>
 */
export class TestConnectionCommand {
  constructor(private apiConfigRepo: IApiConfigRepository) {}

  /**
   * 执行测试命令
   * 
   * 【后续对接说明】
   * - 测试结果包含 success、message 和可选的 latency
   * - 应展示 message 给用户（成功或失败原因）
   * - 如果测试过程抛异常，应捕获并转换为失败结果
   * 
   * @param input - 测试输入参数
   * @returns Promise<TestConnectionResult> - 测试结果
   */
  async execute(input: TestConnectionCommandInput): Promise<TestConnectionResult> {
    try {
      // 1. 验证输入并创建值对象
      const modelId = new ModelId(input.modelId);
      const apiKey = new ApiKey(input.apiKey);
      const baseUrl = new BaseUrl(input.baseUrl);
      const apiType = input.apiType as ApiType;

      // 2. 创建临时配置实体（ID 无关紧要，仅用于测试）
      const tempId = new ApiConfigId('temp-test');
      const config = new ApiConfig(tempId, modelId, apiKey, baseUrl, apiType);

      // 3. 执行测试连接
      return await this.apiConfigRepo.testConnection(config);
    } catch (error) {
      // 4. 捕获异常并转换为失败结果
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
