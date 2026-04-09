"use client";

import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { save } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';

interface PreviewMediaModalProps {
  url: string;
  mimeType: string;
  name?: string;
  onClose: () => void;
}

/**
 * 预览节点专属放大弹窗
 *
 * 与上传节点的 MediaPreviewModal 区别：
 * - 底部有操作栏：下载按钮 + 复制按钮
 * - 样式参考 预览放大.html
 *
 * 使用 Portal 渲染到 document.body，避免被 React Flow 画布的
 * overflow / transform 裁剪。
 */
export function PreviewMediaModal({ url, mimeType, name, onClose }: PreviewMediaModalProps) {
  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  const isAudio = mimeType.startsWith('audio/');

  const [copyLabel, setCopyLabel] = useState('复制');
  const [downloadLabel, setDownloadLabel] = useState('下载');

  // ESC 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 下载
  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setDownloadLabel('下载中...');

      const fileName = name ?? 'preview';

      // 从文件名提取扩展名
      const getExtension = (filename: string): string => {
        const parts = filename.split('.');
        if (parts.length > 1) {
          return parts[parts.length - 1].toLowerCase();
        }
        // 根据 mimeType 推断扩展名
        if (mimeType.startsWith('image/png')) return 'png';
        if (mimeType.startsWith('image/jpeg') || mimeType.startsWith('image/jpg')) return 'jpg';
        if (mimeType.startsWith('image/gif')) return 'gif';
        if (mimeType.startsWith('image/webp')) return 'webp';
        if (mimeType.startsWith('video/mp4')) return 'mp4';
        if (mimeType.startsWith('audio/mpeg')) return 'mp3';
        if (mimeType.startsWith('audio/wav')) return 'wav';
        return '';
      };

      const extension = getExtension(fileName);

      // 检查是否在 Tauri 环境中
      const inTauri = await isTauri();
      console.log('[PreviewMediaModal] isTauri:', inTauri);

      if (inTauri) {
        try {
          // 构建 filters
          const filters = extension
            ? [
                {
                  name: mimeType.startsWith('image/')
                    ? 'Image'
                    : mimeType.startsWith('video/')
                      ? 'Video'
                      : mimeType.startsWith('audio/')
                        ? 'Audio'
                        : 'File',
                  extensions: [extension],
                },
              ]
            : [];

          // 弹出保存对话框
          const filePath = await save({
            defaultPath: fileName,
            filters,
          });

          console.log('[PreviewMediaModal] save dialog returned:', filePath);

          // 用户取消了保存对话框
          if (!filePath) {
            setDownloadLabel('下载');
            return;
          }

          // 使用 Tauri 后端下载并保存文件（绕过 CORS 和 fs 权限限制）
          await invoke('download_and_save_file', { url, path: filePath });
          setDownloadLabel('已保存');
        } catch (err) {
          console.error('[PreviewMediaModal] Download error:', err);
          setDownloadLabel('下载失败');
        }
      } else {
        // 浏览器环境：使用传统下载方式
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to download: ${response.status}`);
          }
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = objectUrl;
          anchor.download = fileName;
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          URL.revokeObjectURL(objectUrl);
          setDownloadLabel('已开始');
        } catch {
          // 降级方案
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          setDownloadLabel('已开始');
        }
      }

      window.setTimeout(() => setDownloadLabel('下载'), 1600);
    },
    [url, name]
  );

  // 复制（图片复制到剪贴板，其它类型复制 URL）
  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        if (isImage && navigator.clipboard?.write) {
          const res = await fetch(url);
          const blob = await res.blob();
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob }),
          ]);
        } else {
          await navigator.clipboard.writeText(url);
        }
        setCopyLabel('已复制');
        setTimeout(() => setCopyLabel('复制'), 2000);
      } catch {
        await navigator.clipboard.writeText(url).catch(() => {});
        setCopyLabel('已复制');
        setTimeout(() => setCopyLabel('复制'), 2000);
      }
    },
    [url, isImage]
  );

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black select-none"
      onClick={onClose}
    >
      {/* 右上角关闭按钮 */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-5 right-6 z-[10001] p-1 text-[#888888] hover:text-white transition-colors duration-200 cursor-pointer"
        aria-label="关闭预览"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* 媒体内容区域 */}
      <div
        className="relative z-[10000] flex items-center justify-center w-full h-full p-8 pb-24"
        onClick={(e) => e.stopPropagation()}
      >
        {isImage && (
          <img
            src={url}
            alt={name ?? '预览图片'}
            className="w-auto h-auto max-w-full max-h-full object-contain shadow-2xl"
            draggable={false}
          />
        )}

        {isVideo && (
          <video
            src={url}
            controls
            autoPlay
            className="w-auto h-auto max-w-full max-h-full shadow-2xl bg-black"
          />
        )}

        {isAudio && (
          <div className="flex flex-col items-center gap-4">
            {name && (
              <p className="text-neutral-300 text-sm truncate max-w-xs">{name}</p>
            )}
            <audio src={url} controls autoPlay className="w-80" />
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10001] flex items-center bg-[#0f0f0f] border border-[#222222] rounded-full p-[3px] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 下载按钮 */}
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center justify-center gap-[6px] bg-[#00a2e8] hover:bg-[#0092d1] text-white px-5 py-[7px] rounded-full text-[13px] transition-colors duration-200 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {downloadLabel}
        </button>

        {/* 复制按钮 */}
        <button
          type="button"
          onClick={handleCopy}
          className="text-[#a3a3a3] hover:text-white px-5 py-[7px] rounded-full text-[13px] transition-colors duration-200 cursor-pointer bg-transparent"
        >
          {copyLabel}
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
