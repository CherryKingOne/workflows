import { useState, useEffect, useRef } from 'react';
import { useModelConfig } from '@/src/presentation/hooks/useModelConfig';
import { ModelConfigInitializer } from '@/src/application/aiModel/ModelConfigInitializer';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TestConnectionResult {
  success: boolean;
  message: string;
  latency?: number;
}

/**
 * API 设置弹窗组件（使用真实 SQLite 数据）
 *
 * 功能：
 * - 支持 Image 和 Chat 两种类型的模型配置
 * - 通过 Tab 切换查看不同类型
 * - 数据来自 SQLite（通过 Tauri Commands）
 * - 保留原有 UI 设计和交互逻辑
 */
export function ApiSettingsModal({ isOpen, onClose }: ApiSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'chat'>('image');

  const {
    configs,
    loading,
    error,
    updateConfig,
    refreshConfigs,
  } = useModelConfig(activeTab);

  // 本地编辑状态
  const [editingConfigs, setEditingConfigs] = useState<Record<string, any>>({});

  // API Key 显示/隐藏状态
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  // 测试连接成功状态（持久）
  const [testSuccessIds, setTestSuccessIds] = useState<Record<string, boolean>>({});

  // 测试连接提示消息（临时）
  const [testResultMessages, setTestResultMessages] = useState<Record<string, { message: string; latency?: number } | null>>({});

  // 错误状态
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 测试结果自动清除定时器
  const autoClearTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  // 初始化配置
  useEffect(() => {
    if (isOpen) {
      ModelConfigInitializer.initialize().catch(console.error);
    }
  }, [isOpen]);

  // 组件卸载时清理所有自动清除定时器
  useEffect(() => {
    return () => {
      Object.values(autoClearTimersRef.current).forEach((timer) => clearTimeout(timer));
      autoClearTimersRef.current = {};
    };
  }, []);

  // 监听 Esc 键关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // 弹窗打开时初始化编辑状态
  useEffect(() => {
    if (isOpen && configs.length > 0) {
      const initialEditingState: Record<string, any> = {};
      configs.forEach((config) => {
        initialEditingState[config.model_id] = { ...config };
      });
      setEditingConfigs(initialEditingState);
    }
  }, [isOpen, configs]);

  // 更新编辑中的配置字段并自动保存
  const handleFieldChange = async (configId: string, field: string, value: string) => {
    setEditingConfigs((prev) => ({
      ...prev,
      [configId]: {
        ...prev[configId],
        [field]: value,
      },
    }));
    setErrors((prev) => ({ ...prev, [configId]: '' }));
  };

  // 自动保存配置
  const handleAutoSave = async (configId: string) => {
    const config = editingConfigs[configId];
    if (!config) return;

    setErrors((prev) => ({ ...prev, [configId]: '' }));

    try {
      await updateConfig(configId, {
        base_url: config.base_url,
        api_key: config.api_key,
        enabled: config.enabled,
      });

      // 保存成功后刷新列表
      await refreshConfigs();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保存失败';
      setErrors((prev) => ({ ...prev, [configId]: errorMessage }));
    }
  };

  // 测试连接
  const handleTestConnection = async (configId: string) => {
    const config = editingConfigs[configId];
    if (!config) return;

    // 清除该配置的旧自动清除定时器
    if (autoClearTimersRef.current[configId]) {
      clearTimeout(autoClearTimersRef.current[configId]);
      delete autoClearTimersRef.current[configId];
    }

    setTestResultMessages((prev) => ({ ...prev, [configId]: null }));
    setErrors((prev) => ({ ...prev, [configId]: '' }));

    try {
      // TODO: 实现真实的连接测试
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const result: TestConnectionResult = {
        success: true,
        message: '连接成功',
        latency: Math.floor(Math.random() * 500) + 100,
      };

      if (result.success) {
        setTestSuccessIds((prev) => ({ ...prev, [configId]: true }));
        setTestResultMessages((prev) => ({
          ...prev,
          [configId]: { message: result.message, latency: result.latency },
        }));

        // 5秒后自动清除提示消息
        const timer = setTimeout(() => {
          setTestResultMessages((prev) => ({ ...prev, [configId]: null }));
          delete autoClearTimersRef.current[configId];
        }, 5000);

        autoClearTimersRef.current[configId] = timer;
      } else {
        setErrors((prev) => ({ ...prev, [configId]: result.message }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '测试失败';
      setErrors((prev) => ({ ...prev, [configId]: errorMessage }));
    }
  };

  if (!isOpen) return null;

  // 渲染配置卡片列表
  const renderConfigCards = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-zinc-400">加载配置中...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-red-600 mb-2">⚠️</div>
            <p className="text-sm text-red-400 mb-3">{error}</p>
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
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mb-4 opacity-50"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <p className="text-sm">暂无 {activeTab === 'image' ? 'Image' : 'Chat'} 类型的配置</p>
        </div>
      );
    }

    return configs.map((config) => {
      const editingConfig = editingConfigs[config.model_id] || config;
      const isSuccess = testSuccessIds[config.model_id];
      const resultMessage = testResultMessages[config.model_id];
      const configError = errors[config.model_id];

      return (
        <div
          key={config.model_id}
          className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 flex flex-col gap-5"
        >
          {/* 卡片 Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              {/* 状态指示灯 */}
              <div
                className={`w-2 h-2 rounded-full ${
                  isSuccess ? 'bg-green-500' : 'bg-zinc-500'
                }`}
              />
              <span className="text-zinc-200 font-medium text-[15px]">
                {config.model_name || '未命名模型'}
              </span>
            </div>
            {/* 类型标签 */}
            <span className="bg-blue-500/20 text-blue-400 text-[12px] px-2.5 py-0.5 rounded-md font-medium">
              {activeTab === 'image' ? 'Image' : 'Chat'}
            </span>
          </div>

          {/* 表单字段 */}
          <div className="grid grid-cols-[80px_1fr] items-center gap-y-3.5">
            {/* Model ID */}
            <label className="text-[12px] text-zinc-500 text-right pr-4">MODEL ID</label>
            <input
              type="text"
              value={config.model_id}
              disabled
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-[14px] text-zinc-500 outline-none cursor-not-allowed"
            />

            {/* API Key */}
            <label className="text-[12px] text-zinc-500 text-right pr-4">API KEY</label>
            <div className="relative w-full">
              <input
                type={showApiKeys[config.model_id] ? 'text' : 'password'}
                value={editingConfig.api_key || ''}
                onChange={(e) => handleFieldChange(config.model_id, 'api_key', e.target.value)}
                onBlur={() => handleAutoSave(config.model_id)}
                placeholder="sk-..."
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-3 pr-10 py-2 text-[14px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-white/20 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowApiKeys(prev => ({ ...prev, [config.model_id]: !prev[config.model_id] }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showApiKeys[config.model_id] ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Base URL */}
            <label className="text-[12px] text-zinc-500 text-right pr-4">BASE URL</label>
            <input
              type="text"
              value={editingConfig.base_url || ''}
              onChange={(e) => handleFieldChange(config.model_id, 'base_url', e.target.value)}
              onBlur={() => handleAutoSave(config.model_id)}
              placeholder="https://api.example.com"
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-[14px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* 测试结果提示 */}
          {resultMessage && (
            <div className="flex items-center gap-2 text-[13px] text-green-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>
                {resultMessage.message}
                {resultMessage.latency && ` (${resultMessage.latency}ms)`}
              </span>
            </div>
          )}

          {/* 错误提示 */}
          {configError && (
            <div className="flex items-center gap-2 text-[13px] text-red-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span>{configError}</span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2.5 pt-2">
            <button
              onClick={() => handleTestConnection(config.model_id)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[13px] py-2 rounded-lg transition-colors"
            >
              测试连接
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fixed-ui">
      {/* 点击背景关闭 */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* 弹窗主容器 */}
      <div className="w-full max-w-[800px] h-[85vh] max-h-[850px] bg-[#0a0a0a] border border-white/10 rounded-xl shadow-[0_20px_50px_rgb(0,0,0,0.7)] flex flex-col overflow-hidden relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-[18px]">
          <h2 className="text-[16px] font-medium text-zinc-100 tracking-wide">模型接口配置</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="关闭"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 类型栏 */}
        <div className="flex px-6 border-b border-white/10 text-[14px] select-none">
          <button
            onClick={() => setActiveTab('image')}
            className={`px-4 py-3 relative top-[1px] ${
              activeTab === 'image'
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span>Image</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-3 relative top-[1px] ${
              activeTab === 'chat'
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span>Chat</span>
          </button>
        </div>

        {/* 内部可滚动内容区 */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {renderConfigCards()}
        </div>

        {/* 底部 Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0a0a0a] flex justify-end shrink-0 relative z-10 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)]">
          <button
            onClick={onClose}
            className="bg-[#0a0a0a] hover:bg-white/10 text-zinc-200 px-6 py-2 rounded-md text-[14px] font-medium transition-colors border border-white/10"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
