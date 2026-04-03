/**
 * ============================================================================
 * GetStorageConfigQuery
 * ============================================================================
 *
 * 【应用层 - 查询 / Application Layer - Query】
 *
 * 【职责说明】
 * 本文件实现了获取存储配置的查询用例（GetStorageConfigQuery）。
 *
 * 【查询的作用】
 * - 从持久化存储中读取当前的存储配置
 * - 如果数据库中不存在配置，创建并返回默认配置
 * - 返回领域层的 StorageConfig 实体
 *
 * 【设计意图】
 * - 查询类应该是无状态的，每次执行都产生相同的结果
 * - 查询不应该修改任何数据（只读操作）
 * - 查询的结果应该可以直接返回给展示层
 *
 * 【新手须知】
 * - 查询类是 CQRS 模式的一部分（Command Query Responsibility Segregation）
 * - 查询和命令（写操作）应该分开，这样代码更容易理解和维护
 * - 一个查询类只解决一个具体的业务问题
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此查询类对应 Rust 后端中的一个查询结构体和方法。
 * Rust 实现时应使用应用服务调用仓库实现。
 *
 * Rust 结构体示例：
 * ```rust
 * pub struct GetStorageConfigQuery {
 *     repository: Arc<dyn StorageConfigRepository>,
 * }
 *
 * impl GetStorageConfigQuery {
 *     pub fn new(repository: Arc<dyn StorageConfigRepository>) -> Self {
 *         Self { repository }
 *     }
 *
 *     pub async fn execute(&self) -> Result<StorageConfig> {
 *         self.repository.get_config().await
 *     }
 * }
 * ```
 */

import { IStorageConfigRepository } from '../../../domain/storage/repositories/IStorageConfigRepository';
import { StorageConfig, createDefaultStorageConfig } from '../../../domain/storage/entities/StorageConfig';

/**
 * 获取存储配置查询类
 *
 * 【功能说明】
 * 从仓库中获取当前的存储配置。
 * 如果仓库返回空配置，则返回默认配置。
 *
 * 【使用方式】
 * ```typescript
 * const repository = /* 仓库实现 *\/;
 * const query = new GetStorageConfigQuery(repository);
 * const config = await query.execute();
 * ```
 */
export class GetStorageConfigQuery {
  /**
   * 构造函数
   *
   * 【参数说明】
   * - repository: 存储配置仓库的实现实例
   *   - 当前项目：SqliteStorageConfigRepository（基础设施层）
   *   - 测试时：可以使用 Mock 仓库实现
   *
   * 【依赖注入说明】
   * 仓库实例应通过依赖注入提供，而不是在类内部创建。
   * 这使得查询类可以独立于具体持久化技术进行开发和测试。
   */
  constructor(private repository: IStorageConfigRepository) {}

  /**
   * 执行查询
   *
   * 【功能说明】
   * 从仓库中读取存储配置。
   * 如果仓库返回的配置不完整，补充默认值。
   *
   * 【返回值】
   * - 返回完整的 StorageConfig 对象
   * - 如果读取过程中发生错误，抛出 Error
   *
   * 【错误处理】
   * - 仓库错误：数据库连接问题、查询失败等
   * - 应该向上层抛出错误，由展示层决定如何显示
   *
   * 【后续对接说明 - 给后端开发同学】
   * 后端实现时应从 SQLite 读取 storage_configs 表。
   * 如果表中无记录，应先插入默认配置再返回。
   *
   * SQL 查询示例：
   * ```sql
   * -- 读取配置
   * SELECT download_directory, cache_directory, auto_save_enabled, auto_save_interval_minutes
   * FROM storage_configs
   * LIMIT 1;
   *
   * -- 如果无结果，插入默认值
   * INSERT INTO storage_configs (
   *     download_directory,
   *     cache_directory,
   *     auto_save_enabled,
   *     auto_save_interval_minutes,
   *     updated_at
   * ) VALUES (NULL, NULL, 1, 5, datetime('now'));
   * ```
   */
  async execute(): Promise<StorageConfig> {
    const config = await this.repository.getConfig();

    // 如果返回的配置不完整，使用默认值补充
    return {
      downloadDirectory: config.downloadDirectory ?? null,
      cacheDirectory: config.cacheDirectory ?? null,
      autoSaveEnabled: config.autoSaveEnabled ?? true,
      autoSaveIntervalMinutes: config.autoSaveIntervalMinutes ?? 5,
    };
  }
}
