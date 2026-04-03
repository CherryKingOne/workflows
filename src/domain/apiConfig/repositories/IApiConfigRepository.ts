/**
 * ============================================================================
 * API Config Repository Interface
 * ============================================================================
 * 
 * 【领域层 - 仓库接口层 / Domain Layer - Repository Interface】
 * 
 * 【职责说明】
 * 本文件定义了 API 配置仓库的接口（IApiConfigRepository）。
 * 
 * 【仓库的作用】
 * - 定义领域层对持久化操作的抽象需求
 * - 使领域层不依赖于具体的持久化技术
 * - 为应用层提供统一的存取接口
 * 
 * 【设计意图】
 * - 接口在领域层定义，实现在基础设施层
 * - 遵循依赖倒置原则（DIP）：高层模块不应依赖低层模块，二者都应依赖抽象
 * - 应用层通过此接口操作，不关心底层是 SQLite、LocalStorage 还是其他
 * 
 * 【新手须知】
 * - 本文件仅有接口定义，无实现代码
 * - 实现类应在 src/infrastructure/persistence/repositories/ 中创建
 * - 实现类应实现此接口的所有方法
 * - Tauri 命令通过调用应用层服务间接使用此接口
 * 
 * 【后续扩展预留】
 * - 可能需要添加批量导入/导出方法
 * - 可能需要添加按类型查询方法
 * - 可能需要添加配置排序方法
 */

import { ApiConfig } from '../entities/ApiConfig';
import { ApiType } from '../valueObjects';

/**
 * API 配置仓库接口
 * 
 * 【业务语义】
 * 定义 API 配置的持久化操作契约。
 * 
 * 【实现位置】
 * 应在基础设施层实现此接口，例如：
 * - src/infrastructure/persistence/repositories/SqliteApiConfigRepo.ts
 * - src/infrastructure/persistence/repositories/TauriApiConfigRepo.ts
 * 
 * 【后续对接说明】
 * 与后端 Tauri 对接时：
 * 1. 基础设施层实现此接口
 * 2. 实现类内部调用 Tauri invoke 命令
 * 3. 应用层通过依赖注入使用此接口
 * 4. 领域层不关心实现细节
 */
export interface IApiConfigRepository {
  /**
   * 获取所有 API 配置
   * 
   * 【业务语义】
   * 返回系统中所有 API 配置，通常用于列表展示。
   * 
   * 【后续对接说明】
   * - 对应 Tauri 命令：get_api_configs
   * - 返回结果应按创建时间倒序（最新在前）
   * - 空列表表示无配置，非错误
   * 
   * @returns Promise<ApiConfig[]> - 所有配置的数组
   * @throws 如果数据库连接失败应抛出具体错误
   */
  findAll(): Promise<ApiConfig[]>;

  /**
   * 按类型获取 API 配置
   * 
   * 【业务语义】
   * 返回指定类型（Chat/Image/Video）的所有配置。
   * 用于 UI 中的 Tab 切换展示。
   * 
   * 【后续对接说明】
   * - 对应 Tauri 命令：get_api_configs_by_type
   * - 参数 apiType 应与 ApiType 枚举值一致
   * 
   * @param apiType - API 类型
   * @returns Promise<ApiConfig[]> - 指定类型的配置数组
   */
  findByType(apiType: ApiType): Promise<ApiConfig[]>;

  /**
   * 根据 ID 获取单个配置
   * 
   * 【业务语义】
   * 返回指定 ID 的配置详情。
   * 
   * 【后续对接说明】
   * - 对应 Tauri 命令：get_api_config
   * - 如果配置不存在，应返回 null（不抛异常）
   * 
   * @param id - 配置 ID
   * @returns Promise<ApiConfig | null> - 配置实体或 null
   */
  findById(id: string): Promise<ApiConfig | null>;

  /**
   * 创建新配置
   * 
   * 【业务语义】
   * 将新的 API 配置持久化。
   * 
   * 【业务规则】
   * - 创建前应验证配置完整性（调用 config.validate()）
   * - ID 由后端生成
   * - 创建后返回完整实体（含生成的 ID）
   * 
   * 【后续对接说明】
   * - 对应 Tauri 命令：create_api_config
   * - 参数为配置的 DTO 格式
   * - 返回创建后的实体（含生成的 ID）
   * 
   * @param config - 待创建的配置实体
   * @returns Promise<ApiConfig> - 创建后的配置（含 ID）
   * @throws 如果验证失败或重复创建应抛出错误
   */
  create(config: ApiConfig): Promise<ApiConfig>;

  /**
   * 更新配置
   * 
   * 【业务语义】
   * 更新已存在的 API 配置。
   * 
   * 【业务规则】
   * - 更新前应验证配置完整性
   * - 如果配置不存在，应返回 null 或抛出错误
   * 
   * 【后续对接说明】
   * - 对应 Tauri 命令：update_api_config
   * - 参数应包含配置 ID 和更新的字段
   * - 返回更新后的完整实体
   * 
   * @param config - 待更新的配置实体
   * @returns Promise<ApiConfig> - 更新后的配置
   * @throws 如果配置不存在或验证失败应抛出错误
   */
  update(config: ApiConfig): Promise<ApiConfig>;

  /**
   * 删除配置
   * 
   * 【业务语义】
   * 从系统中移除指定的 API 配置。
   * 
   * 【业务规则】
   * - 删除操作应不可逆
   * - 如果配置不存在，应返回 false（不抛异常）
   * 
   * 【后续对接说明】
   * - 对应 Tauri 命令：delete_api_config
   * - 参数为配置 ID
   * - 返回布尔值表示是否成功删除
   * 
   * @param id - 待删除的配置 ID
   * @returns Promise<boolean> - 是否成功删除
   */
  delete(id: string): Promise<boolean>;

  /**
   * 测试 API 连接
   * 
   * 【业务语义】
   * 使用给定配置发起测试请求，验证连接是否有效。
   * 
   * 【注意】
   * - 此方法不持久化配置，仅做临时验证
   * - 应设置合理的超时时间（如 10 秒）
   * - 应返回详细的测试结果（成功/失败/错误信息）
   * 
   * 【后续对接说明】
   * - 对应 Tauri 命令：test_api_connection
   * - 参数为配置的 DTO 格式
   * - 返回测试结果对象
   * - 此操作不应修改数据库
   * 
   * @param config - 待测试的配置
   * @returns Promise<TestConnectionResult> - 测试结果
   */
  testConnection(config: ApiConfig): Promise<TestConnectionResult>;
}

/**
 * 测试结果接口
 * 
 * 【用途】
 * 定义测试连接操作的返回格式。
 * 
 * 【后续对接说明】
 * 后端应返回与此接口一致的结构。
 * 
 * 【字段说明】
 * - success: 是否连接成功
 * - message: 结果消息（成功时显示成功信息，失败时显示错误原因）
 * - latency: 响应延迟（毫秒），仅在成功时有值
 */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  latency?: number; // 响应时间（毫秒）
}
