/**
 * useUpdater Hook
 *
 * 【职责说明】
 * 封装 Tauri 更新功能的 React Hook，提供：
 * - 静默检测更新
 * - 后台下载进度监听
 * - 更新状态管理
 * - 安装重启触发
 *
 * 【事件监听】
 * 监听来自 Rust 后端的事件：
 * - update://available: 发现新版本
 * - update://progress: 下载进度
 * - update://downloaded: 下载完成
 * - update://error: 更新出错
 *
 * 【使用示例】
 * const { updateInfo, isDownloaded, checkForUpdate, installAndRestart } = useUpdater();
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from '@tauri-apps/api/core';

/**
 * 更新信息
 */
export interface UpdateInfo {
  version: string;
  current_version: string;
  date?: string;
  body?: string;
}

/**
 * 下载进度
 */
export interface DownloadProgress {
  downloaded: number;
  total?: number;
  percent: number;
}

/**
 * 更新状态
 */
export type UpdateStatus =
  | 'idle'           // 空闲
  | 'checking'       // 检查中
  | 'available'      // 有新版本
  | 'downloading'    // 下载中
  | 'downloaded'     // 下载完成
  | 'error';         // 出错

/**
 * useUpdater 返回值
 */
export interface UseUpdaterReturn {
  /** 更新信息 */
  updateInfo: UpdateInfo | null;
  /** 当前状态 */
  status: UpdateStatus;
  /** 下载进度 */
  progress: DownloadProgress | null;
  /** 错误信息 */
  error: string | null;
  /** 是否已下载完成 */
  isDownloaded: boolean;
  /** 检查更新 */
  checkForUpdate: () => Promise<void>;
  /** 开始下载 */
  startDownload: () => Promise<void>;
  /** 安装并重启 */
  installAndRestart: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/**
 * useUpdater Hook
 */
export function useUpdater(): UseUpdaterReturn {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);

  // 监听更新事件
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      const inTauri = await isTauri();
      if (!inTauri) return;

      // 监听发现新版本
      const unlistenAvailable = await listen<UpdateInfo>('update://available', (event) => {
        setUpdateInfo(event.payload);
        setStatus('available');
      });
      unlisteners.push(unlistenAvailable);

      // 监听下载进度
      const unlistenProgress = await listen<DownloadProgress>('update://progress', (event) => {
        setProgress(event.payload);
        setStatus('downloading');
      });
      unlisteners.push(unlistenProgress);

      // 监听下载完成
      const unlistenDownloaded = await listen<void>('update://downloaded', () => {
        setIsDownloaded(true);
        setStatus('downloaded');
        setProgress(null);
      });
      unlisteners.push(unlistenDownloaded);

      // 监听错误
      const unlistenError = await listen<string>('update://error', (event) => {
        setError(event.payload);
        setIsDownloaded(false);
        setProgress(null);
        setStatus('error');
      });
      unlisteners.push(unlistenError);
    };

    setupListeners();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  // 检查更新
  const checkForUpdate = useCallback(async () => {
    const inTauri = await isTauri();
    if (!inTauri) {
      console.log('[useUpdater] Not in Tauri environment');
      return;
    }

    setStatus('checking');
    setError(null);

    try {
      const info = await invoke<UpdateInfo | null>('check_update');
      if (info) {
        setUpdateInfo(info);
        setStatus('available');
      } else {
        setStatus('idle');
      }
    } catch (err) {
      // 开发期间或无发布版本时，静默忽略错误
      console.log('[useUpdater] Check update failed (may be expected in dev):', err);
      setStatus('idle');
    }
  }, []);

  // 开始下载
  const startDownload = useCallback(async () => {
    const inTauri = await isTauri();
    if (!inTauri) return;

    setStatus('downloading');
    setError(null);
    setIsDownloaded(false);
    setProgress(null);

    try {
      await invoke('download_update');
    } catch (err) {
      console.error('[useUpdater] Download error:', err);
      setError(String(err));
      setStatus('error');
    }
  }, []);

  // 安装并重启
  const installAndRestart = useCallback(async () => {
    const inTauri = await isTauri();
    if (!inTauri) return;

    try {
      await invoke('install_and_restart');
    } catch (err) {
      console.error('[useUpdater] Install and restart error:', err);
      setError(String(err));
      setStatus('error');
    }
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    setUpdateInfo(null);
    setStatus('idle');
    setProgress(null);
    setError(null);
    setIsDownloaded(false);
  }, []);

  return {
    updateInfo,
    status,
    progress,
    error,
    isDownloaded,
    checkForUpdate,
    startDownload,
    installAndRestart,
    reset,
  };
}
