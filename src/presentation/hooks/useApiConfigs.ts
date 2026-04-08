import { useState, useCallback, useEffect } from 'react';
import { useModelConfig } from './useModelConfig';
import { ModelConfig } from '@/src/infrastructure/aiModel/api/ModelConfigApi';

/**
 * API 配置数据接口（前端展示用）
 */
interface ApiConfigData {
  id: string;
  modelId: string;
  apiKey: string;
  baseUrl: string;
  apiType: 'Chat' | 'Image';
  isEnabled: boolean;
}

/**
 * 测试结果接口
 */
interface TestConnectionResult {
  success: boolean;
  message: string;
  latency?: number;
}

/**
 * Hook 返回值接口
 */
interface UseApiConfigsReturn {
  configs: ApiConfigData[];
  loading: boolean;
  error: string | null;
  refreshConfigs: () => Promise<void>;
  testConnection: (config: ApiConfigData) => Promise<TestConnectionResult>;
  saveConfig: (config: ApiConfigData) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
}

/**
 * 将 ModelConfig 转换为 ApiConfigData
 */
function modelConfigToApiConfig(config: ModelConfig): ApiConfigData {
  return {
    id: config.model_id,
    modelId: config.model_id,
    apiKey: config.api_key,
    baseUrl: config.base_url,
    apiType: config.model_type === 'image' ? 'Image' : 'Chat',
    isEnabled: config.enabled,
  };
}

/**
 * API 配置管理 Hook（真实数据版本）
 *
 * 使用 Tauri 后端的模型配置系统
 *
 * @param apiType - API 类型过滤（'Image' | 'Chat'）
 */
export function useApiConfigs(apiType?: 'Image' | 'Chat'): UseApiConfigsReturn {
  const modelType = apiType === 'Image' ? 'image' : apiType === 'Chat' ? 'chat' : undefined;

  const {
    configs: modelConfigs,
    loading,
    error,
    updateConfig,
    refreshConfigs: refresh,
  } = useModelConfig(modelType);

  const [configs, setConfigs] = useState<ApiConfigData[]>([]);

  // 转换 ModelConfig 到 ApiConfigData
  useEffect(() => {
    const apiConfigs = modelConfigs.map(modelConfigToApiConfig);
    setConfigs(apiConfigs);
  }, [modelConfigs]);

  /**
   * 刷新配置列表
   */
  const refreshConfigs = useCallback(async () => {
    await refresh();
  }, [refresh]);

  /**
   * 测试连接
   * TODO: 实现真实的连接测试逻辑
   */
  const testConnection = useCallback(
    async (config: ApiConfigData): Promise<TestConnectionResult> => {
      // 模拟测试（后续可以调用真实的测试接口）
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return {
        success: true,
        message: '连接成功',
        latency: Math.floor(Math.random() * 500) + 100,
      };
    },
    []
  );

  /**
   * 保存配置
   */
  const saveConfig = useCallback(
    async (config: ApiConfigData): Promise<void> => {
      await updateConfig(config.id, {
        model_name: config.modelId,
        base_url: config.baseUrl,
        api_key: config.apiKey,
        enabled: config.isEnabled,
      });
    },
    [updateConfig]
  );

  /**
   * 删除配置
   * 注意：根据设计，模型配置不支持通过接口删除
   * 只能通过代码注册表管理
   */
  const deleteConfig = useCallback(
    async (id: string): Promise<void> => {
      throw new Error('模型配置不支持删除，请通过代码注册表管理');
    },
    []
  );

  return {
    configs,
    loading,
    error,
    refreshConfigs,
    testConnection,
    saveConfig,
    deleteConfig,
  };
}
