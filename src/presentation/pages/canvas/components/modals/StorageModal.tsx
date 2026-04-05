/**
 * ============================================================================
 * Storage Management Modal Component
 * ============================================================================
 *
 * 【展示层 - 组件 / Presentation Layer - Component】
 *
 * 【职责说明】
 * 本文件实现了本地存储管理弹窗组件（StorageModal）。
 *
 * 【组件的作用】
 * - 管理用户的本地存储配置，包括：
 *   1. 下载目录设置：控制文件下载的默认目录
 *   2. 资源缓存目录：控制 AI 生成/远程下载素材的缓存位置
 *   3. 工作流自动保存：控制画布内容的自动保存策略
 *   4. 七牛云对象存储：控制云端存储接入配置（前端草稿态）
 *
 * 【设计意图】
 * - 此组件是展示层，仅负责 UI 展示和用户交互
 * - 业务逻辑（目录选择、持久化、自动保存定时器）应由应用层处理
 * - 通过 Hook（useStorage）与应用层通信
 * - 不直接调用 Tauri invoke 或文件系统 API
 *
 * 【新手须知】
 * - 此组件通过 props 接收状态和回调函数
 * - 状态管理在 Hook（useStorage）中
 * - 如果需要新增功能，应先在应用层添加用例，再在此处调用
 * - 注释中带有"后续对接说明"的部分是未来后端开发时需要关注的
 *
 * 【组件结构】
 * 1. Header: 标题和关闭按钮
 * 2. Content: 四个配置区块（下载目录、缓存目录、自动保存、七牛云）
 * 3. 每个区块包含：
 *    - 图标和标题
 *    - 当前配置显示
 *    - 操作按钮
 *    - 说明文字
 *
 * 【后续扩展预留】
 * - 存储用量统计和清理功能
 * - 历史目录记录和多配置切换
 * - 自动保存版本管理
 * - 缓存过期策略配置
 * - 存储空间预警提示
 * - 多云对象存储（S3/OSS/COS）切换
 *
 * 【文件拆分说明】
 * 当前文件包含完整组件，但后续如果组件变大（>400 行），应拆分为：
 * - StorageModal.tsx: 主容器和状态管理（当前文件）
 * - DownloadDirectorySection.tsx: 下载目录配置区块
 * - CacheDirectorySection.tsx: 缓存目录配置区块
 * - AutoSaveSection.tsx: 自动保存配置区块
 * - QiniuObjectStorageSection.tsx: 七牛云配置区块
 * - hooks/useStorageForm.ts: 表单状态管理 Hook
 */

import { useState, useEffect } from 'react';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 存储配置数据类型
 *
 * 【后续对接说明】
 * 此接口应与后端返回的 DTO 格式一致。
 * 当前定义为前端内部使用，后续应从 domain 层导入。
 *
 * 导入路径示例：
 *   import { StorageConfigDto } from '@/domain/storage/entities/StorageConfig';
 */
interface StorageConfigData {
  /** 下载目录路径，未设置时为 null 或空字符串 */
  downloadDirectory: string | null;
  /** 资源缓存目录路径，未设置时为 null 或空字符串 */
  cacheDirectory: string | null;
  /** 是否启用自动保存 */
  autoSaveEnabled: boolean;
  /** 自动保存间隔（分钟） */
  autoSaveIntervalMinutes: number;
}

/**
 * 七牛云对象存储配置（展示层 DTO）
 *
 * 【字段说明】
 * - accessKey / secretKey / bucket / domain：用户可编辑字段
 * - isConfigured：是否已完成一次成功保存（用于状态徽标）
 * - lastTestSucceededAt：最近一次测试成功时间，占位用于后续排障
 */
interface QiniuStorageConfigData {
  accessKey: string;
  secretKey: string;
  bucket: string;
  domain: string;
  isConfigured: boolean;
  lastTestSucceededAt: string | null;
}

/**
 * 七牛云操作结果
 *
 * 【用途说明】
 * - 统一“测试连接/保存配置”返回结构
 * - 避免组件层耦合异常对象结构
 */
interface QiniuActionResult {
  success: boolean;
  message: string;
}

