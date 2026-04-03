/**
 * ============================================================================
 * API Settings Modal Component
 * ============================================================================
 * 
 * 【展示层 - 组件 / Presentation Layer - Component】
 * 
 * 【职责说明】
 * 本文件实现了 API 设置弹窗组件（ApiSettingsModal）。
 * 
 * 【组件的作用】
 * - 展示和管理用户的 API 配置（模型接口配置）
 * - 支持按类型（Chat/Image/Video）切换查看配置
 * - 支持查看、编辑、测试连接操作
 * - 作为"装配层"，协调 UI 状态与业务逻辑
 * 
 * 【设计意图】
 * - 此组件是展示层，仅负责 UI 展示和用户交互
 * - 业务逻辑（验证、持久化、错误处理）应由应用层处理
 * - 通过 Hook（useApiConfigs）与应用层通信
 * - 不直接调用 Tauri invoke 或 HTTP 请求
 * 
 * 【新手须知】
 * - 此组件通过 props 接收状态和回调函数
 * - 状态管理在 Hook（useApiConfigs）中
 * - 如果需要新增功能，应先在应用层添加用例，再在此处调用
 * - 注释中带有"后续对接说明"的部分是未来后端开发时需要关注的
 * 
 * 【组件结构】
 * 1. Header: 标题和关闭按钮
 * 2. Tabs: 按类型切换（Chat/Image/Video）
 * 3. Content: 配置卡片列表
 * 4. Footer: 关闭按钮
 * 
 * 【后续扩展预留】
 * - 新增配置按钮（目前未实现，需后续添加）
 * - 删除配置按钮（目前未实现，需后续添加）
 * - 启用/禁用切换开关（目前未实现，需后续添加）
 * - 配置拖拽排序（高级功能，可选）
 * - 批量导入/导出（高级功能，可选）
 * 
 * 【文件拆分说明】
 * 当前文件包含完整组件，但后续如果组件变大（>400 行），应拆分为：
 * - ApiSettingsModal.tsx: 主容器和状态管理
 * - ApiConfigCard.tsx: 单个配置卡片组件
 * - ApiTypeTabs.tsx: 类型切换标签
 * - hooks/useApiConfigForm.ts: 表单状态管理 Hook
 */

import { useState, useEffect, useRef } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * API 配置数据类型定义
 * 
 * 【后续对接说明】
 * 此接口应与后端返回的 DTO 格式一致。
 * 当前定义为前端内部使用，后续应从 domain 层导入。
 * 
 * 导入路径示例：
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
 * 测试结果类型
 * 
 * 【后续对接说明】
 * 此类型应与后端返回的测试结果格式一致。
 */
interface TestConnectionResult {
  /** 是否连接成功 */
  success: boolean;
  /** 结果消息（成功时显示成功信息，失败时显示错误原因） */
  message: string;
  /** 响应延迟（毫秒），仅在成功时有值 */
  latency?: number;
}

/**
 * 组件 Props 接口
 * 
 * 【字段说明】
 * - isOpen: 控制弹窗显示/隐藏
 * - onClose: 关闭弹窗的回调函数
 * - configs: API 配置列表
 * - loading: 是否正在加载
 * - onTestConnection: 测试连接的回调函数
 * - onDeleteConfig: 删除配置的回调函数（后续对接）
 * 
 * 【后续对接说明】
 * 这些回调函数应由父组件（CanvasBoard）通过 Hook 提供。
 * 后续对接后端时，Hook 内部会调用应用层的命令用例。
 */
interface ApiSettingsModalProps {
  /** 弹窗是否打开 */
  isOpen: boolean;
  /** 关闭弹窗的回调 */
  onClose: () => void;
  /** API 配置列表 */
  configs: ApiConfigData[];
  /** 是否正在加载 */
  loading: boolean;
  /** 测试连接的回调函数 */
  onTestConnection: (config: ApiConfigData) => Promise<TestConnectionResult>;
  /** 删除配置的回调函数（后续对接后端时使用） */
  onDeleteConfig?: (id: string) => Promise<void>;
}

// ============================================================================
// 主组件
// ============================================================================

