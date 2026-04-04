"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Handle,
  NodeProps,
  Position,
  useNodeConnections,
  useUpdateNodeInternals,
} from '@xyflow/react';
import {
  type ImageGenerationAspectRatio,
  type ImageGenerationPromptDraft,
  type ImageGenerationResolution,
  type ImageGenerationWorkflowNode,
} from './types';

const DEFAULT_CARD_WIDTH = 400;
const MIN_CARD_WIDTH = 340;
const MAX_CARD_WIDTH = 480;
const DEFAULT_EXPANDED_HEIGHT = 420;
const DEFAULT_COLLAPSED_HEIGHT = 88;
const COLLAPSED_PROMPT_PANEL_HEIGHT = 180;
const COLLAPSED_PROMPT_PANEL_GAP = 8;

/**
 * 图片生成节点卡片（React Flow 自定义节点）
 *
 * 职责边界（DDD 视角）：
 * - 这里只负责“展示层 UI + 本地交互”
 * - 不做领域规则判断（配额/风控/鉴权/计费）
 * - 不直接依赖后端实现细节（HTTP/Tauri/SDK）
 *
 * 对新手最重要的一句话：
 * - 你可以在这里改“长什么样、怎么交互”
 * - 但不要在这里写“业务规则和后端编排”
 */