/**
 * 组件 Props 接口
 *
 * 【字段说明】
 * - isOpen: 控制弹窗显示/隐藏
 * - onClose: 关闭弹窗的回调函数
 * - config: 当前存储配置
 * - loading: 是否正在加载
 * - onSelectDownloadDirectory: 选择下载目录的回调函数
 * - onSelectCacheDirectory: 选择缓存目录的回调函数
 * - onUpdateAutoSave: 更新自动保存配置的回调函数
 * - onSaveWorkflowNow: 立即保存工作流的回调函数
 * - onImportAutoSave: 导入自动保存文件的回调函数
 * - qiniuConfig: 七牛云配置草稿
 * - onUpdateQiniuConfigDraft: 更新七牛云配置草稿
 * - onTestQiniuConnection: 测试七牛云连接
 * - onSaveQiniuConfig: 保存七牛云配置
 *
 * 【后续对接说明】
 * 这些回调函数应由父组件（CanvasBoard）通过 Hook 提供。
 * 后续对接后端时，Hook 内部会调用应用层的命令用例。
 */
interface StorageModalProps {
  /** 弹窗是否打开 */
  isOpen: boolean;
  /** 关闭弹窗的回调 */
  onClose: () => void;
  /** 当前存储配置 */
  config: StorageConfigData | null;
  /** 是否正在加载配置 */
  loading: boolean;
  /** 选择下载目录的回调函数 */
  onSelectDownloadDirectory: () => Promise<void>;
  /** 选择缓存目录的回调函数 */
  onSelectCacheDirectory: () => Promise<void>;
  /** 更新自动保存配置的回调函数 */
  onUpdateAutoSave: (updates: {
    enabled?: boolean;
    intervalMinutes?: number;
  }) => Promise<void>;
  /** 立即保存工作流的回调函数 */
  onSaveWorkflowNow: () => Promise<void>;
  /** 导入自动保存文件的回调函数 */
  onImportAutoSave: () => Promise<void>;
  /** 七牛云配置草稿 */
  qiniuConfig: QiniuStorageConfigData;
  /** 更新七牛云配置草稿 */
  onUpdateQiniuConfigDraft: (updates: {
    accessKey?: string;
    secretKey?: string;
    bucket?: string;
    domain?: string;
  }) => void;
  /** 测试七牛云连接 */
  onTestQiniuConnection: () => Promise<QiniuActionResult>;
  /** 保存七牛云配置 */
  onSaveQiniuConfig: () => Promise<QiniuActionResult>;
}

// ============================================================================
// 主组件
// ============================================================================