/**
 * API 设置弹窗组件
 * 
 * 【页面职责】
 * 1. 展示 API 配置列表（按类型分组）
 * 2. 支持 Tab 切换查看不同类型配置
 * 3. 支持编辑配置字段
 * 4. 支持测试连接
 * 5. 管理本地编辑状态
 * 
 * 【后续对接说明】
 * 当前组件仅实现前端展示和交互逻辑，后端对接需要：
 * 
 * 1. 数据加载：
 *    - 当前：configs 通过 props 传入（假数据或父组件提供）
 *    - 后续：通过 Hook 调用应用层的 GetApiConfigsQuery 获取
 * 
 * 2. 保存配置：
 *    - 当前：onSaveConfig 通过 props 传入（可能未实现）
 *    - 后续：通过 Hook 调用应用层的 CreateApiConfigCommand 或 UpdateApiConfigCommand
 * 
 * 3. 删除配置：
 *    - 当前：onDeleteConfig 通过 props 传入（可能未实现）
 *    - 后续：通过 Hook 调用应用层的 DeleteApiConfigCommand
 * 
 * 4. 测试连接：
 *    - 当前：onTestConnection 通过 props 传入
 *    - 后续：通过 Hook 调用应用层的 TestConnectionCommand
 * 
 * 【后端接口需求】
 * 后端需要提供以下 Tauri 命令（命令名仅为示例，可协商）：
 * 
 * - get_api_configs: 获取所有配置列表
 *   输入：无（或可选 filterType）
 *   输出：ApiConfigData[]
 * 
 * - create_api_config: 创建新配置
 *   输入：{ modelId, apiKey, baseUrl, apiType }
 *   输出：ApiConfigData（含生成的 id）
 * 
 * - update_api_config: 更新配置
 *   输入：{ id, modelId, apiKey, baseUrl, apiType, isEnabled }
 *   输出：ApiConfigData
 * 
 * - delete_api_config: 删除配置
 *   输入：{ id }
 *   输出：boolean（是否成功）
 * 
 * - test_api_connection: 测试连接
 *   输入：{ modelId, apiKey, baseUrl, apiType }
 *   输出：{ success, message, latency? }
 * 
 * 【数据库表设计建议】
 * 后端开发人员可参考以下表结构：
 * 
 * ```sql
 * CREATE TABLE api_configs (
 *   id TEXT PRIMARY KEY,           -- 配置唯一标识（UUID）
 *   model_id TEXT NOT NULL,        -- 模型标识
 *   api_key TEXT,                  -- API 密钥（应加密存储）
 *   base_url TEXT NOT NULL,        -- 基础 URL
 *   api_type TEXT NOT NULL,        -- API 类型（Chat/Image/Video）
 *   is_enabled INTEGER NOT NULL,   -- 是否启用（0 或 1）
 *   created_at TEXT NOT NULL,      -- 创建时间
 *   updated_at TEXT NOT NULL       -- 更新时间
 * );
 * ```
 */
