/**
 * ============================================================================
 * useStorage Hook
 * ============================================================================
 *
 * 【展示层 - Hook / Presentation Layer - Hook】
 *
 * 【职责说明】
 * 本文件实现了存储管理相关的展示层 Hook（useStorage）。
 *
 * 【Hook 的作用】
 * - 管理存储配置数据的加载和更新
 * - 提供目录选择、配置更新、立即保存、导入等操作的入口
 * - 作为组件与应用层之间的桥梁
 *
 * 【设计意图】
 * - 此 Hook 是展示层的一部分，不直接包含业务规则
 * - 业务逻辑应封装在应用层服务中
 * - 当前使用 Mock 数据模式，便于前端独立开发和测试
 * - 后端对接时，将 useMockData 改为 false 即可切换为真实模式
 *
 * 【新手须知】
 * - Hook 返回的数据和函数可直接传给 StorageModal 组件
 * - 当前版本使用假数据，不需要后端即可运行
 * - 后端对接时，Hook 内部会改为调用应用层服务
 * - 注释中带有"后续对接说明"的部分是未来后端开发时需要关注的
 *
 * 【当前工作模式】
 * - useMockData: true（默认）- 使用假数据，适合前端独立开发
 * - useMockData: false（待后端对接后启用）- 调用应用层服务
 *
 * 【后续对接说明 - 给后端开发同学】
 * 后端对接时需要实现以下 Tauri 命令（Rust 函数）：
 *
 * 1. get_storage_config() -> StorageConfigDto
 *    - 返回当前存储配置
 *    - 从 SQLite 读取 storage_configs 表
 *
 * 2. select_download_directory() -> { success: bool, path: String }
 *    - 弹出系统目录选择器
 *    - 用户选择后保存到配置
 *    - 使用 Tauri dialog plugin
 *
 * 3. select_cache_directory() -> { success: bool, path: String }
 *    - 弹出系统目录选择器
 *    - 用户选择后保存到配置
 *    - 首次设置时自动创建子目录结构
 *
 * 4. update_storage_config(updates) -> StorageConfigDto
 *    - 更新存储配置（部分更新）
 *    - 如果启用了自动保存，启动定时器
 *    - 如果禁用了自动保存，停止定时器
 *
 * 5. save_workflow_now(project_id) -> { success: bool, file_path: String }
 *    - 立即保存当前工作流
 *    - 序列化画布内容到 JSON
 *    - 保存到 缓存目录/autosave/项目名_时间.json
 *
 * 6. import_auto_save(project_id) -> { success: bool, workflow_data: Json }
 *    - 从缓存目录读取最新的自动保存文件
 *    - 解析并返回工作流数据
 *
 * 【数据库表结构建议】
 * ```sql
 * CREATE TABLE storage_configs (
 *   id INTEGER PRIMARY KEY AUTOINCREMENT,
 *   download_directory TEXT,
 *   cache_directory TEXT,
 *   auto_save_enabled INTEGER NOT NULL DEFAULT 1,
 *   auto_save_interval_minutes INTEGER NOT NULL DEFAULT 5,
 *   updated_at TEXT NOT NULL
 * );
 * ```
 *
 * 【返回数据结构说明】
 * - config: 当前存储配置对象
 * - loading: 是否正在加载
 * - error: 错误信息（如有）
 * - onSelectDownloadDirectory: 选择下载目录的函数
 * - onSelectCacheDirectory: 选择缓存目录的函数
 * - onUpdateAutoSave: 更新自动保存配置的函数
 * - onSaveWorkflowNow: 立即保存工作流的函数
 * - onImportAutoSave: 导入自动保存文件的函数
 * - qiniuConfig: 七牛云配置草稿
 * - onUpdateQiniuConfigDraft: 更新七牛云配置草稿
 * - onTestQiniuConnection: 测试七牛云连接
 * - onSaveQiniuConfig: 保存七牛云配置
 */

