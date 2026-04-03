/**
 * ============================================================================
 * Storage Application Service
 * ============================================================================
 *
 * 【应用层 - 服务 / Application Layer - Service】
 *
 * 【职责说明】
 * 本文件实现了存储应用服务（StorageApplicationService）。
 *
 * 【服务的作用】
 * - 作为应用层的统一入口，编排各个用例（Commands & Queries）
 * - 提供高层业务操作接口，供展示层（Hook / 组件）调用
 * - 管理自动保存定时器的生命周期
 *
 * 【设计意图】
 * - 应用服务不直接包含业务规则，而是协调领域对象和用例
 * - 一个服务对应一个业务上下文（Storage 上下文）
 * - 服务应该是无状态的，状态应保存在领域实体或外部系统中
 *
 * 【新手须知】
 * - 应用服务就像是"交通指挥员"，它知道该调用哪个用例
 * - 它不决定业务规则（那是领域层的事）
 * - 它不直接与用户交互（那是展示层的事）
 * - 它只负责编排和协调
 *
 * 【服务包含的操作】
 * 1. getStorageConfig: 获取存储配置（查询）
 * 2. updateStorageConfig: 更新存储配置（命令）
 * 3. selectDownloadDirectory: 选择下载目录（命令）
 * 4. selectCacheDirectory: 选择缓存目录（命令）
 * 5. saveWorkflowNow: 立即保存工作流（命令）
 * 6. importAutoSave: 导入自动保存文件（命令）
 * 7. startAutoSave: 启动自动保存定时器
 * 8. stopAutoSave: 停止自动保存定时器
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此服务对应 Rust 后端中的一个应用服务结构体。
 * 在 Tauri 中，应用服务由 lib.rs 中的依赖注入提供。
 *
 * Rust 结构体示例：
 * ```rust
 * pub struct StorageApplicationService {
 *     repository: Arc<dyn StorageConfigRepository>,
 *     directory_picker: Arc<dyn DirectoryPickerAdapter>,
 *     directory_creator: Arc<dyn DirectoryCreator>,
 *     file_ops: Arc<dyn FileOperationsAdapter>,
 *     file_read: Arc<dyn FileReadAdapter>,
 *     auto_save_manager: Arc<Mutex<AutoSaveManager>>,
 * }
 * ```
 */

import { IStorageConfigRepository } from '../../domain/storage/repositories/IStorageConfigRepository';
import { StorageConfig } from '../../domain/storage/entities/StorageConfig';
import { GetStorageConfigQuery } from './queries/GetStorageConfigQuery';
import {
  UpdateStorageConfigCommand,
  UpdateStorageConfigParams,
} from './commands/UpdateStorageConfigCommand';
import {
  SelectDownloadDirectoryCommand,
  IDirectoryPickerAdapter,
  DirectorySelectionResult,
} from './commands/SelectDownloadDirectoryCommand';
import {
  SelectCacheDirectoryCommand,
  IDirectoryCreator,
  CACHE_SUBDIRECTORIES,
} from './commands/SelectCacheDirectoryCommand';
import {
  SaveWorkflowNowCommand,
  IFileOperationsAdapter,
  CanvasData,
  SaveWorkflowResult,
} from './commands/SaveWorkflowNowCommand';
import {
  ImportAutoSaveCommand,
  IFileReadAdapter,
  ImportAutoSaveResult,
} from './commands/ImportAutoSaveCommand';

/**
 * 自动保存回调接口
 *
 * 【接口说明】
 * 此接口定义了自动保存触发时的回调函数。
 * 展示层通过此回调获取需要保存的画布数据。
 *
 * 【后续对接说明 - 给后端开发同学】
 * 在 Rust 后端中，这可以通过通道（channel）或闭包实现。
 * 自动保存定时器到期时，调用此回调获取画布数据并保存。
 */
export interface IAutoSaveCallback {
  /**
   * 获取当前画布数据
   *
   * 【返回值】
   * - 返回当前画布的项目 ID、项目名称和画布数据
   */
  getCanvasData(): {
    projectId: string;
    projectName: string;
    canvasData: CanvasData;
  };
}

