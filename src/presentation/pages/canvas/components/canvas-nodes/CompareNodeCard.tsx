"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Handle,
  type NodeProps,
  Position,
  useConnection,
  useNodeConnections,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { type CompareWorkflowNode } from './types';

const DEFAULT_CARD_WIDTH = 380;
const DEFAULT_EMPTY_CARD_HEIGHT = 240;
const DEFAULT_READY_CARD_HEIGHT = 260;
const MIN_CARD_WIDTH = 260;
const MAX_CARD_WIDTH = 920;
const MIN_CARD_HEIGHT = 220;
const MAX_CARD_HEIGHT = 920;
const CHECKERBOARD_BACKGROUND_STYLE: React.CSSProperties = {
  /**
   * 对比区域留白纹理（棋盘格）
   *
   * 设计原因：
   * - 当两路素材比例不一致时，我们使用 `object-contain` 保留完整内容；
   * - 容器内自然会出现空白区域；
   * - 用棋盘格比纯黑背景更容易让用户理解“这里是占位留白，不是素材丢失”。
   *
   * 后续如果要统一主题变量：
   * 1. 可把颜色提到 CSS 变量（例如 --compare-checker-dark/light）
   * 2. 由主题层统一控制浅色/深色模式
   */
  backgroundColor: '#18181b',
  backgroundImage:
    'linear-gradient(45deg, #09090b 25%, transparent 25%, transparent 75%, #09090b 75%, #09090b), linear-gradient(45deg, #09090b 25%, transparent 25%, transparent 75%, #09090b 75%, #09090b)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 10px 10px',
};

/**
 * 对比卡片尺寸规范化（保持宽高比例）
 *
 * 说明：
 * - 之前是分别 clamp 宽和高，会把比例压坏，导致“看起来像固定卡片 + 内容被拉伸裁切”
 * - 现在改成按比例整体缩放，保证卡片几何比例稳定
 */
function normalizeCompareCardSize(
  width: number,
  height: number,
): { cardWidth: number; cardHeight: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      cardWidth: DEFAULT_CARD_WIDTH,
      cardHeight: DEFAULT_EMPTY_CARD_HEIGHT,
    };
  }

  let nextWidth = width;
  let nextHeight = height;

  const scaleDown = Math.min(MAX_CARD_WIDTH / nextWidth, MAX_CARD_HEIGHT / nextHeight, 1);
  nextWidth *= scaleDown;
  nextHeight *= scaleDown;

  const shortSide = Math.min(nextWidth, nextHeight);
  if (shortSide < MIN_CARD_HEIGHT) {
    const scaleUp = MIN_CARD_HEIGHT / shortSide;
    nextWidth *= scaleUp;
    nextHeight *= scaleUp;
  }

  return {
    cardWidth: Math.round(Math.max(MIN_CARD_WIDTH, nextWidth)),
    cardHeight: Math.round(Math.max(MIN_CARD_HEIGHT, nextHeight)),
  };
}

/**
 * 对比节点卡片（React Flow 自定义节点）
 *
 * DDD 职责边界（给新手）：
 * - 当前文件只负责“节点视觉结构 + 本地交互态（hover/selected）”
 * - 不负责“对比素材从哪来、怎么存、怎么校验权限”
 * - 不直接调用后端命令
 *
 * 当前实现范围（本次任务）：
 * - 已实现：空状态卡片 + 激活态边框 + 删除按钮 + compareMedia 驱动的媒体渲染
 * - 已实现：图片对比中线与滑块拖拽（5%~95% 区间）
 * - 未实现：视频双轨同步、音频波形等高级交互
 *
 * 后续后端联调推荐链路：
 * 1. 卡片触发动作（例如“同步对比素材”）
 * 2. 回调上抛给 CanvasBoard（装配层）
 * 3. CanvasBoard 调 application 层 use case
 * 4. application 层调 infrastructure（Tauri/Rust）并回写节点数据
 *
 * 新增功能建议（图片/视频/音频）：
 * - 在 `CompareNodeData.compareMedia.kind` 分支渲染
 * - `image`：渲染左右图 + 分割线
 * - `video`：渲染双视频或封面 + 时间轴控制区
 * - `audio`：渲染双轨波形/时长标签
 *
 * 删除与重构建议：
 * - 删除动作保持上抛（`onRequestRemove`），不要在卡片内部直接改全局节点数组
 * - 当文件变复杂时优先拆分为：
 *   `CompareNodeEmptyState` / `CompareNodeReadyState` / `CompareNodeActions`
 */
