/**
 * ============================================================================
 * useApiConfigs Hook
 * ============================================================================
 * 
 * 【展示层 - Hook / Presentation Layer - Hook】
 * 
 * 【职责说明】
 * 本文件实现了 API 配置的管理 Hook（useApiConfigs）。
 * 
 * 【Hook 的作用】
 * - 封装 API 配置相关的所有状态和逻辑
 * - 作为展示层与应用层的桥梁
 * - 为组件（如 ApiSettingsModal）提供易于使用的接口
 * - 处理加载、错误、乐观更新等 UI 状态
 * 
 * 【设计意图】
 * - 组件通过此 Hook 与后端交互，而非直接调用 Tauri invoke
 * - Hook 内部调用应用层的用例（Queries 和 Commands）
 * - 应用层通过仓库实现调用 Tauri 命令
 * - 遵循分层架构，避免组件与后端紧耦合
 * 
 * 【新手须知】
 * - 组件通过 const { ... } = useApiConfigs() 使用此 Hook
 * - 返回的状态和函数可直接传递给组件的 props
 * - 如果需要修改后端交互逻辑，只需修改此 Hook 内部的实现
 * - 不需要修改组件代码
 * 
 * 【数据流】
 * 组件 -> useApiConfigs Hook -> Application Service -> Repository -> Tauri Command
 * 
 * 【后续对接说明】
 * 当前 Hook 有两种工作模式：
 * 
 * 模式一：Mock 模式（当前默认，用于前端开发和测试）
 * - 使用假数据模拟后端响应
 * - 无需后端即可测试完整 UI 交互
 * - 通过环境变量或参数切换
 * 
 * 模式二：真实模式（后续对接后端时启用）
 * - 通过仓库实现调用 Tauri 命令
 * - 与真实后端交互
 * - 需要创建仓库实现类（见下方说明）
 * 
 * 【后端对接步骤】
 * 1. 创建仓库实现类（见下方示例代码）
 *    位置：src/infrastructure/persistence/repositories/TauriApiConfigRepo.ts
 * 
 * 2. 在 Tauri 后端实现对应的命令
 *    位置：src-tauri/src/commands/api_config.rs（或类似文件）
 * 
 * 3. 切换此 Hook 到真实模式（修改 useMockData 或环境变量）
 * 
 * 4. 测试完整的数据流
 */

import { useState, useCallback, useEffect } from 'react';
import { ApiConfigApplicationService } from '../../application/apiConfig/ApiConfigApplicationService';
import { ApiType } from '../../domain/apiConfig/valueObjects';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * API 配置数据接口（前端内部使用）
 * 
 * 【后续对接说明】
 * 此接口应与后端返回的 DTO 格式一致。
 * 后续应从 domain 层导入：
 *   import { ApiConfigDto } from '@/domain/apiConfig/entities/ApiConfig';
 */
interface ApiConfigData {
  /** 配置唯一标识（后端生成） */
  id: string;
  /** 模型标识（如 "gpt-5.4"） */
  modelId: string;
  /** API 密钥（存储时应加密，展示时应掩码） */
  apiKey: string;
  /** API 基础 URL（如 "https://api.openai.com"） */
  baseUrl: string;
  /** API 类型（"Chat" | "Image" | "Video"） */
  apiType: 'Chat' | 'Image' | 'Video';
  /** 是否启用 */
  isEnabled: boolean;
}

/**
 * 测试结果接口
 * 
 * 【后续对接说明】
 * 此接口应与后端返回的测试结果格式一致。
 */
interface TestConnectionResult {
  /** 是否连接成功 */
  success: boolean;
  /** 结果消息 */
  message: string;
  /** 响应延迟（毫秒） */
  latency?: number;
}

/**
 * Hook 返回值接口
 * 
 * 【字段说明】
 * 此接口定义了组件可通过 Hook 访问的所有状态和函数。
 * 
 * 【后续对接说明】
 * 所有函数内部应调用应用层的用例，而非直接调用 Tauri invoke。
 */