/**
 * 存储应用服务类
 *
 * 【功能说明】
 * 协调存储相关的所有用例操作。
 * 提供统一的接口供展示层调用。
 *
 * 【使用方式】
 * ```typescript
 * // 1. 创建服务实例（通常在依赖注入容器中）
 * const service = new StorageApplicationService(
 *   repository,
 *   directoryPicker,
 *   directoryCreator,
 *   fileOps,
 *   fileRead
 * );
 *
 * // 2. 获取存储配置
 * const config = await service.getStorageConfig();
 *
 * // 3. 更新配置
 * await service.updateStorageConfig({ autoSaveEnabled: true });
 *
 * // 4. 选择目录
 * const result = await service.selectDownloadDirectory();
 *
 * // 5. 保存工作流
 * const result = await service.saveWorkflowNow(projectId, projectName, canvasData);
 *
 * // 6. 导入自动保存
 * const result = await service.importAutoSave(projectId);
 * ```
 *
 * 【后续对接说明 - 给后端开发同学】
 * 在 Tauri 中，此服务应通过依赖注入提供给命令处理器。
 * 展示层通过 Tauri invoke 调用命令，命令再调用应用服务。
 *
 * Tauri 命令处理器示例（Rust）：
 * ```rust
 * #[tauri::command]
 * async fn get_storage_config(
 *     service: State<'_, StorageApplicationService>,
 * ) -> Result<StorageConfig, String> {
 *     service.get_storage_config().await.map_err(|e| e.to_string())
 * }
 *
 * #[tauri::command]
 * async fn update_storage_config(
 *     service: State<'_, StorageApplicationService>,
 *     params: UpdateStorageConfigParams,
 * ) -> Result<StorageConfig, String> {
 *     service.update_storage_config(params).await.map_err(|e| e.to_string())
 * }
 * // ... 其他命令
 * ```
 */
export class StorageApplicationService {
  /** 获取存储配置查询 */
  private getStorageConfigQuery: GetStorageConfigQuery;

  /** 更新存储配置命令 */
  private updateStorageConfigCommand: UpdateStorageConfigCommand;

  /** 选择下载目录命令 */
  private selectDownloadDirectoryCommand: SelectDownloadDirectoryCommand;

  /** 选择缓存目录命令 */
  private selectCacheDirectoryCommand: SelectCacheDirectoryCommand;

  /** 立即保存工作流命令 */
  private saveWorkflowNowCommand: SaveWorkflowNowCommand;

  /** 导入自动保存命令 */
  private importAutoSaveCommand: ImportAutoSaveCommand;

  /** 自动保存定时器 ID（浏览器环境） */
  private autoSaveTimerId: ReturnType<typeof setInterval> | null = null;

  /** 自动保存回调 */
  private autoSaveCallback: IAutoSaveCallback | null = null;

  /**
   * 构造函数
   *
   * 【参数说明】
   * - repository: 存储配置仓库的实现实例
   * - directoryPicker: 目录选择器的 adapter 实现
   * - directoryCreator: 目录创建器的 adapter 实现
   * - fileOps: 文件操作的 adapter 实现
   * - fileRead: 文件读取的 adapter 实现
   *
   * 【依赖注入说明】
   * 所有依赖都通过构造函数注入，而不是在类内部创建。
   * 这使得服务可以独立于具体实现进行开发和测试。
   *
   * 【后续对接说明 - 给后端开发同学】
   * 在 Tauri 中，这些依赖应通过 lib.rs 中的状态管理提供：
   * ```rust
   * fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
   *     let repository = Arc::new(SqliteStorageConfigRepository::new(app.db())?);
   *     let directory_picker = Arc::new(TauriDirectoryPicker::new(app.clone()));
   *     // ... 其他依赖
   *
   *     app.manage(StorageApplicationService::new(
   *         repository,
   *         directory_picker,
   *         // ...
   *     ));
   *
   *     Ok(())
   * }
   * ```
   */
  constructor(
    repository: IStorageConfigRepository,
    directoryPicker: IDirectoryPickerAdapter,
    directoryCreator: IDirectoryCreator,
    fileOps: IFileOperationsAdapter,
    fileRead: IFileReadAdapter
  ) {
    // 初始化各个用例
    this.getStorageConfigQuery = new GetStorageConfigQuery(repository);
    this.updateStorageConfigCommand = new UpdateStorageConfigCommand(repository);
    this.selectDownloadDirectoryCommand = new SelectDownloadDirectoryCommand(
      repository,
      directoryPicker
    );
    this.selectCacheDirectoryCommand = new SelectCacheDirectoryCommand(
      repository,
      directoryPicker,
      directoryCreator
    );
    this.saveWorkflowNowCommand = new SaveWorkflowNowCommand(repository, fileOps);
    this.importAutoSaveCommand = new ImportAutoSaveCommand(repository, fileRead);
  }

  // ============================================================================
  // 查询操作
  // ============================================================================

  /**
   * 获取存储配置
   *
   * 【功能说明】
   * 从持久化存储中读取当前的存储配置。
   *
   * 【返回值】
   * - 返回完整的 StorageConfig 对象
   */
  async getStorageConfig(): Promise<StorageConfig> {
    return await this.getStorageConfigQuery.execute();
  }

  // ============================================================================
  // 命令操作
  // ============================================================================

  /**
   * 更新存储配置
   *
   * 【功能说明】
   * 更新用户的存储配置，支持部分更新。
   * 如果更新了自动保存配置，会自动管理定时器。
   *
   * 【参数说明】
   * - params: 更新参数，所有字段都是可选的
   *
   * 【返回值】
   * - 返回更新后的完整 StorageConfig 对象
   */
  async updateStorageConfig(params: UpdateStorageConfigParams): Promise<StorageConfig> {
    const result = await this.updateStorageConfigCommand.execute(params);

    // 如果更新了自动保存配置，重新管理定时器
    this.manageAutoSaveTimer();

    return result;
  }

