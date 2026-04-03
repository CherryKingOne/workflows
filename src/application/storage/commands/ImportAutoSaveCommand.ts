/**
 * ============================================================================
 * ImportAutoSaveCommand
 * ============================================================================
 *
 * 【应用层 - 命令 / Application Layer - Command】
 *
 * 【职责说明】
 * 本文件实现了导入自动保存文件命令（ImportAutoSaveCommand）。
 *
 * 【命令的作用】
 * - 从缓存目录的 autosave 子目录读取最新的自动保存文件
 * - 解析文件内容，返回工作流数据
 * - 支持按项目 ID 过滤，只读取该项目的自动保存
 *
 * 【设计意图】
 * - 此命令需要文件系统操作，通过 adapter 接口实现
 * - 命令本身不包含文件系统实现，而是通过接口调用
 * - 这使得命令可以在测试时使用 Mock 文件系统
 *
 * 【新手须知】
 * - 这个命令用于"导入自动保存"功能
 * - 当画布意外丢失内容时，用户可以使用此功能恢复
 * - 命令会自动找到最新的自动保存文件（按时间戳排序）
 * - 如果找不到自动保存文件，应返回友好的错误提示
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此命令的完整流程：
 *
 * 1. 从数据库读取缓存目录路径
 * 2. 读取 autosave 目录下的所有 JSON 文件
 * 3. 按项目 ID 过滤文件名
 * 4. 按时间戳排序，找到最新的文件
 * 5. 读取并解析 JSON 文件
 * 6. 返回工作流数据
 *
 * Rust 实现示例：
 * ```rust
 * #[tauri::command]
 * async fn import_auto_save(
 *     project_id: String,
 *     state: State<'_, StorageCommandHandler>,
 * ) -> Result<ImportAutoSaveResult, String> {
 *     state.execute(&project_id).await.map_err(|e| e.to_string())
 * }
 * ```
 */

import { IStorageConfigRepository } from '../../../domain/storage/repositories/IStorageConfigRepository';
import { CanvasData } from './SaveWorkflowNowCommand';

/**
 * 导入自动保存结果
 *
 * 【字段说明】
 * - success: 是否导入成功
 * - workflowData: 解析后的工作流数据
 * - filePath: 导入的文件路径
 * - fileName: 导入的文件名
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此类型应与前端期望的返回格式一致。
 * workflowData 的结构应与画布数据的结构一致。
 */
export interface ImportAutoSaveResult {
  /** 是否导入成功 */
  success: boolean;
  /** 解析后的工作流数据 */
  workflowData: CanvasData;
  /** 导入的文件路径 */
  filePath: string;
  /** 导入的文件名 */
  fileName: string;
}

/**
 * 文件读取 Adapter 接口
 *
 * 【接口说明】
 * 此接口定义了文件系统读取操作的抽象。
 * 具体实现由基础设施层提供（Tauri 文件系统）。
 *
 * 【后续对接说明 - 给后端开发同学】
 * 在 Rust 后端中，这对应一个 trait：
 * ```rust
 * #[async_trait]
 * pub trait FileReadAdapter: Send + Sync {
 *     async fn list_json_files_in_directory(&self, dir_path: &str) -> Result<Vec<String>>;
 *     async fn read_json_file(&self, file_path: &str) -> Result<serde_json::Value>;
 * }
 * ```
 *
 * Tauri 实现应使用 tokio::fs 和 serde_json。
 */
export interface IFileReadAdapter {
  /**
   * 列出目录中的所有 JSON 文件
   *
   * 【参数说明】
   * - dirPath: 目录路径
   *
   * 【返回值】
   * - 文件名列表（只包含 .json 文件）
   * - 按文件名排序（升序）
   */
  listJsonFilesInDirectory(dirPath: string): Promise<string[]>;

  /**
   * 读取并解析 JSON 文件
   *
   * 【参数说明】
   * - filePath: 文件路径
   *
   * 【返回值】
   * - 解析后的 JSON 数据
   * - 如果文件不存在或格式错误，抛出错误
   */
  readJsonFile(filePath: string): Promise<CanvasData>;
}

/**
 * 从文件名中提取项目 ID
 *
 * 【功能说明】
 * 根据文件名格式 {项目名}_{时间戳}.json 提取项目 ID。
 *
 * 【参数说明】
 * - fileName: 文件名，例如 "My_Project_20260403_143025.json"
 *
 * 【返回值】
 * - 提取出的项目名部分，例如 "My_Project"
 *
 * 【后续对接说明 - 给后端开发同学】
 * 此函数用于在 Rust 后端中实现类似的逻辑。
 * 由于文件名中包含时间戳，需要通过解析文件名来提取项目信息。
 *
 * Rust 实现思路：
 * 1. 去掉 .json 后缀
 * 2. 从后往前找最后一个符合时间戳格式的部分（YYYYMMDD_HHMMSS）
 * 3. 去掉时间戳部分，剩余的就是项目名
 */
function extractProjectNameFromFileName(fileName: string): string {
  // 去掉 .json 后缀
  const nameWithoutExt = fileName.replace(/\.json$/, '');

  // 匹配时间戳格式：_YYYYMMDD_HHMMSS
  const timestampPattern = /_\d{8}_\d{6}$/;
  const match = nameWithoutExt.match(timestampPattern);

  if (match) {
    // 去掉时间戳部分
    return nameWithoutExt.slice(0, match.index);
  }

  // 如果没有匹配到时间戳，返回整个文件名
  return nameWithoutExt;
}