interface UseApiConfigsReturn {
  /** 配置列表 */
  configs: ApiConfigData[];
  /** 是否正在加载 */
  loading: boolean;
  /** 错误消息 */
  error: string | null;
  /** 刷新配置列表 */
  refreshConfigs: () => Promise<void>;
  /** 测试连接 */
  testConnection: (config: ApiConfigData) => Promise<TestConnectionResult>;
  /** 保存配置（创建或更新） */
  saveConfig: (config: ApiConfigData) => Promise<void>;
  /** 删除配置 */
  deleteConfig: (id: string) => Promise<void>;
  /** 应用服务实例（供高级使用） */
  service: ApiConfigApplicationService | null;
}

// ============================================================================
// Mock 数据（用于前端开发测试）
// ============================================================================

/**
 * 模拟数据生成器
 * 
 * 【用途】
 * 在后端尚未对接时，提供假数据用于前端开发和测试。
 * 
 * 【后续对接说明】
 * 后端对接完成后，可将 useMockData 设为 false，或直接删除此函数。
 */
function generateMockConfigs(): ApiConfigData[] {
  return [
    {
      id: 'mock-1',
      modelId: 'gpt-5.4',
      apiKey: 'sk-abc123def456',
      baseUrl: 'https://ai.comfly.chat',
      apiType: 'Chat',
      isEnabled: true,
    },
    {
      id: 'mock-2',
      modelId: 'gpt-5.4-pro',
      apiKey: 'sk-xyz789ghi012',
      baseUrl: 'https://ai.comfly.chat',
      apiType: 'Chat',
      isEnabled: true,
    },
    {
      id: 'mock-3',
      modelId: 'dall-e-3',
      apiKey: 'sk-img123abc456',
      baseUrl: 'https://api.openai.com',
      apiType: 'Image',
      isEnabled: true,
    },
    {
      id: 'mock-4',
      modelId: 'runway-gen2',
      apiKey: '',
      baseUrl: 'https://api.runwayml.com',
      apiType: 'Video',
      isEnabled: false,
    },
  ];
}

// ============================================================================
// 仓库实现示例（后续对接后端时创建）
// ============================================================================

