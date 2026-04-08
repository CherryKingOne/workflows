"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Handle,
  NodeProps,
  Position,
  useConnection,
  useNodeConnections,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { type FileUploadWorkflowNode } from './types';
import { MediaPreviewModal } from './MediaPreviewModal';

/**
 * 上传文件节点卡片（React Flow 自定义节点）
 *
 * 职责边界（给新手）：
 * - 这里只负责“卡片 UI 展示 + 本地交互事件触发”
 * - 不负责直接发请求、不负责业务规则判断、不负责数据持久化
 *
 * 为什么要这样做：
 * - 这符合 DDD 的“展示层只做展示和交互”的职责边界
 * - 后续换后端实现（Tauri / 本地函数 / 其它适配器）时，不需要重写卡片 UI
 *
 * 后续扩展建议：
 * - 新增字段（例如文件大小上限、支持格式）优先加到 `FileUploadNodeData`
 * - 新增行为（例如重试上传、查看日志）通过回调函数继续向上抛给装配层
 */
export function FileUploadNodeCard({ id, data, selected }: NodeProps<FileUploadWorkflowNode>) {
  const [previewOpen, setPreviewOpen] = useState(false);
  /**
   * 获取“无后缀”的展示名
   *
   * 规则：
   * - `photo.png` -> `photo`
   * - `archive.tar.gz` -> `archive.tar`
   * - 无后缀时原样返回
   */
  const toDisplayNameWithoutExtension = (fullName: string) => {
    const lastDotIndex = fullName.lastIndexOf('.');
    if (lastDotIndex <= 0) {
      return fullName;
    }
    return fullName.slice(0, lastDotIndex);
  };

  /**
   * 节点是否处于“激活态”
   *
   * 当前定义：只要被选中，就视为激活态。
   * 与原型保持一致：未激活时不显示连接点和右上角关闭按钮。
   */
  const isNodeActive = selected;
  const updateNodeInternals = useUpdateNodeInternals();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const firstAsset = data.selectedAssets?.[0];
  const hasSelectedAssets = Boolean(data.selectedAssets && data.selectedAssets.length > 0);
  const incomingConnectionsOnInputHandle = useNodeConnections({
    id,
    handleType: 'target',
    handleId: 'input',
  });
  const hasIncomingSourceOnInputHandle = incomingConnectionsOnInputHandle.length > 0;
  const isInputHandleConnected = hasIncomingSourceOnInputHandle;
  /**
   * 输入点显示规则（按你最新需求）：
   * 1. 卡片激活时显示；
   * 2. 即使卡片未激活，只要输入点已有上游连线，也保持显示。
   *
   * 目的：
   * - 让用户在画布缩放/切换选中后，仍能快速看出“该节点已接入输入来源”。
   */
  const shouldShowInputHandle = isNodeActive || hasIncomingSourceOnInputHandle;
  const cardWidth = data.cardWidth ?? 320;
  const cardHeight = data.cardHeight ?? 320;
  const isImageAsset = Boolean(firstAsset && firstAsset.mimeType.startsWith('image/'));
  const isVideoAsset = Boolean(firstAsset && firstAsset.mimeType.startsWith('video/'));
  const isAudioAsset = Boolean(firstAsset && firstAsset.mimeType.startsWith('audio/'));
  const shouldRenderFillMedia = hasSelectedAssets && (isImageAsset || isVideoAsset);
  const topDisplayName = hasSelectedAssets
    ? toDisplayNameWithoutExtension(firstAsset?.name ?? data.title)
    : data.title;
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
   * 连线命中输入点时显示上下流光（仅拖线进行中）
   *
   * 触发条件（与你给的要求一致）：
   * 1. 当前正在拖线（鼠标未松开）
   * 2. 当前拖线目标命中本节点 input handle
   * 3. 非“自己连自己”场景
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
   * 当激活态切换时，主动通知 React Flow 重新计算 handle 几何信息。
   *
   * 背景原因：
   * - 我们会在未激活时把 handle 尺寸收缩为 0（避免连线和卡片产生可见空隙）
   * - React Flow 需要刷新一次内部缓存，边线锚点才能立即对齐新尺寸
   */
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, isNodeActive, shouldShowInputHandle, cardWidth, cardHeight, updateNodeInternals]);

  /**
   * 上传按钮点击处理
   *
   * 当前仅触发上层回调，方便后续接入真实后端函数。
   * 这里特别强调“函数调用优先”，避免默认走 HTTP 接口堆叠。
   */
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  /**
   * 本地文件选择完成后回调
   *
   * 这里把原生 FileList 转为 File[] 再交给装配层。
   * 装配层负责：
   * - 文件类型校验
   * - 更新节点展示态
   * - 调用后端函数（后续接入）
   */
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    data.onRequestBackendUpload?.(id, selectedFiles);
    // 允许再次选择同一个文件（不清空的话同名同文件重复选择可能不触发 change）。
    event.currentTarget.value = '';
  };

  /**
   * 删除节点按钮点击处理
   *
   * 依然是抛给上层，由装配层统一维护节点列表状态。
   * 这样做可以避免子组件私自改全局状态，降低后续维护成本。
   */
  const handleRemoveNode = () => {
    data.onRequestRemove?.(id);
  };

  return (
    <div
      className={`relative rounded-2xl border ${
        selected ? 'border-neutral-500 shadow-[0_0_20px_rgba(255,255,255,0.05)]' : 'border-transparent'
      } bg-[#18191c] flex flex-col items-center justify-center text-neutral-300`}
      style={{ width: `${cardWidth}px`, height: `${cardHeight}px` }}
    >
      <div
        className={`absolute inset-0 rounded-2xl overflow-hidden ${
          hasSelectedAssets ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {shouldRenderFillMedia && firstAsset?.previewUrl && (
          <>
            {isImageAsset && (
              <img
                src={firstAsset.previewUrl}
                alt={firstAsset.name}
                className="absolute inset-0 h-full w-full object-cover cursor-zoom-in"
                onDoubleClick={() => setPreviewOpen(true)}
              />
            )}
            {isVideoAsset && (
              <video
                src={firstAsset.previewUrl}
                controls
                className="absolute inset-0 h-full w-full object-cover bg-black cursor-zoom-in"
                onDoubleClick={() => setPreviewOpen(true)}
              />
            )}
          </>
        )}
      </div>

      {/*
        Handle 不能用 display:none 隐藏，这是 React Flow 官方的已知约束。
        当前场景直接显示连接点，既符合原型也避免未来连线时的尺寸计算问题。
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
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl">
          <div className="upload-node-merge-glint upload-node-merge-glint-top" />
          <div className="upload-node-merge-glint upload-node-merge-glint-bottom" />
        </div>
      )}

      <div
        className="absolute left-0 top-[-26px] truncate text-[12px] text-neutral-300"
        style={{ maxWidth: `${Math.max(120, cardWidth - 40)}px` }}
      >
        {topDisplayName}
      </div>

      {/*
        `nodrag` 是 React Flow 推荐写法：
        - 防止点击按钮时误触发节点拖拽
        - 后续如果在卡片内加 input/select，也继续沿用这个类名
      */}
      {isNodeActive && (
        <button
          type="button"
          onClick={handleRemoveNode}
          className="nodrag absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full border border-neutral-700 bg-[#2a2d32] text-neutral-400 hover:text-white transition-colors"
          aria-label="删除上传文件节点"
        >
          ×
        </button>
      )}

      {!hasSelectedAssets && (
        <button
          type="button"
          onClick={handleSelectFile}
          className="nodrag border border-neutral-700 bg-[#1e2023] hover:border-neutral-500 text-neutral-200 text-sm px-5 py-2 rounded-xl transition-all"
        >
          选择文件
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.mp3,.jpeg,.jpg,.png,.bmp,.webp,.mp4,.mov,image/jpeg,image/jpg,image/png,image/bmp,image/webp,audio/wav,audio/mpeg,audio/mp3,video/mp4,video/quicktime"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {!hasSelectedAssets && (
        <div className="mt-4 text-center text-[11px] leading-5 w-full px-6">
          {data.uploadErrorMessage ? (
            <div className="text-rose-400">{data.uploadErrorMessage}</div>
          ) : (
            <div className="text-neutral-500">
              {data.hintLines.map((line) => (
                <div key={`${id}-${line}`}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {hasSelectedAssets && isAudioAsset && firstAsset?.previewUrl && (
        <div className="z-10 w-[220px] rounded-lg border border-white/10 bg-black/35 px-2 py-2">
          <audio
            src={firstAsset.previewUrl}
            controls
            className="nodrag nowheel w-full h-8"
            onDoubleClick={() => setPreviewOpen(true)}
          />
          <p
            className="mt-1 text-center text-[10px] text-neutral-500 cursor-zoom-in select-none"
            onDoubleClick={() => setPreviewOpen(true)}
          >
            双击放大
          </p>
        </div>
      )}

      {previewOpen && firstAsset?.previewUrl && (
        <MediaPreviewModal
          url={firstAsset.previewUrl}
          mimeType={firstAsset.mimeType}
          name={firstAsset.name}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      <style jsx>{`
        @keyframes upload-node-glint-slide {
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

        .upload-node-merge-glint {
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
          animation: upload-node-glint-slide 1.2s ease-in-out infinite;
        }

        .upload-node-merge-glint-top {
          top: 0;
        }

        .upload-node-merge-glint-bottom {
          bottom: 0;
          animation-delay: 0.14s;
        }
      `}</style>
    </div>
  );
}
