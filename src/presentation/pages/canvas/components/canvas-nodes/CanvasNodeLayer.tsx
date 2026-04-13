"use client";

import React from 'react';
import {
  ConnectionLineType,
  type Edge,
  MiniMap,
  type OnConnect,
  type OnEdgesChange,
  type OnMove,
  ReactFlow,
  type NodeTypes,
  type OnNodesChange,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CompareNodeCard } from './CompareNodeCard';
import { FileUploadNodeCard } from './FileUploadNodeCard';
import { ImageGenerationNodeCard } from './ImageGenerationNodeCard';
import { PreviewNodeCard } from './PreviewNodeCard';
import { VideoNodeCard } from './VideoNodeCard';
import {
  COMPARE_NODE_TYPE,
  FILE_UPLOAD_NODE_TYPE,
  IMAGE_GENERATION_NODE_TYPE,
  PREVIEW_NODE_TYPE,
  VIDEO_NODE_TYPE,
  type CanvasWorkflowNode,
} from './types';

/**
 * React Flow 节点类型映射
 *
 * 特别注意：该对象定义在组件外部，避免每次渲染产生新引用导致性能抖动。
 * 这是 React Flow 官方推荐实践。
 */
const nodeTypes: NodeTypes = {
  [COMPARE_NODE_TYPE]: CompareNodeCard,
  [FILE_UPLOAD_NODE_TYPE]: FileUploadNodeCard,
  [IMAGE_GENERATION_NODE_TYPE]: ImageGenerationNodeCard,
  [PREVIEW_NODE_TYPE]: PreviewNodeCard,
  [VIDEO_NODE_TYPE]: VideoNodeCard,
};

interface CanvasNodeLayerProps {
  /**
   * 画布节点列表
   *
   * 由上层装配组件（CanvasBoard）管理，当前组件只负责渲染。
   */
  nodes: CanvasWorkflowNode[];

  /**
   * 连线数据列表
   *
   * 由上层统一管理，确保连线状态和节点状态可一起进入后续持久化流程。
   */
  edges: Edge[];

  /**
   * 节点变更回调（位置移动、选中状态变化等）
   *
   * 由上层统一接管，便于未来接入：
   * - undo/redo
   * - 持久化
   * - 协同编辑
   */
  onNodesChange: OnNodesChange<CanvasWorkflowNode>;

  /**
   * 连线变更回调（删除/重连等）
   */
  onEdgesChange: OnEdgesChange;

  /**
   * 节点连接回调（用户从连接点拖线并完成连接）
   */
  onConnect: OnConnect;

  /**
   * 初始视口（平移 + 缩放）
   *
   * 说明：
   * - 由上层传入默认值，保持历史初始视角体验
   * - 后续实际拖拽/缩放由 React Flow 内部接管
   */
  initialViewport: Viewport;

  /**
   * 视口变更回调（平移、滚轮缩放）
   *
   * 上层用它来同步：
   * - 右键菜单坐标换算
   * - 画布外层辅助 UI（如浮动工具栏）
   */
  onViewportChange: (viewport: Viewport) => void;
}

/**
 * 画布节点渲染层
 *
 * 职责边界（给新手）：
 * - 这里只做 React Flow 容器渲染和交互能力装配
 * - 不做右键菜单状态管理
 * - 不做节点创建策略判断
 * - 不做后端调用
 */
export function CanvasNodeLayer({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  initialViewport,
  onViewportChange,
}: CanvasNodeLayerProps) {
  const handleMove = React.useCallback<OnMove>(
    (_, viewport) => {
      onViewportChange(viewport);
    },
    [onViewportChange],
  );

  return (
    <div className="canvas-node-layer w-full h-full">
      <style jsx global>{`
        @keyframes canvas-connection-dash-flow {
          to {
            stroke-dashoffset: -10;
          }
        }

        .canvas-node-layer .react-flow__edge-path {
          stroke: #a3a3a3;
          stroke-width: 2;
          fill: none;
          transition: stroke 0.2s ease, stroke-width 0.2s ease;
        }

        .canvas-node-layer .react-flow__edge:hover .react-flow__edge-path {
          stroke: #d4d4d4;
          stroke-width: 2.5;
        }

        .canvas-node-layer .react-flow__connection-path {
          stroke: #737373;
          stroke-width: 2;
          stroke-dasharray: 6 4;
          animation: canvas-connection-dash-flow 0.5s linear infinite;
          fill: none;
        }

        .canvas-node-layer .react-flow__minimap {
          cursor: default;
        }

        .canvas-node-layer .react-flow__minimap-mask {
          cursor: grab;
        }

        .canvas-node-layer .react-flow__minimap-mask:active {
          cursor: grabbing;
        }
      `}</style>

      {/*
        React Flow 容器必须有明确宽高，否则节点会“看起来像没渲染”。
        这是 React Flow 初学者最常踩的坑之一。
      */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        defaultViewport={initialViewport}
        onMove={handleMove}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{
          stroke: '#737373',
          strokeWidth: 2,
          strokeDasharray: '6 4',
        }}
        defaultEdgeOptions={{
          type: 'default',
          style: {
            stroke: '#a3a3a3',
            strokeWidth: 2,
          },
        }}
        className="!bg-transparent"
        proOptions={{ hideAttribution: true }}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.4}
        maxZoom={1.8}
      >
        <MiniMap
          pannable
          style={{
            backgroundColor: '#1C1C1E',
            borderRadius: 8,
            border: '1px solid #333',
          }}
          nodeColor="#5C5C5E"
          maskColor="rgba(0, 0, 0, 0.7)"
          maskStrokeColor="#E5E7EB"
          maskStrokeWidth={1.2}
        />
      </ReactFlow>
    </div>
  );
}
