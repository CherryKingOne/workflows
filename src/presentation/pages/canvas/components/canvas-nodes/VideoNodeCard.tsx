"use client";

import React, { useMemo } from 'react';
import {
  Handle,
  type NodeProps,
  Position,
  useConnection,
  useNodeConnections,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { type VideoWorkflowNode } from './types';

const DEFAULT_CARD_WIDTH = 680;
const DEFAULT_CARD_HEIGHT = 384; /* aspect-video ratio for 680px width (16:9) */

/**
 * 视频生成节点卡片（React Flow 自定义节点） - 样式0: 纯视频卡片
 *
 * DDD 职责边界：
 * - 当前文件只负责"视频节点的展示层 UI + 本地交互"
 * - 不做领域规则判断（配额/风控/鉴权/计费）
 * - 不直接依赖后端实现细节（HTTP/Tauri/SDK）
 *
 * 样式0 视觉规范（来自原型 video卡片.html）：
 * - 深色背景 #1a1a1a，圆角 rounded-[24px]
 * - 边框 border-white/10
 * - aspect-video 宽高比（16:9）
 * - 内部居中显示"尝试"选项列表：
 *   - "首尾帧生成视频"（带 layer-group 图标）
 *   - "首帧生成视频"（带 wand-magic-sparkles 图标）
 * - 左侧输出连接点 (source)、右侧输入连接点 (target)
 * - 节点标题显示在卡片外部左上角（absolute 定位）
 *
 * 对新手最重要的一句话：
 * - 你可以在这里改"长什么样、怎么交互"
 * - 但不要在这里写"业务规则和后端编排"
 */
export function VideoNodeCard({ id, data, selected }: NodeProps<VideoWorkflowNode>) {
  const cardWidth = data.cardWidth ?? DEFAULT_CARD_WIDTH;
  const updateNodeInternals = useUpdateNodeInternals();

  /**
   * 节点是否处于"激活态"
   *
   * 当前定义：只要被选中，就视为激活态。
   * 与原型保持一致：未激活时不显示连接点和关闭按钮。
   */
  const isNodeActive = Boolean(selected);

  /**
   * 检测输入连接点是否已连接
   */
  const incomingConnectionsOnInputHandle = useNodeConnections({
    id,
    handleType: 'target',
    handleId: 'input',
  });
  const hasIncomingSourceOnInputHandle = incomingConnectionsOnInputHandle.length > 0;
  const isInputHandleConnected = hasIncomingSourceOnInputHandle;

  /**
   * 输入点显示规则：
   * 1. 节点激活时显示；
   * 2. 即使卡片未激活，只要输入点已有上游连线，也保持显示。
   */
  const shouldShowInputHandle = isNodeActive || hasIncomingSourceOnInputHandle;

  /**
   * Handle 的锚点高度：取卡片垂直中线
   */
  const handleTopOffset = Math.round(DEFAULT_CARD_HEIGHT / 2);

  /**
   * 监听连线状态，用于触发流光效果
   *
   * 当用户从其他节点拖拽连线靠近本节点的 input handle 时，
   * 显示上下两条水平流光动画，提示用户"可以在此处连接"。
   */
  const connectionPreview = useConnection((connection) => {
    if (!connection.inProgress || !connection.fromNode) {
      return {
        inProgress: false,
        fromNodeId: null as string | null,
        toNodeId: null as string | null,
        toHandleId: null as string | null,
      };
    }

    return {
      inProgress: true,
      fromNodeId: connection.fromNode.id,
      toNodeId: connection.toNode?.id ?? null,
      toHandleId: connection.toHandle?.id ?? null,
    };
  });

  /**
   * 连线命中输入点时显示上下流光（拖线未松手）
   *
   * 触发条件（与图片节点保持一致）：
   * 1. 正在拖线；
   * 2. 当前目标命中本节点 input handle；
   * 3. 非自己连接自己。
   */
  const showConnectionMergeGlow = useMemo(() => {
    if (!connectionPreview.inProgress) {
      return false;
    }

    if (connectionPreview.fromNodeId === id) {
      return false;
    }

    return connectionPreview.toNodeId === id && connectionPreview.toHandleId === 'input';
  }, [connectionPreview.fromNodeId, connectionPreview.inProgress, connectionPreview.toHandleId, connectionPreview.toNodeId, id]);

  /**
   * 刷新 React Flow 内部缓存
   */
  React.useEffect(() => {
    updateNodeInternals(id);
  }, [cardWidth, handleTopOffset, id, isNodeActive, shouldShowInputHandle, updateNodeInternals]);

  const handleRemoveNode = () => {
    data.onRequestRemove?.(id);
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: `${cardWidth}px` }}>
      {/* 左侧输入连接点 (target) */}
      <Handle
        type="target"
        id="input"
        position={Position.Left}
        style={{
          top: `${handleTopOffset}px`,
          left: isInputHandleConnected ? -5 : isNodeActive ? -7 : -6,
          transform: 'translate(0, -50%)',
          width: isInputHandleConnected ? 10 : 12,
          height: isInputHandleConnected ? 10 : 12,
          background: isInputHandleConnected ? '#ffffff' : isNodeActive ? '#71717a' : '#52525b',
          border: isInputHandleConnected
            ? '1px solid #18181b'
            : isNodeActive
              ? '2px solid #18181b'
              : '1px solid #18181b',
          borderRadius: '999px',
          boxShadow: isInputHandleConnected
            ? '0 0 8px rgba(255, 255, 255, 0.8)'
            : isNodeActive
              ? '0 0 8px rgba(255, 255, 255, 0.18)'
              : 'none',
          opacity: shouldShowInputHandle ? 1 : 0,
          pointerEvents: shouldShowInputHandle ? 'auto' : 'none',
          zIndex: 30,
          transition: 'all 0.2s ease',
        }}
      />

      {/* 主卡片容器 */}
      <div className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-[24px] p-8 aspect-video flex flex-col shadow-2xl relative">
        {/* 节点标题（卡片外部左上角） */}
        <div className="absolute -top-8 left-0 text-[15px] font-medium tracking-wide text-[#888888] flex items-center gap-2 whitespace-nowrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-sm">
            <path d="M8 5v14l11-7z"/>
          </svg>
          {data.title}
        </div>

        {/* 流光效果 - 当连线接近时显示 */}
        {showConnectionMergeGlow && (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[24px]">
            <div className="video-node-merge-glint video-node-merge-glint-top" />
            <div className="video-node-merge-glint video-node-merge-glint-bottom" />
          </div>
        )}

        {/* 卡片内容区 - 居中显示"尝试"选项 */}
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="w-full max-w-xs space-y-4">
            <div className="text-white/40 text-sm">尝试：</div>

            {/* 首尾帧生成视频 */}
            <button
              type="button"
              className="nodrag nowheel flex items-center gap-3 text-white/80 cursor-pointer hover:text-white transition-colors w-full text-left text-base"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 576 512" fill="currentColor" className="text-white/40 shrink-0">
                <path d="M0 128C0 92.7 28.7 64 64 64H512c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zM64 128V384H512V128H64z"/>
                <path d="M272 352V160l128 96-128 96z"/>
              </svg>
              <span>首尾帧生成视频</span>
            </button>

            {/* 首帧生成视频 */}
            <button
              type="button"
              className="nodrag nowheel flex items-center gap-3 text-white/80 cursor-pointer hover:text-white transition-colors w-full text-left text-base"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512" fill="currentColor" className="text-white/40 shrink-0">
                <path d="M512 256A256 256 0 1 0 256 512a256 256 0 1 0 256-256zM188.3 147.1c7.6-4.2 16.8-4.1 24.3 .5l144 88c7.1 4.4 11.5 12.1 11.5 20.5s-4.4 16.1-11.5 20.5l-144 88c-7.4 4.5-16.7 4.7-24.3 .5s-12.3-12.2-12.3-20.9V168c0-8.7 4.7-16.7 12.3-20.9z"/>
              </svg>
              <span>首帧生成视频</span>
            </button>
          </div>
        </div>

        {/* 删除按钮 - 仅激活时显示 */}
        {isNodeActive && (
          <button
            type="button"
            onClick={handleRemoveNode}
            className="nodrag absolute -top-3 -right-3 z-20 h-7 w-7 rounded-full border border-white/10 bg-[#27272a] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
            aria-label="删除视频节点"
          >
            <svg viewBox="0 0 24 24" className="mx-auto h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 右侧输出连接点 (source) */}
      <Handle
        type="source"
        id="output"
        position={Position.Right}
        style={{
          top: `${handleTopOffset}px`,
          right: isNodeActive ? -7 : -6,
          transform: 'translate(0, -50%)',
          width: 12,
          height: 12,
          background: isNodeActive ? '#71717a' : '#52525b',
          border: isNodeActive ? '2px solid #18181b' : '1px solid #18181b',
          borderRadius: '999px',
          boxShadow: isNodeActive ? '0 0 8px rgba(255, 255, 255, 0.18)' : 'none',
          opacity: isNodeActive ? 1 : 0,
          pointerEvents: isNodeActive ? 'auto' : 'none',
          zIndex: 30,
          transition: 'all 0.2s ease',
        }}
      />

      {/* 流光效果 CSS 动画 */}
      <style jsx>{`
        @keyframes video-node-glint-slide {
          0% {
            transform: translateX(-52%);
            opacity: 0.12;
          }
          50% {
            opacity: 0.92;
          }
          100% {
            transform: translateX(52%);
            opacity: 0.16;
          }
        }

        .video-node-merge-glint {
          position: absolute;
          left: -26%;
          width: 152%;
          height: 2px;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.06) 18%,
            rgba(255, 255, 255, 0.92) 50%,
            rgba(255, 255, 255, 0.06) 82%,
            rgba(255, 255, 255, 0) 100%
          );
          filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.35));
          animation: video-node-glint-slide 1.2s ease-in-out infinite;
        }

        .video-node-merge-glint-top {
          top: 0;
        }

        .video-node-merge-glint-bottom {
          bottom: 0;
          animation-delay: 0.14s;
        }
      `}</style>
    </div>
  );
}
