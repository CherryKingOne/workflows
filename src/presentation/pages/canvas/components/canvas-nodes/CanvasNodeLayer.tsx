"use client";

import React from 'react';
import {
  ConnectionLineType,
  type Edge,
  type OnConnect,
  type OnEdgesChange,
  ReactFlow,
  type NodeTypes,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FileUploadNodeCard } from './FileUploadNodeCard';
import { ImageGenerationNodeCard } from './ImageGenerationNodeCard';
import { PreviewNodeCard } from './PreviewNodeCard';
import {
  FILE_UPLOAD_NODE_TYPE,
  IMAGE_GENERATION_NODE_TYPE,
  PREVIEW_NODE_TYPE,
  type CanvasWorkflowNode,
} from './types';

/**
 * React Flow 节点类型映射
 *
 * 特别注意：该对象定义在组件外部，避免每次渲染产生新引用导致性能抖动。
 * 这是 React Flow 官方推荐实践。
 */
const nodeTypes: NodeTypes = {
  [FILE_UPLOAD_NODE_TYPE]: FileUploadNodeCard,
  [IMAGE_GENERATION_NODE_TYPE]: ImageGenerationNodeCard,
  [PREVIEW_NODE_TYPE]: PreviewNodeCard,
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
}: CanvasNodeLayerProps) {
  return (
    <div className="canvas-node-layer w-[3200px] h-[2200px]">
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
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        minZoom={1}
        maxZoom={1}
      />
    </div>
  );
}
