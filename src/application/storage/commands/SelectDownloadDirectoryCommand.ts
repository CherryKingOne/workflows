/**
 * ============================================================================
 * SelectDownloadDirectoryCommand
 * ============================================================================
 *
 * 【应用层 - 命令 / Application Layer - Command】
 *
 * 【职责说明】
 * 本文件实现了选择下载目录命令（SelectDownloadDirectoryCommand）。
 *
 * 【命令的作用】
 * - 触发系统目录选择器，让用户选择下载目录
 * - 将用户选择的路径保存到持久化存储
 * - 返回选择结果和路径
 *
 * 【设计意图】
 * - 此命令涉及基础设施层（系统对话框），因此依赖 adapter 接口
 * - 命令本身不包含对话框实现，而是通过接口调用
 * - 这使得命令可以在测试时使用 Mock 对话框实现
 *
 * 【新手须知】
 * - 这个命令需要与操作系统交互（弹出目录选择器）
 * - 在 Tauri 中，这通过 dialog plugin 实现
 * - 命令类通过接口（adapter）调用对话框，不直接依赖 Tauri API
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此命令在 Tauri 中通过以下方式实现：
 *
 * 1. Tauri Command Handler（src-tauri/src/commands/storage.rs）
 *    - 接收前端调用请求
 *    - 调用 dialog plugin 弹出目录选择器
 *    - 调用应用服务执行命令
 *
 * 2. Dialog 调用示例（Rust）：
 * ```rust
 * use tauri_plugin_dialog::DialogExt;
 *
 * let path = app.dialog()
 *     .file()
 *     .set_title("选择下载目录")
 *     .pick_folder();
 * ```
 *
 * 3. 如果用户选择了目录，调用仓库保存路径：
 * ```rust
 * repository.update_download_directory(&path).await?;
 * ```
 */

import { IStorageConfigRepository } from '../../../domain/storage/repositories/IStorageConfigRepository';
import { StorageConfig } from '../../../domain/storage/entities/StorageConfig';

/**
 * 目录选择器结果
 *
 * 【字段说明】
 * - success: 用户是否成功选择了目录
 * - path: 用户选择的目录路径，如果取消则为 null
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此类型对应 Tauri dialog plugin 的返回结果。
 * 用户取消选择时，success 为 false，path 为 null。
 */
export interface DirectorySelectionResult {
  /** 是否成功选择了目录 */
  success: boolean;
  /** 用户选择的目录路径，取消时为 null */
  path: string | null;
}

/**
 * 目录选择器 Adapter 接口
 *
 * 【接口说明】
 * 此接口定义了目录选择器的抽象。
 * 具体实现由基础设施层提供（Tauri dialog plugin）。
 *
 * 【后续对接说明 - 给后端开发同学】
 * 在 Rust 后端中，这对应一个 trait：
 * ```rust
 * #[async_trait]
 * pub trait DirectoryPickerAdapter: Send + Sync {
 *     async fn pick_folder(&self, title: &str) -> Option<String>;
 * }
 * ```
 *
 * Tauri 实现应实现此 trait，使用 dialog plugin。
 */
export interface IDirectoryPickerAdapter {
  /**
   * 弹出文件夹选择器
   *
   * 【参数说明】
   * - title: 对话框标题
   *
   * 【返回值】
   * - 用户选择的目录路径
   * - 如果用户取消，返回 null
   */
  pickFolder(title: string): Promise<string | null>;
}

/**
 * 选择下载目录命令类
 *
 * 【功能说明】
 * 弹出系统目录选择器，让用户选择下载目录。
 * 用户选择后，将路径保存到持久化存储。
 *
 * 【使用方式】
 * ```typescript
 * const repository = /* 仓库实现 *\/;
 * const directoryPicker = /* 目录选择器 adapter *\/;
 * const command = new SelectDownloadDirectoryCommand(repository, directoryPicker);
 * const result = await command.execute();
 * ```
 *
 * 【业务流程】
 * 1. 弹出目录选择器
 * 2. 用户选择目录或取消
 * 3. 如果选择了目录，保存到数据库
 * 4. 返回选择结果
 *
 * 【后续对接说明 - 给后端开发同学】
 * Tauri Command Handler 示例（Rust）：
 * ```rust
 * #[tauri::command]
 * async fn select_download_directory(
 *     app: AppHandle,
 *     handler: State<'_, StorageCommandHandler>,
 * ) -> Result<DirectorySelectionResult, String> {
 *     handler.execute().await.map_err(|e| e.to_string())
 * }
 * ```
 *
 * SQL 保存示例：
 * ```sql
 * UPDATE storage_configs
 * SET download_directory = ?, updated_at = datetime('now')
 * WHERE id = 1;
 * ```
 */
export class SelectDownloadDirectoryCommand {
  /**
   * 构造函数
   *
   * 【参数说明】
   * - repository: 存储配置仓库的实现实例
   * - directoryPicker: 目录选择器的 adapter 实现
   */
  constructor(
    private repository: IStorageConfigRepository,
    private directoryPicker: IDirectoryPickerAdapter
  ) {}

  /**
   * 执行命令
   *
   * 【功能说明】
   * 弹出目录选择器，用户选择后保存路径到数据库。
   *
   * 【返回值】
   * - 成功时：{ success: true, path: "/path/to/directory" }
   * - 取消时：{ success: false, path: null }
   * - 错误时：抛出 Error
   *
   * 【错误处理】
   * - 对话框错误：系统无法弹出选择器
   * - 仓库错误：数据库保存失败
   *
   * 【后续对接说明 - 给后端开发同学】
   * 如果用户取消选择，应返回 { success: false, path: null }。
   * 不应抛出错误，因为取消是用户的正常操作。
   */
  async execute(): Promise<DirectorySelectionResult> {
    // 1. 弹出目录选择器
    const path = await this.directoryPicker.pickFolder('选择下载目录');

    // 2. 用户取消选择
    if (path === null) {
      return { success: false, path: null };
    }

    // 3. 保存路径到数据库
    await this.repository.updateDownloadDirectory(path);

    // 4. 返回成功结果
    return { success: true, path };
  }
}
