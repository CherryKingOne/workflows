import { useState } from 'react';
import { ModelConfig } from '@/src/infrastructure/aiModel/api/ModelConfigApi';

interface ModelConfigCardProps {
  config: ModelConfig;
  onUpdate: (modelId: string, data: {
    model_name?: string;
    base_url?: string;
    api_key?: string;
    enabled?: boolean;
  }) => Promise<void>;
  onTest?: (config: ModelConfig) => Promise<{ success: boolean; message: string; latency?: number }>;
}

/**
 * 模型配置卡片组件
 * 用于展示和编辑单个模型的配置信息
 */
export function ModelConfigCard({ config, onUpdate, onTest }: ModelConfigCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // 编辑状态
  const [editedConfig, setEditedConfig] = useState({
    model_name: config.model_name,
    base_url: config.base_url,
    api_key: config.api_key,
    enabled: config.enabled,
  });

  const handleAutoSave = async () => {
    try {
      await onUpdate(config.model_id, editedConfig);
      setTestResult({ success: true, message: '已自动保存' });
      setTimeout(() => setTestResult(null), 2000);
    } catch (error) {
      setTestResult({ success: false, message: '保存失败: ' + (error as Error).message });
    }
  };

  const handleClose = () => {
    setIsEditing(false);
  };

  const handleTest = async () => {
    if (!onTest) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await onTest(config);
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: '测试失败: ' + (error as Error).message });
    } finally {
      setIsTesting(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '***';
    return key.substring(0, 4) + '***' + key.substring(key.length - 4);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      {/* 头部：模型名称和状态 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">{config.model_name}</h3>
          <span className={`px-2 py-1 text-xs rounded-full ${
            config.enabled
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {config.enabled ? '已启用' : '已禁用'}
          </span>
          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
            {config.model_type === 'image' ? '图像' : '对话'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
              >
                {isTesting ? '测试中...' : '测试连接'}
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                编辑
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              关闭
            </button>
          )}
        </div>
      </div>

      {/* 配置信息 */}
      <div className="space-y-3">
        {/* Model ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            模型 ID
          </label>
          <input
            type="text"
            value={config.model_id}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>

        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Base URL
          </label>
          <input
            type="text"
            value={isEditing ? editedConfig.base_url : config.base_url}
            onChange={(e) => setEditedConfig({ ...editedConfig, base_url: e.target.value })}
            onBlur={handleAutoSave}
            disabled={!isEditing}
            className={`w-full px-3 py-2 border rounded-md ${
              isEditing
                ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                : 'border-gray-200 bg-gray-50'
            }`}
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={isEditing ? editedConfig.api_key : config.api_key}
              onChange={(e) => setEditedConfig({ ...editedConfig, api_key: e.target.value })}
              onBlur={handleAutoSave}
              disabled={!isEditing}
              className={`w-full px-3 py-2 pr-20 border rounded-md ${
                isEditing
                  ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  : 'border-gray-200 bg-gray-50'
              }`}
              placeholder={!isEditing && !showApiKey ? maskApiKey(config.api_key) : ''}
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
            >
              {showApiKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        {/* 启用状态 */}
        {isEditing && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`enabled-${config.model_id}`}
              checked={editedConfig.enabled}
              onChange={(e) => {
                setEditedConfig({ ...editedConfig, enabled: e.target.checked });
                handleAutoSave();
              }}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor={`enabled-${config.model_id}`} className="text-sm text-gray-700">
              启用此模型
            </label>
          </div>
        )}
      </div>

      {/* 测试结果 */}
      {testResult && (
        <div className={`mt-3 p-3 rounded-md ${
          testResult.success
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-sm ${
            testResult.success ? 'text-green-700' : 'text-red-700'
          }`}>
            {testResult.message}
          </p>
        </div>
      )}
    </div>
  );
}
