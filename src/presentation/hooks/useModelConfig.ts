import { useState, useEffect } from 'react';
import { ModelConfigApi, ModelConfig, UpdateConfigRequest, InitConfigRequest } from '@/src/infrastructure/aiModel/api/ModelConfigApi';

/**
 * 模型配置管理 Hook
 * 通过 Tauri Commands 调用 Rust 后端
 *
 * 使用示例：
 * ```tsx
 * const { configs, loading, error, updateConfig, refreshConfigs } = useModelConfig('image');
 *
 * const handleUpdate = async (modelId: string) => {
 *   await updateConfig(modelId, {
 *     apiKey: 'new-key',
 *     enabled: true
 *   });
 * };
 * ```
 */
export const useModelConfig = (modelType?: 'image' | 'chat') => {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载配置列表
   */
  const loadConfigs = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await ModelConfigApi.getAllConfigs(modelType);
      setConfigs(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load configs';
      setError(errorMessage);
      console.error('[useModelConfig] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取单个模型配置
   */
  const getConfig = async (modelId: string): Promise<ModelConfig | null> => {
    try {
      return await ModelConfigApi.getConfig(modelId);
    } catch (err) {
      console.error('[useModelConfig] Error getting config:', err);
      return null;
    }
  };

  /**
   * 更新模型配置
   */
  const updateConfig = async (modelId: string, data: UpdateConfigRequest) => {
    setError(null);

    try {
      await ModelConfigApi.updateConfig(modelId, data);
      // 更新成功后刷新列表
      await loadConfigs();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update config';
      setError(errorMessage);
      console.error('[useModelConfig] Error updating config:', err);
      throw err;
    }
  };

  /**
   * 初始化配置（将注册表同步到数据库）
   */
  const initializeConfigs = async (configs: InitConfigRequest[]) => {
    try {
      await ModelConfigApi.initConfigs(configs);
      await loadConfigs();
    } catch (err) {
      console.error('[useModelConfig] Error initializing configs:', err);
    }
  };

  /**
   * 刷新配置列表
   */
  const refreshConfigs = () => {
    loadConfigs();
  };

  // 组件挂载时加载配置
  useEffect(() => {
    loadConfigs();
  }, [modelType]);

  return {
    configs,
    loading,
    error,
    getConfig,
    updateConfig,
    initializeConfigs,
    refreshConfigs,
  };
};