export function ApiSettingsModal({
  isOpen,
  onClose,
  configs,
  loading,
  onTestConnection,
  onDeleteConfig,
}: ApiSettingsModalProps) {
  // ============================================================================
  // 状态管理
  // ============================================================================

  /**
   * 当前激活的 Tab 类型
   * 
   * 【状态说明】
   * - 用于控制显示哪种类型的配置
   * - 默认为 'Chat'
   * - 切换 Tab 时会过滤显示对应配置
   */
  const [activeTab, setActiveTab] = useState<'Chat' | 'Image' | 'Video'>('Chat');

  /**
   * 本地编辑状态
   * 
   * 【状态说明】
   * - 用于跟踪用户正在编辑的配置
   * - key 为配置 ID，value 为编辑中的配置数据
   * - 与原始 configs 分离，避免直接修改原数据
   * 
   * 【后续对接说明】
   * 当用户点击"保存"时，应将 editingConfigs[id] 发送给后端。
   * 如果后端保存成功，更新原始 configs；如果失败，保留编辑状态并显示错误。
   */
  const [editingConfigs, setEditingConfigs] = useState<Record<string, ApiConfigData>>({});

  /**
   * 测试连接成功状态（持久）
   *
   * 【状态说明】
   * - key 为配置 ID，value 表示是否测试成功过
   * - 用于控制绿色指示灯，测试成功后一直保持，不会消失
   */
  const [testSuccessIds, setTestSuccessIds] = useState<Record<string, boolean>>({});

  /**
   * 测试连接提示消息（临时）
   *
   * 【状态说明】
   * - key 为配置 ID，value 为提示消息和延迟时间
   * - 用于显示"连接成功 (XXms)"或错误消息
   * - 成功时5秒后自动消失，失败时保持显示
   */
  const [testResultMessages, setTestResultMessages] = useState<Record<string, { message: string; latency?: number } | null>>({});

  /**
   * 错误状态
   * 
   * 【状态说明】
   * - key 为配置 ID，value 为错误消息
   * - 用于显示保存或测试时的错误信息
   * 
   * 【后续对接说明】
   * 错误消息应从后端返回的 error 中提取。
   */
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * 测试结果自动清除定时器
   * 
   * 【状态说明】
   * - 用于存储每个配置的自动清除定时器 ID
   * - 测试成功后 5 秒自动清除结果
   * - 组件卸载或重新测试时会清除旧的定时器
   */
  const autoClearTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  // ============================================================================
  // 副作用
  // ============================================================================

  /**
   * 组件卸载时清理所有自动清除定时器
   * 
   * 【功能说明】
   * - 防止组件卸载后定时器仍然执行导致内存泄漏或错误
   */
  useEffect(() => {
    return () => {
      // 清理所有定时器
      Object.values(autoClearTimersRef.current).forEach((timer) => clearTimeout(timer));
      autoClearTimersRef.current = {};
    };
  }, []);

  /**
   * 监听 Esc 键和点击外部关闭
   * 
   * 【功能说明】
   * - 当用户按下 Esc 键时关闭弹窗
   * - 当用户点击弹窗外部区域时关闭弹窗
   * 
   * 【后续对接说明】
   * 如果后续需要在关闭前确认（如有未保存的更改），
   * 应在此处添加确认逻辑或提示。
   */
  useEffect(() => {
    if (!isOpen) return;

    // 监听 Esc 键
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

  /**
   * 弹窗打开时初始化编辑状态
   * 
   * 【功能说明】
   * - 当弹窗打开或 configs 变化时，将原始数据复制到编辑状态
   * - 确保用户编辑的是副本，不影响原始数据
   */
  useEffect(() => {
    if (isOpen && configs.length > 0) {
      const initialEditingState: Record<string, ApiConfigData> = {};
      configs.forEach((config) => {
        initialEditingState[config.id] = { ...config };
      });
      setEditingConfigs(initialEditingState);
    }
  }, [isOpen, configs]);

  // ============================================================================
  // 事件处理函数
  // ============================================================================

  /**
   * 更新编辑中的配置字段
   * 
   * 【功能说明】
   * 当用户在输入框中修改字段时，更新本地编辑状态。
   * 
   * 【参数说明】
   * - configId: 配置 ID
   * - field: 要更新的字段名（modelId、apiKey、baseUrl）
   * - value: 新值
   * 
   * 【后续对接说明】
   * 此函数仅更新本地编辑状态，不会触发保存。
   * 用户需要点击"保存"按钮才会调用后端接口。
   */
  const handleFieldChange = (configId: string, field: keyof ApiConfigData, value: string) => {
    setEditingConfigs((prev) => ({
      ...prev,
      [configId]: {
        ...prev[configId],
        [field]: value,
      },
    }));
    // 清除该配置的错误信息
    setErrors((prev) => ({ ...prev, [configId]: '' }));
  };

  /**
   * 测试连接
   * 
   * 【功能说明】
   * 调用后端接口测试当前编辑中的配置是否可以正常连接。
   * 
   * 【业务流程】
   * 1. 设置测试状态为"加载中"
   * 2. 调用后端的测试连接接口
   * 3. 更新测试结果状态
   * 4. 如果失败，显示错误消息
   * 
   * 【后续对接说明】
   * 后端对接时需要：
   * - 调用 Tauri 命令：test_api_connection
   * - 传入当前编辑中的配置（modelId, apiKey, baseUrl, apiType）
   * - 后端应发起真实的 HTTP 请求验证连接
   * - 返回结果包含 success、message 和可选的 latency
   * 
   * 【后端实现建议】
   * 后端测试连接的逻辑应为：
   * 1. 使用传入的配置构建 HTTP 客户端
   * 2. 发起一个简单的请求（如 GET /v1/models 或健康检查端点）
   * 3. 记录响应时间
   * 4. 返回成功或失败结果
   */
  const handleTestConnection = async (configId: string) => {
    const config = editingConfigs[configId];
    if (!config) return;

    // 清除该配置的旧自动清除定时器
    if (autoClearTimersRef.current[configId]) {
      clearTimeout(autoClearTimersRef.current[configId]);
      delete autoClearTimersRef.current[configId];
    }

    // 设置测试状态
    setTestResultMessages((prev) => ({ ...prev, [configId]: null }));
    setErrors((prev) => ({ ...prev, [configId]: '' }));

    try {
      // 【后续对接说明】
      // 此处应调用后端的测试连接接口
      // 当前：通过 props 传入的 onTestConnection 回调
      // 后续：通过 Hook 调用应用层的 TestConnectionCommand
      //
      // 示例（后续实现）：
      //   const result = await testConnection({
      //     modelId: config.modelId,
      //     apiKey: config.apiKey,
      //     baseUrl: config.baseUrl,
      //     apiType: config.apiType,
      //   });
      //
      // 后端 Tauri 命令示例（Rust）：
      //   #[tauri::command]
      //   async fn test_api_connection(
      //     model_id: String,
      //     api_key: String,
      //     base_url: String,
      //     api_type: String,
      //   ) -> Result<TestConnectionResult, String> {
      //     // 1. 构建 HTTP 客户端
      //     // 2. 发起测试请求
      //     // 3. 返回结果
      //   }

      const result = await onTestConnection(config);

      // 更新测试成功状态（持久）
      if (result.success) {
        setTestSuccessIds((prev) => ({ ...prev, [configId]: true }));
        // 更新提示消息（5秒后消失）
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
        // 测试失败，显示错误并保持显示
        setErrors((prev) => ({ ...prev, [configId]: result.message }));
      }
    } catch (error) {
      // 处理异常情况
      const errorMessage = error instanceof Error ? error.message : '测试连接失败';
      setErrors((prev) => ({ ...prev, [configId]: errorMessage }));
    }
  };

  // ============================================================================
  // 渲染逻辑
  // ============================================================================

  /**
   * 如果弹窗未打开，不渲染任何内容
   */
  if (!isOpen) return null;

  /**
   * 按类型过滤配置
   * 
   * 【过滤逻辑】
   * - 根据 activeTab 显示对应类型的配置
   * - 如果某类型无配置，显示空状态提示
   */
  const filteredConfigs = configs.filter((config) => config.apiType === activeTab);

  // 渲染配置卡片
  const renderConfigCards = () => {
    // 加载中状态
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-400">加载中...</div>
        </div>
      );
    }

    // 空状态
    if (filteredConfigs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            fill="none"
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
          <p className="text-sm">暂无 {activeTab} 类型的配置</p>
          {/* 
            【后续扩展预留】
            此处可添加"新增配置"按钮，点击后创建空白配置卡片。
            示例：
            <button
              onClick={handleAddConfig}
              className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
            >
              + 新增配置
            </button>
          */}
        </div>
      );
    }

    // 渲染配置卡片列表
    return filteredConfigs.map((config) => {
      const editingConfig = editingConfigs[config.id] || config;
      const isSuccess = testSuccessIds[config.id];
      const resultMessage = testResultMessages[config.id];
      const error = errors[config.id];

      return (
        <div
          key={config.id}
          className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 flex flex-col gap-5"
        >
          {/* 卡片 Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              {/* 状态指示灯 - 测试成功后一直保持绿色 */}
              <div
                className={`w-2 h-2 rounded-full ${
                  isSuccess ? 'bg-green-500' : 'bg-zinc-500'
                }`}
              />
              <span className="text-zinc-200 font-medium text-[15px]">
                {editingConfig.modelId || '未命名模型'}
              </span>
            </div>
            {/* 类型标签 */}
            <span className="bg-blue-500/20 text-blue-400 text-[12px] px-2.5 py-0.5 rounded-md font-medium">
              {activeTab}
            </span>
          </div>

          {/* 表单字段 */}
          <div className="grid grid-cols-[80px_1fr] items-center gap-y-3.5">
            {/* Model ID */}
            <label className="text-[12px] text-zinc-500 text-right pr-4">MODEL ID</label>
            <input
              type="text"
              value={editingConfig.modelId}
              onChange={(e) => handleFieldChange(config.id, 'modelId', e.target.value)}
              className="w-full bg-[#111111] border border-white/10 rounded-lg px-3 py-2 text-[14px] text-zinc-300 outline-none focus:border-white/20 transition-colors"
              placeholder="例如：gpt-5.4"
            />

            {/* API Key */}
            <label className="text-[12px] text-zinc-500 text-right pr-4">API KEY</label>
            <div className="relative w-full">
              <input
                type="text"
                value={editingConfig.apiKey}
                onChange={(e) => handleFieldChange(config.id, 'apiKey', e.target.value)}
                placeholder="sk-..."
                className="w-full bg-[#111111] border border-white/10 rounded-lg pl-3 pr-10 py-2 text-[14px] text-zinc-500 placeholder-zinc-600 outline-none focus:border-white/20 transition-colors"
              />
              {/* 显示按钮 */}
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                title="查看"
              >
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
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
            </div>

            {/* Base URL */}
            <label className="text-[12px] text-zinc-500 text-right pr-4">BASE URL</label>
            <input
              type="text"
              value={editingConfig.baseUrl}
              onChange={(e) => handleFieldChange(config.id, 'baseUrl', e.target.value)}
              className="w-full bg-[#111111] border border-white/10 rounded-lg px-3 py-2 text-[14px] text-zinc-300 outline-none focus:border-white/20 transition-colors"
              placeholder="例如：https://api.openai.com"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="text-red-400 text-[12px] px-1">{error}</div>
          )}

          {/* 测试成功提示消息 - 5秒后自动消失 */}
          {resultMessage && (
            <div
              className="text-[12px] px-1 text-green-400 flex items-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                {resultMessage.message}
                {resultMessage.latency && ` (${resultMessage.latency}ms)`}
              </span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end pt-1">
            {/* 测试连接按钮 */}
            <button
              onClick={() => handleTestConnection(config.id)}
              className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <span>测试连接</span>
            </button>

            {/*
              【后续扩展预留】
              删除配置按钮
              
              后续实现时取消注释，并添加 handleDeleteConfig 函数。
              
              示例：
              <button
                onClick={() => handleDeleteConfig(config.id)}
                className="flex items-center gap-1.5 text-[13px] text-red-400 hover:text-red-300 transition-colors"
              >
                <svg ...>删除图标</svg>
                <span>删除</span>
              </button>
            */}
          </div>
        </div>
      );
    });
  };

  // ============================================================================
  // 主渲染
  // ============================================================================

  return (
    // 使用 Portal 渲染到 body，避免被父元素的样式影响
    // 【后续优化建议】
    // 可以使用 createPortal 将弹窗渲染到 document.body
    // 这样弹窗的 z-index 和定位不会受父元素影响
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fixed-ui">
      {/* 点击背景关闭 */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* 弹窗主容器 */}
      <div className="w-full max-w-[800px] h-[85vh] max-h-[850px] bg-[#111111] border border-white/10 rounded-xl shadow-[0_20px_50px_rgb(0,0,0,0.7)] flex flex-col overflow-hidden relative z-10">
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

        {/* 导航 Tabs */}
        <div className="flex px-6 border-b border-white/10 text-[14px] select-none">
          {(['Chat', 'Image', 'Video'] as const).map((tab) => {
            // 计算每种类型的配置数量
            const count = configs.filter((c) => c.apiType === tab).length;
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-3 relative top-[1px] transition-colors ${
                  isActive
                    ? 'text-blue-400 border-b-2 border-blue-500'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{tab}</span>
                {/* 配置数量徽章 */}
                <span
                  className={`px-1.5 py-0.5 rounded text-[12px] font-medium ${
                    isActive ? 'bg-white/5 text-blue-300' : 'bg-white/5 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 内部可滚动内容区 */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {renderConfigCards()}
        </div>

        {/* 底部 Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#111111] flex justify-end shrink-0 relative z-10 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)]">
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
