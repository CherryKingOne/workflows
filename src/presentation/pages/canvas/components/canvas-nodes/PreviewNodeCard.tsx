"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Handle,
  type NodeProps,
  Position,
  useConnection,
  useNodeConnections,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { type PreviewWorkflowNode } from './types';

const DEFAULT_CARD_WIDTH = 540;
const DEFAULT_CARD_HEIGHT = 340;
const MIN_CARD_WIDTH = 420;
const MAX_CARD_WIDTH = 640;
const MIN_CARD_HEIGHT = 260;
const MAX_CARD_HEIGHT = 440;

/**
 * 预览节点卡片（React Flow 自定义节点）
 *
 * DDD 职责边界（请新同学先看这段）：
 * - 当前文件只负责“预览节点长什么样、有哪些前端交互”
 * - 不负责“预览结果从哪里来、如何持久化、如何鉴权”
 * - 不直接调用后端命令（Tauri/Rust）或 HTTP
 *
 * 为什么要这样做：
 * - 这能保持 presentation 层轻量，避免 UI 组件变成“超级业务组件”
 * - 后续如果后端能力变化（例如从本地函数改为云函数），卡片样式代码无需重写
 *
 * 后端联调时的推荐链路：
 * 1. 该卡片触发交互（例如点击“刷新预览”）
 * 2. 通过回调上抛到 CanvasBoard（装配层）
 * 3. CanvasBoard 调用 application 层用例函数
 * 4. application 层再调 infrastructure 适配器（Tauri/Rust）
 *
 * 重要说明（当前实现状态）：
 * - 当前卡片还没有真正渲染“图片/视频预览内容”
 * - 现在展示的是“空状态占位文案 + 图标”
 * - 这样做是为了先把节点骨架、交互边界、联调入口固定下来
 *
 * 为什么这里要明确写清楚“未实现预览渲染”：
 * - 避免新同学误以为“预览能力已经完整上线”
 * - 避免把后续媒体渲染逻辑直接堆到 CanvasBoard，破坏分层
 *
 * 后续要支持“图片/视频预览”时，建议按下面顺序新增（只做结构说明）：
 * 1. 在 `types.ts` 的 `PreviewNodeData` 新增“可渲染媒体数据”字段
 *    例如：`previewMedia?: { kind: 'image' | 'video'; url: string; mimeType: string }`
 * 2. 在 CanvasBoard 的 `handleRequestSyncPreview` 中，把后端返回结果映射到该字段
 * 3. 在本组件中根据 `previewMedia.kind` 分支渲染 `<img>` 或 `<video>`
 * 4. 保留当前空状态作为兜底（无媒体时仍可正常展示）
 *
 * 后续要新增“音频预览”时，建议这样扩展：
 * 1. 先扩展数据契约：`kind` 从 `'image' | 'video'` 扩到 `'image' | 'video' | 'audio'`
 * 2. 在当前组件新增 `audio` 分支渲染 `<audio controls>`
 * 3. 若要展示封面/波形图，新增独立子组件，不要把复杂 UI 全塞在当前文件
 *
 * 删除相关（给接手同学）：
 * - 删除动作统一通过 `onRequestRemove` 回调上抛
 * - 当前组件不直接改节点数组，这能保持“展示层不持有全局写权限”的边界
 * - 真正删除执行在 CanvasBoard（或未来 application 命令）中完成
 *
 * 重构相关（后续文件变大时）：
 * - 把媒体渲染区拆为 `PreviewNodeMediaContent`
 * - 把空状态拆为 `PreviewNodeEmptyState`
 * - 把顶部动作区（关闭、刷新、更多操作）拆为 `PreviewNodeActions`
 * - 当前文件保留“状态选择 + 结构装配”，避免继续膨胀成超大组件
 */
