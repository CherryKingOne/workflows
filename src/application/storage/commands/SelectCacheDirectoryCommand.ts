/**
 * ============================================================================
 * SelectCacheDirectoryCommand
 * ============================================================================
 *
 * 【应用层 - 命令 / Application Layer - Command】
 *
 * 【职责说明】
 * 本文件实现了选择缓存目录命令（SelectCacheDirectoryCommand）。
 *
 * 【命令的作用】
 * - 触发系统目录选择器，让用户选择缓存目录
 * - 将用户选择的路径保存到持久化存储
 * - 首次设置时，自动创建缓存子目录结构
 *
 * 【与 SelectDownloadDirectoryCommand 的区别】
 * - 此命令在保存路径后，还需要创建子目录结构
 * - 子目录包括：/images/、/videos/、/audios/、/local/、/autosave/
 * - 这些子目录用于分类存储不同类型的资源
 *
 * 【设计意图】
 * - 与下载目录命令类似，通过 adapter 接口调用对话框
 * - 额外依赖目录创建接口，以支持子目录创建
 *
 * 【新手须知】
 * - 缓存目录比下载目录更复杂，因为需要子目录结构
 * - 子目录的作用是按类型分类存储素材
 * - 如果子目录已存在，创建操作应该是安全的（不报错）
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此命令与 SelectDownloadDirectoryCommand 类似，但增加了子目录创建步骤。
 *
 * 子目录结构：
 * ```
 * {用户选择的缓存目录}/
 * ├── images/        # 图片缓存
 * ├── videos/        # 视频缓存
 * ├── audios/        # 音频缓存
 * ├── local/         # 用户拖入或粘贴的素材
 * └── autosave/      # 工作流自动保存文件
 * ```
 *
 * Rust 创建子目录示例：
 * ```rust
 * use tokio::fs;
 *
 * let subdirs = ["images", "videos", "audios", "local", "autosave"];
 * for subdir in subdirs {
 *     let dir_path = format!("{}/{}", base_path, subdir);
 *     fs::create_dir_all(&dir_path).await?;
 * }
 * ```
 */

import { IStorageConfigRepository } from '../../../domain/storage/repositories/IStorageConfigRepository';
import {
  IDirectoryPickerAdapter,
  DirectorySelectionResult,
} from './SelectDownloadDirectoryCommand';

/**
 * 目录创建 Adapter 接口
 *
 * 【接口说明】
 * 此接口定义了在指定路径下创建子目录的抽象。
 * 具体实现由基础设施层提供（文件系统操作）。
 *
 * 【后续对接说明 - 给后端开发同学】
 * 在 Rust 后端中，这对应一个 trait：
 * ```rust
 * #[async_trait]
 * pub trait DirectoryCreator: Send + Sync {
 *     async fn ensure_subdirectories(&self, base_path: &str, subdirs: &[&str]) -> Result<()>;
 * }
 * ```
 *
 * Tauri 实现应使用 tokio::fs::create_dir_all。
 */
export interface IDirectoryCreator {
  /**
   * 在指定路径下创建子目录
   *
   * 【参数说明】
   * - basePath: 基础目录路径
   * - subdirs: 要创建的子目录名称列表
   *
   * 【业务规则】
   * - 如果子目录已存在，不应报错（幂等操作）
   * - 如果基础路径不存在，应先创建基础路径
   * - 如果创建失败，应抛出错误
   */
  ensureSubdirectories(basePath: string, subdirs: string[]): Promise<void>;
}

/**
 * 缓存目录所需的子目录列表
 *
 * 【说明】
 * - images: 存储 AI 生成或远程下载的图片
 * - videos: 存储 AI 生成或远程下载的视频
 * - audios: 存储 AI 生成或远程下载的音频
 * - local: 存储用户拖入画布或从剪贴板粘贴的素材
 * - autosave: 存储工作流自动保存的 JSON 文件
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此列表应保持一致，如果未来需要新增子目录类型，
 * 应同时更新此数组和相关的业务逻辑。
 */
export const CACHE_SUBDIRECTORIES = ['images', 'videos', 'audios', 'local', 'autosave'];

/**
 * 选择缓存目录命令类
 *
 * 【功能说明】
 * 弹出系统目录选择器，让用户选择缓存目录。
 * 用户选择后，将路径保存到数据库，并创建子目录结构。
 *
 * 【使用方式】
 * ```typescript
 * const repository = /* 仓库实现 *\/;
 * const directoryPicker = /* 目录选择器 adapter *\/;
 * const directoryCreator = /* 目录创建 adapter *\/;
 * const command = new SelectCacheDirectoryCommand(
 *   repository,
 *   directoryPicker,
 *   directoryCreator
 * );
 * const result = await command.execute();
 * ```
 *
 * 【业务流程】
 * 1. 弹出目录选择器
 * 2. 用户选择目录或取消
 * 3. 如果选择了目录，保存到数据库
 * 4. 创建子目录结构（幂等操作）
 * 5. 返回选择结果
 *
 * 【后续对接说明 - 给后端开发同学】
 * Tauri Command Handler 示例（Rust）：
 * ```rust
 * #[tauri::command]
 * async fn select_cache_directory(
 *     app: AppHandle,
 *     handler: State<'_, StorageCommandHandler>,
 * ) -> Result<DirectorySelectionResult, String> {
 *     handler.execute().await.map_err(|e| e.to_string())
 * }
 * ```
 *
 * 完整实现步骤：
 * 1. 调用 dialog plugin 弹出目录选择器
 * 2. 用户选择后，调用 repository.update_cache_directory
 * 3. 调用 ensure_subdirectories 创建子目录结构
 * 4. 返回选择结果
 */
export class SelectCacheDirectoryCommand {
  /**
   * 构造函数
   *
   * 【参数说明】
   * - repository: 存储配置仓库的实现实例
   * - directoryPicker: 目录选择器的 adapter 实现
   * - directoryCreator: 目录创建器的 adapter 实现
   */
  constructor(
    private repository: IStorageConfigRepository,
    private directoryPicker: IDirectoryPickerAdapter,
    private directoryCreator: IDirectoryCreator
  ) {}

  /**
   * 执行命令
   *
   * 【功能说明】
   * 弹出目录选择器，用户选择后保存路径到数据库，并创建子目录结构。
   *
   * 【返回值】
   * - 成功时：{ success: true, path: "/path/to/cache/directory" }
   * - 取消时：{ success: false, path: null }
   * - 错误时：抛出 Error
   *
   * 【错误处理】
   * - 对话框错误：系统无法弹出选择器
   * - 仓库错误：数据库保存失败
   * - 目录创建错误：无法创建子目录（权限问题、磁盘满等）
   *
   * 【后续对接说明 - 给后端开发同学】
   * 如果用户取消选择，应返回 { success: false, path: null }。
   * 子目录创建失败时应抛出错误，因为这将影响后续功能。
   */
  async execute(): Promise<DirectorySelectionResult> {
    // 1. 弹出目录选择器
    const path = await this.directoryPicker.pickFolder('选择缓存目录');

    // 2. 用户取消选择
    if (path === null) {
      return { success: false, path: null };
    }

    // 3. 保存路径到数据库
    await this.repository.updateCacheDirectory(path);

    // 4. 创建子目录结构（幂等操作，已存在时不报错）
    await this.directoryCreator.ensureSubdirectories(path, CACHE_SUBDIRECTORIES);

    // 5. 返回成功结果
    return { success: true, path };
  }
}