/**
 * 【后续对接说明 - 仓库实现示例】
 * 
 * 以下代码是后端对接时需要创建的仓库实现类示例。
 * 此类应放在以下位置：
 *   src/infrastructure/persistence/repositories/TauriApiConfigRepo.ts
 * 
 * 完整示例代码（取消注释即可使用）：
 * 
 * ```typescript
 * import { invoke } from '@tauri-apps/api/core';
 * import { IApiConfigRepository, TestConnectionResult } from '@/domain/apiConfig/repositories/IApiConfigRepository';
 * import { ApiConfig, ApiConfigDto } from '@/domain/apiConfig/entities/ApiConfig';
 * import { ApiType } from '@/domain/apiConfig/valueObjects';
 * 
 * export class TauriApiConfigRepo implements IApiConfigRepository {
 *   async findAll(): Promise<ApiConfig[]> {
 *     // 调用 Tauri 命令获取所有配置
 *     const dtos = await invoke<ApiConfigDto[]>('get_api_configs');
 *     return dtos.map((dto) => ApiConfig.fromDto(dto));
 *   }
 * 
 *   async findByType(apiType: ApiType): Promise<ApiConfig[]> {
 *     // 调用 Tauri 命令按类型获取配置
 *     const dtos = await invoke<ApiConfigDto[]>('get_api_configs_by_type', { apiType });
 *     return dtos.map((dto) => ApiConfig.fromDto(dto));
 *   }
 * 
 *   async findById(id: string): Promise<ApiConfig | null> {
 *     // 调用 Tauri 命令获取单个配置
 *     const dto = await invoke<ApiConfigDto | null>('get_api_config', { id });
 *     return dto ? ApiConfig.fromDto(dto) : null;
 *   }
 * 
 *   async create(config: ApiConfig): Promise<ApiConfig> {
 *     // 调用 Tauri 命令创建配置
 *     const dto = await invoke<ApiConfigDto>('create_api_config', {
 *       modelId: config.modelId.value,
 *       apiKey: config.apiKey.value,
 *       baseUrl: config.baseUrl.value,
 *       apiType: config.apiType,
 *     });
 *     return ApiConfig.fromDto(dto);
 *   }
 * 
 *   async update(config: ApiConfig): Promise<ApiConfig> {
 *     // 调用 Tauri 命令更新配置
 *     const dto = await invoke<ApiConfigDto>('update_api_config', {
 *       id: config.id.value,
 *       modelId: config.modelId.value,
 *       apiKey: config.apiKey.value,
 *       baseUrl: config.baseUrl.value,
 *       apiType: config.apiType,
 *       isEnabled: config.isEnabled,
 *     });
 *     return ApiConfig.fromDto(dto);
 *   }
 * 
 *   async delete(id: string): Promise<boolean> {
 *     // 调用 Tauri 命令删除配置
 *     return await invoke<boolean>('delete_api_config', { id });
 *   }
 * 
 *   async testConnection(config: ApiConfig): Promise<TestConnectionResult> {
 *     // 调用 Tauri 命令测试连接
 *     return await invoke<TestConnectionResult>('test_api_connection', {
 *       modelId: config.modelId.value,
 *       apiKey: config.apiKey.value,
 *       baseUrl: config.baseUrl.value,
 *       apiType: config.apiType,
 *     });
 *   }
 * }
 * ```
 * 
 * 【后端 Tauri 命令示例】
 * 后端开发人员可参考以下 Rust 代码实现 Tauri 命令：
 * 
 * ```rust
 * use tauri::command;
 * use serde::{Deserialize, Serialize};
 * 
 * #[derive(Serialize, Deserialize)]
 * pub struct ApiConfigDto {
 *     pub id: String,
 *     pub model_id: String,
 *     pub api_key: String,
 *     pub base_url: String,
 *     pub api_type: String,
 *     pub is_enabled: bool,
 * }
 * 
 * #[derive(Serialize, Deserialize)]
 * pub struct TestConnectionResult {
 *     pub success: bool,
 *     pub message: String,
 *     pub latency: Option<u64>,
 * }
 * 
 * #[command]
 * pub async fn get_api_configs() -> Result<Vec<ApiConfigDto>, String> {
 *     // 1. 连接数据库
 *     // 2. 查询所有配置
 *     // 3. 返回 DTO 列表
 *     todo!()
 * }
 * 
 * #[command]
 * pub async fn create_api_config(
 *     model_id: String,
 *     api_key: String,
 *     base_url: String,
 *     api_type: String,
 * ) -> Result<ApiConfigDto, String> {
 *     // 1. 验证输入
 *     // 2. 生成 UUID
 *     // 3. 加密 api_key
 *     // 4. 插入数据库
 *     // 5. 返回 DTO
 *     todo!()
 * }
 * 
 * // ... 其他命令类似
 * ```
 */

// ============================================================================
// 主 Hook
// ============================================================================

/**
 * API 配置管理 Hook
 * 
 * 【使用方式】
 * ```typescript
 * const {
 *   configs,
 *   loading,
 *   error,
 *   refreshConfigs,
 *   testConnection,
 *   saveConfig,
 *   deleteConfig,
 * } = useApiConfigs();
 * ```
 * 
 * 【后续对接说明】
 * 当前 Hook 默认使用 Mock 数据。
 * 后端对接时，将 useMockData 设为 false 并传入仓库实现。
 * 
 * @param useMockData - 是否使用 Mock 数据（默认 true）
 * @returns Hook 状态和函数
 */