/**
 * 本地存储管理弹窗组件
 *
 * 【页面职责】
 * 1. 展示当前存储配置
 * 2. 支持选择下载目录
 * 3. 支持选择缓存目录
 * 4. 支持配置自动保存策略
 * 5. 支持立即保存和导入自动保存
 * 6. 支持维护七牛云对象存储配置（前端 Mock 流程）
 *
 * 【后续对接说明】
 * 当前组件仅实现前端展示和交互逻辑，后端对接需要：
 *
 * 1. 数据加载：
 *    - 当前：config 通过 props 传入（假数据或父组件提供）
 *    - 后续：通过 Hook 调用应用层的 GetStorageConfigQuery 获取
 *
 * 2. 选择目录：
 *    - 当前：onSelectDownloadDirectory / onSelectCacheDirectory 通过 props 传入
 *    - 后续：通过 Hook 调用应用层的 SelectDirectoryCommand
 *    - 后端应调用 Tauri 的 dialog API 弹出系统目录选择器
 *
 * 3. 保存配置：
 *    - 当前：onUpdateAutoSave 通过 props 传入
 *    - 后续：通过 Hook 调用应用层的 UpdateStorageConfigCommand
 *
 * 4. 立即保存：
 *    - 当前：onSaveWorkflowNow 通过 props 传入
 *    - 后续：通过 Hook 调用应用层的 SaveWorkflowNowCommand
 *
 * 5. 导入自动保存：
 *    - 当前：onImportAutoSave 通过 props 传入
 *    - 后续：通过 Hook 调用应用层的 ImportAutoSaveCommand
 *
 * 6. 七牛云配置：
 *    - 当前：qiniuConfig + onUpdateQiniuConfigDraft + onTestQiniuConnection + onSaveQiniuConfig 通过 props 传入
 *    - 后续：通过 Hook 调用应用层命令（TestQiniuConnectionCommand / SaveQiniuConfigCommand）
 *    - 提示：敏感字段持久化时应加密存储，前端不应打印密钥日志
 *
 * 【后端接口需求】
 * 后端需要提供以下 Tauri 命令（命令名仅为示例，可协商）：
 *
 * - get_storage_config: 获取当前存储配置
 *   输入：无
 *   输出：StorageConfigData
 *
 * - select_download_directory: 弹出目录选择器并保存选择
 *   输入：无
 *   输出：{ success: boolean, path: string }
 *
 * - select_cache_directory: 弹出目录选择器并保存选择
 *   输入：无
 *   输出：{ success: boolean, path: string }
 *
 * - update_storage_config: 更新存储配置
 *   输入：{ downloadDirectory?, cacheDirectory?, autoSaveEnabled?, autoSaveIntervalMinutes? }
 *   输出：StorageConfigData
 *
 * - save_workflow_now: 立即保存当前工作流
 *   输入：{ projectId }
 *   输出：{ success: boolean, filePath: string }
 *
 * - import_auto_save: 导入自动保存文件
 *   输入：无（自动从缓存目录读取最新的自动保存文件）
 *   输出：{ success: boolean, workflowData: any }
 *
 * 【数据库表设计建议】
 * 后端开发人员可参考以下表结构：
 *
 * ```sql
 * CREATE TABLE storage_configs (
 *   id INTEGER PRIMARY KEY AUTOINCREMENT,
 *   download_directory TEXT,              -- 下载目录路径
 *   cache_directory TEXT,                 -- 缓存目录路径
 *   auto_save_enabled INTEGER NOT NULL,   -- 是否启用自动保存（0 或 1）
 *   auto_save_interval_minutes INTEGER,   -- 自动保存间隔（分钟）
 *   updated_at TEXT NOT NULL              -- 更新时间
 * );
 *
 * -- 通常只有一行配置，可使用单例模式
 * INSERT INTO storage_configs (download_directory, cache_directory, auto_save_enabled, auto_save_interval_minutes, updated_at)
 * VALUES (NULL, NULL, 1, 5, datetime('now'));
 * ```
 */
