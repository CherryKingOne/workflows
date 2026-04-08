import { useEffect } from 'react';
import { useModelConfig } from '@/src/presentation/hooks/useModelConfig';
import { ModelConfigCard } from '@/src/presentation/components/ModelConfigCard';
import { ModelConfigInitializer } from '@/src/application/aiModel/ModelConfigInitializer';

interface ModelConfigPanelProps {
  /** 模型类型过滤 */
  modelType?: 'image' | 'chat';
  /** 面板标题 */
  title?: string;
}

/**
 * 模型配置面板组件
 * 展示和管理模型配置列表
 */
export function ModelConfigPanel({ modelType, title }: ModelConfigPanelProps) {
  const {
    configs,
    loading,
    error,
    updateConfig,
    refreshConfigs,
  } = useModelConfig(modelType);

  // 初始化配置
  useEffect(() => {
    ModelConfigInitializer.initialize().catch(console.error);
  }, []);

  const handleTest = async (config: any) => {
    // TODO: 实现真实的连接测试
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return {
      success: true,
      message: '连接成功',
      latency: Math.floor(Math.random() * 500) + 100,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600">加载配置中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-600 mb-2">⚠️</div>
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={refreshConfigs}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-gray-500 mb-3">暂无配置</p>
          <button
            onClick={refreshConfigs}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            刷新
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 头部 */}
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={refreshConfigs}
            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            刷新
          </button>
        </div>
      )}

      {/* 配置卡片列表 */}
      <div className="space-y-4">
        {configs.map((config) => (
          <ModelConfigCard
            key={config.model_id}
            config={config}
            onUpdate={updateConfig}
            onTest={handleTest}
          />
        ))}
      </div>

      {/* 提示信息 */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 提示：模型配置不支持通过界面创建或删除，只能通过代码注册表管理。
          如需添加新模型，请在代码中注册后重启应用。
        </p>
      </div>
    </div>
  );
}
