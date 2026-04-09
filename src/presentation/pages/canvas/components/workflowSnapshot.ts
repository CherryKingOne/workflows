import { type Edge, type Viewport } from '@xyflow/react';
import { type CanvasWorkflowNode } from './canvas-nodes/types';

/**
 * 持久化节点（仅保留可 JSON 序列化的数据）
 */
export type PersistedCanvasNode = Omit<CanvasWorkflowNode, 'data'> & {
  data: Record<string, unknown>;
};

/**
 * 持久化连线
 */
export type PersistedCanvasEdge = Edge;

/**
 * 项目工作流快照（V1）
 */
export interface ProjectWorkflowSnapshotV1 {
  version: 'v1';
  projectId: string;
  viewport: Viewport;
  nodes: PersistedCanvasNode[];
  edges: PersistedCanvasEdge[];
  savedAt: number;
}