import { useState, useCallback } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 存储配置数据类型
 *
 * 【后续对接说明】
 * 此接口应与后端返回的 DTO 格式一致。
 * 后续应从 domain 层导入此类型。
 *
 * 导入路径示例：
 *   import { StorageConfigDto } from '@/domain/storage/entities/StorageConfig';
 */
interface StorageConfigDto {
  /** 下载目录路径，未设置时为 null */
  downloadDirectory: string | null;
  /** 资源缓存目录路径，未设置时为 null */
  cacheDirectory: string | null;
  /** 是否启用自动保存 */
  autoSaveEnabled: boolean;
  /** 自动保存间隔（分钟） */
  autoSaveIntervalMinutes: number;
}

/**
 * 七牛云对象存储配置 DTO（前端展示层）
 *
 * 【职责说明】
 * 该类型用于前端页面的“配置草稿 + 展示状态”。
 * 目前只用于前端交互，不涉及后端真实持久化。
 *
 * 【字段设计意图】
 * - accessKey / secretKey / bucket：对应用户输入的核心配置
 * - isConfigured：用于驱动 UI 右上角状态（已配置/未配置）
 * - lastTestSucceededAt：记录最近一次测试成功时间（前端占位）
 *
 * 【后续扩展建议】
 * 后续若新增“Region、Domain、上传策略”等字段，应在此类型扩展，
 * 并同步更新 domain 层实体（如果确定属于领域概念）。
 */
interface QiniuObjectStorageConfigDto {
  /** 七牛 Access Key */
  accessKey: string;
  /** 七牛 Secret Key */
  secretKey: string;
  /** 七牛 Bucket 名称 */
  bucket: string;
  /** 当前配置是否已保存 */
  isConfigured: boolean;
  /** 最近一次测试成功时间（ISO 字符串），未测试成功时为 null */
  lastTestSucceededAt: string | null;
}

/**
 * 七牛操作结果（测试连接 / 保存配置）
 *
 * 【用途说明】
 * - 给展示层一个统一的返回结构，避免组件层做异常字符串解析
 * - success 决定提示颜色和后续 UI 状态
 * - message 提供可直接展示给用户的反馈文案
 */
interface QiniuOperationResult {
  /** 操作是否成功 */
  success: boolean;
  /** 可展示给用户的结果消息 */
  message: string;
}

/**
 * Hook 返回类型
 *
 * 【字段说明】
 * - config: 当前存储配置
 * - loading: 是否正在加载
 * - error: 错误信息
 * - onSelectDownloadDirectory: 选择下载目录
 * - onSelectCacheDirectory: 选择缓存目录
 * - onUpdateAutoSave: 更新自动保存配置
 * - onSaveWorkflowNow: 立即保存工作流
 * - onImportAutoSave: 导入自动保存文件
 */
interface UseStorageReturn {
  /** 当前存储配置 */
  config: StorageConfigDto | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息（如有） */
  error: Error | null;
  /** 选择下载目录的函数 */
  onSelectDownloadDirectory: () => Promise<void>;
  /** 选择缓存目录的函数 */
  onSelectCacheDirectory: () => Promise<void>;
  /** 更新自动保存配置的函数 */
  onUpdateAutoSave: (updates: { enabled?: boolean; intervalMinutes?: number }) => Promise<void>;
  /** 立即保存工作流的函数 */
  onSaveWorkflowNow: () => Promise<void>;
  /** 导入自动保存文件的函数 */
  onImportAutoSave: () => Promise<void>;
  /** 七牛云配置草稿 */
  qiniuConfig: QiniuObjectStorageConfigDto;
  /** 更新七牛云配置草稿 */
  onUpdateQiniuConfigDraft: (updates: {
    accessKey?: string;
    secretKey?: string;
    bucket?: string;
  }) => void;
  /** 测试七牛云连接 */
  onTestQiniuConnection: () => Promise<QiniuOperationResult>;
  /** 保存七牛云配置 */
  onSaveQiniuConfig: () => Promise<QiniuOperationResult>;
}

