"use client";

import React from 'react';

interface UploadedAssetFloatingToolbarProps {
  /**
   * 当前激活并已上传文件的节点 ID（仅用于语义标识）
   *
   * 说明：
   * - 工具栏当前是纯前端视觉与交互骨架
   * - 后续接后端能力时，可基于该 ID 调用对应节点的处理函数
   */
  activeNodeId: string;
  /**
   * 工具栏锚点（视口坐标）
   *
   * 由装配层传入，表示“当前激活卡片顶部中心点”。
   * 组件内部只负责渲染，不自行推导节点几何信息。
   */
  anchorX: number;
  anchorY: number;
  /**
   * 点击“上传”工具后的回调
   *
   * 用于触发“替换当前卡片文件”的文件选择流程。
   */
  onRequestUploadReplace: (activeNodeId: string) => void;
}

/**
 * 上传后悬浮工具栏（展示层组件）
 *
 * 职责边界：
 * - 负责“工具栏外观 + 前端点击入口”
 * - 不负责判断显示条件（由 CanvasBoard 装配层决定）
 * - 不负责执行业务动作（后续通过回调或应用层函数接入）
 */
export function UploadedAssetFloatingToolbar({
  activeNodeId,
  anchorX,
  anchorY,
  onRequestUploadReplace,
}: UploadedAssetFloatingToolbarProps) {
  const handleToolClick = (toolKey: string) => {
    if (toolKey === 'upload-file') {
      onRequestUploadReplace(activeNodeId);
      return;
    }
    // 预留：后续接入 application 层函数。
    console.info('[UI Placeholder] 点击上传后工具栏按钮', { activeNodeId, toolKey });
  };

  const TOOL_ITEMS: Array<{
    key: string;
    icon: React.ReactNode;
    highlighted?: boolean;
    label?: string;
  }> = [
    {
      key: 'camera',
      highlighted: true,
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 8h3l2-2h6l2 2h3v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
          <circle cx="12" cy="13" r="3.2" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      key: 'pen',
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m12 19-7 2 2-7L15.5 5.5a2.12 2.12 0 0 1 3 3L12 19Z" />
        </svg>
      ),
    },
    {
      key: 'pin',
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 22s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z" />
          <circle cx="12" cy="10" r="2.2" />
        </svg>
      ),
    },
    {
      key: 'cut',
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="6.5" cy="6.5" r="2.5" />
          <circle cx="6.5" cy="17.5" r="2.5" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 4 8.5 15.5M20 20 8.5 8.5" />
        </svg>
      ),
    },
    {
      key: 'erase',
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m7 16 8.5-8.5a2.2 2.2 0 0 1 3.1 0l1.9 1.9a2.2 2.2 0 0 1 0 3.1L13 20H7l-3-3 3-1Z" />
        </svg>
      ),
    },
    {
      key: 'light',
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 18h6M10 22h4M12 2a6 6 0 0 1 3.8 10.7c-1.3 1-1.8 1.8-1.8 3.3h-4c0-1.5-.5-2.3-1.8-3.3A6 6 0 0 1 12 2Z" />
        </svg>
      ),
    },
    {
      key: 'adjust',
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 7h8M16 7h4M10 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM4 17h4M12 17h8M18 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
        </svg>
      ),
    },
    {
      key: 'draw',
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 21h4l12-12-4-4L3 17v4Z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m14 6 4 4" />
        </svg>
      ),
    },
    {
      key: 'upload-file',
      label: '上传文件（图片、视频、音频）',
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15V3" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m7 10 5-5 5 5" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="fixed z-40 fixed-ui pointer-events-auto"
      style={{
        left: `${anchorX}px`,
        top: `${anchorY}px`,
        transform: 'translate(-50%, calc(-100% - 36px))',
      }}
    >
      <div className="flex items-center bg-[#0a0a0c] rounded-full border border-[#2a2a2c] px-3 py-1.5 shadow-xl space-x-1">
        {TOOL_ITEMS.map((tool, index) => (
          <React.Fragment key={tool.key}>
            <button
              type="button"
              onClick={() => handleToolClick(tool.key)}
              title={tool.label ?? tool.key}
              className={`flex items-center justify-center w-[34px] h-[34px] rounded-lg transition-colors ${
                tool.highlighted
                  ? 'bg-[#222327] border border-neutral-700 text-white'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-neutral-800/50'
              }`}
              aria-label={tool.label ?? `上传后工具栏按钮-${tool.key}`}
            >
              {tool.icon}
            </button>
            {index < TOOL_ITEMS.length - 1 && <div className="w-[1px] h-5 bg-[#1f1f23] mx-1" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