export function CompareNodeCard({ id, data, selected }: NodeProps<CompareWorkflowNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const [hovered, setHovered] = useState(false);
  const [splitPercent, setSplitPercent] = useState(50);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const imageCompareViewportRef = useRef<HTMLDivElement | null>(null);
  const isNodeActive = Boolean(selected);
  const compareStatus = data.compareStatus ?? 'empty';
  const isReady = compareStatus === 'ready';
  const compareMedia = data.compareMedia;
  const isImageCompare = isReady && compareMedia?.kind === 'image';
  const isVideoCompare = isReady && compareMedia?.kind === 'video';
  const isAudioCompare = isReady && compareMedia?.kind === 'audio';
  const incomingConnectionsOnInputHandle = useNodeConnections({
    id,
    handleType: 'target',
    handleId: 'input',
  });
  const hasIncomingSourceOnInputHandle = incomingConnectionsOnInputHandle.length > 0;
  const isInputHandleConnected = hasIncomingSourceOnInputHandle;
  /**
   * 输入点显示规则（与上传节点保持一致）：
   * 1. 节点激活时显示；
   * 2. 节点未激活但输入点已有上游来源时，也保持显示；
   * 3. 其余情况隐藏。
   */
  const shouldShowInputHandle = isNodeActive || hasIncomingSourceOnInputHandle;
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
   * 尺寸钳制：
   * - 防止异常值导致卡片变形
   * - 新手改动时可先改默认常量，再看是否需要放宽边界
   */
  const { cardWidth, cardHeight } = useMemo(() => {
    const rawWidth = data.cardWidth ?? DEFAULT_CARD_WIDTH;
    const fallback = isReady ? DEFAULT_READY_CARD_HEIGHT : DEFAULT_EMPTY_CARD_HEIGHT;
    const rawHeight = data.cardHeight ?? fallback;
    return normalizeCompareCardSize(rawWidth, rawHeight);
  }, [data.cardHeight, data.cardWidth, isReady]);

  /**
   * 连线“命中输入点”判定（按你最新要求）
   *
   * 目标：
   * - 必须是“拖线过程中（鼠标未松开）”
   * - 且当前拖线目标正好命中本节点输入 Handle（id = input）
   * - 才显示顶部/底部流光提示
   *
   * 为什么这样判定：
   * - 你明确要求“不是附近触发”，而是“光标放在输入点上且未松手才触发”
   * - React Flow 在拖线命中 Handle 时会给出 `toNode` 与 `toHandle`，可直接用来精准判断
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
   * React Flow 在节点尺寸变化后需要刷新内部锚点缓存。
   * 否则连线端点会出现“位置滞后”。
   */
  useEffect(() => {
    updateNodeInternals(id);
  }, [cardHeight, cardWidth, id, isNodeActive, isReady, shouldShowInputHandle, updateNodeInternals]);

  /**
   * 删除动作上抛：
   * - 当前组件只表达“用户意图”
   * - 删除执行细节由装配层统一处理（便于后续接撤销、批量删除、审计）
   */
  const handleRemoveNode = () => {
    data.onRequestRemove?.(id);
  };

  /**
   * 根据鼠标 X 坐标更新分割线位置（限制在 5% ~ 95%）
   *
   * 为什么要限制边界：
   * - 避免滑块被拖出可见区
   * - 保证左右两边始终有最小可见面积，便于用户判断对比结果
   */
  const updateSplitPercentByClientX = useCallback((clientX: number) => {
    const viewport = imageCompareViewportRef.current;
    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const rawPercent = ((clientX - rect.left) / rect.width) * 100;
    const clampedPercent = Math.max(5, Math.min(95, rawPercent));
    setSplitPercent(clampedPercent);
  }, []);

  /**
   * 开始拖拽分割线
   *
   * 说明：
   * - 这里只切换“拖拽中”状态
   * - 真正的位置更新在 window pointermove 监听里执行
   */
  const handleDividerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingDivider(true);
    updateSplitPercentByClientX(event.clientX);
  };

  /**
   * 拖拽生命周期监听（绑定到 window，确保鼠标移出节点后仍能继续拖）
   */
  useEffect(() => {
    if (!isDraggingDivider) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      updateSplitPercentByClientX(event.clientX);
    };

    const handlePointerUp = () => {
      setIsDraggingDivider(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingDivider, updateSplitPercentByClientX]);

  return (
    <div
      className="relative"
      style={{ width: `${cardWidth}px`, height: `${cardHeight}px` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="absolute -top-8 left-0 text-[15px] font-medium tracking-wide text-zinc-400">
        {data.title}
      </div>

      {/*
        对比节点当前只需要“输入端”：
        - 作为目标节点接收上游素材
        - 暂不提供输出端（后续若要串联下游节点再新增 source Handle）
      */}
      <Handle
        type="target"
        id="input"
        position={Position.Left}
        style={{
          top: '50%',
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

      {isNodeActive && hovered && (
        <button
          type="button"
          onClick={handleRemoveNode}
          className="nodrag absolute -top-[10px] -right-[10px] z-20 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-[#27272a] text-zinc-400 transition-colors hover:bg-zinc-600 hover:text-white"
          aria-label="删除对比节点"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {showConnectionMergeGlow && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[14px]">
          <div className="compare-node-merge-glint compare-node-merge-glint-top" />
          <div className="compare-node-merge-glint compare-node-merge-glint-bottom" />
        </div>
      )}

      {!isReady && (
        <div
          className="relative flex h-full w-full flex-col items-center justify-center rounded-[14px] bg-[#18181b]"
          style={{
            border: isNodeActive ? '2px solid rgba(113, 113, 122, 0.8)' : '1px solid rgba(63, 63, 70, 0.6)',
            boxShadow: isNodeActive ? '0 0 15px rgba(255, 255, 255, 0.05)' : '0 8px 18px rgba(0, 0, 0, 0.35)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" className="mb-3 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V6" strokeLinecap="round" />
            <path d="M15 18V6" strokeLinecap="round" />
            <rect x="5" y="6" width="4" height="12" rx="1" />
            <rect x="15" y="6" width="4" height="12" rx="1" />
          </svg>
          <span className="text-sm font-medium text-zinc-500">{data.emptyHintText}</span>
          {data.compareErrorMessage && (
            <span className="mt-3 px-6 text-center text-xs text-rose-400">{data.compareErrorMessage}</span>
          )}
        </div>
      )}

      {isReady && (
        <div
          className="relative h-full w-full overflow-hidden rounded-[14px] bg-[#18181b]"
          style={{
            border: isNodeActive ? '2px solid rgba(113, 113, 122, 0.8)' : '1px solid rgba(63, 63, 70, 0.6)',
            boxShadow: isNodeActive ? '0 0 15px rgba(255, 255, 255, 0.05)' : '0 8px 18px rgba(0, 0, 0, 0.35)',
          }}
        >
          {/*
            对比内容态（前端实现版）：
            - image: 使用“右图底层 + 左图裁切覆盖”的结构复刻原型
            - video/audio: 先给出可见占位与可播放控件，后续可升级为时间轴同步与拖拽分割
            - 所有数据来自 `compareMedia`（由装配层写入）
          */}
          <div className="relative h-full w-full overflow-hidden rounded-[12px] bg-black">
            {isImageCompare && compareMedia && (
              <div
                ref={imageCompareViewportRef}
                className="relative h-full w-full overflow-hidden"
                style={CHECKERBOARD_BACKGROUND_STYLE}
              >
                <img
                  src={compareMedia.rightMediaUrl}
                  alt={compareMedia.rightLabel ?? '对比右侧素材'}
                  className="absolute inset-0 h-full w-full object-contain"
                />
                <div
                  className="absolute inset-0"
                  style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
                >
                  <img
                    src={compareMedia.leftMediaUrl}
                    alt={compareMedia.leftLabel ?? '对比左侧素材'}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </div>

                <div className="absolute bottom-2 left-2 rounded border border-zinc-700/60 bg-black/80 px-2 py-1 text-xs text-zinc-300">
                  {compareMedia.leftLabel ?? '原始'}
                </div>
                <div className="absolute bottom-2 right-2 rounded bg-[#2563eb] px-3 py-1 text-xs text-white shadow-md">
                  {compareMedia.rightLabel ?? '生成'}
                </div>

                <div
                  role="slider"
                  aria-label="图片对比分割线"
                  aria-valuemin={5}
                  aria-valuemax={95}
                  aria-valuenow={Math.round(splitPercent)}
                  onPointerDown={handleDividerPointerDown}
                  className="nodrag absolute inset-y-0 z-10 w-[2px] -translate-x-1/2 cursor-ew-resize bg-white"
                  style={{ left: `${splitPercent}%`, touchAction: 'none' }}
                >
                  <div className="nodrag absolute top-1/2 left-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-md">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18-6-6 6-6" />
                      <path d="m15 18 6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {isVideoCompare && compareMedia && (
              <div className="flex h-full w-full gap-0.5 bg-[#111112] p-0">
                <video
                  src={compareMedia.leftMediaUrl}
                  controls
                  className="nodrag nowheel h-full w-1/2 rounded bg-black object-cover"
                />
                <video
                  src={compareMedia.rightMediaUrl}
                  controls
                  className="nodrag nowheel h-full w-1/2 rounded bg-black object-cover"
                />
              </div>
            )}

            {isAudioCompare && compareMedia && (
              <div className="flex h-full w-full flex-col gap-2 bg-[#111112] p-2">
                <div className="text-xs text-zinc-400">{compareMedia.leftLabel ?? '原始音频'}</div>
                <audio src={compareMedia.leftMediaUrl} controls className="nodrag nowheel w-full" />
                <div className="text-xs text-zinc-400">{compareMedia.rightLabel ?? '生成音频'}</div>
                <audio src={compareMedia.rightMediaUrl} controls className="nodrag nowheel w-full" />
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes compare-node-glint-slide {
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

        .compare-node-merge-glint {
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
          animation: compare-node-glint-slide 1.2s ease-in-out infinite;
        }

        .compare-node-merge-glint-top {
          top: 0;
        }

        .compare-node-merge-glint-bottom {
          bottom: 0;
          animation-delay: 0.14s;
        }
      `}</style>
    </div>
  );
}