  /**
   * 选择下载目录
   *
   * 【功能说明】
   * 弹出系统目录选择器，让用户选择下载目录。
   *
   * 【返回值】
   * - 成功时：{ success: true, path: "/path/to/directory" }
   * - 取消时：{ success: false, path: null }
   */
  async selectDownloadDirectory(): Promise<DirectorySelectionResult> {
    return await this.selectDownloadDirectoryCommand.execute();
  }

  /**
   * 选择缓存目录
   *
   * 【功能说明】
   * 弹出系统目录选择器，让用户选择缓存目录。
   * 用户选择后，会自动创建子目录结构。
   *
   * 【返回值】
   * - 成功时：{ success: true, path: "/path/to/cache/directory" }
   * - 取消时：{ success: false, path: null }
   */
  async selectCacheDirectory(): Promise<DirectorySelectionResult> {
    return await this.selectCacheDirectoryCommand.execute();
  }

  /**
   * 立即保存工作流
   *
   * 【功能说明】
   * 将当前画布数据保存到缓存目录的 autosave 子目录。
   *
   * 【参数说明】
   * - projectId: 项目 ID
   * - projectName: 项目名称（用于文件名）
   * - canvasData: 画布数据（要序列化的内容）
   *
   * 【返回值】
   * - 成功时：返回 SaveWorkflowResult
   */
  async saveWorkflowNow(
    projectId: string,
    projectName: string,
    canvasData: CanvasData
  ): Promise<SaveWorkflowResult> {
    return await this.saveWorkflowNowCommand.execute({
      projectId,
      projectName,
      canvasData,
    });
  }

  /**
   * 导入自动保存文件
   *
   * 【功能说明】
   * 从缓存目录的 autosave 子目录读取最新的自动保存文件。
   *
   * 【参数说明】
   * - projectId: 项目 ID（用于过滤自动保存文件）
   *
   * 【返回值】
   * - 成功时：返回 ImportAutoSaveResult
   */
  async importAutoSave(projectId: string): Promise<ImportAutoSaveResult> {
    return await this.importAutoSaveCommand.execute({ projectId });
  }

  // ============================================================================
  // 自动保存定时器管理
  // ============================================================================

  /**
   * 设置自动保存回调
   *
   * 【功能说明】
   * 设置自动保存触发时获取画布数据的回调函数。
   *
   * 【参数说明】
   * - callback: 自动保存回调
   *
   * 【后续对接说明 - 给后端开发同学】
   * 在前端环境中，此回调用于从 React 状态中获取画布数据。
   * 在 Rust 后端中，自动保存可以直接访问应用状态，不需要回调。
   */
  setAutoSaveCallback(callback: IAutoSaveCallback | null): void {
    this.autoSaveCallback = callback;
    this.manageAutoSaveTimer();
  }

  /**
   * 管理自动保存定时器
   *
   * 【功能说明】
   * 根据当前存储配置管理自动保存定时器。
   * - 如果启用了自动保存，启动或更新定时器
   * - 如果禁用了自动保存，停止定时器
   *
   * 【内部方法】
   * 此方法是私有的，由服务内部管理。
   */
  private async manageAutoSaveTimer(): Promise<void> {
    // 获取当前配置
    const config = await this.getStorageConfig();

    // 停止旧的定时器
    if (this.autoSaveTimerId !== null) {
      clearInterval(this.autoSaveTimerId);
      this.autoSaveTimerId = null;
    }

    // 如果启用了自动保存，启动新的定时器
    if (config.autoSaveEnabled && this.autoSaveCallback) {
      const intervalMs = config.autoSaveIntervalMinutes * 60 * 1000;

      this.autoSaveTimerId = setInterval(async () => {
        try {
          const { projectId, projectName, canvasData } = this.autoSaveCallback!.getCanvasData();
          await this.saveWorkflowNow(projectId, projectName, canvasData);
        } catch (error) {
          // 记录错误，但不中断定时器
          console.error('[AutoSave] Failed to save workflow:', error);
        }
      }, intervalMs);
    }
  }

  /**
   * 停止自动保存
   *
   * 【功能说明】
   * 手动停止自动保存定时器。
   * 通常在组件卸载或应用关闭时调用。
   */
  stopAutoSave(): void {
    if (this.autoSaveTimerId !== null) {
      clearInterval(this.autoSaveTimerId);
      this.autoSaveTimerId = null;
    }
  }

  /**
   * 销毁服务
   *
   * 【功能说明】
   * 清理服务资源，停止自动保存定时器。
   * 在应用退出时调用。
   */
  destroy(): void {
    this.stopAutoSave();
    this.autoSaveCallback = null;
  }
}
