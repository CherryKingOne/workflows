/**
 * ============================================================================
 * StorageConfig Entity
 * ============================================================================
 *
 * 【领域层 - 实体 / Domain Layer - Entity】
 *
 * 【职责说明】
 * 本文件定义了存储配置领域实体（StorageConfig）。
 *
 * 【实体的作用】
 * - 表示用户的本地存储配置（下载目录、缓存目录、自动保存策略）
 * - 包含业务规则验证和默认值逻辑
 * - 是领域层的核心业务对象，不依赖任何外部技术
 *
 * 【设计意图】
 * - 领域实体应该是纯粹的 TypeScript 类/对象，不包含框架特定代码
 * - 实体的验证逻辑确保业务规则在数据进入系统时就得到执行
 * - 实体的默认值逻辑确保新用户获得合理的初始配置
 *
 * 【新手须知】
 * - 领域实体与数据库表不同，它关注的是业务概念而不是存储结构
 * - 实体的字段应该反映业务需求，而不是数据库设计
 * - 如果业务规则变化，实体也应该随之变化
 *
 * 【业务规则】
 * 1. 自动保存间隔必须在 1-60 分钟之间
 * 2. 目录路径可以是 null（表示用户尚未配置）
 * 3. 自动保存默认启用，间隔默认 5 分钟
 */

// ============================================================================
// 领域实体
// ============================================================================

/**
 * 存储配置实体
 *
 * 【字段说明】
 * - downloadDirectory: 下载目录路径，用户未配置时为 null
 * - cacheDirectory: 资源缓存目录路径，用户未配置时为 null
 * - autoSaveEnabled: 是否启用自动保存
 * - autoSaveIntervalMinutes: 自动保存间隔（分钟）
 *
 * 【业务规则】
 * 1. autoSaveIntervalMinutes 必须在 1-60 之间
 * 2. 目录路径可以为 null，表示用户尚未配置
 * 3. 新用户默认启用自动保存，间隔为 5 分钟
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此实体应对应数据库中的 storage_configs 表。
 * Rust 后端应定义对应的结构体，字段与此处保持一致。
 *
 * Rust 结构体示例：
 * ```rust
 * pub struct StorageConfig {
 *     pub download_directory: Option<String>,
 *     pub cache_directory: Option<String>,
 *     pub auto_save_enabled: bool,
 *     pub auto_save_interval_minutes: u32,
 * }
 * ```
 */
export interface StorageConfig {
  /** 下载目录路径，用户未配置时为 null */
  downloadDirectory: string | null;

  /** 资源缓存目录路径，用户未配置时为 null */
  cacheDirectory: string | null;

  /** 是否启用自动保存 */
  autoSaveEnabled: boolean;

  /** 自动保存间隔（分钟），必须在 1-60 之间 */
  autoSaveIntervalMinutes: number;
}

// ============================================================================
// 领域工厂函数
// ============================================================================

/**
 * 创建默认存储配置
 *
 * 【功能说明】
 * 为新用户创建合理的默认存储配置。
 *
 * 【默认值说明】
 * - 下载目录: null（用户需要自行选择）
 * - 缓存目录: null（用户需要自行选择）
 * - 自动保存: 启用（防止画布内容丢失）
 * - 自动保存间隔: 5 分钟（平衡性能和数据安全）
 *
 * 【后续对接说明 - 给后端开发同学】
 * 后端应在首次初始化时在数据库中插入此默认配置。
 * 如果数据库中不存在配置记录，应返回此默认值。
 *
 * Rust 实现示例：
 * ```rust
 * impl StorageConfig {
 *     pub fn default() -> Self {
 *         Self {
 *             download_directory: None,
 *             cache_directory: None,
 *             auto_save_enabled: true,
 *             auto_save_interval_minutes: 5,
 *         }
 *     }
 * }
 * ```
 */
export function createDefaultStorageConfig(): StorageConfig {
  return {
    downloadDirectory: null,
    cacheDirectory: null,
    autoSaveEnabled: true,
    autoSaveIntervalMinutes: 5,
  };
}

// ============================================================================
// 领域验证函数
// ============================================================================

/**
 * 验证自动保存间隔是否有效
 *
 * 【功能说明】
 * 检查给定的自动保存间隔是否符合业务规则。
 *
 * 【业务规则】
 * - 间隔必须在 1-60 分钟之间
 * - 小于 1 分钟会导致频繁保存，影响性能
 * - 大于 60 分钟会导致数据丢失风险增加
 *
 * 【参数说明】
 * - minutes: 要验证的间隔值
 *
 * 【返回值】
 * - true: 间隔有效
 * - false: 间隔无效
 *
 * 【后续对接说明 - 给后端开发同学】
 * 后端在接收自动保存间隔参数时也应执行同样的验证。
 * 建议在领域层和应用层都执行验证，确保数据安全。
 *
 * Rust 实现示例：
 * ```rust
 * pub fn is_valid_auto_save_interval(minutes: u32) -> bool {
 *     (1..=60).contains(&minutes)
 * }
 * ```
 */
export function isValidAutoSaveInterval(minutes: number): boolean {
  return minutes >= 1 && minutes <= 60;
}

/**
 * 验证存储配置是否完整有效
 *
 * 【功能说明】
 * 检查存储配置对象是否符合所有业务规则。
 *
 * 【验证规则】
 * 1. autoSaveIntervalMinutes 必须在 1-60 之间
 * 2. autoSaveEnabled 必须是布尔值
 * 3. 目录路径可以是 null 或非空字符串
 *
 * 【参数说明】
 * - config: 要验证的存储配置对象
 *
 * 【返回值】
 * - true: 配置有效
 * - false: 配置无效
 *
 * 【后续对接说明 - 给后端开发同学】
 * 后端在保存配置到数据库前应执行此验证。
 * 如果验证失败，应返回错误而不是保存无效数据。
 */
export function isValidStorageConfig(config: StorageConfig): boolean {
  // 验证自动保存间隔
  if (!isValidAutoSaveInterval(config.autoSaveIntervalMinutes)) {
    return false;
  }

  // 验证自动保存启用状态
  if (typeof config.autoSaveEnabled !== 'boolean') {
    return false;
  }

  // 验证目录路径（可以是 null 或非空字符串）
  if (config.downloadDirectory !== null && typeof config.downloadDirectory !== 'string') {
    return false;
  }

  if (config.cacheDirectory !== null && typeof config.cacheDirectory !== 'string') {
    return false;
  }

  return true;
}