export function ImageGenerationNodeCard({ id, data, selected }: NodeProps<ImageGenerationWorkflowNode>) {
  const updateNodeInternals = useUpdateNodeInternals();

  /**
   * 原型里卡片有 4 个视觉状态：
   * 1. 展开态（默认）
   * 2. 激活态（显示右上角关闭按钮）
   * 3. 收起态（只有底部工具条）
   * 4. 收起激活态（收起条 + 下方提示词面板）
   *
   * 当前实现策略：
   * - 用 `isCollapsed` 控制 1/3
   * - 用 `selected` 控制“是否激活”
   *
   * 你这次需求明确要求：
   * - 未点击卡片（未激活）时，不显示左右连接点
   * - 只有点击激活后才显示连接点
   */
  const [isCollapsed, setIsCollapsed] = useState(Boolean(data.isCollapsed));
  const [hovered, setHovered] = useState(false);
  const [promptText, setPromptText] = useState(data.promptText ?? '');
  const [modelName] = useState(data.modelName ?? 'Qwen Image Edit');
  const [aspectRatio] = useState<ImageGenerationAspectRatio>(data.aspectRatio ?? '1:1');
  const [resolution] = useState<ImageGenerationResolution>(data.resolution ?? '1K');

  /**
   * 节点宽度兜底与钳制
   *
   * 目的：
   * - 防止异常数据把卡片拉得过宽（你反馈的“右侧空白过大”就是这类视觉问题）
   * - 保证卡片始终落在原型可接受区间
   */
  const rawCardWidth = data.cardWidth ?? DEFAULT_CARD_WIDTH;
  const cardWidth = Math.max(MIN_CARD_WIDTH, Math.min(MAX_CARD_WIDTH, rawCardWidth));
  const expandedHeight = data.expandedHeight ?? DEFAULT_EXPANDED_HEIGHT;
  const collapsedHeight = data.collapsedHeight ?? DEFAULT_COLLAPSED_HEIGHT;

  const isNodeActive = Boolean(selected);
  const incomingConnectionsOnInputHandle = useNodeConnections({
    id,
    handleType: 'target',
    handleId: 'input',
  });
  const hasIncomingSourceOnInputHandle = incomingConnectionsOnInputHandle.length > 0;
  /**
   * 输入点显示规则（按你当前要求）：
   * 1. 节点激活时显示；
   * 2. 节点未激活但输入点已有来源时，也保持显示。
   *
   * 注意：
   * - 这个规则只作用在“输入点”；
   * - 输出点仍保持“仅激活态显示”。
   */
  const shouldShowInputHandle = isNodeActive || hasIncomingSourceOnInputHandle;
  const showCollapsedPromptPanel = isCollapsed && isNodeActive;

  const containerHeight = useMemo(() => {
    if (!isCollapsed) {
      return expandedHeight;
    }

    if (!showCollapsedPromptPanel) {
      return collapsedHeight;
    }

    return collapsedHeight + COLLAPSED_PROMPT_PANEL_GAP + COLLAPSED_PROMPT_PANEL_HEIGHT;
  }, [collapsedHeight, expandedHeight, isCollapsed, showCollapsedPromptPanel]);

  /**
   * Handle 的锚点高度需要根据状态计算：
   * - 展开态：取整卡片中线
   * - 收起态：固定在顶部工具条中线（即使下方展开了提示词面板）
   */
  const handleTopOffset = isCollapsed ? Math.round(collapsedHeight / 2) : Math.round(containerHeight / 2);

  /**
   * 收起/展开后，节点几何尺寸发生变化，需要刷新 React Flow 内部缓存。
   * 不主动刷新会导致连线锚点位置滞后。
   */
  useEffect(() => {
    updateNodeInternals(id);
  }, [cardWidth, containerHeight, handleTopOffset, id, isNodeActive, shouldShowInputHandle, updateNodeInternals]);

  /**
   * 触发“生成图片”动作
   *
   * 这里是前端调用后端能力的预留位。
   * 当前只调用回调（如果上层还没接，会 fallback 到 console 提示）。
   *
   * 后续接后端推荐路径：
   * 1. CanvasBoard 接住回调
   * 2. 调用 application 层 `CreateImageTaskUseCase`
   * 3. 再由 infrastructure 层适配 Tauri/Rust 函数
   */
  const handleGenerateImage = () => {
    const promptDraft: ImageGenerationPromptDraft = {
      promptText,
      modelName,
      aspectRatio,
      resolution,
    };

    if (data.onRequestGenerateImage) {
      data.onRequestGenerateImage(id, promptDraft);
      return;
    }

    console.info('[UI Placeholder] 图片节点触发生成，待接入后端函数。', {
      nodeId: id,
      draft: promptDraft,
    });
  };

  /**
   * 输入提示词变化时，先更新本地 UI，再向上抛出事件。
   *
   * 这样做的好处：
   * - 本地输入体验流畅
   * - 上层可以选择是否把草稿写入全局状态/持久化
   */
  const handlePromptTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextPromptText = event.currentTarget.value;
    setPromptText(nextPromptText);
    data.onRequestUpdatePromptText?.(id, nextPromptText);
  };

  const handleToggleCollapse = () => {
    setIsCollapsed((previous) => !previous);
  };

  const handleRemoveNode = () => {
    data.onRequestRemove?.(id);
  };

  return (
    <div
      className="relative"
      style={{ width: `${cardWidth}px`, height: `${containerHeight}px` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="absolute -top-7 left-0 max-w-[280px] truncate text-xs text-neutral-300">
        {data.title}
      </div>

      <Handle
        type="target"
        id="input"
        position={Position.Left}
        style={{
          top: `${handleTopOffset}px`,
          left: isNodeActive ? -7 : -6,
          transform: 'translate(0, -50%)',
          width: 12,
          height: 12,
          background: isNodeActive ? '#71717a' : '#52525b',
          border: isNodeActive ? '2px solid #18181b' : '1px solid #18181b',
          borderRadius: '999px',
          boxShadow: isNodeActive ? '0 0 8px rgba(255, 255, 255, 0.18)' : 'none',
          opacity: shouldShowInputHandle ? 1 : 0,
          pointerEvents: shouldShowInputHandle ? 'auto' : 'none',
          zIndex: 30,
          transition: 'all 0.2s ease',
        }}
      />
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

      {isNodeActive && hovered && (
        <button
          type="button"
          onClick={handleRemoveNode}
          className="nodrag absolute -top-3 -right-3 z-20 h-7 w-7 rounded-full border border-white/10 bg-[#27272a] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
          aria-label="删除图片节点"
        >
          <svg viewBox="0 0 24 24" className="mx-auto h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {!isCollapsed && (
        <div
          className="relative flex h-full w-full flex-col justify-between rounded-2xl border border-white/10 bg-[#18181b] p-5 shadow-2xl"
          style={{
            boxShadow: isNodeActive
              ? '0 0 0 1px rgba(82,82,91,0.7), 0 16px 42px rgba(0,0,0,0.55)'
              : '0 12px 32px rgba(0,0,0,0.45)',
          }}
        >
          <div className="pt-6 pl-4 text-xl font-light tracking-wide text-neutral-400">输入提示词...</div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-white/10 bg-[#121214] px-4 py-2 text-sm text-neutral-200">
              {modelName}
            </div>
            <button type="button" className="nodrag rounded-lg border border-white/10 bg-[#18181b] px-4 py-2 text-sm text-neutral-300">
              {aspectRatio}
            </button>
            <button type="button" className="nodrag rounded-lg border border-white/10 bg-[#18181b] px-4 py-2 text-sm text-neutral-300">
              {resolution}
            </button>
            <button
              type="button"
              onClick={handleGenerateImage}
              className="nodrag flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#18181b] text-white transition-colors hover:bg-white/10"
              aria-label="生成图片"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="nodrag flex w-6 justify-center text-neutral-500 transition-colors hover:text-neutral-300"
              aria-label="收起图片节点"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="flex flex-col gap-2">
          <div
            className="relative flex w-full flex-col rounded-2xl border border-white/10 bg-[#18181b] p-3 shadow-xl"
            style={{
              boxShadow: isNodeActive
                ? '0 0 0 1px rgba(82,82,91,0.6), 0 14px 36px rgba(0,0,0,0.5)'
                : '0 10px 24px rgba(0,0,0,0.45)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-white/10 bg-[#121214] px-4 py-2 text-sm text-neutral-200">
                {modelName}
              </div>
              <button type="button" className="nodrag rounded-lg border border-white/10 bg-[#18181b] px-4 py-2 text-sm text-neutral-300">
                {aspectRatio}
              </button>
              <button type="button" className="nodrag rounded-lg border border-white/10 bg-[#18181b] px-4 py-2 text-sm text-neutral-300">
                {resolution}
              </button>
              <button
                type="button"
                onClick={handleGenerateImage}
                className="nodrag flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#18181b] text-white transition-colors hover:bg-white/10"
                aria-label="生成图片"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleToggleCollapse}
                className="nodrag flex w-6 justify-center text-neutral-500 transition-colors hover:text-neutral-300"
                aria-label="展开图片节点"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 14l6-6 6 6" />
                  <path d="M6 20l6-6 6 6" />
                </svg>
              </button>
            </div>

            <div className="mt-2 flex w-full justify-center">
              <div
                className="h-1 rounded-full transition-all"
                style={{
                  width: isNodeActive ? '48px' : '40px',
                  background: isNodeActive ? '#2563eb' : '#3f3f46',
                  boxShadow: isNodeActive ? '0 0 8px rgba(37, 99, 235, 0.6)' : 'none',
                }}
              />
            </div>
          </div>

          {showCollapsedPromptPanel && (
            <div className="h-[180px] rounded-2xl border border-white/10 bg-[#18181b] p-2 shadow-xl">
              <div className="flex h-full rounded-xl border border-blue-900/50 bg-[#161619] p-4 ring-1 ring-blue-500/20">
                <textarea
                  className="nodrag nowheel h-full w-full resize-none border-none bg-transparent text-lg font-light tracking-wide text-neutral-300 outline-none placeholder:text-neutral-500"
                  value={promptText}
                  onChange={handlePromptTextChange}
                  placeholder="输入提示词..."
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