// ============================================================================
// Mock 数据（前端独立开发时使用）
// ============================================================================

/**
 * 模拟存储配置数据
 *
 * 【功能说明】
 * 这是在前端独立开发阶段使用的假数据。
 * 不需要任何后端支持即可测试存储管理弹窗的 UI 和交互。
 *
 * 【后续对接说明】
 * 后端对接后，此假数据将被真实的数据替换。
 * 可将此数据保留为"默认值"，在后端未返回配置时使用。
 */
const MOCK_STORAGE_CONFIG: StorageConfigDto = {
  downloadDirectory: null,
  cacheDirectory: null,
  autoSaveEnabled: true,
  autoSaveIntervalMinutes: 5,
};

/**
 * 模拟七牛云配置数据
 *
 * 【功能说明】
 * 用于前端无后端时联调和交互演示。
 *
 * 【安全提示】
 * 这里是本地开发态假数据，不应写入任何真实密钥。
 */
const MOCK_QINIU_STORAGE_CONFIG: QiniuObjectStorageConfigDto = {
  accessKey: '',
  secretKey: '',
  bucket: '',
  isConfigured: false,
  lastTestSucceededAt: null,
};

// ============================================================================
// 主 Hook
// ============================================================================

/**
 * 存储管理 Hook
 *
 * 【页面职责】
 * 1. 管理存储配置数据的加载和更新
 * 2. 提供目录选择、配置更新、立即保存、导入等操作的入口
 * 3. 作为组件与应用层之间的桥梁
 *
 * 【使用方式】
 * ```tsx
 * const {
 *   config,
 *   loading,
 *   onSelectDownloadDirectory,
 *   onSelectCacheDirectory,
 *   onUpdateAutoSave,
 *   onSaveWorkflowNow,
 *   onImportAutoSave,
 *   qiniuConfig,
 *   onUpdateQiniuConfigDraft,
 *   onTestQiniuConnection,
 *   onSaveQiniuConfig,
 * } = useStorage(true); // true = 使用 Mock 数据
 * ```
 *
 * 【后续对接说明】
 * 后端对接时，将 useMockData 参数改为 false。
 * Hook 内部会改为调用应用层服务而不是返回假数据。
 *
 * 【参数说明】
 * - useMockData: 是否使用 Mock 数据
 *   - true: 使用假数据（前端独立开发阶段）
 *   - false: 调用应用层服务（后端对接后）
 */