/**
 * 导入自动保存文件命令类
 *
 * 【功能说明】
 * 从缓存目录的 autosave 子目录读取最新的自动保存文件。
 *
 * 【使用方式】
 * ```typescript
 * const repository = /* 仓库实现 *\/;
 * const fileRead = /* 文件读取 adapter *\/;
 * const command = new ImportAutoSaveCommand(repository, fileRead);
 * const result = await command.execute({
 *   projectId: 'project-123',
 * });
 * ```
 *
 * 【业务流程】
 * 1. 从数据库读取缓存目录路径
 * 2. 构建 autosave 目录路径
 * 3. 列出 autosave 目录中的所有 JSON 文件
 * 4. 按项目 ID 过滤文件
 * 5. 按文件名排序，找到最新的文件
 * 6. 读取并解析 JSON 文件
 * 7. 返回导入结果
 *
 * 【后续对接说明 - 给后端开发同学】
 * Rust 实现示例：
 * ```rust
 * use tokio::fs;
 * use std::path::Path;
 *
 * // 1. 获取缓存目录
 * let config = repository.get_config().await?;
 * let cache_dir = config.cache_directory
 *     .ok_or("Cache directory not set")?;
 *
 * // 2. 构建 autosave 目录路径
 * let autosave_dir = format!("{}/autosave", cache_dir);
 *
 * // 3. 读取目录中的所有文件
 * let mut entries = fs::read_dir(&autosave_dir).await?;
 * let mut json_files = Vec::new();
 *
 * while let Some(entry) = entries.next_entry().await? {
 *     let path = entry.path();
 *     if path.extension().and_then(|s| s.to_str()) == Some("json") {
 *         if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
 *             json_files.push(name.to_string());
 *         }
 *     }
 * }
 *
 * // 4. 按项目 ID 过滤
 * json_files.retain(|name| {
 *     let project_name = extract_project_name(name);
 *     // 假设 project_id 与 project_name 有关联
 *     project_name.contains(&project_id_filter)
 * });
 *
 * // 5. 排序并找到最新的文件
 * json_files.sort();
 * let latest_file = json_files.last()
 *     .ok_or("No auto-save files found for this project")?;
 *
 * // 6. 读取并解析 JSON
 * let file_path = format!("{}/{}", autosave_dir, latest_file);
 * let json_content = fs::read_to_string(&file_path).await?;
 * let workflow_data: serde_json::Value = serde_json::from_str(&json_content)?;
 *
 * Ok(ImportAutoSaveResult {
 *     success: true,
 *     workflow_data,
 *     file_path,
 *     file_name: latest_file.clone(),
 * })
 * ```
 */
export class ImportAutoSaveCommand {
  /**
   * 构造函数
   *
   * 【参数说明】
   * - repository: 存储配置仓库的实现实例
   * - fileRead: 文件读取的 adapter 实现
   */
  constructor(
    private repository: IStorageConfigRepository,
    private fileRead: IFileReadAdapter
  ) {}

  /**
   * 执行命令
   *
   * 【参数说明】
   * - params.projectId: 项目 ID（用于过滤自动保存文件）
   *
   * 【返回值】
   * - 成功时：返回 ImportAutoSaveResult
   * - 错误时：抛出 Error
   *
   * 【错误处理】
   * - 缓存目录未设置：提示用户先设置缓存目录
   * - autosave 目录不存在：提示用户没有自动保存文件
   * - 找不到项目的自动保存：提示用户该项目没有自动保存记录
   * - 文件读取错误：文件格式错误、权限问题等
   */
  async execute(params: { projectId: string }): Promise<ImportAutoSaveResult> {
    // 1. 从数据库读取缓存目录路径
    const config = await this.repository.getConfig();

    if (!config.cacheDirectory) {
      throw new Error('请先在存储管理中设置缓存目录');
    }

    // 2. 构建 autosave 目录路径
    const autosaveDir = `${config.cacheDirectory}/autosave`;

    // 3. 列出 autosave 目录中的所有 JSON 文件
    let jsonFiles: string[];
    try {
      jsonFiles = await this.fileRead.listJsonFilesInDirectory(autosaveDir);
    } catch {
      throw new Error('无法读取自动保存目录');
    }

    if (jsonFiles.length === 0) {
      throw new Error('没有找到自动保存文件');
    }

    // 4. 按项目 ID 过滤文件
    // 注意：这里简化处理，实际项目中可能需要更精确的匹配逻辑
    const filteredFiles = jsonFiles.filter((fileName) => {
      const projectName = extractProjectNameFromFileName(fileName);
      // 简化匹配：检查项目 ID 是否与项目名相关
      return projectName.toLowerCase().includes(params.projectId.toLowerCase());
    });

    if (filteredFiles.length === 0) {
      throw new Error(`没有找到项目 "${params.projectId}" 的自动保存文件`);
    }

    // 5. 按文件名排序（升序），找到最新的文件（最后一个）
    filteredFiles.sort();
    const latestFile = filteredFiles[filteredFiles.length - 1];
    const filePath = `${autosaveDir}/${latestFile}`;

    // 6. 读取并解析 JSON 文件
    const workflowData = await this.fileRead.readJsonFile(filePath);

    // 7. 返回导入结果
    return {
      success: true,
      workflowData,
      filePath,
      fileName: latestFile,
    };
  }
}
