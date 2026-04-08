"use client";

import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface MediaPreviewModalProps {
  url: string;
  mimeType: string;
  name?: string;
  onClose: () => void;
}

/**
 * 媒体放大预览弹窗
 *
 * 双击上传节点中的图片/视频/音频后触发，全屏黑底展示。
 * 使用 Portal 渲染到 document.body，避免被 React Flow 画布的 overflow/transform 裁剪。
 */
export function MediaPreviewModal({ url, mimeType, name, onClose }: MediaPreviewModalProps) {
  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  const isAudio = mimeType.startsWith('audio/');

  // ESC 键关闭
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

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black select-none"
      onClick={onClose}
    >
      {/* 右上角关闭按钮，z-[10001] 确保在内容层之上可点击 */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-5 right-6 z-[10001] p-1 text-[#888] hover:text-white transition-colors duration-200 cursor-pointer"
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

      {/* 媒体内容区域，阻止冒泡避免点内容时关闭 */}
      <div
        className="relative z-[10000] flex items-center justify-center w-full h-full p-8"
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
    </div>
  );

  return createPortal(modal, document.body);
}