export function useStorage(useMockData: boolean = true): UseStorageReturn {
  // ============================================================================
  // 状态管理
  // ============================================================================

  /**
   * 存储配置数据
   *
   * 【状态说明】
   * - 初始为 null，加载后填充真实数据
   * - Mock 模式下初始为 MOCK_STORAGE_CONFIG
   */
  const [config, setConfig] = useState<StorageConfigDto | null>(
    useMockData ? MOCK_STORAGE_CONFIG : null
  );

  /**
   * 加载状态
   *
   * 【状态说明】
   * - 用于在数据请求期间显示加载反馈
   * - Mock 模式下通常为 false（立即返回）
   */
  const [loading, setLoading] = useState(false);

  /**
   * 错误状态
   *
   * 【状态说明】
   * - 用于在请求失败时显示错误信息
   * - 成功时重置为 null
   */
  const [error, setError] = useState<Error | null>(null);

  /**
   * 七牛云配置草稿状态
   *
   * 【状态说明】
   * - 此状态是“前端草稿态”，用于输入框双向绑定
   * - 与本地存储配置分开管理，避免互相影响
   * - 后端接入后，该状态仍可保留，作为“编辑态”容器
   */
  const [qiniuConfig, setQiniuConfig] = useState<QiniuObjectStorageConfigDto>(
    MOCK_QINIU_STORAGE_CONFIG
  );

  /**
   * 判断七牛配置是否完整
   *
   * 【规则说明】
   * 目前仅做最小完整性校验：
   * 1. Access Key 非空
   * 2. Secret Key 非空
   * 3. Bucket 非空
   *
   * 后续如果要接入更严格规则（如字符集、长度、前缀），
   * 建议迁移到 domain 层的 value object 中统一校验。
   */
  const isQiniuConfigComplete = useCallback((target: QiniuObjectStorageConfigDto): boolean => {
    return Boolean(
      target.accessKey.trim() &&
      target.secretKey.trim() &&
      target.bucket.trim()
    );
  }, []);

  // ============================================================================
  // Mock 模式操作函数
  // ============================================================================

  /**
   * 选择下载目录（Mock 版本）
   *
   * 【功能说明】
   * 模拟用户选择下载目录的操作。
   * 实际应弹出系统目录选择器。
   *
   * 【后续对接说明】
   * 后端对接时需要：
   * 1. 调用 Tauri dialog plugin 的 `open` 方法
   *    ```rust
   *    let path = dialog::FileDialogBuilder::new()
   *        .pick_folder()
   *        .await?;
   *    ```
   * 2. 将选择的路径保存到 storage_configs 表
   * 3. 返回选择结果
   *
   * 【Tauri 实现示例（Rust）】
   * ```rust
   * #[tauri::command]
   * async fn select_download_directory(
   *     app: AppHandle,
   *     state: State<'_, StorageRepository>,
   * ) -> Result<SelectDirectoryResult, String> {
   *     // 1. 弹出目录选择器
   *     let folder = dialog::FileDialogBuilder::new()
   *         .set_title("选择下载目录")
   *         .pick_folder()
   *         .await
   *         .map_err(|e| e.to_string())?;
   *
   *     if let Some(path) = folder {
   *         let path_str = path.to_string_lossy().to_string();
   *
   *         // 2. 保存到数据库
   *         state.update_download_directory(&path_str).await
   *             .map_err(|e| e.to_string())?;
   *
   *         Ok(SelectDirectoryResult { success: true, path: path_str })
   *     } else {
   *         Ok(SelectDirectoryResult { success: false, path: String::new() })
   *     }
   * }
   * ```
   */
  const onSelectDownloadDirectory = useCallback(async () => {
    if (useMockData) {
      // Mock 模式：模拟选择目录
      setLoading(true);
      // 模拟网络延迟
      await new Promise((resolve) => setTimeout(resolve, 500));
      setConfig((prev) => ({
        ...prev!,
        downloadDirectory: '/Users/example/Downloads',
      }));
      setLoading(false);
      return;
    }

    // 【后续对接说明 - 真实实现】
    // 此处应调用应用层的 SelectDownloadDirectoryCommand
    //
    // 示例（后续实现）：
    //   const command = new SelectDownloadDirectoryCommand();
    //   const result = await applicationService.execute(command);
    //   if (result.success) {
    //     await loadConfig(); // 重新加载配置
    //   }
    //
    // 应用层会调用：
    //   1. Tauri dialog plugin 弹出目录选择器
    //   2. 仓库实现保存路径到数据库
    throw new Error('Not implemented yet - awaiting backend integration');
  }, [useMockData]);

  /**
   * 选择缓存目录（Mock 版本）
   *
   * 【功能说明】
   * 模拟用户选择缓存目录的操作。
   *
   * 【后续对接说明】
   * 与 onSelectDownloadDirectory 类似，但额外需要：
   * - 首次设置时自动创建子目录结构（/images/、/videos/、/audios/、/local/）
   *
   * 【Tauri 实现示例（Rust）】
   * ```rust
   * #[tauri::command]
   * async fn select_cache_directory(
   *     app: AppHandle,
   *     state: State<'_, StorageRepository>,
   * ) -> Result<SelectDirectoryResult, String> {
   *     let folder = dialog::FileDialogBuilder::new()
   *         .set_title("选择缓存目录")
   *         .pick_folder()
   *         .await
   *         .map_err(|e| e.to_string())?;
   *
   *     if let Some(path) = folder {
   *         let path_str = path.to_string_lossy().to_string();
   *
   *         // 保存路径
   *         state.update_cache_directory(&path_str).await
   *             .map_err(|e| e.to_string())?;
   *
   *         // 首次设置时创建子目录结构
   *         ensure_cache_subdirectories(&path_str).await
   *             .map_err(|e| e.to_string())?;
   *
   *         Ok(SelectDirectoryResult { success: true, path: path_str })
   *     } else {
   *         Ok(SelectDirectoryResult { success: false, path: String::new() })
   *     }
   * }
   *
   * // 辅助函数：确保缓存子目录存在
   * async fn ensure_cache_subdirectories(base_path: &str) -> std::io::Result<()> {
   *     let subdirs = ["images", "videos", "audios", "local"];
   *     for subdir in subdirs {
   *         let dir_path = format!("{}/{}", base_path, subdir);
   *         tokio::fs::create_dir_all(&dir_path).await?;
   *     }
   *     Ok(())
   * }
   * ```
   */
  const onSelectCacheDirectory = useCallback(async () => {
    if (useMockData) {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setConfig((prev) => ({
        ...prev!,
        cacheDirectory: '/Users/example/Cache',
      }));
      setLoading(false);
      return;
    }

    // 【后续对接说明 - 真实实现】
    // 此处应调用应用层的 SelectCacheDirectoryCommand
    throw new Error('Not implemented yet - awaiting backend integration');
  }, [useMockData]);

  /**
   * 更新自动保存配置（Mock 版本）
   *
   * 【功能说明】
   * 模拟更新自动保存配置（启用状态和间隔）。
   *
   * 【参数说明】
   * - updates.enabled: 是否启用自动保存
   * - updates.intervalMinutes: 自动保存间隔（分钟）
   *
   * 【后续对接说明】
   * 后端对接时需要：
   * 1. 更新数据库中的配置
   * 2. 如果启用了自动保存，启动或更新定时器
   * 3. 如果禁用了自动保存，停止定时器
   *
   * 【Tauri 实现示例（Rust）】
   * ```rust
   * #[tauri::command]
   * async fn update_storage_config(
   *     state: State<'_, StorageRepository>,
   *     auto_save_enabled: Option<bool>,
   *     auto_save_interval_minutes: Option<u32>,
   * ) -> Result<StorageConfigDto, String> {
   *     // 1. 更新数据库
   *     state.update_auto_save_config(auto_save_enabled, auto_save_interval_minutes)
   *         .await
   *         .map_err(|e| e.to_string())?;
   *
   *     // 2. 获取更新后的配置
   *     let config = state.get_config().await
   *         .map_err(|e| e.to_string())?;
   *
   *     // 3. 管理自动保存定时器（在应用层处理）
   *     // ...
   *
   *     Ok(config)
   * }
   * ```
   */
  const onUpdateAutoSave = useCallback(async (updates: {
    enabled?: boolean;
    intervalMinutes?: number;
  }) => {
    if (useMockData) {
      setConfig((prev) => ({
        ...prev!,
        autoSaveEnabled: updates.enabled ?? prev!.autoSaveEnabled,
        autoSaveIntervalMinutes: updates.intervalMinutes ?? prev!.autoSaveIntervalMinutes,
      }));
      return;
    }

    // 【后续对接说明 - 真实实现】
    // 此处应调用应用层的 UpdateStorageConfigCommand
    throw new Error('Not implemented yet - awaiting backend integration');
  }, [useMockData]);

  /**
   * 立即保存工作流（Mock 版本）
   *
   * 【功能说明】
   * 模拟立即保存当前工作流的操作。
   *
   * 【后续对接说明】
   * 后端对接时需要：
   * 1. 获取当前画布内容
   * 2. 序列化为 JSON
   * 3. 保存到 缓存目录/autosave/项目名_时间.json
   * 4. 返回保存结果和文件路径
   *
   * 【Tauri 实现示例（Rust）】
   * ```rust
   * #[tauri::command]
   * async fn save_workflow_now(
   *     project_id: String,
   *     canvas_data: CanvasDataDto,
   *     state: State<'_, StorageRepository>,
   * ) -> Result<SaveWorkflowResult, String> {
   *     // 1. 获取缓存目录
   *     let config = state.get_config().await
   *         .map_err(|e| e.to_string())?;
   *
   *     let cache_dir = config.cache_directory
   *         .ok_or("Cache directory not set")?;
   *
   *     // 2. 构建文件路径
   *     let autosave_dir = format!("{}/autosave", cache_dir);
   *     tokio::fs::create_dir_all(&autosave_dir).await
   *         .map_err(|e| e.to_string())?;
   *
   *     let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
   *     let file_name = format!("{}_{}.json", project_id, timestamp);
   *     let file_path = format!("{}/{}", autosave_dir, file_name);
   *
   *     // 3. 序列化并保存
   *     let json = serde_json::to_string_pretty(&canvas_data)
   *         .map_err(|e| e.to_string())?;
   *
   *     tokio::fs::write(&file_path, json).await
   *         .map_err(|e| e.to_string())?;
   *
   *     Ok(SaveWorkflowResult {
   *         success: true,
   *         file_path,
   *     })
   * }
   * ```
   */
  const onSaveWorkflowNow = useCallback(async () => {
    if (useMockData) {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      console.log('[Mock] Workflow saved successfully');
      setLoading(false);
      return;
    }

    // 【后续对接说明 - 真实实现】
    // 此处应调用应用层的 SaveWorkflowNowCommand
    throw new Error('Not implemented yet - awaiting backend integration');
  }, [useMockData]);

  /**
   * 导入自动保存文件（Mock 版本）
   *
   * 【功能说明】
   * 模拟导入自动保存文件的操作。
   *
   * 【后续对接说明】
   * 后端对接时需要：
   * 1. 从缓存目录读取最新的自动保存 JSON 文件
   * 2. 解析文件内容
   * 3. 返回工作流数据
   * 4. 前端接收后应恢复画布状态
   *
   * 【Tauri 实现示例（Rust）】
   * ```rust
   * #[tauri::command]
   * async fn import_auto_save(
   *     project_id: String,
   *     state: State<'_, StorageRepository>,
   * ) -> Result<ImportAutoSaveResult, String> {
   *     // 1. 获取缓存目录
   *     let config = state.get_config().await
   *         .map_err(|e| e.to_string())?;
   *
   *     let cache_dir = config.cache_directory
   *         .ok_or("Cache directory not set")?;
   *
   *     let autosave_dir = format!("{}/autosave", cache_dir);
   *
   *     // 2. 查找最新的自动保存文件
   *     let latest_file = find_latest_autosave_file(&autosave_dir, &project_id)
   *         .await
   *         .map_err(|e| e.to_string())?
   *         .ok_or("No auto-save files found")?;
   *
   *     // 3. 读取并解析 JSON
   *     let json = tokio::fs::read_to_string(&latest_file).await
   *         .map_err(|e| e.to_string())?;
   *
   *     let workflow_data: serde_json::Value = serde_json::from_str(&json)
   *         .map_err(|e| e.to_string())?;
   *
   *     Ok(ImportAutoSaveResult {
   *         success: true,
   *         workflow_data,
   *         file_path: latest_file,
   *     })
   * }
   * ```
   */
  const onImportAutoSave = useCallback(async () => {
    if (useMockData) {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 600));
      console.log('[Mock] Auto-save imported successfully');
      setLoading(false);
      return;
    }

    // 【后续对接说明 - 真实实现】
    // 此处应调用应用层的 ImportAutoSaveCommand
    throw new Error('Not implemented yet - awaiting backend integration');
  }, [useMockData]);

  /**
   * 更新七牛云配置草稿（展示层）
   *
   * 【设计意图】
   * - 输入框改动只更新草稿，不自动保存
   * - 一旦字段变化，默认标记为“未配置”，引导用户显式保存
   *
   * 【后续扩展建议】
   * 如果后续要做“脏数据检测”，可新增 `lastSavedSnapshot` 做对比，
   * 避免“值没变也被标记未配置”的误判。
   */
  const onUpdateQiniuConfigDraft = useCallback((updates: {
    accessKey?: string;
    secretKey?: string;
    bucket?: string;
  }) => {
    setQiniuConfig((previous) => ({
      ...previous,
      ...updates,
      isConfigured: false,
    }));
  }, []);

  /**
   * 测试七牛云连接（Mock 版本）
   *
   * 【功能说明】
   * - 前端阶段仅做字段完整性校验 + 异步反馈模拟
   * - 返回统一结果给组件层展示
   *
   * 【后续对接说明】
   * 后端对接后应调用应用层命令（例如 TestQiniuConnectionCommand）：
   * 1. 使用 Access Key / Secret Key 构建鉴权
   * 2. 对 Bucket 执行最小权限探测（如列举/上传 token 验证）
   * 3. 返回标准化结果（success/message）
   */
  const onTestQiniuConnection = useCallback(async (): Promise<QiniuOperationResult> => {
    if (useMockData) {
      setLoading(true);
      setError(null);
      await new Promise((resolve) => setTimeout(resolve, 600));

      const complete = isQiniuConfigComplete(qiniuConfig);
      if (!complete) {
        setLoading(false);
        return {
          success: false,
          message: '请先填写 Access Key、Secret Key 和 Bucket。',
        };
      }

      setQiniuConfig((previous) => ({
        ...previous,
        lastTestSucceededAt: new Date().toISOString(),
      }));
      setLoading(false);
      return {
        success: true,
        message: '连接测试通过（Mock）。',
      };
    }

    // 【后续对接说明 - 真实实现】
    // 此处应调用应用层的 TestQiniuConnectionCommand。
    throw new Error('Not implemented yet - awaiting backend integration');
  }, [isQiniuConfigComplete, qiniuConfig, useMockData]);

  /**
   * 保存七牛云配置（Mock 版本）
   *
   * 【功能说明】
   * - 校验配置完整性
   * - 模拟保存成功后，将 isConfigured 标记为 true
   * - 返回统一结果给组件层用于提示
   *
   * 【后续对接说明】
   * 后端对接后应调用应用层命令（例如 SaveQiniuConfigCommand）：
   * 1. 对敏感字段做安全处理（加密或系统凭据存储）
   * 2. 落库并记录更新时间
   * 3. 返回保存后的配置摘要（不要回传明文 Secret Key）
   */
  const onSaveQiniuConfig = useCallback(async (): Promise<QiniuOperationResult> => {
    if (useMockData) {
      setLoading(true);
      setError(null);
      await new Promise((resolve) => setTimeout(resolve, 700));

      const complete = isQiniuConfigComplete(qiniuConfig);
      if (!complete) {
        setLoading(false);
        return {
          success: false,
          message: '配置不完整，无法保存。',
        };
      }

      setQiniuConfig((previous) => ({
        ...previous,
        isConfigured: true,
      }));
      setLoading(false);
      return {
        success: true,
        message: '七牛云配置已保存（Mock）。',
      };
    }

    // 【后续对接说明 - 真实实现】
    // 此处应调用应用层的 SaveQiniuConfigCommand。
    throw new Error('Not implemented yet - awaiting backend integration');
  }, [isQiniuConfigComplete, qiniuConfig, useMockData]);

  // ============================================================================
  // 返回值
  // ============================================================================

  return {
    config,
    loading,
    error,
    onSelectDownloadDirectory,
    onSelectCacheDirectory,
    onUpdateAutoSave,
    onSaveWorkflowNow,
    onImportAutoSave,
    qiniuConfig,
    onUpdateQiniuConfigDraft,
    onTestQiniuConnection,
    onSaveQiniuConfig,
  };
}
