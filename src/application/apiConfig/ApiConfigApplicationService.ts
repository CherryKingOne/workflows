/**
 * ============================================================================
 * API Config Application Service
 * ============================================================================
 * 
 * 【应用层 - 应用服务 / Application Layer - Application Service】
 * 
 * 【职责说明】
 * 本文件实现了 API 配置的应用服务（ApiConfigApplicationService）。
 * 
 * 【应用服务的作用】
 * - 作为展示层与领域层的桥梁
 * - 编排和协调多个用例（Queries 和 Commands）
 * - 对外提供统一的操作接口
 * - 隐藏用例的具体实现细节
 * 
 * 【设计意图】
 * - 应用服务是唯一的入口点，展示层不应直接调用用例类
 * - 应用服务内部负责实例化和调用具体的用例
 * - 应用服务可以组合多个用例完成复杂业务流程
 * 
 * 【新手须知】
 * - 展示层（组件/Hook）应通过此服务操作数据
 * - 不应直接调用 GetApiConfigsQuery 等用例类
 * - 所有依赖通过构造函数注入（仓库实现）
 * 
 * 【后续对接说明】
 * 与后端 Tauri 对接时，有两种方式：
 * 
 * 方式一：前端 Hook 直接调用 Tauri invoke
 *   - 绕过此应用服务
 *   - 适用于快速原型
 *   - 缺点：组件与 Tauri 命令紧耦合
 * 
 * 方式二（推荐）：前端 Hook 调用此应用服务
 *   - 此应用服务内部调用 Tauri invoke
 *   - 优点：组件与 Tauri 解耦，易于测试和维护
 *   - 仓库实现（基础设施层）负责调用 Tauri 命令
 * 
 * 【后续扩展预留】
 * - 可能需要添加批量导入方法
 * - 可能需要添加配置校验方法
 * - 可能需要添加设置默认配置方法
 */

import { IApiConfigRepository, TestConnectionResult } from '../../domain/apiConfig/repositories/IApiConfigRepository';
import { ApiConfig } from '../../domain/apiConfig/entities/ApiConfig';
import { ApiType } from '../../domain/apiConfig/valueObjects';
import { GetApiConfigsQuery, GetApiConfigsQueryInput, GetApiConfigsQueryOutput } from './queries/GetApiConfigsQuery';
import {
  CreateApiConfigCommand,
  UpdateApiConfigCommand,
  DeleteApiConfigCommand,
  TestConnectionCommand,
  CreateApiConfigCommandInput,
  UpdateApiConfigCommandInput,
  DeleteApiConfigCommandInput,
  TestConnectionCommandInput,
} from './commands/CreateUpdateDeleteApiConfigCommands';

/**
 * API 配置应用服务
 * 
 * 【业务语义】
 * 提供 API 配置相关的所有业务操作入口。
 * 
 * 【使用方式】
 * ```typescript
 * const service = new ApiConfigApplicationService(repository);
 * 
 * // 获取所有配置
 * const result = await service.getAllConfigs();
 * 
 * // 创建配置
 * const newConfig = await service.createConfig({ ... });
 * 
 * // 更新配置
 * const updatedConfig = await service.updateConfig({ ... });
 * 
 * // 删除配置
 * const deleted = await service.deleteConfig('config-id');
 * 
 * // 测试连接
 * const testResult = await service.testConnection({ ... });
 * ```
 * 
 * 【后续对接说明】
 * 此服务应由前端 Hook 调用，而非直接在组件中调用。
 * 推荐的数据流：
 * 
 * 组件 -> Hook -> Application Service -> Repository -> Tauri Command
 * 
 * 示例 Hook 用法（见 useApiConfigs.ts）：
 *   const { configs, loading, error } = useApiConfigs();
 *   await configs.create({ modelId: "gpt-5.4", ... });
 */
export class ApiConfigApplicationService {
  /**
   * 构造函数
   * 
   * @param apiConfigRepo - API 配置仓库实现（依赖注入）
   */
  constructor(private apiConfigRepo: IApiConfigRepository) {}

