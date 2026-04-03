/**
 * ============================================================================
 * StorageConfig Repository Interface
 * ============================================================================
 *
 * 【领域层 - 仓库接口 / Domain Layer - Repository Interface】
 *
 * 【职责说明】
 * 本文件定义了存储配置仓库的接口（IStorageConfigRepository）。
 *
 * 【接口的作用】
 * - 定义存储配置持久化的抽象契约
 * - 规定领域层需要哪些数据操作能力
 * - 不包含任何具体实现细节
 *
 * 【设计意图】
 * - 领域层只关心业务需要的操作，不关心数据如何存储
 * - 具体实现（SQLite、LocalStorage、IndexedDB 等）在基础设施层完成
 * - 这使得领域逻辑可以独立于外部技术进行开发和测试
 *
 * 【新手须知】
 * - 接口就像是"购物清单"，告诉实现者领域层需要什么
 * - 实现者可以用任何技术满足这些需求
 * - 当前项目使用 SQLite，但可以换成其他存储方式
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此接口对应 Rust 后端中的 trait 定义。
 * Rust 端应实现此 trait，使用 rusqlite 操作 SQLite 数据库。
 *
 * Rust trait 示例：
 * ```rust
 * #[async_trait]
 * pub trait StorageConfigRepository: Send + Sync {
 *     async fn get_config(&self) -> Result<StorageConfig>;
 *     async fn update_download_directory(&self, path: &str) -> Result<()>;
 *     async fn update_cache_directory(&self, path: &str) -> Result<()>;
 *     async fn update_auto_save_config(
 *         &self,
 *         enabled: Option<bool>,
 *         interval_minutes: Option<u32>,
 *     ) -> Result<()>;
 * }
 * ```
 */

import { StorageConfig } from '../entities/StorageConfig';

// ============================================================================
// 仓库接口
// ============================================================================

/**
 * 存储配置仓库接口
 *
 * 【接口说明】
 * 此接口定义了存储配置的所有持久化操作。
 * 领域层通过这个接口与基础设施层通信。
 *
 * 【方法说明】
 * - getConfig: 获取当前存储配置
 * - updateDownloadDirectory: 更新下载目录
 * - updateCacheDirectory: 更新缓存目录
 * - updateAutoSaveConfig: 更新自动保存配置
 * - updateConfig: 更新完整配置
 *
 * 【后续对接说明 - 给后端开发同学】
 * 基础设施层（src/infrastructure/persistence/）应实现此接口。
 * 实现类应使用 SQLite 作为持久化存储。
 *
 * TypeScript 实现类示例：
 * ```typescript
 * export class SqliteStorageConfigRepository implements IStorageConfigRepository {
 *   async getConfig(): Promise<StorageConfig> { ... }
 *   async updateDownloadDirectory(path: string): Promise<void> { ... }
 *   // ...
 * }
 * ```
 */
export interface IStorageConfigRepository {
  /**
   * 获取当前存储配置
   *
   * 【功能说明】
   * 从持久化存储中读取当前的存储配置。
   * 如果数据库中不存在配置，应返回默认配置。
   *
   * 【返回值】
   * - 返回当前的存储配置
   * - 如果读取失败，抛出错误
   *
   * 【后续对接说明】
   * SQL 查询示例：
   * ```sql
   * SELECT download_directory, cache_directory, auto_save_enabled, auto_save_interval_minutes
   * FROM storage_configs
   * LIMIT 1;
   * ```
   * 如果无结果，INSERT 默认值后返回。
   */
  getConfig(): Promise<StorageConfig>;

  /**
   * 更新下载目录
   *
   * 【功能说明】
   * 将用户选择的下载目录保存到持久化存储。
   *
   * 【参数说明】
   * - path: 用户选择的下载目录路径
   *
   * 【业务规则】
   * - 路径可以为 null（表示清除下载目录）
   * - 路径应该是有效的文件系统路径
   *
   * 【后续对接说明】
   * SQL 更新示例：
   * ```sql
   * UPDATE storage_configs
   * SET download_directory = ?, updated_at = datetime('now')
   * WHERE id = 1;
   * ```
   * 如果无记录，先 INSERT 默认配置再 UPDATE。
   */
  updateDownloadDirectory(path: string | null): Promise<void>;

  /**
   * 更新缓存目录
   *
   * 【功能说明】
   * 将用户选择的缓存目录保存到持久化存储。
   *
   * 【参数说明】
   * - path: 用户选择的缓存目录路径
   *
   * 【业务规则】
   * - 路径可以为 null（表示清除缓存目录）
   * - 路径应该是有效的文件系统路径
   * - 首次设置时，基础设施层应负责创建子目录结构
   *
   * 【后续对接说明】
   * SQL 更新示例：
   * ```sql
   * UPDATE storage_configs
   * SET cache_directory = ?, updated_at = datetime('now')
   * WHERE id = 1;
   * ```
   */
  updateCacheDirectory(path: string | null): Promise<void>;

  /**
   * 更新自动保存配置
   *
   * 【功能说明】
   * 更新自动保存的启用状态和间隔。
   * 支持部分更新（只更新提供的字段）。
   *
   * 【参数说明】
   * - enabled: 是否启用自动保存（可选）
   * - intervalMinutes: 自动保存间隔（分钟）（可选）
   *
   * 【业务规则】
   * - intervalMinutes 必须在 1-60 之间
   * - 如果提供了无效值，应抛出错误
   *
   * 【后续对接说明】
   * SQL 更新示例（只更新提供的字段）：
   * ```sql
   * UPDATE storage_configs
   * SET auto_save_enabled = COALESCE(?, auto_save_enabled),
   *     auto_save_interval_minutes = COALESCE(?, auto_save_interval_minutes),
   *     updated_at = datetime('now')
   * WHERE id = 1;
   * ```
   */
  updateAutoSaveConfig(enabled?: boolean, intervalMinutes?: number): Promise<void>;

  /**
   * 更新完整存储配置
   *
   * 【功能说明】
   * 将整个存储配置对象保存到持久化存储。
   * 适用于需要一次性更新多个字段的场景。
   *
   * 【参数说明】
   * - config: 完整的存储配置对象
   *
   * 【业务规则】
   * - 配置必须通过 isValidStorageConfig 验证
   * - 如果配置无效，应抛出错误
   *
   * 【后续对接说明】
   * 此方法适用于批量更新场景。
   * 如果只需更新单个字段，建议使用上述的专用方法。
   */
  updateConfig(config: StorageConfig): Promise<void>;
}