export function PreviewNodeCard({ id, data, selected }: NodeProps<PreviewWorkflowNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const [hovered, setHovered] = useState(false);

  /**
   * 尺寸钳制（防止异常值把卡片拉坏）
   *
   * 新手常见问题：
   * - 在某处把宽高写成了 0 或非常大
   * - 导致 React Flow 节点布局异常
   *
   * 这里做一次防御性钳制，保障节点在可阅读区间内。
   */
  const cardWidth = useMemo(() => {
    const rawWidth = data.cardWidth ?? DEFAULT_CARD_WIDTH;
    return Math.max(MIN_CARD_WIDTH, Math.min(MAX_CARD_WIDTH, rawWidth));
  }, [data.cardWidth]);

  const cardHeight = useMemo(() => {
    const rawHeight = data.cardHeight ?? DEFAULT_CARD_HEIGHT;
    return Math.max(MIN_CARD_HEIGHT, Math.min(MAX_CARD_HEIGHT, rawHeight));
  }, [data.cardHeight]);

  const isNodeActive = Boolean(selected);
  const incomingConnectionsOnInputHandle = useNodeConnections({
    id,
    handleType: 'target',
    handleId: 'input',
  });
  const hasIncomingSourceOnInputHandle = incomingConnectionsOnInputHandle.length > 0;
  const isInputHandleConnected = hasIncomingSourceOnInputHandle;
  /**
   * 输入点显示规则（按你的统一要求）：
   * 1. 节点激活时显示；
   * 2. 节点未激活但输入点已有来源时，也保持显示。
   *
   * 注意：
   * - 该规则仅作用于输入点；
   * - 输出点仍保持“仅激活态显示”。
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
   * 连线命中输入点时显示上下流光（拖线未松手）
   *
   * 触发条件（对齐对比卡片）：
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
   * 当节点尺寸或选中态变化时，刷新 React Flow 内部几何缓存。
   *
   * 不主动刷新时，连线锚点位置可能会滞后一帧，尤其在边框粗细变化时更明显。
   */
  useEffect(() => {
    updateNodeInternals(id);
  }, [cardHeight, cardWidth, id, isNodeActive, shouldShowInputHandle, updateNodeInternals]);

  /**
   * 删除节点入口（只做事件上抛，不直接改全局状态）
   *
   * 这么设计的核心原因：
   * - 子组件只关心“用户点了删除”
   * - 父级装配层才有资格决定“如何删除 + 是否需要清理关联资源”
   *
   * 未来如果删除逻辑升级（例如删除确认弹窗、依赖检查、审计日志）：
   * - 仍然从这里抛事件
   * - 在 CanvasBoard / application 层扩展，不要把流程编排塞进当前卡片
   */
  const handleRemoveNode = () => {
    data.onRequestRemove?.(id);
  };

  return (
    <div
      className="relative"
      style={{ width: `${cardWidth}px`, height: `${cardHeight}px` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="absolute -top-8 left-0 text-[15px] font-medium tracking-wide text-[#888888]">
        {data.title}
      </div>

      {/*
        交互规则与画布其它节点保持一致：
        - 未激活（未选中）时，隐藏连接点
        - 激活（选中）后，显示连接点，允许连线
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

      <Handle
        type="source"
        id="output"
        position={Position.Right}
        style={{
          top: '50%',
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

      {showConnectionMergeGlow && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[14px]">
          <div className="preview-node-merge-glint preview-node-merge-glint-top" />
          <div className="preview-node-merge-glint preview-node-merge-glint-bottom" />
        </div>
      )}

      {hovered && (
        <button
          type="button"
          onClick={handleRemoveNode}
          className="nodrag absolute -top-[10px] -right-[10px] z-20 flex h-[20px] w-[20px] items-center justify-center rounded-full border border-[#444] bg-[#2a2a2b] text-[#999999] transition-colors hover:bg-[#333333]"
          aria-label="删除预览节点"
        >
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      <div
        className="relative flex h-full w-full flex-col items-center justify-center rounded-[14px] bg-[#161618] px-6 text-center"
        style={{
          border: isNodeActive ? '2px solid #99999a' : '1px solid #2a2a2c',
          boxShadow: isNodeActive ? '0 0 12px rgba(255, 255, 255, 0.1)' : 'none',
        }}
      >
        {/*
          预览内容区（当前是“空状态占位版本”）
          
          当前阶段为什么只保留空状态：
          - 本次任务聚焦“节点卡片设计与交接注释”
          - 真正媒体预览涉及后端结果契约、状态管理、错误兜底，需分阶段接入

          后续落地图片/视频/音频渲染时的建议顺序：
          1. 先判断 `data` 是否存在可用媒体
          2. 有媒体 -> 渲染媒体组件（image/video/audio）
          3. 无媒体 -> 回退到当前空状态
          4. 媒体加载失败 -> 显示错误占位（建议独立子组件）

          重构提醒：
          - 该区域会随着媒体类型变多而复杂化
          - 一旦出现 2 种以上媒体分支，优先拆子组件，避免 `if/else` 链爆炸
        */}
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="mb-4">
          <path
            d="M12 5C7 5 2.73 8.11 1 12C2.73 15.89 7 19 12 19C17 19 21.27 15.89 23 12C21.27 8.11 17 5 12 5Z"
            stroke="#4a4a4c"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="3.5" stroke="#4a4a4c" strokeWidth="2" />
          <circle cx="12" cy="12" r="1.5" fill="#4a4a4c" />
        </svg>

        <p className="text-[15px] tracking-wide text-[#999999]">{data.primaryHintText}</p>
        <p className="mt-3 text-[13px] tracking-wide text-[#666666]">{data.secondaryHintText}</p>
      </div>

      <style jsx>{`
        @keyframes preview-node-glint-slide {
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

        .preview-node-merge-glint {
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
          animation: preview-node-glint-slide 1.2s ease-in-out infinite;
        }

        .preview-node-merge-glint-top {
          top: 0;
        }

        .preview-node-merge-glint-bottom {
          bottom: 0;
          animation-delay: 0.14s;
        }
      `}</style>
    </div>
  );
}