  /**
   * 获取所有 API 配置
   * 
   * 【业务流程】
   * 1. 实例化查询用例
   * 2. 执行查询
   * 3. 返回结果
   * 
   * 【后续对接说明】
   * - 此方法内部调用 GetApiConfigsQuery
   * - 查询通过仓库的 findAll 或 findByType 方法获取数据
   * - 仓库实现负责调用 Tauri invoke 命令
   * 
   * @param input - 查询参数（可选，支持按类型过滤）
   * @returns Promise<GetApiConfigsQueryOutput> - 配置列表和分组信息
   * @throws 如果查询失败，抛出错误
   */
  async getAllConfigs(input?: GetApiConfigsQueryInput): Promise<GetApiConfigsQueryOutput> {
    const query = new GetApiConfigsQuery(this.apiConfigRepo);
    return await query.execute(input);
  }

  /**
   * 按类型获取 API 配置
   * 
   * 【便捷方法】
   * 这是 getAllConfigs 的特化版本，仅返回指定类型的配置。
   * 
   * 【后续对接说明】
   * - 此方法内部调用 getAllConfigs 并传入 filterType
   * - 用于 UI Tab 切换时获取数据
   * 
   * @param apiType - API 类型
   * @returns Promise<ApiConfig[]> - 指定类型的配置数组
   */
  async getConfigsByType(apiType: ApiType): Promise<ApiConfig[]> {
    const result = await this.getAllConfigs({ filterType: apiType });
    return result.configs;
  }

  /**
   * 创建 API 配置
   * 
   * 【业务流程】
   * 1. 实例化命令用例
   * 2. 执行创建
   * 3. 返回创建后的配置（含生成的 ID）
   * 
   * 【后续对接说明】
   * - 此方法内部调用 CreateApiConfigCommand
   * - 命令会验证输入参数
   * - 仓库实现负责调用 Tauri invoke 命令
   * 
   * @param input - 创建参数（modelId, apiKey, baseUrl, apiType）
   * @returns Promise<ApiConfig> - 创建后的配置实体
   * @throws 如果验证失败或创建失败，抛出错误
   */
  async createConfig(input: CreateApiConfigCommandInput): Promise<ApiConfig> {
    const command = new CreateApiConfigCommand(this.apiConfigRepo);
    return await command.execute(input);
  }

  /**
   * 更新 API 配置
   * 
   * 【业务流程】
   * 1. 实例化命令用例
   * 2. 执行更新
   * 3. 返回更新后的配置
   * 
   * 【后续对接说明】
   * - 此方法内部调用 UpdateApiConfigCommand
   * - 命令会查找现有配置并更新
   * - 如果配置不存在，抛出错误
   * 
   * @param input - 更新参数（id, modelId, apiKey, baseUrl, apiType, isEnabled）
   * @returns Promise<ApiConfig> - 更新后的配置实体
   * @throws 如果配置不存在或验证失败，抛出错误
   */
  async updateConfig(input: UpdateApiConfigCommandInput): Promise<ApiConfig> {
    const command = new UpdateApiConfigCommand(this.apiConfigRepo);
    return await command.execute(input);
  }

  /**
   * 删除 API 配置
   * 
   * 【业务流程】
   * 1. 实例化命令用例
   * 2. 执行删除
   * 3. 返回删除结果
   * 
   * 【后续对接说明】
   * - 此方法内部调用 DeleteApiConfigCommand
   * - 删除成功后返回 true
   * - 如果配置不存在，返回 false
   * 
   * @param id - 待删除的配置 ID
   * @returns Promise<boolean> - 是否成功删除
   * @throws 如果删除操作失败（如数据库错误），抛出错误
   */
  async deleteConfig(id: string): Promise<boolean> {
    const command = new DeleteApiConfigCommand(this.apiConfigRepo);
    return await command.execute({ id });
  }

  /**
   * 测试 API 连接
   * 
   * 【业务流程】
   * 1. 实例化命令用例
   * 2. 执行测试
   * 3. 返回测试结果
   * 
   * 【后续对接说明】
   * - 此方法内部调用 TestConnectionCommand
   * - 测试不会持久化配置
   * - 结果包含 success、message 和可选的 latency
   * 
   * @param input - 测试参数（modelId, apiKey, baseUrl, apiType）
   * @returns Promise<TestConnectionResult> - 测试结果
   */
  async testConnection(input: TestConnectionCommandInput): Promise<TestConnectionResult> {
    const command = new TestConnectionCommand(this.apiConfigRepo);
    return await command.execute(input);
  }
}
