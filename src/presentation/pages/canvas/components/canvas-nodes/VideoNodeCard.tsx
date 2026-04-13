"use client";

import React, { useMemo, useState } from 'react';
import {
  Handle,
  type NodeProps,
  Position,
  useConnection,
  useNodeConnections,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { type VideoWorkflowNode, type VideoGenerationMode } from './types';

const DEFAULT_CARD_WIDTH = 680;

/**
 * 视频生成节点卡片（React Flow 自定义节点）
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
 * - 内部居中显示"尝试"选项列表
 * - 左侧输入连接点 (target)、右侧输出连接点 (source)
 * - 节点标题显示在卡片外部左上角（absolute 定位）
 *
 * 样式1 底部操作面板（激活态显示）：
 * - Tab 切换：文生视频 / 全能参考 / 图生视频 / 首尾帧 / 图片参考
 * - 工具按钮：标记 / 运镜 / 角色库
 * - 提示词输入框
 * - 参数设置：模型选择 / 比例 / 清晰度 / 时长 / 音频等
 */
export function VideoNodeCard({ id, data, selected }: NodeProps<VideoWorkflowNode>) {
  const cardWidth = data.cardWidth ?? DEFAULT_CARD_WIDTH;
  const updateNodeInternals = useUpdateNodeInternals();

  // 本地状态 - 使用 activeTabKey 追踪当前选中的 Tab（解决多个 Tab 共用同一个 mode 的问题）
  const [promptText, setPromptText] = useState(data.promptText ?? '');
  const [activeTabKey, setActiveTabKey] = useState<string>('textToVideo');

  /**
   * 节点是否处于"激活态"
   *
   * 当前定义：只要被选中，就视为激活态。
   * 与原型保持一致：未激活时不显示连接点、关闭按钮和底部操作面板。
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
   * 监听连线状态，用于触发流光效果
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
  }, [cardWidth, id, isNodeActive, shouldShowInputHandle, updateNodeInternals]);

  const handleRemoveNode = () => {
    data.onRequestRemove?.(id);
  };

  const handlePromptTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextPromptText = event.currentTarget.value;
    setPromptText(nextPromptText);
    data.onRequestUpdatePromptText?.(id, nextPromptText);
  };

  const handleTabChange = (key: string, mode: VideoGenerationMode) => {
    setActiveTabKey(key);
    data.onRequestUpdateGenerationMode?.(id, mode);
  };

  /**
   * Tab 按钮配置
   * 每个Tab使用唯一的key来避免重复激活问题
   * toolButtons 定义该模式下显示的工具按钮
   */
  const modeTabs: { mode: VideoGenerationMode; label: string; key: string; toolButtons: string[] }[] = [
    { mode: 'textToVideo', label: '文生视频', key: 'textToVideo', toolButtons: ['marker', 'camera', 'character'] },
    { mode: 'imageToVideo', label: '全能参考', key: 'imageToVideo', toolButtons: ['marker', 'camera', 'character'] },
    { mode: 'imageToVideo', label: '图生视频', key: 'imageToVideo2', toolButtons: ['marker', 'camera'] },
    { mode: 'firstLastFrame', label: '首尾帧', key: 'firstLastFrame', toolButtons: ['marker', 'character'] },
    { mode: 'imageReference', label: '图片参考', key: 'imageReference', toolButtons: ['marker', 'camera', 'character'] },
  ];

  /**
   * 根据当前选中的 Tab key 获取应该显示的工具按钮
   */
  const currentToolButtons = modeTabs.find((tab) => tab.key === activeTabKey)?.toolButtons ?? ['marker', 'camera', 'character'];

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ width: `${cardWidth}px` }}
    >
      {/* 主卡片区域 */}
      <div className="relative flex items-center justify-center w-full">
        {/* 左侧输入连接点 (target) */}
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

        {/* 视频卡片 */}
        <div className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-[24px] p-8 aspect-video flex flex-col shadow-2xl relative">
          {/* 节点标题（卡片外部左上角） */}
          <div className="absolute -top-8 left-0 text-[15px] font-medium tracking-wide text-[#888888] flex items-center gap-2 whitespace-nowrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
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
      </div>

      {/* 底部操作面板 - 仅激活态显示 */}
      {isNodeActive && (
        <div className="w-full mt-4 bg-[#1a1a1a] border border-white/10 rounded-[20px] p-5 shadow-xl">
          {/* Tab 切换 */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex bg-[#0c0c0c] p-1 rounded-xl">
              {modeTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key, tab.mode)}
                  className={`nodrag px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTabKey === tab.key
                      ? 'bg-[#2a2a2a] text-white'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {/* 全屏按钮 */}
            <button
              type="button"
              className="text-white/40 hover:text-white transition-colors"
              aria-label="全屏"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
          </div>

          {/* 工具按钮 */}
          <div className="flex gap-2.5 mb-5">
            {/* 标记按钮 */}
            {currentToolButtons.includes('marker') && (
              <button
                type="button"
                className="nodrag flex flex-col items-center justify-center w-14 h-14 bg-[#0c0c0c] border border-white/5 rounded-xl text-sm text-white/40 hover:border-white/20 hover:text-white/80 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 384 512" fill="currentColor" className="mb-1.5">
                  <path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/>
                </svg>
                标记
              </button>
            )}
            {/* 运镜按钮 */}
            {currentToolButtons.includes('camera') && (
              <button
                type="button"
                className="nodrag flex flex-col items-center justify-center w-14 h-14 bg-[#0c0c0c] border border-white/5 rounded-xl text-sm text-white/40 hover:border-white/20 hover:text-white/80 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" className="mb-1.5">
                  <path d="M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z"/>
                </svg>
                运镜
              </button>
            )}
            {/* 角色库按钮 */}
            {currentToolButtons.includes('character') && (
              <button
                type="button"
                className="nodrag flex flex-col items-center justify-center w-14 h-14 bg-[#0c0c0c] border border-white/5 rounded-xl text-sm text-white/40 hover:border-white/20 hover:text-white/80 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 640 512" fill="currentColor" className="mb-1.5">
                  <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H322.8c-3.1-8.8-3.7-18.4-1.4-27.8l15-60.1c2.8-11.3 8.6-21.5 16.8-29.7l40.3-40.3c-32.1-31-75.7-50.1-123.9-50.1H178.3zm435.5-68.3c-15.6-15.6-40.9-15.6-56.6 0l-29.4 29.4 71 71 29.4-29.4c15.6-15.6 15.6-40.9 0-56.6l-14.4-14.4zM375.9 417c-4.1 4.1-7 9.2-8.4 14.9l-15 60.1c-1.4 5.5 .2 11.2 4.2 15.2s9.7 5.6 15.2 4.2l60.1-15c5.6-1.4 10.8-4.3 14.9-8.4L576.1 358.7l-71-71L375.9 417z"/>
                </svg>
                角色库
              </button>
            )}
          </div>

          {/* 提示词输入框 */}
          <textarea
            className="nodrag nowheel w-full bg-transparent border-none focus:ring-0 focus:outline-none text-[14px] text-white/80 placeholder-white/20 h-20 resize-none"
            placeholder="描述你想要生成的画面内容，@引用素材"
            value={promptText}
            onChange={handlePromptTextChange}
          />

          {/* 底部参数栏 */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            {/* 左侧参数 */}
            <div className="flex items-center gap-4 text-[12px] text-white/60">
              {/* 模型选择 */}
              <button
                type="button"
                className="nodrag flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 512 512" fill="currentColor" className="text-white/80">
                  <path d="M64 64c0-17.7-14.3-32-32-32S0 46.3 0 64V400c0 44.2 35.8 80 80 80H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H80c-8.8 0-16-7.2-16-16V64zm406.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L320 210.7l-57.4-57.4c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L240 221.3l57.4 57.4c12.5 12.5 32.8 12.5 45.3 0l128-128z"/>
                </svg>
                Seedance 2.0 VIP
                <span className="bg-[#f3a73c] text-black text-[9px] px-1 rounded font-bold leading-tight">VIP</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>

              {/* 比例/清晰度/时长 */}
              <button
                type="button"
                className="nodrag flex items-center gap-2 bg-[#252525] px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-[#333] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 448 512" fill="currentColor" className="text-white/40">
                  <path d="M384 80c8.8 0 16 7.2 16 16V416c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V96c0-8.8 7.2-16 16-16H384zM64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64z"/>
                </svg>
                16:9 · 720P · 5s
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 576 512" fill="currentColor" className="text-white/40">
                  <path d="M0 128C0 92.7 28.7 64 64 64H512c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zM64 128V384H512V128H64z"/>
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m18 15-6-6-6 6"/>
                </svg>
              </button>
            </div>

            {/* 右侧操作 */}
            <div className="flex items-center gap-5">
              {/* 语言 */}
              <button
                type="button"
                className="text-white/40 hover:text-white cursor-pointer transition-colors"
                aria-label="语言"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 640 512" fill="currentColor">
                  <path d="M0 128C0 92.7 28.7 64 64 64H512c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zm320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H320zm-96 96c-17.7 0-32 14.3-32 32s14.3 32 32 32h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H224zm128 0c-17.7 0-32 14.3-32 32s14.3 32 32 32h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H352zM96 224c-17.7 0-32 14.3-32 32s14.3 32 32 32h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/>
                </svg>
              </button>

              {/* 高级设置 */}
              <button
                type="button"
                className="text-white/40 hover:text-white cursor-pointer transition-colors"
                aria-label="高级设置"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 512 512" fill="currentColor">
                  <path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.6 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.6-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.6-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.6 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/>
                </svg>
              </button>

              {/* 生成数量 */}
              <button
                type="button"
                className="nodrag text-[12px] text-white/60 flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
              >
                1个
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>

              {/* 积分显示 */}
              <div className="text-[12px] text-white/40 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 448 512" fill="currentColor" className="text-[#f3a73c]">
                  <path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.6-13.7 22.9-9.2 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.6 13.7-22.9 9.2-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/>
                </svg>
                108 / 135
              </div>

              {/* 生成按钮 */}
              <button
                type="button"
                className="nodrag bg-white/20 w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/30 transition-all"
                aria-label="生成视频"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 384 512" fill="currentColor" className="text-white">
                  <path d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.3V448c0 17.7 14.3 32 32 32s32-14.3 32-32V141.3L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

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
