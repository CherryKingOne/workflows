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
 * 2. Content: 三个配置区块（下载目录、缓存目录、自动保存）
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
 *
 * 【文件拆分说明】
 * 当前文件包含完整组件，但后续如果组件变大（>400 行），应拆分为：
 * - StorageModal.tsx: 主容器和状态管理（当前文件）
 * - DownloadDirectorySection.tsx: 下载目录配置区块
 * - CacheDirectorySection.tsx: 缓存目录配置区块
 * - AutoSaveSection.tsx: 自动保存配置区块
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

        </div>
      </div>
    </div>
  );
}
