/**
 * ============================================================================
 * UpdateStorageConfigCommand
 * ============================================================================
 *
 * 【应用层 - 命令 / Application Layer - Command】
 *
 * 【职责说明】
 * 本文件实现了更新存储配置命令（UpdateStorageConfigCommand）。
 *
 * 【命令的作用】
 * - 更新用户的存储配置（下载目录、缓存目录、自动保存策略）
 * - 支持部分更新（只更新提供的字段）
 * - 执行业务规则验证
 *
 * 【设计意图】
 * - 命令类应该有明确的输入和输出
 * - 命令应该执行业务规则验证
 * - 命令成功后返回更新后的配置，失败时抛出错误
 *
 * 【新手须知】
 * - 命令和查询的区别：命令会修改数据，查询不会
 * - 一个命令类只解决一个具体的业务操作
 * - 命令可以包含多个参数，但应该有明确的目的
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此命令类对应 Rust 后端中的一个命令结构体和方法。
 * Rust 实现时应先验证参数，再调用仓库更新数据库。
 *
 * Rust 结构体示例：
 * ```rust
 * pub struct UpdateStorageConfigCommand {
 *     repository: Arc<dyn StorageConfigRepository>,
 * }
 *
 * impl UpdateStorageConfigCommand {
 *     pub fn new(repository: Arc<dyn StorageConfigRepository>) -> Self {
 *         Self { repository }
 *     }
 *
 *     pub async fn execute(
 *         &self,
 *         download_directory: Option<Option<String>>,
 *         cache_directory: Option<Option<String>>,
 *         auto_save_enabled: Option<bool>,
 *         auto_save_interval_minutes: Option<u32>,
 *     ) -> Result<StorageConfig> {
 *         // 1. 验证参数
 *         // 2. 执行更新
 *         // 3. 返回更新后的配置
 *     }
 * }
 * ```
 */

import { IStorageConfigRepository } from '../../../domain/storage/repositories/IStorageConfigRepository';
import { StorageConfig, isValidAutoSaveInterval } from '../../../domain/storage/entities/StorageConfig';

/**
 * 更新存储配置命令参数
 *
 * 【字段说明】
 * 所有字段都是可选的，支持部分更新。
 * - downloadDirectory: 新的下载目录路径，或 null 清除
 * - cacheDirectory: 新的缓存目录路径，或 null 清除
 * - autoSaveEnabled: 是否启用自动保存
 * - autoSaveIntervalMinutes: 自动保存间隔（分钟）
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此接口定义了命令的参数类型。
 * Rust 实现时可以使用结构体参数或直接使用多个参数。
 */
export interface UpdateStorageConfigParams {
  /** 新的下载目录路径，或 null 清除 */
  downloadDirectory?: string | null;
  /** 新的缓存目录路径，或 null 清除 */
  cacheDirectory?: string | null;
  /** 是否启用自动保存 */
  autoSaveEnabled?: boolean;
  /** 自动保存间隔（分钟） */
  autoSaveIntervalMinutes?: number;
}

/**
 * 更新存储配置命令类
 *
 * 【功能说明】
 * 更新用户的存储配置，支持部分更新。
 * 执行必要的业务规则验证。
 *
 * 【使用方式】
 * ```typescript
 * const repository = /* 仓库实现 *\/;
 * const command = new UpdateStorageConfigCommand(repository);
 * const updatedConfig = await command.execute({
 *   autoSaveEnabled: true,
 *   autoSaveIntervalMinutes: 10,
 * });
 * ```
 *
 * 【业务规则】
 * 1. autoSaveIntervalMinutes 必须在 1-60 之间
 * 2. 目录路径可以是 null 或有效的文件系统路径
 *
 * 【后续对接说明 - 给后端开发同学】
 * 后端实现时应：
 * 1. 验证 autoSaveIntervalMinutes 范围
 * 2. 调用仓库的更新方法
 * 3. 返回更新后的配置
 *
 * 如果更新了自动保存配置，应用层还应该：
 * - 如果启用了自动保存，确保定时器运行
 * - 如果禁用了自动保存，停止定时器
 * （定时器管理可以在更上层的应用服务中处理）
 */
export class UpdateStorageConfigCommand {
  /**
   * 构造函数
   *
   * 【参数说明】
   * - repository: 存储配置仓库的实现实例
   */
  constructor(private repository: IStorageConfigRepository) {}

  /**
   * 执行命令
   *
   * 【功能说明】
   * 根据提供的参数更新存储配置。
   * 只更新提供的字段，其他字段保持不变。
   *
   * 【参数说明】
   * - params: 更新参数，所有字段都是可选的
   *
   * 【返回值】
   * - 返回更新后的完整 StorageConfig 对象
   * - 如果验证失败或更新失败，抛出 Error
   *
   * 【错误处理】
   * - 验证错误：autoSaveIntervalMinutes 超出范围
   * - 仓库错误：数据库连接问题、更新失败等
   *
   * 【后续对接说明 - 给后端开发同学】
   * SQL 更新示例（只更新提供的字段）：
   * ```sql
   * UPDATE storage_configs
   * SET
   *   download_directory = COALESCE(?, download_directory),
   *   cache_directory = COALESCE(?, cache_directory),
   *   auto_save_enabled = COALESCE(?, auto_save_enabled),
   *   auto_save_interval_minutes = COALESCE(?, auto_save_interval_minutes),
   *   updated_at = datetime('now')
   * WHERE id = 1;
   * ```
   */
  async execute(params: UpdateStorageConfigParams): Promise<StorageConfig> {
    // 1. 验证自动保存间隔
    if (
      params.autoSaveIntervalMinutes !== undefined &&
      !isValidAutoSaveInterval(params.autoSaveIntervalMinutes)
    ) {
      throw new Error('Auto-save interval must be between 1 and 60 minutes');
    }

    // 2. 执行更新
    // 注意：我们分别调用专用的更新方法，而不是直接 updateConfig
    // 这样可以让仓库层更好地处理部分更新场景

    if (params.downloadDirectory !== undefined) {
      await this.repository.updateDownloadDirectory(params.downloadDirectory);
    }

    if (params.cacheDirectory !== undefined) {
      await this.repository.updateCacheDirectory(params.cacheDirectory);
    }

    if (params.autoSaveEnabled !== undefined || params.autoSaveIntervalMinutes !== undefined) {
      await this.repository.updateAutoSaveConfig(
        params.autoSaveEnabled,
        params.autoSaveIntervalMinutes
      );
    }

    // 3. 返回更新后的配置
    return await this.repository.getConfig();
  }
}
