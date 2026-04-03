/**
 * ============================================================================
 * SaveWorkflowNowCommand
 * ============================================================================
 *
 * 【应用层 - 命令 / Application Layer - Command】
 *
 * 【职责说明】
 * 本文件实现了立即保存工作流命令（SaveWorkflowNowCommand）。
 *
 * 【命令的作用】
 * - 将当前画布内容序列化为 JSON
 * - 保存到缓存目录的 autosave 子目录
 * - 文件名格式：项目名_时间戳.json
 *
 * 【设计意图】
 * - 此命令需要文件系统操作，通过 adapter 接口实现
 * - 命令本身不包含文件系统实现，而是通过接口调用
 * - 这使得命令可以在测试时使用 Mock 文件系统
 *
 * 【新手须知】
 * - 这个命令用于"立即保存"功能，区别于自动保存
 * - 用户可以随时点击"立即保存"按钮触发此命令
 * - 保存的内容包括画布结构和节点引用的素材信息
 * - 素材本身不序列化，只保存引用（从缓存目录读取）
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此命令的完整流程：
 *
 * 1. 获取当前项目 ID 和画布数据（从前端传入）
 * 2. 从数据库读取缓存目录路径
 * 3. 构建文件路径：{缓存目录}/autosave/{项目名}_{时间戳}.json
 * 4. 序列化画布数据为 JSON
 * 5. 写入文件
 * 6. 返回保存结果和文件路径
 *
 * Rust 实现示例：
 * ```rust
 * #[tauri::command]
 * async fn save_workflow_now(
 *     project_id: String,
 *     project_name: String,
 *     canvas_data: serde_json::Value,
 *     state: State<'_, StorageCommandHandler>,
 * ) -> Result<SaveWorkflowResult, String> {
 *     state.execute(&project_id, &project_name, &canvas_data).await
 *         .map_err(|e| e.to_string())
 * }
 * ```
 */

import { IStorageConfigRepository } from '../../../domain/storage/repositories/IStorageConfigRepository';

/**
 * 画布数据类型
 *
 * 【说明】
 * 这是画布数据的简化类型定义。
 * 实际项目中，这应该与画布的实际数据结构一致。
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此类型对应 Rust 中的 serde_json::Value 或具体的画布数据结构体。
 * 建议定义具体的结构体而不是使用动态 JSON 类型。
 */
export type CanvasData = Record<string, unknown>;

/**
 * 保存工作流结果
 *
 * 【字段说明】
 * - success: 是否保存成功
 * - filePath: 保存的文件路径
 * - fileName: 保存的文件名
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此类型应与前端期望的返回格式一致。
 */
export interface SaveWorkflowResult {
  /** 是否保存成功 */
  success: boolean;
  /** 保存的文件路径 */
  filePath: string;
  /** 保存的文件名 */
  fileName: string;
}

/**
 * 文件操作 Adapter 接口
 *
 * 【接口说明】
 * 此接口定义了文件系统操作的抽象。
 * 具体实现由基础设施层提供（Tauri 文件系统）。
 *
 * 【后续对接说明 - 给后端开发同学】
 * 在 Rust 后端中，这对应一个 trait：
 * ```rust
 * #[async_trait]
 * pub trait FileOperationsAdapter: Send + Sync {
 *     async fn ensure_directory_exists(&self, path: &str) -> Result<()>;
 *     async fn write_json_file(&self, path: &str, data: &serde_json::Value) -> Result<()>;
 *     fn get_timestamp_string(&self) -> String;
 * }
 * ```
 *
 * Tauri 实现应使用 tokio::fs 和 chrono crate。
 */
export interface IFileOperationsAdapter {
  /**
   * 确保目录存在（不存在则创建）
   *
   * 【参数说明】
   * - path: 目录路径
   */
  ensureDirectoryExists(path: string): Promise<void>;

  /**
   * 写入 JSON 文件
   *
   * 【参数说明】
   * - path: 文件路径
   * - data: 要写入的 JSON 数据
   */
  writeJsonFile(path: string, data: CanvasData): Promise<void>;

  /**
   * 获取当前时间戳字符串（用于文件名）
   *
   * 【返回值】
   * - 格式：YYYYMMDD_HHMMSS
   * - 示例：20260403_143025
   */
  getTimestampString(): string;
}