export function StorageModal({
  isOpen,
  onClose,
  config,
  loading,
  onSelectDownloadDirectory,
  onSelectCacheDirectory,
  onUpdateAutoSave,
  onSaveWorkflowNow,
  onImportAutoSave,
  qiniuConfig,
  onUpdateQiniuConfigDraft,
  onTestQiniuConnection,
  onSaveQiniuConfig,
}: StorageModalProps) {
  // ============================================================================
  // 本地状态
  // ============================================================================

  /**
   * 自动保存间隔的本地编辑值
   *
   * 【状态说明】
   * - 用于在用户修改间隔时即时更新输入框显示
   * - 与 config.autoSaveIntervalMinutes 分离，避免未确认就生效
   * - 用户修改后可选择是否立即应用或等待确认
   *
   * 【后续对接说明】
   * 当前实现修改后即时生效，后续如果需要"确认/取消"机制，
   * 可在此基础上新增暂存状态。
   */
  const [localInterval, setLocalInterval] = useState(config?.autoSaveIntervalMinutes ?? 5);

  /**
   * 目录选择加载状态
   *
   * 【状态说明】
   * - 用于在用户点击选择目录按钮时显示加载反馈
   * - 分为下载目录和缓存目录两个独立状态
   */
  const [selectingDownloadDir, setSelectingDownloadDir] = useState(false);
  const [selectingCacheDir, setSelectingCacheDir] = useState(false);

  /**
   * 七牛敏感字段显示控制
   *
   * 【状态说明】
   * - 默认隐藏（password）
   * - 用户可按字段单独切换显示，便于核对输入
   * - 不会写入持久层，只服务当前交互体验
   */
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  /**
   * 七牛操作按钮加载状态
   *
   * 【设计意图】
   * 将“测试连接”和“保存配置”拆成独立 loading，
   * 避免一个请求锁死另一个按钮，提升可预期性。
   */
  const [testingQiniu, setTestingQiniu] = useState(false);
  const [savingQiniu, setSavingQiniu] = useState(false);

  /**
   * 七牛操作反馈
   *
   * 【状态说明】
   * - success=true：显示绿色成功提示
   * - success=false：显示橙/红色失败提示
   * - null：不显示提示
   *
   * 【维护建议】
   * 若后续引入全局通知系统（Toast），此状态可逐步下沉到 Hook 或通知中心。
   */
  const [qiniuFeedback, setQiniuFeedback] = useState<QiniuActionResult | null>(null);

  // ============================================================================
  // 副作用
  // ============================================================================

  /**
   * 同步本地间隔值与外部配置
   *
   * 【功能说明】
   * - 当弹窗打开或外部配置变化时，同步本地编辑值
   * - 确保用户看到的是最新配置
   */
  useEffect(() => {
    if (isOpen && config) {
      setLocalInterval(config.autoSaveIntervalMinutes);
    }
  }, [isOpen, config]);

  /**
   * 弹窗重新打开时重置七牛反馈态
   *
   * 【设计意图】
   * - 避免上一次测试/保存结果“残留”到新一轮编辑
   * - 降低新手排障时的误判（误以为当前输入已经测试通过）
   */
  useEffect(() => {
    if (isOpen) {
      setQiniuFeedback(null);
    }
  }, [isOpen]);

  /**
   * 监听 Esc 键和点击外部关闭
   *
   * 【功能说明】
   * - 当用户按下 Esc 键时关闭弹窗
   * - 当用户点击弹窗外部区域时关闭弹窗
   */
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

  // ============================================================================
  // 事件处理函数
  // ============================================================================

  /**
   * 处理选择下载目录
   *
   * 【功能说明】
   * 调用后端提供的目录选择器，让用户选择下载目录。
   *
   * 【业务流程】
   * 1. 设置加载状态
   * 2. 调用后端的目录选择命令
   * 3. 成功后自动刷新配置
   *
   * 【后续对接说明】
   * 后端对接时需要：
   * - 调用 Tauri 的 dialog API 弹出系统目录选择器
   * - 用户选择后，保存路径到存储配置
   * - 返回选择结果
   *
   * 示例（后续实现）：
   *   const result = await selectDownloadDirectory();
   *   if (result.success) {
   *     // 配置已自动更新
   *   }
   */
  const handleSelectDownloadDirectory = async () => {
    setSelectingDownloadDir(true);
    try {
      await onSelectDownloadDirectory();
    } finally {
      setSelectingDownloadDir(false);
    }
  };

  /**
   * 处理选择缓存目录
   *
   * 【功能说明】
   * 调用后端提供的目录选择器，让用户选择缓存目录。
   *
   * 【后续对接说明】
   * 同 handleSelectDownloadDirectory，调用后端的缓存目录选择命令。
   */
  const handleSelectCacheDirectory = async () => {
    setSelectingCacheDir(true);
    try {
      await onSelectCacheDirectory();
    } finally {
      setSelectingCacheDir(false);
    }
  };

  /**
   * 处理自动保存间隔变化
   *
   * 【功能说明】
   * 当用户修改间隔值时，更新本地编辑状态并同步到外部配置。
   *
   * 【参数说明】
   * - value: 用户输入的新间隔值（分钟）
   *
   * 【后续对接说明】
   * 当前实现修改后即时生效，后续如需"确认/取消"机制可调整。
   */
  const handleIntervalChange = async (value: number) => {
    // 限制范围为 1-60 分钟
    const clampedValue = Math.max(1, Math.min(60, value));
    setLocalInterval(clampedValue);
    await onUpdateAutoSave({ intervalMinutes: clampedValue });
  };

  /**
   * 处理自动保存开关切换
   *
   * 【功能说明】
   * 当用户切换自动保存启用状态时，调用外部配置更新。
   *
   * 【后续对接说明】
   * 后端应在此时启动或停止自动保存定时器。
   */
  const handleAutoSaveToggle = async (enabled: boolean) => {
    await onUpdateAutoSave({ enabled });
  };

  /**
   * 处理立即保存
   *
   * 【功能说明】
   * 调用后端的立即保存命令，将当前工作流保存到缓存目录。
   *
   * 【后续对接说明】
   * 后端对接时需要：
   * - 序列化当前画布内容
   * - 写入到缓存目录 / autosave / 项目名_时间.json
   * - 返回保存结果和文件路径
   */
  const handleSaveWorkflowNow = async () => {
    await onSaveWorkflowNow();
  };

  /**
   * 处理导入自动保存
   *
   * 【功能说明】
   * 调用后端的导入命令，从缓存目录读取最新的自动保存文件并恢复。
   *
   * 【后续对接说明】
   * 后端对接时需要：
   * - 从缓存目录读取最新的自动保存 JSON 文件
   * - 解析并返回工作流数据
   * - 前端接收后应恢复画布状态
   */
  const handleImportAutoSave = async () => {
    await onImportAutoSave();
  };

  /**
   * 处理七牛字段输入
   *
   * 【职责边界】
   * - 这里只负责收集输入并同步到展示层 Hook
   * - 不做保存、不做连接校验
   * - 保存和测试必须通过专门按钮触发，避免“输入即副作用”
   *
   * 【可维护性建议】
   * 后续如需新增字段（如 Region、Domain），优先沿用此入口，
   * 保持输入同步路径一致，减少遗漏风险。
   */
  const handleQiniuFieldChange = (
    field: 'accessKey' | 'secretKey' | 'bucket' | 'domain',
    value: string,
  ) => {
    if (field === 'accessKey') {
      onUpdateQiniuConfigDraft({ accessKey: value });
    } else if (field === 'secretKey') {
      onUpdateQiniuConfigDraft({ secretKey: value });
    } else if (field === 'bucket') {
      onUpdateQiniuConfigDraft({ bucket: value });
    } else {
      onUpdateQiniuConfigDraft({ domain: value });
    }
    setQiniuFeedback(null);
  };

  /**
   * 处理“测试连接”
   *
   * 【流程说明】
   * 1. 设置测试中状态
   * 2. 调用 Hook 提供的测试命令
   * 3. 将统一结果回填到提示区
   *
   * 【后续对接说明】
   * 真正接入后端时，失败消息应尽量标准化（鉴权失败 / Bucket 不存在 / 网络异常）。
   */
  const handleTestQiniuConnection = async () => {
    setTestingQiniu(true);
    try {
      const result = await onTestQiniuConnection();
      setQiniuFeedback(result);
    } finally {
      setTestingQiniu(false);
    }
  };

  /**
   * 处理“保存配置”
   *
   * 【流程说明】
   * 1. 设置保存中状态
   * 2. 调用 Hook 提供的保存命令
   * 3. 展示结果消息，并通过 isConfigured 更新状态徽标
   *
   * 【安全说明】
   * 前端只传递用户输入，真实密钥持久化策略必须在后端实现。
   */
  const handleSaveQiniuConfig = async () => {
    setSavingQiniu(true);
    try {
      const result = await onSaveQiniuConfig();
      setQiniuFeedback(result);
    } finally {
      setSavingQiniu(false);
    }
  };

  // ============================================================================
  // 渲染逻辑
  // ============================================================================

  /**
   * 如果弹窗未打开，不渲染任何内容
   */
  if (!isOpen) return null;

  // ============================================================================
  // 主渲染
  // ============================================================================

  return (
    // 弹窗遮罩层
    // 使用 fixed 定位覆盖整个视口，z-50 确保在最上层
    // backdrop-blur-sm 提供毛玻璃背景效果
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fixed-ui">
      {/* 点击背景关闭 */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* 弹窗主容器 */}
      <div className="w-full max-w-[720px] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] relative z-10">

        {/* ========================================================= */}
        {/* 头部 Header */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3 text-gray-200">
            {/* 存储图标 */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-[15px] font-medium">本地存储管理</span>
          </div>
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="group relative w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
            aria-label="关闭"
          >
            <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* 内容区 Content - 内部可滚动 */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">

          {/*
            =========================================================
            1. 下载目录设置区块
            =========================================================

            【功能说明】
            让用户选择文件的默认下载目录。

            【后续对接说明 - 给后端开发同学】
            后端需要提供：
            1. 获取当前下载目录路径的接口
            2. 弹出系统目录选择器的接口
            3. 保存用户选择的路径到配置

            Tauri 实现建议：
            - 使用 `@tauri-apps/plugin-dialog` 的 `open` 方法弹出目录选择
            - 保存路径到 SQLite 数据库的 storage_configs 表
            - 后续下载操作应读取此路径作为默认目录
          */}
          <section className="border border-white/5 bg-white/[0.02] rounded-xl p-5 space-y-4">
            {/* 区块标题 - 蓝色主题 */}
            <div className="flex items-center gap-2 text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <h3 className="text-sm font-medium text-gray-200">下载目录设置</h3>
            </div>

            {/* 当前目录显示 */}
            <div className="input-dark rounded-lg p-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">当前下载目录</span>
              {/*
                【后续对接说明】
                - 如果 config.downloadDirectory 有值，显示实际路径
                - 如果未设置，显示"未选择"
                - 可考虑添加路径截断逻辑（过长时显示...）
              */}
              <span className="text-xs text-gray-300">
                {loading ? '加载中...' : (config?.downloadDirectory || '未选择')}
              </span>
            </div>

            {/* 选择目录按钮 */}
            <button
              onClick={handleSelectDownloadDirectory}
              disabled={selectingDownloadDir || loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {selectingDownloadDir ? '选择中...' : '选择下载目录'}
            </button>

            {/* 说明文字 */}
            <p className="text-[11px] text-gray-500">
              设置后，所有下载的文件将保存到指定目录。首次设置后，后续下载将自动使用该目录。
            </p>
          </section>

          {/*
            =========================================================
            2. 资源缓存目录区块
            =========================================================

            【功能说明】
            让用户选择 AI 生成或远程下载素材的缓存目录。
            此目录用于：
            - 按类型（图片/视频/音频）分类缓存素材
            - 拖入画布或粘贴的素材写入此目录下的 local 文件夹
            - Blob URL 失效时从缓存恢复
            - 导出项目时优先从缓存读取

            【后续对接说明 - 给后端开发同学】
            后端需要提供：
            1. 获取当前缓存目录路径的接口
            2. 弹出系统目录选择器的接口
            3. 保存用户选择的路径到配置
            4. 自动在该目录下创建子目录结构（如 /images/、/videos/、/audios/、/local/）

            Tauri 实现建议：
            - 使用 `@tauri-apps/plugin-dialog` 的 `open` 方法弹出目录选择
            - 保存路径到 SQLite 数据库
            - 首次设置时自动创建子目录结构
            - 后续资源下载/缓存操作应读取此路径
          */}
          <section className="border border-white/5 bg-white/[0.02] rounded-xl p-5 space-y-4">
            {/* 区块标题 - 绿色主题 */}
            <div className="flex items-center gap-2 text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <h3 className="text-sm font-medium text-gray-200">资源缓存目录</h3>
            </div>

            {/* 当前目录显示 */}
            <div className="input-dark rounded-lg p-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">缓存目录</span>
              {/*
                【后续对接说明】
                - 如果 config.cacheDirectory 有值，显示实际路径
                - 如果未设置，显示"未选择"
              */}
              <span className="text-xs text-gray-300 font-medium">
                {loading ? '加载中...' : (config?.cacheDirectory || '未选择')}
              </span>
            </div>

            {/* 选择目录按钮 */}
            <button
              onClick={handleSelectCacheDirectory}
              disabled={selectingCacheDir || loading}
              className="w-full bg-[#00a870] hover:bg-[#00c080] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {selectingCacheDir ? '选择中...' : '选择缓存目录'}
            </button>

            {/* 说明文字 */}
            <p className="text-[11px] text-gray-500 leading-relaxed">
              选择一个本地目录后，AI 生成或远程下载的素材将按类型（图片/视频/音频）分类缓存；
              从本机文件夹拖入画布或从剪贴板粘贴的素材也会写入同目录下的 local 文件夹。
              当浏览器清理 IndexedDB 或页面刷新导致 Blob URL 失效时，可从本地缓存自动恢复。
              导出项目时也会优先从本地缓存读取，提升导出速度。
            </p>
          </section>

          {/*
            =========================================================
            3. 工作流自动保存区块
            =========================================================

            【功能说明】
            让用户配置工作流的自动保存策略，包括：
            - 启用/禁用自动保存
            - 设置保存间隔
            - 立即手动保存
            - 导入自动保存文件

            【后续对接说明 - 给后端开发同学】
            后端需要提供：
            1. 更新自动保存配置的接口（启用状态 + 间隔）
            2. 启动/停止自动保存定时器的逻辑
            3. 立即保存工作流的接口
            4. 导入自动保存文件的接口

            Tauri 实现建议：
            - 使用 setInterval 或类似机制定时保存
            - 保存内容序列化到 缓存目录/autosave/项目名_时间.json
            - 导入时读取最新的自动保存文件并解析
            - 注意处理定时器生命周期（应用关闭时清理）
          */}
          <section className="border border-white/5 bg-white/[0.02] rounded-xl p-5 space-y-4">
            {/* 区块标题和开关 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <h3 className="text-sm font-medium text-gray-200">工作流自动保存</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">防止画布卡死、白屏丢失内容</span>
                {/* 启用/禁用开关 */}
                <div className="flex items-center gap-1.5 ml-2">
                  <input
                    type="checkbox"
                    checked={config?.autoSaveEnabled ?? true}
                    onChange={(e) => handleAutoSaveToggle(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded bg-gray-800 border-none"
                  />
                  <span className="text-xs text-gray-300">启用</span>
                </div>
              </div>
            </div>

            {/* 保存间隔配置 */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">保存间隔（分钟）</span>
              {/* 间隔输入区 */}
              <div className="flex items-center bg-black/40 border border-white/10 rounded px-2 py-1">
                <input
                  type="number"
                  value={localInterval}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value)) {
                      handleIntervalChange(value);
                    }
                  }}
                  min={1}
                  max={60}
                  className="bg-transparent w-8 text-xs text-center outline-none text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                {/* 上下调节箭头 */}
                <div className="flex flex-col border-l border-white/10 ml-2 pl-1">
                  <button
                    onClick={() => handleIntervalChange(localInterval + 1)}
                    className="flex items-center justify-center"
                    aria-label="增加间隔"
                  >
                    <svg className="w-2.5 h-2.5 text-gray-500 cursor-pointer hover:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleIntervalChange(localInterval - 1)}
                    className="flex items-center justify-center"
                    aria-label="减少间隔"
                  >
                    <svg className="w-2.5 h-2.5 text-gray-500 cursor-pointer hover:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* 保存路径提示 */}
              <span className="text-[11px] text-gray-500 italic">
                保存到资源缓存目录 / autosave /
              </span>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              {/* 立即保存按钮 */}
              <button
                onClick={handleSaveWorkflowNow}
                disabled={loading}
                className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 text-sm py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                立即保存
              </button>
              {/* 导入自动保存按钮 */}
              <button
                onClick={handleImportAutoSave}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                导入自动保存
              </button>
            </div>

            {/* 说明文字 */}
            <p className="text-[11px] text-gray-500 leading-relaxed">
              仅保存工作流结构及画布节点引用的图像/视频素材信息（JSON），
              素材从资源缓存目录读取。文件名格式：项目名_时间.json。
            </p>
          </section>

          {/*
            =========================================================
            4. 七牛云对象存储区块
            =========================================================

            【功能说明】
            让用户在前端配置七牛云对象存储参数，并执行：
            - 测试连接（验证当前输入可用性）
            - 保存配置（进入已配置状态）

            【职责边界】
            - 当前区块属于展示层，不直接请求 HTTP，不直接调用 Tauri invoke
            - 所有动作由 `useStorage` Hook 暴露命令函数
            - 当前是 Mock 流程，后续可平滑切到应用层真实命令

            【给后续维护者的安全改造指南】
            1. 新增字段（例如 Region）：
               - 先扩展 Hook 的 DTO 与命令参数，再扩展本区块 UI；
               - 不要只改 UI，避免提交“看得到但存不住”的半成品。
            2. 删除字段：
               - 先确认后端是否仍依赖该字段；
               - 如涉及历史数据，先做兼容读取，再分阶段移除。
            3. 重构拆分：
               - 当本组件继续变大时，优先拆出 `QiniuObjectStorageSection` 子组件；
               - 子组件只收敛 UI 和交互，业务调用仍经 Hook。
          */}
          <section className="border border-white/5 bg-white/[0.02] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
                <h3 className="text-sm font-medium text-gray-200">七牛云对象存储</h3>
              </div>
              <span className={`text-[11px] italic ${qiniuConfig.isConfigured ? 'text-emerald-400' : 'text-gray-500'}`}>
                {qiniuConfig.isConfigured ? '已配置' : '未配置'}
              </span>
            </div>

            {/* Access Key */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400">Access Key</label>
              <div className="input-dark rounded-lg p-3 flex items-center gap-2">
                <input
                  type={showAccessKey ? 'text' : 'password'}
                  value={qiniuConfig.accessKey}
                  onChange={(event) => handleQiniuFieldChange('accessKey', event.target.value)}
                  placeholder="请输入 Access Key"
                  className="bg-transparent flex-1 text-xs text-gray-300 outline-none placeholder-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowAccessKey((previous) => !previous)}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showAccessKey ? '隐藏 Access Key' : '显示 Access Key'}
                >
                  {showAccessKey ? (
                    // 当前为明文显示，图标用“闭眼”提示点击后会隐藏
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10.58 10.58a2 2 0 002.83 2.83" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9.88 5.09A10.94 10.94 0 0112 5c4.48 0 8.27 2.94 9.54 7a11.05 11.05 0 01-4.17 5.11" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.61 6.61A11.06 11.06 0 002.46 12a11.05 11.05 0 005.27 6.07A10.94 10.94 0 0012 19c1.31 0 2.57-.23 3.74-.65" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    // 当前为密文隐藏，图标用“睁眼”提示点击后可查看
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Secret Key */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400">Secret Key</label>
              <div className="input-dark rounded-lg p-3 flex items-center gap-2">
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  value={qiniuConfig.secretKey}
                  onChange={(event) => handleQiniuFieldChange('secretKey', event.target.value)}
                  placeholder="请输入 Secret Key"
                  className="bg-transparent flex-1 text-xs text-gray-300 outline-none placeholder-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey((previous) => !previous)}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showSecretKey ? '隐藏 Secret Key' : '显示 Secret Key'}
                >
                  {showSecretKey ? (
                    // 当前为明文显示，图标用“闭眼”提示点击后会隐藏
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10.58 10.58a2 2 0 002.83 2.83" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9.88 5.09A10.94 10.94 0 0112 5c4.48 0 8.27 2.94 9.54 7a11.05 11.05 0 01-4.17 5.11" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.61 6.61A11.06 11.06 0 002.46 12a11.05 11.05 0 005.27 6.07A10.94 10.94 0 0012 19c1.31 0 2.57-.23 3.74-.65" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    // 当前为密文隐藏，图标用“睁眼”提示点击后可查看
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Bucket */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400">存储空间（Bucket）</label>
              <div className="input-dark rounded-lg p-3">
                <input
                  type="text"
                  value={qiniuConfig.bucket}
                  onChange={(event) => handleQiniuFieldChange('bucket', event.target.value)}
                  placeholder="请输入存储空间名称"
                  className="bg-transparent w-full text-xs text-gray-300 outline-none placeholder-gray-600"
                />
              </div>
            </div>

            {/* Domain */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400">访问域名（Domain）</label>
              <div className="input-dark rounded-lg p-3">
                <input
                  type="text"
                  value={qiniuConfig.domain}
                  onChange={(event) => handleQiniuFieldChange('domain', event.target.value)}
                  placeholder="请输入域名，例如 https://cdn.example.com"
                  className="bg-transparent w-full text-xs text-gray-300 outline-none placeholder-gray-600"
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTestQiniuConnection}
                disabled={testingQiniu || savingQiniu || loading}
                className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 text-sm py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {testingQiniu ? '测试中...' : '测试连接'}
              </button>
              <button
                type="button"
                onClick={handleSaveQiniuConfig}
                disabled={savingQiniu || testingQiniu || loading}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                {savingQiniu ? '保存中...' : '保存配置'}
              </button>
            </div>

            {qiniuFeedback ? (
              <p className={`text-[11px] leading-relaxed ${qiniuFeedback.success ? 'text-emerald-400' : 'text-orange-400'}`}>
                {qiniuFeedback.message}
              </p>
            ) : null}

            <p className="text-[11px] text-gray-500 leading-relaxed">
              配置七牛云对象存储后，可将资源上传至云端存储，支持 CDN 加速访问。请妥善保管 Access Key 和 Secret Key。
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