export function useApiConfigs(useMockData: boolean = true): UseApiConfigsReturn {
  // ============================================================================
  // 状态管理
  // ============================================================================

  /** 配置列表状态 */
  const [configs, setConfigs] = useState<ApiConfigData[]>([]);
  
  /** 加载状态 */
  const [loading, setLoading] = useState(false);
  
  /** 错误状态 */
  const [error, setError] = useState<string | null>(null);

  /** 应用服务实例 */
  const [service, setService] = useState<ApiConfigApplicationService | null>(null);

  // ============================================================================
  // 初始化
  // ============================================================================

  /**
   * 初始化 Hook
   * 
   * 【功能说明】
   * - 如果使用真实模式，创建应用服务实例和仓库实现
   * - 加载初始数据
   * 
   * 【后续对接说明】
   * 当 useMockData 为 false 时，需要传入仓库实现：
   *   const repo = new TauriApiConfigRepo();
   *   const service = new ApiConfigApplicationService(repo);
   */
  useEffect(() => {
    if (!useMockData) {
      // 【后续对接说明】
      // 此处应创建仓库实现和应用服务实例
      // 示例：
      //   const repo = new TauriApiConfigRepo();
      //   setService(new ApiConfigApplicationService(repo));
      // 当前：跳过，使用 Mock 模式
    }
  }, [useMockData]);

  /**
   * 加载初始数据
   * 
   * 【功能说明】
   * - 组件挂载时加载数据
   * - 如果 useMockData 为 true，使用假数据
   * - 否则调用真实接口
   */
  useEffect(() => {
    if (useMockData) {
      setConfigs(generateMockConfigs());
    } else {
      refreshConfigs();
    }
  }, [useMockData]);

  // ============================================================================
  // 数据操作函数
  // ============================================================================

  /**
   * 刷新配置列表
   * 
   * 【功能说明】
   * - 从后端重新获取所有配置
   * - 用于初始化、用户手动刷新等操作
   * 
   * 【后续对接说明】
   * 后端对接时，此处调用应用服务的 getAllConfigs 方法。
   * 
   * 示例：
   *   const result = await service.getAllConfigs();
   *   const configs = result.configs.map((c) => c.toDto());
   *   setConfigs(configs);
   */
  const refreshConfigs = useCallback(async () => {
    if (useMockData) {
      // Mock 模式：不执行任何操作
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 【后续对接说明】
      // 此处调用应用服务的 getAllConfigs 方法
      // 示例：
      //   const result = await service.getAllConfigs();
      //   const configs = result.configs.map((c) => ({
      //     id: c.id.value,
      //     modelId: c.modelId.value,
      //     apiKey: c.apiKey.value,
      //     baseUrl: c.baseUrl.value,
      //     apiType: c.apiType,
      //     isEnabled: c.isEnabled,
      //   }));
      //   setConfigs(configs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载配置失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [useMockData, service]);

  /**
   * 测试连接
   * 
   * 【功能说明】
   * - 使用给定配置发起测试请求
   * - 返回测试结果（成功/失败/延迟）
   * 
   * 【后续对接说明】
   * 后端对接时，此处调用应用服务的 testConnection 方法。
   * 
   * 示例：
   *   const result = await service.testConnection({
   *     modelId: config.modelId,
   *     apiKey: config.apiKey,
   *     baseUrl: config.baseUrl,
   *     apiType: config.apiType,
   *   });
   *   return result;
   * 
   * @param config - 待测试的配置
   * @returns Promise<TestConnectionResult> - 测试结果
   */
  const testConnection = useCallback(
    async (config: ApiConfigData): Promise<TestConnectionResult> => {
      if (useMockData) {
        // Mock 模式：模拟测试结果
        // 模拟 2 秒延迟后返回成功
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return {
          success: true,
          message: '连接成功',
          latency: Math.floor(Math.random() * 500) + 100, // 随机 100-600ms
        };
      }

      // 【后续对接说明】
      // 此处调用应用服务的 testConnection 方法
      // 示例：
      //   return await service.testConnection({
      //     modelId: config.modelId,
      //     apiKey: config.apiKey,
      //     baseUrl: config.baseUrl,
      //     apiType: config.apiType,
      //   });
      
      return { success: false, message: '后端尚未对接' };
    },
    [useMockData, service]
  );

  /**
   * 保存配置
   * 
   * 【功能说明】
   * - 调用后端接口创建或更新配置
   * - 如果配置有 id 且非临时 ID，执行更新
   * - 否则执行创建
   * 
   * 【后续对接说明】
   * 后端对接时，此处根据情况调用应用服务的 createConfig 或 updateConfig 方法。
   * 
   * 示例：
   *   if (config.id && !config.id.startsWith('mock-')) {
   *     await service.updateConfig({
   *       id: config.id,
   *       modelId: config.modelId,
   *       apiKey: config.apiKey,
   *       baseUrl: config.baseUrl,
   *       apiType: config.apiType,
   *       isEnabled: config.isEnabled,
   *     });
   *   } else {
   *     await service.createConfig({
   *       modelId: config.modelId,
   *       apiKey: config.apiKey,
   *       baseUrl: config.baseUrl,
   *       apiType: config.apiType,
   *     });
   *   }
   *   await refreshConfigs();
   * 
   * @param config - 待保存的配置
   */
  const saveConfig = useCallback(
    async (config: ApiConfigData): Promise<void> => {
      if (useMockData) {
        // Mock 模式：模拟保存
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // 乐观更新本地状态
        setConfigs((prev) =>
          prev.map((c) => (c.id === config.id ? config : c))
        );
        return;
      }

      // 【后续对接说明】
      // 此处根据配置 ID 判断是创建还是更新
      // 示例：
      //   if (config.id && !config.id.startsWith('mock-')) {
      //     await service.updateConfig({
      //       id: config.id,
      //       modelId: config.modelId,
      //       apiKey: config.apiKey,
      //       baseUrl: config.baseUrl,
      //       apiType: config.apiType,
      //       isEnabled: config.isEnabled,
      //     });
      //   } else {
      //     await service.createConfig({
      //       modelId: config.modelId,
      //       apiKey: config.apiKey,
      //       baseUrl: config.baseUrl,
      //       apiType: config.apiType,
      //     });
      //   }
      //   await refreshConfigs();
    },
    [useMockData, service, refreshConfigs]
  );

  /**
   * 删除配置
   * 
   * 【功能说明】
   * - 调用后端接口删除指定配置
   * - 删除成功后更新本地状态
   * 
   * 【后续对接说明】
   * 后端对接时，此处调用应用服务的 deleteConfig 方法。
   * 
   * 示例：
   *   const deleted = await service.deleteConfig(id);
   *   if (deleted) {
   *     setConfigs((prev) => prev.filter((c) => c.id !== id));
   *   }
   * 
   * @param id - 待删除的配置 ID
   */
  const deleteConfig = useCallback(
    async (id: string): Promise<void> => {
      if (useMockData) {
        // Mock 模式：模拟删除
        await new Promise((resolve) => setTimeout(resolve, 500));
        // 乐观更新本地状态
        setConfigs((prev) => prev.filter((c) => c.id !== id));
        return;
      }

      // 【后续对接说明】
      // 此处调用应用服务的 deleteConfig 方法
      // 示例：
      //   const deleted = await service.deleteConfig(id);
      //   if (deleted) {
      //     setConfigs((prev) => prev.filter((c) => c.id !== id));
      //   }
    },
    [useMockData, service]
  );

  // ============================================================================
  // 返回值
  // ============================================================================

  return {
    configs,
    loading,
    error,
    refreshConfigs,
    testConnection,
    saveConfig,
    deleteConfig,
    service,
  };
}
