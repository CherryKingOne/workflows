import { useState, useEffect, useCallback } from 'react';
import { ModelConfigApi, ModelConfig, UpdateConfigRequest, InitConfigRequest } from '@/src/infrastructure/aiModel/api/ModelConfigApi';

const MODEL_CONFIG_CHANGED_EVENT = 'workflow:model-config-changed';

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

  const emitModelConfigChanged = useCallback((changedModelType?: 'image' | 'chat') => {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(new CustomEvent(MODEL_CONFIG_CHANGED_EVENT, {
      detail: { modelType: changedModelType ?? modelType },
    }));
  }, [modelType]);

  /**
   * 加载配置列表
   */
  const loadConfigs = useCallback(async () => {
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
  }, [modelType]);

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
  const updateConfig = useCallback(async (modelId: string, data: UpdateConfigRequest) => {
    setError(null);

    try {
      await ModelConfigApi.updateConfig(modelId, data);
      // 更新成功后刷新列表
      await loadConfigs();
      emitModelConfigChanged(modelType);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update config';
      setError(errorMessage);
      console.error('[useModelConfig] Error updating config:', err);
      throw err;
    }
  }, [emitModelConfigChanged, loadConfigs, modelType]);

  /**
   * 初始化配置（将注册表同步到数据库）
   */
  const initializeConfigs = useCallback(async (configs: InitConfigRequest[]) => {
    try {
      await ModelConfigApi.initConfigs(configs);
      await loadConfigs();
      emitModelConfigChanged(modelType);
    } catch (err) {
      console.error('[useModelConfig] Error initializing configs:', err);
    }
  }, [emitModelConfigChanged, loadConfigs, modelType]);

  /**
   * 刷新配置列表
   */
  const refreshConfigs = useCallback(() => {
    void loadConfigs();
  }, [loadConfigs]);

  // 组件挂载时加载配置
  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  // 监听其他组件触发的配置变更事件，保持多处 UI 同步
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleModelConfigChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ modelType?: 'image' | 'chat' }>;
      const changedType = customEvent.detail?.modelType;
      if (!changedType || !modelType || changedType === modelType) {
        void loadConfigs();
      }
    };

    window.addEventListener(MODEL_CONFIG_CHANGED_EVENT, handleModelConfigChanged);
    return () => {
      window.removeEventListener(MODEL_CONFIG_CHANGED_EVENT, handleModelConfigChanged);
    };
  }, [loadConfigs, modelType]);

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