/**
 * 立即保存工作流命令类
 *
 * 【功能说明】
 * 将当前画布数据保存到缓存目录的 autosave 子目录。
 *
 * 【使用方式】
 * ```typescript
 * const repository = /* 仓库实现 *\/;
 * const fileOps = /* 文件操作 adapter *\/;
 * const command = new SaveWorkflowNowCommand(repository, fileOps);
 * const result = await command.execute({
 *   projectId: 'project-123',
 *   projectName: 'My Project',
 *   canvasData: { /* 画布数据 *\/ },
 * });
 * ```
 *
 * 【业务流程】
 * 1. 从数据库读取缓存目录路径
 * 2. 构建 autosave 目录路径
 * 3. 确保 autosave 目录存在
 * 4. 构建文件名：项目名_时间戳.json
 * 5. 序列化并写入文件
 * 6. 返回保存结果
 *
 * 【后续对接说明 - 给后端开发同学】
 * 文件名格式：
 * ```
 * {项目名}_{YYYYMMDD_HHMMSS}.json
 * ```
 *
 * 示例：
 * ```
 * My_Project_20260403_143025.json
 * ```
 *
 * 完整文件路径：
 * ```
 * {缓存目录}/autosave/{文件名}
 * ```
 *
 * SQL 读取缓存目录：
 * ```sql
 * SELECT cache_directory FROM storage_configs LIMIT 1;
 * ```
 *
 * Rust 文件写入示例：
 * ```rust
 * use chrono::Utc;
 * use tokio::fs;
 * use serde_json;
 *
 * let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
 * let file_name = format!("{}_{}.json", project_name, timestamp);
 * let file_path = format!("{}/autosave/{}", cache_dir, file_name);
 *
 * // 确保目录存在
 * fs::create_dir_all(&format!("{}/autosave", cache_dir)).await?;
 *
 * // 写入 JSON 文件
 * let json = serde_json::to_string_pretty(&canvas_data)?;
 * fs::write(&file_path, json).await?;
 * ```
 */
export class SaveWorkflowNowCommand {
  /**
   * 构造函数
   *
   * 【参数说明】
   * - repository: 存储配置仓库的实现实例
   * - fileOps: 文件操作的 adapter 实现
   */
  constructor(
    private repository: IStorageConfigRepository,
    private fileOps: IFileOperationsAdapter
  ) {}

  /**
   * 执行命令
   *
   * 【参数说明】
   * - params.projectId: 项目 ID
   * - params.projectName: 项目名称（用于文件名）
   * - params.canvasData: 画布数据（要序列化的内容）
   *
   * 【返回值】
   * - 成功时：返回 SaveWorkflowResult
   * - 错误时：抛出 Error
   *
   * 【错误处理】
   * - 缓存目录未设置：抛出错误，提示用户先设置缓存目录
   * - 文件系统错误：写入失败、权限问题等
   *
   * 【后续对接说明 - 给后端开发同学】
   * 如果缓存目录未设置，应返回友好的错误消息：
   * "请先在存储管理中设置缓存目录"
   */
  async execute(params: {
    projectId: string;
    projectName: string;
    canvasData: CanvasData;
  }): Promise<SaveWorkflowResult> {
    // 1. 从数据库读取缓存目录路径
    const config = await this.repository.getConfig();

    if (!config.cacheDirectory) {
      throw new Error('请先在存储管理中设置缓存目录');
    }

    // 2. 构建 autosave 目录路径
    const autosaveDir = `${config.cacheDirectory}/autosave`;

    // 3. 确保 autosave 目录存在
    await this.fileOps.ensureDirectoryExists(autosaveDir);

    // 4. 构建文件名和项目名（替换特殊字符）
    const sanitizedName = params.projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    const timestamp = this.fileOps.getTimestampString();
    const fileName = `${sanitizedName}_${timestamp}.json`;
    const filePath = `${autosaveDir}/${fileName}`;

    // 5. 写入 JSON 文件
    await this.fileOps.writeJsonFile(filePath, params.canvasData);

    // 6. 返回保存结果
    return {
      success: true,
      filePath,
      fileName,
    };
  }
}
