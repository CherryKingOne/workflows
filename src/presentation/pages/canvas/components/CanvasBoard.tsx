"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type OnEdgesChange,
  type OnNodesChange,
  type Viewport,
} from '@xyflow/react';
import { useRouter } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import { Project } from '../../../../domain/project/entities/Project';
import { ApiSettingsModal } from './modals/ApiSettingsModal';
import { StorageModal } from './modals/StorageModal';
import { useApiConfigs } from '../../../hooks/useApiConfigs';
import { useStorage } from '../../../hooks/useStorage';
import { CanvasNodeLayer } from './canvas-nodes/CanvasNodeLayer';
import { UploadedAssetFloatingToolbar } from './toolbars/UploadedAssetFloatingToolbar';
import {
  COMPARE_NODE_TYPE,
  type CanvasWorkflowNode,
  FILE_UPLOAD_NODE_TYPE,
  IMAGE_GENERATION_NODE_TYPE,
  PREVIEW_NODE_TYPE,
  type CompareWorkflowNode,
  type FileUploadAssetSummary,
  type FileUploadWorkflowNode,
  type ImageGenerationPromptDraft,
  type ImageGenerationWorkflowNode,
  type PreviewWorkflowNode,
} from './canvas-nodes/types';

/**
 * 上传文件支持的 MIME 前缀
 *
 * 当前需求明确只支持图片、视频、音频，所以前端先做一层兜底校验。
 * 后续后端仍需保留同等校验，前后端双保险更稳妥。
 */
const SUPPORTED_UPLOAD_MIME_PREFIXES = ['image/', 'video/', 'audio/'] as const;
const SUPPORTED_UPLOAD_FILE_ACCEPT =
  '.wav,.mp3,.jpeg,.jpg,.png,.bmp,.webp,.mp4,.mov,image/jpeg,image/jpg,image/png,image/bmp,image/webp,audio/wav,audio/mpeg,audio/mp3,video/mp4,video/quicktime';
const DEFAULT_COMPARE_NODE_CARD_WIDTH = 380;
const DEFAULT_COMPARE_NODE_CARD_HEIGHT = 240;
const DEFAULT_COMPARE_NODE_READY_CARD_HEIGHT = 260;
const MAX_COMPARE_NODE_CARD_LONG_SIDE = 460;
const MIN_COMPARE_NODE_CARD_SHORT_SIDE = 200;
const DEFAULT_FILE_UPLOAD_CARD_WIDTH = 320;
const DEFAULT_FILE_UPLOAD_CARD_HEIGHT = 320;
const DEFAULT_IMAGE_NODE_CARD_WIDTH = 400;
const DEFAULT_IMAGE_NODE_EXPANDED_HEIGHT = 380;
const DEFAULT_IMAGE_NODE_COLLAPSED_HEIGHT = 88;
const DEFAULT_PREVIEW_NODE_CARD_WIDTH = 500;
const DEFAULT_PREVIEW_NODE_CARD_HEIGHT = 340;
const INITIAL_CANVAS_VIEWPORT: Viewport = { x: -1500, y: -1200, zoom: 0.89 };
/**
 * 动态卡片尺寸边界（按当前视觉稿收敛）
 *
 * 说明：
 * - 保留“按比例自适应”
 * - 但限制在更克制的区间，避免上传后卡片过大影响画布浏览
 */
const MAX_FILE_UPLOAD_CARD_LONG_SIDE = 360;
const MIN_FILE_UPLOAD_CARD_SHORT_SIDE = 150;

/**
 * 后端上传函数输入 DTO（前端调用 Tauri command 时使用）。
 */
interface UploadCanvasFileInputDto {
  nodeId: string;
  fileName: string;
  mimeType: string;
  fileBytes: number[];
}

/**
 * 后端上传函数输出 DTO（与 Rust `UploadedAsset` 对齐）。
 */
interface UploadedAssetDto {
  id: string;
  name: string;
  mimeType: string;
  sizeInBytes: number;
  previewUrl: string;
  mediaType: 'image' | 'video' | 'audio';
  storageProvider: 'qiniu' | 'base64';
  objectKey?: string | null;
}

/**
 * 节点类型守卫：是否为“上传文件节点”
 *
 * 为什么需要类型守卫：
 * - `canvasNodes` 现在是“多节点联合类型”
 * - 不同节点的数据结构不同（比如只有上传节点才有 selectedAssets）
 * - 用类型守卫可避免误读字段，减少新手改动时的类型错误
 */
function isFileUploadWorkflowNode(node: CanvasWorkflowNode): node is FileUploadWorkflowNode {
  return node.type === FILE_UPLOAD_NODE_TYPE;
}

/**
 * 节点类型守卫：是否为“对比节点”
 */
function isCompareWorkflowNode(node: CanvasWorkflowNode): node is CompareWorkflowNode {
  return node.type === COMPARE_NODE_TYPE;
}

/**
 * 节点类型守卫：是否为“预览节点”
 */
function isPreviewWorkflowNode(node: CanvasWorkflowNode): node is PreviewWorkflowNode {
  return node.type === PREVIEW_NODE_TYPE;
}

/**
 * 对比节点可消费的素材摘要
 *
 * 说明：
 * - 这里只提取“前端对比渲染必需字段”
 * - 便于后续替换为后端返回结构时，集中在一个地方改映射
 */
interface CompareRenderableAsset {
  name: string;
  mimeType: string;
  previewUrl: string;
  kind: 'image' | 'video' | 'audio';
  sourceCardWidth: number;
  sourceCardHeight: number;
}

/**
 * 从上传节点提取可用于对比的首个素材
 *
 * 当前规则：
 * - 只取 `selectedAssets[0]`
 * - 必须有 previewUrl 才能渲染
 */
function extractComparableAssetFromUploadNode(
  node: FileUploadWorkflowNode,
): CompareRenderableAsset | null {
  const firstAsset = node.data.selectedAssets?.[0];
  if (!firstAsset?.previewUrl) {
    return null;
  }

  if (firstAsset.mimeType.startsWith('image/')) {
    return {
      name: firstAsset.name,
      mimeType: firstAsset.mimeType,
      previewUrl: firstAsset.previewUrl,
      kind: 'image',
      sourceCardWidth: node.data.cardWidth ?? DEFAULT_FILE_UPLOAD_CARD_WIDTH,
      sourceCardHeight: node.data.cardHeight ?? DEFAULT_FILE_UPLOAD_CARD_HEIGHT,
    };
  }

  if (firstAsset.mimeType.startsWith('video/')) {
    return {
      name: firstAsset.name,
      mimeType: firstAsset.mimeType,
      previewUrl: firstAsset.previewUrl,
      kind: 'video',
      sourceCardWidth: node.data.cardWidth ?? DEFAULT_FILE_UPLOAD_CARD_WIDTH,
      sourceCardHeight: node.data.cardHeight ?? DEFAULT_FILE_UPLOAD_CARD_HEIGHT,
    };
  }

  if (firstAsset.mimeType.startsWith('audio/')) {
    return {
      name: firstAsset.name,
      mimeType: firstAsset.mimeType,
      previewUrl: firstAsset.previewUrl,
      kind: 'audio',
      sourceCardWidth: node.data.cardWidth ?? DEFAULT_FILE_UPLOAD_CARD_WIDTH,
      sourceCardHeight: node.data.cardHeight ?? DEFAULT_FILE_UPLOAD_CARD_HEIGHT,
    };
  }

  return null;
}

/**
 * 对比节点尺寸自适应（按素材尺寸比例）
 *
 * 目标：
 * - 避免对比卡片固定尺寸导致内容挤压/过度裁切
 * - 保持画布可读性，长边不无限增大
 */
function getAdaptiveCompareNodeCardSize(
  width: number,
  height: number,
): { cardWidth: number; cardHeight: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      cardWidth: DEFAULT_COMPARE_NODE_CARD_WIDTH,
      cardHeight: DEFAULT_COMPARE_NODE_READY_CARD_HEIGHT,
    };
  }

  let scaledWidth = width;
  let scaledHeight = height;

  const longSide = Math.max(scaledWidth, scaledHeight);
  /**
   * 对比卡片仅做“缩小适配”，不做“反向放大”。
   *
   * 原因：
   * - 之前会把部分素材放大，导致对比卡片视觉上过大
   * - 现在限制最大缩放系数为 1，避免比来源素材更大
   */
  const scaleToLongSide = Math.min(MAX_COMPARE_NODE_CARD_LONG_SIDE / longSide, 1);
  scaledWidth *= scaleToLongSide;
  scaledHeight *= scaleToLongSide;

  const shortSide = Math.min(scaledWidth, scaledHeight);
  if (shortSide < MIN_COMPARE_NODE_CARD_SHORT_SIDE) {
    const scaleToShortSide = MIN_COMPARE_NODE_CARD_SHORT_SIDE / shortSide;
    scaledWidth *= scaleToShortSide;
    scaledHeight *= scaleToShortSide;
  }

  return {
    cardWidth: Math.round(scaledWidth),
    cardHeight: Math.round(scaledHeight),
  };
}

/**
 * 计算“对比节点”的基准素材尺寸（用于卡片尺寸推导）
 *
 * 关键规则（本次按你的需求调整）：
 * - 当两路素材宽高不一致时，不再取平均值；
 * - 改为“宽取最大值、高取最大值”。
 *
 * 这样做的直接收益：
 * 1. 卡片不会因为一侧素材较小而被整体压短；
 * 2. 对比区域能容纳完整素材内容；
 * 3. 多余空白区域交给卡片内部的棋盘格背景承接（见 CompareNodeCard）。
 *
 * 注意：
 * - 这里只负责“尺寸推导策略”，不负责真正媒体绘制；
 * - 媒体绘制与补白样式在展示层组件 CompareNodeCard 中实现。
 */
function getCompareNodeBaseMediaSize(
  leftAsset: CompareRenderableAsset,
  rightAsset?: CompareRenderableAsset,
): { width: number; height: number } {
  if (!rightAsset) {
    return {
      width: leftAsset.sourceCardWidth,
      height: leftAsset.sourceCardHeight,
    };
  }

  return {
    width: Math.max(leftAsset.sourceCardWidth, rightAsset.sourceCardWidth),
    height: Math.max(leftAsset.sourceCardHeight, rightAsset.sourceCardHeight),
  };
}

/**
 * 释放节点文件预览 URL
 *
 * 注意：
 * - 新版上传链路返回的是“七牛 URL / Base64 Data URL”，一般不需要回收；
 * - 但历史版本和本地临时流程可能仍存在 `blob:` URL，浏览器不会自动释放；
 * - 因此这里保留“仅回收 blob URL”的兼容逻辑，避免内存持续增长。
 */
function revokePreviewUrls(assets?: FileUploadAssetSummary[]) {
  assets?.forEach((asset) => {
    if (asset.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(asset.previewUrl);
    }
  });
}

/**
 * 读取媒体源分辨率（仅图片/视频）
 *
 * 说明：
 * - 音频文件没有宽高，返回 null
 * - 该函数只负责前端展示尺寸计算，不参与业务规则判断
 */
async function readMediaDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const imageObjectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
        URL.revokeObjectURL(imageObjectUrl);
      };
      image.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(imageObjectUrl);
      };

      image.src = imageObjectUrl;
    });
  }

  if (file.type.startsWith('video/')) {
    return new Promise((resolve) => {
      const videoObjectUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight });
        URL.revokeObjectURL(videoObjectUrl);
      };
      video.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(videoObjectUrl);
      };

      video.src = videoObjectUrl;
    });
  }

  return null;
}

/**
 * 根据媒体宽高计算卡片尺寸（保持比例）
 *
 * 设计目标：
 * - 不再固定正方形
 * - 长边受上限控制，避免超大
 * - 短边保证最小可读性
 */
function getAdaptiveCardSize(width: number, height: number): { cardWidth: number; cardHeight: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      cardWidth: DEFAULT_FILE_UPLOAD_CARD_WIDTH,
      cardHeight: DEFAULT_FILE_UPLOAD_CARD_HEIGHT,
    };
  }

  let scaledWidth = width;
  let scaledHeight = height;

  const longSide = Math.max(scaledWidth, scaledHeight);
  const scaleToLongSide = MAX_FILE_UPLOAD_CARD_LONG_SIDE / longSide;
  scaledWidth *= scaleToLongSide;
  scaledHeight *= scaleToLongSide;

  const shortSide = Math.min(scaledWidth, scaledHeight);
  if (shortSide < MIN_FILE_UPLOAD_CARD_SHORT_SIDE) {
    const scaleToShortSide = MIN_FILE_UPLOAD_CARD_SHORT_SIDE / shortSide;
    scaledWidth *= scaleToShortSide;
    scaledHeight *= scaleToShortSide;
  }

  return {
    cardWidth: Math.round(scaledWidth),
    cardHeight: Math.round(scaledHeight),
  };
}

interface CanvasBoardProps {
  /**
   * 当前画布所对应的项目实体。
   *
   * 这里拿到的是领域层 `Project`，
   * 说明当前组件是展示层对领域数据的一次消费。
   * 组件负责“展示”和“交互”，不负责重新定义项目领域规则。
   */
  project: Project | null;
}

/**
 * 画布页面主组件 (CanvasBoard)
 *
 * 这个文件是当前 `canvas` 页面最核心的展示层组件。
 * 你可以把它理解为：
 * “负责把画布页面的外壳、交互骨架、基础布局先搭起来的主容器”。
 *
 * 当前主要职责：
 * 1. 提供无限画布的基础交互能力，例如拖拽移动。
 * 2. 提供顶部导航、底部辅助区、右键菜单、弹窗容器等页面骨架。
 * 3. 作为未来复杂画布能力的主装配点。
 *
 * 当前明确不应该承担的职责：
 * 1. 不应该把所有未来弹窗的具体 UI 和逻辑都永久堆在这里。
 * 2. 不应该把所有工作流卡片、节点类型、节点配置表单全部手写在这里。
 * 3. 不应该在这里直接承载大量业务规则判断。
 *
 * 对新手非常重要的一句总结：
 * - 这个文件是“画布总舞台”
 * - 但不是“所有演员都永远住在这里”
 *
 * 后续扩展一定遵循 DDD + 分层拆分：
 * - 路由层负责进入页面
 * - 当前组件负责装配画布主舞台
 * - 更细的弹窗 / 卡片 / 面板 / 工具条 / 节点渲染器，需要拆成独立模块
 * - 业务命令和查询进入 application 层
 * - 业务规则留在 domain 层
 *
 * 后续新增功能时，优先考虑的拆分方向：
 * - `components/modals/*`        放各种弹窗
 * - `components/cards/*`         放工作流卡片、节点卡片
 * - `components/panels/*`        放左右侧栏、详情面板
 * - `components/toolbars/*`      放顶部或底部工具栏
 * - `components/context-menu/*`  放右键菜单细项
 * - `components/canvas-nodes/*`  放画布内具体元素渲染器
 * - `hooks/*` 或 `composables/*` 放交互逻辑复用
 *
 * 一个务必遵守的实践原则：
 * 如果未来新增“一个完整可独立理解的界面块”，
 * 例如：
 * - 存储管理弹窗
 * - API 设置弹窗
 * - 工作流卡片
 * - 节点编辑面板
 * - 批量操作面板
 * - 导出确认弹窗
 * 那就优先新建独立组件文件，再在当前文件中调用。
 *
 * 不要为了“省文件”把整个系统写成一个超长组件，
 * 否则后续交接时，新同学几乎无法建立正确心智模型。
 *
 * 这一份文件的注释目标：
 * - 帮助第一次接手的人快速知道每个区域负责什么
 * - 帮助后续开发者知道新功能应该插到哪里
 * - 帮助新手理解“为什么不能把所有设计都堆在当前页面里”
 *
 * [Update 2026-04-03]
 * - 当前版本以画布原型为基础完成第一层骨架。
 * - 当前重点是结构清晰、便于扩展、便于交接，而不是一次性塞满全部功能。
 */
export function CanvasBoard({ project }: CanvasBoardProps) {
  const router = useRouter();
  const canvasNodesRef = useRef<CanvasWorkflowNode[]>([]);
  const toolbarUploadInputRef = useRef<HTMLInputElement | null>(null);
  const toolbarUploadTargetNodeIdRef = useRef<string | null>(null);
  
  /**
   * 画布视口状态（React Flow viewport）
   *
   * 说明：
   * - x / y：当前平移偏移量
   * - zoom：当前缩放比例
   *
   * 这组状态由 React Flow 原生交互驱动（拖拽平移、滚轮缩放、小地图拖拽）。
   */
  const [viewport, setViewport] = useState<Viewport>(INITIAL_CANVAS_VIEWPORT);
  const zoomPercentText = `${Math.round(viewport.zoom * 100)}%`;

  /**
   * 右键菜单状态
   *
   * 当前是一个轻量实现，只负责控制显示位置和开关。
   * 如果右键菜单未来变复杂，例如支持：
   * - 多层菜单
   * - 不同节点类型对应不同菜单
   * - 权限控制菜单项
   * - 动态菜单配置
   * 建议拆为独立的 ContextMenu 组件和配置工厂。
   */
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
    visible: boolean;
  }>({ x: 0, y: 0, canvasX: 0, canvasY: 0, visible: false });

  /**
   * 画布节点状态（仅前端 UI）
   *
   * 这一版需求只做前端页面，所以节点数据暂存在页面内存里。
   * 后续接后端时，推荐升级为：
   * 1. 展示层触发应用层命令（例如 createNode / moveNode / removeNode）
   * 2. 应用层统一编排仓库与持久化
   * 3. 展示层只消费结果，不直接承担业务规则
   */
  const [canvasNodes, setCanvasNodes] = useState<CanvasWorkflowNode[]>([]);

  /**
   * 画布连线状态（仅前端 UI）
   *
   * 这一版主要目的是把连线样式和交互做成与原型一致。
   * 后续接后端时，应与节点一起由应用层命令统一管理。
   */
  const [canvasEdges, setCanvasEdges] = useState<Edge[]>([]);

  /**
   * 根据“连线关系 + 上传节点素材”同步对比节点数据（纯前端内存态）
   *
   * 这个函数是当前前端数据传输的核心桥接点：
   * - 输入：当前全部节点 + 当前全部连线
   * - 输出：把每个 compare 节点更新到最新可渲染状态
   *
   * 当前规则（前端可用版）：
   * 1. 只处理“连到 compare 节点”的入边
   * 2. 每个来源上传节点只取 `selectedAssets[0]`
   * 3. 至少 1 路可渲染素材即可进入 ready 并显示内容
   * 4. 如果有 2 路素材，要求类型一致（image/video/audio）
   *
   * 说明：
   * - 这套规则故意收敛，目的是先跑通前端链路
   * - 后续接后端时，可把规则收敛到 application 层并在这里做结果映射
   */
  const syncCompareNodesByConnections = useCallback(
    (nodes: CanvasWorkflowNode[], edges: Edge[]): CanvasWorkflowNode[] => {
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      let hasAnyCompareNodeChanged = false;

      const nextNodes = nodes.map((node) => {
        if (!isCompareWorkflowNode(node)) {
          return node;
        }

        const incomingEdges = edges.filter((edge) => edge.target === node.id);
        const incomingComparableAssets = incomingEdges
          .map((edge) => nodeById.get(edge.source))
          .filter((sourceNode): sourceNode is FileUploadWorkflowNode => Boolean(sourceNode && isFileUploadWorkflowNode(sourceNode)))
          .map((uploadNode) => extractComparableAssetFromUploadNode(uploadNode))
          .filter((asset): asset is CompareRenderableAsset => Boolean(asset));

        const firstTwoAssets = incomingComparableAssets.slice(0, 2);
        const firstAsset = firstTwoAssets[0];
        const secondAsset = firstTwoAssets[1];
        const hasAtLeastOneAsset = Boolean(firstAsset);
        const hasTwoAssets = Boolean(firstAsset && secondAsset);
        const hasSameKind = hasTwoAssets && firstAsset.kind === secondAsset.kind;

        let nextCompareStatus: 'empty' | 'ready' = 'empty';
        let nextCompareMedia: CompareWorkflowNode['data']['compareMedia'] = undefined;
        let nextCompareErrorMessage: string | undefined = undefined;
        let nextCardWidth = DEFAULT_COMPARE_NODE_CARD_WIDTH;
        let nextCardHeight = DEFAULT_COMPARE_NODE_CARD_HEIGHT;

        if (!hasAtLeastOneAsset) {
          if (incomingEdges.length > 0) {
            nextCompareErrorMessage = '当前连接素材不可预览，请检查上传内容';
          }
        } else if (!hasTwoAssets && firstAsset) {
          const singleAssetBaseSize = getCompareNodeBaseMediaSize(firstAsset);
          const singleAssetCardSize = getAdaptiveCompareNodeCardSize(
            singleAssetBaseSize.width,
            singleAssetBaseSize.height,
          );
          nextCompareStatus = 'ready';
          /**
           * 单路素材兜底策略：
           * - 先把同一路素材映射到左右两侧，保证卡片即时可见
           * - 第二路素材接入后会自动被替换为真实双路对比
           */
          nextCompareMedia = {
            kind: firstAsset.kind,
            leftMediaUrl: firstAsset.previewUrl,
            rightMediaUrl: firstAsset.previewUrl,
            leftMimeType: firstAsset.mimeType,
            rightMimeType: firstAsset.mimeType,
            /**
             * 标签固定策略（按产品确认）：
             * - 左侧统一显示“原始”
             * - 右侧统一显示“生成”
             *
             * 说明：
             * - 这里不再显示文件名，避免不同来源素材名称干扰对比语义。
             * - 如果后续需要“悬浮查看真实文件名”，建议新增独立字段 tooltipLabel，
             *   不要再覆盖对比主标签，保持视觉语义稳定。
             */
            leftLabel: '原始',
            rightLabel: '生成',
          };
          nextCardWidth = singleAssetCardSize.cardWidth;
          nextCardHeight = singleAssetCardSize.cardHeight;
        } else if (!hasSameKind) {
          nextCompareErrorMessage = '仅支持同类型素材对比（图片/视频/音频需一致）';
        } else {
          const leftAsset = firstAsset;
          const rightAsset = secondAsset;
          if (!leftAsset || !rightAsset) {
            return node;
          }
          /**
           * 双素材尺寸策略（按最大宽高，而非平均值）
           *
           * 旧策略问题：
           * - 用平均值时，宽高差异大的素材会把容器“折中压缩”，视觉上像被挤短。
           *
           * 新策略收益：
           * - 先按最大包络计算卡片尺寸，再在卡片内部用棋盘格补齐留白。
           * - 用户可以看到完整素材轮廓，不会误以为内容被裁掉或比例异常。
           */
          const mergedBaseSize = getCompareNodeBaseMediaSize(leftAsset, rightAsset);
          const mergedAssetCardSize = getAdaptiveCompareNodeCardSize(
            mergedBaseSize.width,
            mergedBaseSize.height,
          );
          nextCompareStatus = 'ready';
          nextCompareMedia = {
            kind: leftAsset.kind,
            leftMediaUrl: leftAsset.previewUrl,
            rightMediaUrl: rightAsset.previewUrl,
            leftMimeType: leftAsset.mimeType,
            rightMimeType: rightAsset.mimeType,
            /**
             * 对比标签固定为“原始 / 生成”
             *
             * 无论文件名是什么，卡片语义都保持一致：
             * - 左侧代表输入原始素材
             * - 右侧代表输出生成结果
             */
            leftLabel: '原始',
            rightLabel: '生成',
          };
          nextCardWidth = mergedAssetCardSize.cardWidth;
          nextCardHeight = mergedAssetCardSize.cardHeight;
        }

        const isSameAsCurrent =
          node.data.compareStatus === nextCompareStatus &&
          node.data.compareErrorMessage === nextCompareErrorMessage &&
          node.data.cardWidth === nextCardWidth &&
          node.data.cardHeight === nextCardHeight &&
          (node.data.compareMedia?.kind ?? undefined) === (nextCompareMedia?.kind ?? undefined) &&
          (node.data.compareMedia?.leftMediaUrl ?? undefined) === (nextCompareMedia?.leftMediaUrl ?? undefined) &&
          (node.data.compareMedia?.rightMediaUrl ?? undefined) === (nextCompareMedia?.rightMediaUrl ?? undefined) &&
          (node.data.compareMedia?.leftMimeType ?? undefined) === (nextCompareMedia?.leftMimeType ?? undefined) &&
          (node.data.compareMedia?.rightMimeType ?? undefined) === (nextCompareMedia?.rightMimeType ?? undefined) &&
          (node.data.compareMedia?.leftLabel ?? undefined) === (nextCompareMedia?.leftLabel ?? undefined) &&
          (node.data.compareMedia?.rightLabel ?? undefined) === (nextCompareMedia?.rightLabel ?? undefined);

        if (isSameAsCurrent) {
          return node;
        }

        hasAnyCompareNodeChanged = true;
        return {
          ...node,
          data: {
            ...node.data,
            compareStatus: nextCompareStatus,
            compareMedia: nextCompareMedia,
            compareErrorMessage: nextCompareErrorMessage,
            cardWidth: nextCardWidth,
            cardHeight: nextCardHeight,
          },
        };
      });

      return hasAnyCompareNodeChanged ? nextNodes : nodes;
    },
    [],
  );

  /**
   * 根据“连线关系 + 上传节点素材”同步预览节点数据。
   *
   * 规则：
   * 1. 只消费连到 preview 节点的入边；
   * 2. 来源仅支持上传节点（fileUpload）；
   * 3. 每个来源节点仅取 `selectedAssets[0]`；
   * 4. 当存在可渲染素材时，写入 `previewMedia` 并标记 ready；
   * 5. 当连线存在但没有可预览素材时，给出错误文案。
   */
  const syncPreviewNodesByConnections = useCallback(
    (nodes: CanvasWorkflowNode[], edges: Edge[]): CanvasWorkflowNode[] => {
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      let hasAnyPreviewNodeChanged = false;

      const nextNodes = nodes.map((node) => {
        if (!isPreviewWorkflowNode(node)) {
          return node;
        }

        const incomingEdges = edges.filter((edge) => edge.target === node.id);
        const firstConnectedUploadNode = incomingEdges
          .map((edge) => nodeById.get(edge.source))
          .find(
            (sourceNode): sourceNode is FileUploadWorkflowNode =>
              Boolean(sourceNode && isFileUploadWorkflowNode(sourceNode)),
          );

        const firstAsset = firstConnectedUploadNode?.data.selectedAssets?.[0];
        const hasRenderableMedia = Boolean(
          firstAsset?.previewUrl &&
            (firstAsset.mimeType.startsWith('image/') ||
              firstAsset.mimeType.startsWith('video/') ||
              firstAsset.mimeType.startsWith('audio/')),
        );

        const nextPreviewStatus: 'empty' | 'ready' = hasRenderableMedia ? 'ready' : 'empty';
        const nextPreviewMedia = hasRenderableMedia && firstAsset
          ? {
              kind: firstAsset.mimeType.startsWith('image/')
                ? 'image'
                : firstAsset.mimeType.startsWith('video/')
                  ? 'video'
                  : 'audio',
              url: firstAsset.previewUrl ?? '',
              mimeType: firstAsset.mimeType,
              name: firstAsset.name,
              storageProvider: firstAsset.storageProvider,
              objectKey: firstAsset.objectKey,
            }
          : undefined;

        const nextPreviewErrorMessage =
          !hasRenderableMedia && incomingEdges.length > 0
            ? '当前连接素材不可预览，请检查上传内容'
            : undefined;

        const isSameAsCurrent =
          (node.data.previewStatus ?? 'empty') === nextPreviewStatus &&
          node.data.previewErrorMessage === nextPreviewErrorMessage &&
          (node.data.previewMedia?.kind ?? undefined) === (nextPreviewMedia?.kind ?? undefined) &&
          (node.data.previewMedia?.url ?? undefined) === (nextPreviewMedia?.url ?? undefined) &&
          (node.data.previewMedia?.mimeType ?? undefined) === (nextPreviewMedia?.mimeType ?? undefined) &&
          (node.data.previewMedia?.name ?? undefined) === (nextPreviewMedia?.name ?? undefined) &&
          (node.data.previewMedia?.storageProvider ?? undefined) === (nextPreviewMedia?.storageProvider ?? undefined) &&
          (node.data.previewMedia?.objectKey ?? undefined) === (nextPreviewMedia?.objectKey ?? undefined);

        if (isSameAsCurrent) {
          return node;
        }

        hasAnyPreviewNodeChanged = true;
        return {
          ...node,
          data: {
            ...node.data,
            previewStatus: nextPreviewStatus,
            previewMedia: nextPreviewMedia,
            previewErrorMessage: nextPreviewErrorMessage,
          },
        };
      });

      return hasAnyPreviewNodeChanged ? nextNodes : nodes;
    },
    [],
  );

  /**
   * 当前“可显示上传后工具栏”的激活节点
   *
   * 显示规则（与用户需求完全一致）：
   * 1. 必须是用户当前点击选中的节点（selected === true）
   * 2. 节点内必须已有上传文件（selectedAssets.length > 0）
   *
   * 以下任一情况都不显示：
   * - 只是右键创建了卡片，但还没上传任何文件
   * - 有上传文件，但当前没有点击该卡片（未激活）
   */
  const activeUploadedNode = canvasNodes.find(
    (node): node is FileUploadWorkflowNode =>
      isFileUploadWorkflowNode(node) &&
      Boolean(node.selected) &&
      (node.data.selectedAssets?.length ?? 0) > 0,
  );

  /**
   * 上传后工具栏锚点（视口坐标）
   *
   * 计算方式：
   * - x: 卡片左上角 + 卡片宽度一半
   * - y: 卡片顶部（工具栏组件内部再向上偏移自身高度）
   *
   * 这样可以做到“工具栏固定悬浮在激活卡片上方”，符合原型。
   */
  const activeToolbarAnchor = activeUploadedNode
    ? {
        x:
          viewport.x +
          (activeUploadedNode.position.x +
            (activeUploadedNode.data.cardWidth ?? DEFAULT_FILE_UPLOAD_CARD_WIDTH) / 2) *
            viewport.zoom,
        y: viewport.y + activeUploadedNode.position.y * viewport.zoom,
      }
    : null;

  /**
   * 节点 ID 自增序列
   *
   * 使用 ref 的好处：
   * - 不会因为序号变化触发重渲染
   * - 每次创建新节点都能拿到稳定且唯一的 ID
   *
   * 后续如果节点改为后端分配 ID，这里可作为“本地临时 ID”保留，等待服务端回填正式 ID。
   */
  const nodeSequenceRef = useRef(1);

  /**
   * 处理节点移动/选中等变更（React Flow 受控模式）
   *
   * 采用受控模式是为了后续扩展更复杂能力：
   * - 撤销/重做
   * - 协同编辑
   * - 持久化同步
   */
  const handleCanvasNodesChange = useCallback<OnNodesChange<CanvasWorkflowNode>>((changes) => {
    setCanvasNodes((previousNodes) => applyNodeChanges(changes, previousNodes));
  }, []);

  /**
   * 处理连线增删改（React Flow 受控模式）
   *
   * 这里与节点状态分开管理，但职责一致：只做前端状态更新，不做业务规则。
   */
  const handleCanvasEdgesChange = useCallback<OnEdgesChange>((changes) => {
    setCanvasEdges((previousEdges) => applyEdgeChanges(changes, previousEdges));
  }, []);

  /**
   * 处理用户拖线连接行为
   *
   * 这里统一设置连线默认样式，让“已连接状态”颜色与原型保持一致。
   */
  const handleConnect = useCallback((connection: Connection) => {
    setCanvasEdges((previousEdges) =>
      addEdge(
        {
          ...connection,
          type: 'default',
          style: {
            stroke: '#a3a3a3',
            strokeWidth: 2,
          },
        },
        previousEdges,
      ),
    );
  }, []);

  /**
   * 删除节点（由子节点卡片回调触发）
   *
   * 设计意图：
   * - 子组件只上抛“我想删除”
   * - 真正删数据由装配层执行
   * 这样能减少组件间耦合，便于后续接入统一的应用层命令。
   */
  const handleRemoveNode = useCallback((nodeId: string) => {
    setCanvasNodes((previousNodes) => {
      const removingNode = previousNodes.find((node) => node.id === nodeId);
      if (removingNode && isFileUploadWorkflowNode(removingNode)) {
        revokePreviewUrls(removingNode.data.selectedAssets);
      }
      return previousNodes.filter((node) => node.id !== nodeId);
    });
    setCanvasEdges((previousEdges) =>
      previousEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    );
  }, []);

  /**
   * 调用后端上传函数（Tauri command）。
   *
   * 调用链路：
   * 1. 前端读取 File -> Uint8Array；
   * 2. invoke('upload_canvas_file_asset') 传入二进制和元信息；
   * 3. Rust 后端按策略处理：
   *    - 已配置七牛：上传七牛，返回公网 URL；
   *    - 未配置七牛：仅图片转 Base64，音视频直接报错。
   */
  const uploadFileToBackend = useCallback(async (nodeId: string, file: File): Promise<UploadedAssetDto> => {
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = Array.from(new Uint8Array(fileBuffer));
    const input: UploadCanvasFileInputDto = {
      nodeId,
      fileName: file.name,
      mimeType: file.type,
      fileBytes,
    };

    return await invoke<UploadedAssetDto>('upload_canvas_file_asset', { input });
  }, []);

  /**
   * 上传动作函数（已接入后端函数调用）。
   */
  const handleRequestUpload = useCallback(async (nodeId: string, files: File[]) => {
    const hasInvalidFile = files.some((file) =>
      file.type && !SUPPORTED_UPLOAD_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix)),
    );

    if (hasInvalidFile) {
      setCanvasNodes((previousNodes) =>
        previousNodes.map((node) => {
          if (node.id !== nodeId || !isFileUploadWorkflowNode(node)) {
            return node;
          }
          revokePreviewUrls(node.data.selectedAssets);
          return {
            ...node,
            data: {
              ...node.data,
              selectedAssets: [],
              uploadErrorMessage: '仅支持图片、视频、音频文件',
            },
          };
        }),
      );
      return;
    }

    let uploadedAssets: UploadedAssetDto[] = [];
    try {
      uploadedAssets = await Promise.all(
        files.map(async (file) => await uploadFileToBackend(nodeId, file)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCanvasNodes((previousNodes) =>
        previousNodes.map((node) => {
          if (node.id !== nodeId || !isFileUploadWorkflowNode(node)) {
            return node;
          }
          revokePreviewUrls(node.data.selectedAssets);
          return {
            ...node,
            data: {
              ...node.data,
              selectedAssets: [],
              uploadErrorMessage: message || '上传失败，请稍后重试',
            },
          };
        }),
      );
      return;
    }

    const selectedAssets: FileUploadAssetSummary[] = uploadedAssets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      sizeInBytes: asset.sizeInBytes,
      previewUrl: asset.previewUrl,
      mediaType: asset.mediaType,
      storageProvider: asset.storageProvider,
      objectKey: asset.objectKey ?? undefined,
    }));

    const firstSelectedFile = files[0];
    const mediaDimensions = firstSelectedFile ? await readMediaDimensions(firstSelectedFile) : null;
    const nextCardSize = mediaDimensions
      ? getAdaptiveCardSize(mediaDimensions.width, mediaDimensions.height)
      : {
          cardWidth: DEFAULT_FILE_UPLOAD_CARD_WIDTH,
          cardHeight: DEFAULT_FILE_UPLOAD_CARD_HEIGHT,
        };

    setCanvasNodes((previousNodes) =>
      previousNodes.map((node) => {
        if (node.id !== nodeId || !isFileUploadWorkflowNode(node)) {
          return node;
        }
        revokePreviewUrls(node.data.selectedAssets);
        const previousCardWidth = node.data.cardWidth ?? DEFAULT_FILE_UPLOAD_CARD_WIDTH;
        const previousCardHeight = node.data.cardHeight ?? DEFAULT_FILE_UPLOAD_CARD_HEIGHT;
        const adjustedPosition = {
          x: node.position.x + (previousCardWidth - nextCardSize.cardWidth) / 2,
          y: node.position.y + (previousCardHeight - nextCardSize.cardHeight) / 2,
        };
        return {
          ...node,
          position: adjustedPosition,
          data: {
            ...node.data,
            cardWidth: nextCardSize.cardWidth,
            cardHeight: nextCardSize.cardHeight,
            selectedAssets,
            uploadErrorMessage: undefined,
          },
        };
      }),
    );
  }, [uploadFileToBackend]);

  /**
   * 图片节点“生成”动作入口（后端对接预留）
   *
   * 设计目标：
   * - 节点卡片只负责收集输入并触发事件
   * - 页面装配层统一承接事件，未来在这里对接 application 层 use case
   *
   * 后续后端接入建议：
   * - 建立 `CreateImageGenerationTaskUseCase`
   * - 由该 use case 统一处理参数校验、任务创建、状态更新
   * - infrastructure 层再适配 Tauri/Rust 函数
   */
  const handleRequestGenerateImage = useCallback((nodeId: string, draft: ImageGenerationPromptDraft) => {
    console.info('[UI Placeholder] 图片生成请求待接后端函数。', { nodeId, draft });
  }, []);

  /**
   * 预览节点“同步最新预览结果”入口（后端对接预留）
   *
   * 为什么入口放在 CanvasBoard：
   * - 预览卡片本身只做展示层
   * - 真正的业务编排应放在装配层，再转给 application 层
   *
   * 未来接后端时建议：
   * 1. 在 application 层新增 `SyncPreviewNodeUseCase`
   * 2. 由该 use case 调用 infrastructure 适配器（Tauri/Rust）
   * 3. 返回结果后再更新节点 UI 状态（如预览图、状态文案、时间戳）
   *
   * 当前实现状态：
   * - 这里只是占位入口，尚未真正拉取图片/视频数据
   * - 保留该函数是为了明确“后端联调应该挂在哪”
   *
   * 后续支持图片/视频预览的推荐落地步骤（给接手同学）：
   * 1. 在 application 层定义输入输出契约（例如 nodeId -> preview payload）
   * 2. 在这里调用 use case，并拿到标准化结果
   * 3. 用 `setCanvasNodes` 只更新目标预览节点的数据字段
   * 4. 卡片组件根据新字段渲染 image/video 分支
   * 5. 出错时写入 error 状态字段，让卡片显示错误占位
   *
   * 后续新增音频时的最小改动路径：
   * - application 层结果中新增 `kind: 'audio'`
   * - 这里保持映射逻辑不变（只做数据透传）
   * - 让 PreviewNodeCard 新增 `audio` UI 分支即可
   *
   * 删除与清理注意事项：
   * - 若后续预览媒体改为 Object URL，本函数或删除流程要补充 URL 回收
   * - 统一在装配层/应用层清理，避免子组件各自清理导致遗漏
   */
  const handleRequestSyncPreview = useCallback((nodeId: string) => {
    console.info('[UI Placeholder] 预览节点请求同步，待接后端函数。', { nodeId });
  }, []);

  /**
   * 对比节点“同步对比素材”入口（后端对接预留）
   *
   * 当前状态：
   * - 仅保留函数入口，不执行真实请求
   * - 目的是固定后续联调挂点，避免功能上来后分散到多个 UI 组件里
   *
   * 推荐后端接入步骤（函数调用优先）：
   * 1. application 层新增 `SyncCompareNodeMediaUseCase`
   * 2. 在该 use case 中统一处理参数校验、素材读取、错误转换
   * 3. infrastructure 层适配 Tauri/Rust 实际能力
   * 4. 回到这里用 `setCanvasNodes` 更新 compare 节点数据（status/media/error）
   *
   * 后续新增音频时：
   * - 保持函数签名不变
   * - 在返回 payload 中新增 `kind: 'audio'`
   * - 由 CompareNodeCard 渲染分支扩展即可
   */
  const handleRequestSyncCompareMedia = useCallback((nodeId: string) => {
    console.info('[UI Placeholder] 对比节点请求同步素材，待接后端函数。', { nodeId });
  }, []);

  /**
   * 图片节点提示词草稿更新
   *
   * 当前版本：
   * - 仅在前端内存中同步草稿，方便还原 UI
   *
   * 后续扩展方向：
   * - 可增加自动保存节流（例如 300ms）
   * - 可在 application 层增加“草稿持久化命令”
   */
  const handleUpdateImagePromptText = useCallback((nodeId: string, nextPromptText: string) => {
    setCanvasNodes((previousNodes) =>
      previousNodes.map((node) => {
        if (node.id !== nodeId || node.type !== IMAGE_GENERATION_NODE_TYPE) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            promptText: nextPromptText,
          },
        };
      }),
    );
  }, []);

  /**
   * 工具栏触发“替换上传”入口
   *
   * 触发逻辑：
   * - 记录当前要替换的节点 ID
   * - 打开隐藏的文件选择器
   */
  const handleRequestUploadReplaceFromToolbar = useCallback((nodeId: string) => {
    toolbarUploadTargetNodeIdRef.current = nodeId;
    toolbarUploadInputRef.current?.click();
  }, []);

  /**
   * 工具栏文件选择器变更回调
   *
   * 这里会把新文件交给统一的 `handleRequestUpload`，
   * 以“替换模式”覆盖当前节点原文件预览。
   */
  const handleToolbarUploadInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const targetNodeId = toolbarUploadTargetNodeIdRef.current;
    if (selectedFiles.length === 0 || !targetNodeId) {
      event.currentTarget.value = '';
      return;
    }

    handleRequestUpload(targetNodeId, selectedFiles);
    event.currentTarget.value = '';
  }, [handleRequestUpload]);

  /**
   * 画布渲染用节点（派生数据）
   *
   * 关键点：
   * - 这里不直接改 `canvasNodes` 状态
   * - 只在渲染前根据“连线 + 上传素材”做一次派生映射
   *
   * 这样做的好处：
   * - 避免在 effect 中 setState 造成级联渲染
   * - 保持源状态（用户操作状态）和展示状态（派生对比视图）职责分离
   *
   * 后续接后端时：
   * - 如果改为后端下发最终对比结果，这里可直接简化为 `canvasNodes`
   */
  const renderedCanvasNodes = useMemo(
    () => {
      const previewSyncedNodes = syncPreviewNodesByConnections(canvasNodes, canvasEdges);
      return syncCompareNodesByConnections(previewSyncedNodes, canvasEdges);
    },
    [canvasEdges, canvasNodes, syncCompareNodesByConnections, syncPreviewNodesByConnections],
  );

  /**
   * 维护最新节点快照，供卸载时清理预览 URL。
   */
  useEffect(() => {
    canvasNodesRef.current = canvasNodes;
  }, [canvasNodes]);

  /**
   * 页面卸载时统一清理所有预览 URL，避免内存泄漏。
   */
  useEffect(() => {
    return () => {
      canvasNodesRef.current.forEach((node) => {
        if (isFileUploadWorkflowNode(node)) {
          revokePreviewUrls(node.data.selectedAssets);
        }
      });
    };
  }, []);

  /**
   * 创建“上传文件”节点
   *
   * 由右键菜单触发，使用菜单打开时记录的画布坐标来决定初始位置。
   * 该函数只负责节点前端创建，不承担业务规则。
   */
  const createFileUploadNodeFromContextMenu = useCallback(() => {
    const nodeId = `file-upload-${nodeSequenceRef.current}`;
    nodeSequenceRef.current += 1;

    const nextNode: FileUploadWorkflowNode = {
      id: nodeId,
      type: FILE_UPLOAD_NODE_TYPE,
      selected: true,
      position: {
        // 原型卡片尺寸约 320px，创建时让菜单点击点更接近卡片中心，交互更自然。
        x: Math.max(0, contextMenu.canvasX - DEFAULT_FILE_UPLOAD_CARD_WIDTH / 2),
        y: Math.max(0, contextMenu.canvasY - DEFAULT_FILE_UPLOAD_CARD_HEIGHT / 2),
      },
      data: {
        title: '文件上传',
        hintLines: ['或拖放文件到此处', '或 Ctrl+V 粘贴', '支持图片、视频、音频素材'],
        cardWidth: DEFAULT_FILE_UPLOAD_CARD_WIDTH,
        cardHeight: DEFAULT_FILE_UPLOAD_CARD_HEIGHT,
        selectedAssets: [],
        uploadErrorMessage: undefined,
        onRequestRemove: handleRemoveNode,
        onRequestBackendUpload: handleRequestUpload,
      },
    };

    setCanvasNodes((previousNodes) => [
      ...previousNodes.map((node) => ({ ...node, selected: false })),
      nextNode,
    ]);
    setContextMenu((previous) => ({ ...previous, visible: false }));
  }, [contextMenu.canvasX, contextMenu.canvasY, handleRemoveNode, handleRequestUpload]);

  /**
   * 创建“图片生成”节点
   *
   * 对应右键菜单中的“图片”按钮。
   * 当前只做前端节点创建与交互骨架，不接真实后端任务创建。
   */
  const createImageGenerationNodeFromContextMenu = useCallback(() => {
    const nodeId = `image-generation-${nodeSequenceRef.current}`;
    nodeSequenceRef.current += 1;

    const nextNode: ImageGenerationWorkflowNode = {
      id: nodeId,
      type: IMAGE_GENERATION_NODE_TYPE,
      selected: true,
      position: {
        // 原型宽度约 600，默认展开高度约 480，让点击点落在卡片几何中心附近。
        x: Math.max(0, contextMenu.canvasX - DEFAULT_IMAGE_NODE_CARD_WIDTH / 2),
        y: Math.max(0, contextMenu.canvasY - DEFAULT_IMAGE_NODE_EXPANDED_HEIGHT / 2),
      },
      data: {
        title: '生成图片',
        promptText: '',
        modelName: 'Qwen Image Edit',
        aspectRatio: '1:1',
        resolution: '1K',
        cardWidth: DEFAULT_IMAGE_NODE_CARD_WIDTH,
        expandedHeight: DEFAULT_IMAGE_NODE_EXPANDED_HEIGHT,
        collapsedHeight: DEFAULT_IMAGE_NODE_COLLAPSED_HEIGHT,
        isCollapsed: false,
        onRequestRemove: handleRemoveNode,
        onRequestGenerateImage: handleRequestGenerateImage,
        onRequestUpdatePromptText: handleUpdateImagePromptText,
      },
    };

    setCanvasNodes((previousNodes) => [
      ...previousNodes.map((node) => ({ ...node, selected: false })),
      nextNode,
    ]);
    setContextMenu((previous) => ({ ...previous, visible: false }));
  }, [
    contextMenu.canvasX,
    contextMenu.canvasY,
    handleRemoveNode,
    handleRequestGenerateImage,
    handleUpdateImagePromptText,
  ]);

  /**
   * 创建“预览”节点
   *
   * 对应右键菜单中的“预览”按钮。
   * 当前阶段已支持“从上传节点连线透传预览媒体”，后端任务结果联动仍为后续阶段。
   *
   * 后续扩展建议：
   * - 新增“预览状态”字段（如 idle/loading/success/failed）
   * - 在 application 层增加“同步预览内容”用例
   * - 由用例统一驱动节点 UI 状态更新，而不是在卡片里直接请求后端
   *
   * 补充说明（交接重点）：
   * - 本函数只负责“创建节点初始壳”
   * - 不负责“把后端预览内容塞进节点”
   * - 媒体内容更新应走 `handleRequestSyncPreview` + application 层
   *
   * 如果未来要重构预览节点创建逻辑，建议方向：
   * 1. 把默认数据提炼到 `buildPreviewNodeData()` 工厂函数
   * 2. 把“定位计算”提炼到 `getPreviewNodeInitialPosition()`
   * 3. 保持当前函数只做“组装 + setCanvasNodes”两件事
   *
   * 如果未来要支持“批量删除/撤销删除”：
   * - 不要在卡片组件新增复杂删除流程
   * - 统一在 CanvasBoard / application 层维护删除命令和历史栈
   */
  const createPreviewNodeFromContextMenu = useCallback(() => {
    const nodeId = `preview-${nodeSequenceRef.current}`;
    nodeSequenceRef.current += 1;

    const nextNode: PreviewWorkflowNode = {
      id: nodeId,
      type: PREVIEW_NODE_TYPE,
      selected: true,
      position: {
        // 预览卡片是横向大卡，创建时让点击点接近卡片几何中心，视觉更自然。
        x: Math.max(0, contextMenu.canvasX - DEFAULT_PREVIEW_NODE_CARD_WIDTH / 2),
        y: Math.max(0, contextMenu.canvasY - DEFAULT_PREVIEW_NODE_CARD_HEIGHT / 2),
      },
      data: {
        title: '预览节点',
        primaryHintText: '连接 AI 绘图 / AI 视频 / 可灵动作迁移 节点',
        secondaryHintText: '或从历史记录发送到此处进行预览',
        cardWidth: DEFAULT_PREVIEW_NODE_CARD_WIDTH,
        cardHeight: DEFAULT_PREVIEW_NODE_CARD_HEIGHT,
        previewStatus: 'empty',
        previewMedia: undefined,
        previewErrorMessage: undefined,
        onRequestRemove: handleRemoveNode,
        onRequestSyncPreview: handleRequestSyncPreview,
      },
    };

    setCanvasNodes((previousNodes) => [
      ...previousNodes.map((node) => ({ ...node, selected: false })),
      nextNode,
    ]);
    setContextMenu((previous) => ({ ...previous, visible: false }));
  }, [contextMenu.canvasX, contextMenu.canvasY, handleRemoveNode, handleRequestSyncPreview]);

  /**
   * 创建“对比”节点
   *
   * 对应右键菜单中的“对比”按钮。
   * 当前只做前端卡片设计与基础交互，不接后端真实素材。
   *
   * 节点生命周期建议（后续实现）：
   * - 初始创建：`compareStatus = 'empty'`
   * - 后端素材就绪：更新为 `compareStatus = 'ready'` 并写入 `compareMedia`
   * - 删除节点：统一走 `onRequestRemove` 回调，在装配层处理资源清理
   *
   * 重构建议：
   * - 如果未来出现更多创建参数（模板、来源、对齐策略），
   *   建议提炼 `buildCompareNodeData()` 工厂函数，避免当前函数持续膨胀
   */
  const createCompareNodeFromContextMenu = useCallback(() => {
    const nodeId = `compare-${nodeSequenceRef.current}`;
    nodeSequenceRef.current += 1;

    const nextNode: CompareWorkflowNode = {
      id: nodeId,
      type: COMPARE_NODE_TYPE,
      selected: true,
      position: {
        // 原型默认尺寸约 380x240，创建时将点击点放在卡片几何中心附近。
        x: Math.max(0, contextMenu.canvasX - DEFAULT_COMPARE_NODE_CARD_WIDTH / 2),
        y: Math.max(0, contextMenu.canvasY - DEFAULT_COMPARE_NODE_CARD_HEIGHT / 2),
      },
      data: {
        title: '图片对比',
        emptyHintText: '连接图片以对比',
        cardWidth: DEFAULT_COMPARE_NODE_CARD_WIDTH,
        cardHeight: DEFAULT_COMPARE_NODE_CARD_HEIGHT,
        compareStatus: 'empty',
        onRequestRemove: handleRemoveNode,
        onRequestSyncCompareMedia: handleRequestSyncCompareMedia,
      },
    };

    setCanvasNodes((previousNodes) => [
      ...previousNodes.map((node) => ({ ...node, selected: false })),
      nextNode,
    ]);
    setContextMenu((previous) => ({ ...previous, visible: false }));
  }, [contextMenu.canvasX, contextMenu.canvasY, handleRemoveNode, handleRequestSyncCompareMedia]);

  /**
   * 存储管理弹窗状态
   *
   * 当前项目里这个弹窗还属于骨架占位性质。
   * 后续如果存储相关功能继续增加，请不要把完整弹窗逻辑长期堆在当前文件中。
   *
   * 推荐做法：
   * - 新建 `StorageModal` 独立组件
   * - 当前主组件只保留开关状态和调用入口
   *
   * 以后新增任何弹窗，也都遵循同样思路：
   * “当前文件负责调用，不负责容纳所有弹窗细节”
   */
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);

  /**
   * API 设置弹窗状态
   *
   * 当前项目里这个弹窗还属于骨架占位性质。
   * 后续如果 API 配置相关功能继续增加，请不要把完整弹窗逻辑长期堆在当前文件中。
   *
   * 推荐做法：
   * - 已创建 `ApiSettingsModal` 独立组件（位于 ./modals/ApiSettingsModal.tsx）
   * - 当前主组件只保留开关状态和调用入口
   * - 数据逻辑通过 `useApiConfigs` Hook 管理
   *
   * 以后新增任何弹窗，也都遵循同样思路：
   * "当前文件负责调用，不负责容纳所有弹窗细节"
   */
  const [isApiSettingsModalOpen, setIsApiSettingsModalOpen] = useState(false);

  /**
   * API 配置数据管理 Hook
   *
   * 【职责说明】
   * 此 Hook 负责管理所有 API 配置相关的数据和操作。
   *
   * 【当前工作模式】
   * - 当前使用 Mock 数据（useMockData: true）
   * - 后端对接时，将 useMockData 改为 false 即可切换为真实模式
   *
   * 【返回数据说明】
   * - configs: API 配置列表
   * - loading: 是否正在加载
   * - testConnection: 测试连接的函数
   * - saveConfig: 保存配置的函数
   * - deleteConfig: 删除配置的函数
   *
   * 【后续对接说明】
   * 后端对接时，Hook 内部会调用：
   * 1. 应用层服务（ApiConfigApplicationService）
   * 2. 仓库实现（TauriApiConfigRepo）
   * 3. Tauri 命令（Rust 后端）
   *
   * 详细对接步骤请查看：
   * src/presentation/hooks/useApiConfigs.ts 文件顶部的注释说明
   */
  const {
    configs,
    loading,
    testConnection,
    deleteConfig,
  } = useApiConfigs(true); // true = 使用 Mock 数据，后端对接时改为 false

  /**
   * 存储管理数据 Hook
   *
   * 【职责说明】
   * 此 Hook 负责管理所有存储配置相关的数据和操作。
   *
   * 【当前工作模式】
   * - 当前使用 Mock 数据（useMockData: true）
   * - 后端对接时，将 useMockData 改为 false 即可切换为真实模式
   *
   * 【返回数据说明】
   * - config: 当前存储配置
   * - loading: 是否正在加载
   * - error: 错误信息（如有）
   * - onSelectDownloadDirectory: 选择下载目录的函数
   * - onSelectCacheDirectory: 选择缓存目录的函数
   * - onUpdateAutoSave: 更新自动保存配置的函数
   * - onSaveWorkflowNow: 立即保存工作流的函数
   * - onImportAutoSave: 导入自动保存文件的函数
   * - qiniuConfig: 七牛云配置草稿
   * - onUpdateQiniuConfigDraft: 更新七牛云配置草稿的函数
   * - onTestQiniuConnection: 测试七牛云连接的函数
   * - onSaveQiniuConfig: 保存七牛云配置的函数
   *
   * 【后续对接说明】
   * 后端对接时，Hook 内部会调用：
   * 1. 应用层服务（StorageApplicationService）
   * 2. 仓库实现（如 SqliteStorageConfigRepository）
   * 3. Tauri 命令（Rust 后端）
   *
   * 详细对接步骤请查看：
   * src/presentation/hooks/useStorage.ts 文件顶部的注释说明
   */
  const {
    config: storageConfig,
    loading: storageLoading,
    onSelectDownloadDirectory,
    onSelectCacheDirectory,
    onUpdateAutoSave,
    onSaveWorkflowNow,
    onImportAutoSave,
    qiniuConfig,
    onUpdateQiniuConfigDraft,
    onTestQiniuConnection,
    onSaveQiniuConfig,
  } = useStorage(true); // true = 使用 Mock 数据，后端对接时改为 false

  /**
   * 同步 React Flow 视口（平移/缩放）
   *
   * 说明：
   * - 小地图拖拽、画布拖拽、滚轮缩放都会触发该回调
   * - 上层保存一份视口状态，供“右键落点换算 / 悬浮工具栏定位”等 UI 使用
   */
  const handleViewportChange = useCallback((nextViewport: Viewport) => {
    setViewport(nextViewport);
    setContextMenu((previous) => (previous.visible ? { ...previous, visible: false } : previous));
  }, []);

  /**
   * 打开右键菜单
   *
   * 当前仅在画布区域允许弹出上下文菜单。
   * 如果点击的是固定 UI 区域，则跳过，避免和按钮本身的交互冲突。
   */
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if ((e.target as Element).closest('header') || (e.target as Element).closest('.fixed-ui')) {
      return;
    }

    const canvasX = (e.clientX - viewport.x) / viewport.zoom;
    const canvasY = (e.clientY - viewport.y) / viewport.zoom;
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      canvasX,
      canvasY,
      visible: true
    });
  };

  /**
   * 全局事件绑定
   *
   * 这里处理的是“超出组件局部范围也要生效”的页面级交互：
   * - 点击空白关闭右键菜单
   * - ESC 关闭菜单和弹窗
   *
   * 对新手来说，可以把 `useEffect` 中这部分理解为：
   * “给整个浏览器窗口加上一些页面级监听器，并在组件卸载时清理干净”
   *
   * 如果未来全局交互越来越多，建议抽成：
   * - `useCanvasGlobalShortcuts`
   * - `useCanvasOverlayManager`
   * - `useCanvasViewportInteractions`
   * 这样的细分 hook，而不是继续把所有事件堆在一个 effect 里。
   */
  useEffect(() => {
    // 点击空白处关闭菜单
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('#context-menu')) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(prev => ({ ...prev, visible: false }));
        setIsStorageModalOpen(false);
      }
    };

    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden text-gray-300 font-sans select-none bg-black relative">

      {/* 
        阅读建议：
        如果你是第一次接手这个页面，请按下面顺序阅读：
        1. 先看“画布背景容器”理解最底层交互
        2. 再看“顶部导航栏”理解页面控制入口
        3. 再看“帮助区 / 小地图 / 右键菜单 / 弹窗区”理解外围辅助系统
        4. 最后再决定新功能应该扩展到哪个独立模块中
      */}

      {/* ========================================================= */}
      {/* 1. 画布背景容器 (Canvas Layer) */}
      {/* ========================================================= */}
      <div 
        className="absolute inset-0 overflow-hidden bg-black"
        onContextMenu={handleContextMenu}
      >
        {/* 光滑玻璃底板反光层 - 增强反光与光泽 */}
        <div 
          className="absolute inset-0 pointer-events-none z-0 mix-blend-screen"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 30%, transparent 50%, rgba(255,255,255,0.03) 100%), radial-gradient(circle at 50% 0%, rgba(255,255,255,0.15) 0%, transparent 60%)',
          }}
        />

        {/* 无限网格点阵层 - 放在反光层之上 */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 1.5px, transparent 1.5px)',
            backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
          }}
        />

        {/* 边缘强烈暗角，用于营造玻璃厚度和内陷感 */}
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            boxShadow: 'inset 0 0 150px rgba(0,0,0,1), inset 0 0 50px rgba(0,0,0,0.8)'
          }}
        />

        {/*
          画布内容真正的承载层
          
          目前这里还是空的，是为了先把视图骨架和交互底座搭好。
          后续画布里的真正内容，例如：
          - 工作流卡片
          - 节点
          - 连线
          - 占位提示
          - 分组框
          - 选区框
          都应该优先拆成独立组件，再挂到这里渲染。
          
          非常重要的开发约定：
          - 不要在这里直接手写一大坨复杂卡片结构然后无限膨胀
          - 要先抽成可复用、可单测、可单独理解的组件
          
          推荐方向：
          - `CanvasNodeLayer`
          - `WorkflowCard`
          - `CanvasConnectionLayer`
          - `CanvasSelectionLayer`
          - `CanvasEmptyState`
          
          如果未来出现“新增一个具体页面来承载某种设计内容”的需求，
          也应理解为：
          “新建独立模块，然后在当前主画布中调用它”
          而不是把所有视觉实现都直接写死在当前文件。
        */}
        <div className="absolute inset-0 z-10">
          {/* 
            节点渲染层（已接入 React Flow）

            当前版本已完成：
            - 右键菜单点击“上传文件”后创建节点卡片
            - 右键菜单点击“预览”后创建预览节点卡片
            - 右键菜单点击“对比”后创建对比节点卡片
            - 节点可拖拽、可选中、可删除
            - 节点内“选择文件”按钮预留后端调用入口

            对新手非常重要的边界说明：
            - 节点 UI 结构：在 `components/canvas-nodes/*`
            - 节点创建入口：当前文件右键菜单动作
            - 后端调用挂接：`handleRequestUpload`

            后续新增其它节点时，建议流程：
            1. 先在 `canvas-nodes/types.ts` 新增节点数据契约
            2. 再新增自定义节点组件
            3. 最后在右键菜单或工具栏接入创建动作
          */}
          <CanvasNodeLayer
            nodes={renderedCanvasNodes}
            edges={canvasEdges}
            onNodesChange={handleCanvasNodesChange}
            onEdgesChange={handleCanvasEdgesChange}
            onConnect={handleConnect}
            initialViewport={INITIAL_CANVAS_VIEWPORT}
            onViewportChange={handleViewportChange}
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. 顶部导航栏 (Header) */}
      {/* ========================================================= */}
      <header className="fixed top-4 inset-x-0 z-20 pointer-events-none fixed-ui">
        <div className="flex items-center justify-between px-4 max-w-[100vw] overflow-x-auto ui-scrollbar">
          
          {/* 左侧项目信息 */}
          <div 
            onClick={() => router.push('/projects')}
            className="flex shrink-0 items-center space-x-2 bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-white/5 pointer-events-auto cursor-pointer hover:bg-[#252525] transition-colors shadow-lg"
          >
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.5)]">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
            </div>
            <span className="text-xs font-medium text-white truncate max-w-[150px]">
              {project ? project.meta.name : '未命名项目'}
            </span>
          </div>

          {/* 
            右侧工具栏
            
            这里是“页面入口操作区”，而不是每个功能的最终实现区。
            例如下载、清空、存储、API 设置这些按钮，未来若功能做深：
            - 下载应调用独立导出能力
            - 清空应调用明确的应用层命令
            - 存储应调用独立弹窗或独立流程页
            - API 设置应调用独立设置页面或弹窗
            
            当前文件更适合保留：
            - 按钮位置
            - 是否显示
            - 点击后打开哪个模块
            
            不适合保留：
            - 全量表单细节
            - 大量业务校验
            - 复杂流程状态机
          */}
          <div className="bg-[#171717]/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center space-x-4 text-[11px] pointer-events-auto shrink-0 shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                <span>{zoomPercentText}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 border-l border-white/10 pl-4">
              <button className="flex items-center space-x-1 hover:text-white transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                <span>下载</span>
              </button>
              <button className="hover:text-white transition-colors">清空</button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsStorageModalOpen(true); }} 
                className="flex items-center space-x-1 hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <span>存储</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsApiSettingsModalOpen(true); }}
                className="flex items-center space-x-1 hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>
                <span>API 设置</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 3. 左下角帮助 */}
      {/* ========================================================= */}
      <div className="fixed bottom-4 left-4 z-20 fixed-ui">
        <button className="w-8 h-8 bg-[#171717]/80 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors shadow-lg text-white">
          <span className="text-xs font-medium">?</span>
        </button>
      </div>

      {/*
        上传后悬浮工具栏

        显示门槛非常严格，必须同时满足：
        - 当前节点被用户点击选中（激活态）
        - 当前节点已存在上传文件

        这是为了避免两类误显示：
        1. 用户仅创建了空卡片（未上传）时误出现工具栏
        2. 用户未点击该节点时抢占视觉焦点
      */}
      {activeUploadedNode && activeToolbarAnchor && (
        <>
          <UploadedAssetFloatingToolbar
            activeNodeId={activeUploadedNode.id}
            anchorX={activeToolbarAnchor.x}
            anchorY={activeToolbarAnchor.y}
            onRequestUploadReplace={handleRequestUploadReplaceFromToolbar}
          />
          <input
            ref={toolbarUploadInputRef}
            type="file"
            accept={SUPPORTED_UPLOAD_FILE_ACCEPT}
            className="hidden"
            onChange={handleToolbarUploadInputChange}
          />
        </>
      )}

      {/* ========================================================= */}
      {/* 4. 右键菜单 (Context Menu) */}
      {/* ========================================================= */}
      {contextMenu.visible && (
        <div 
          id="context-menu" 
          className="fixed z-50 bg-[#1a1a1a]/95 backdrop-blur-md border border-[#2d2d2d] rounded-xl shadow-2xl py-1 overflow-visible select-none fixed-ui"
          style={{ 
            left: `${Math.min(contextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 200 : contextMenu.x)}px`, 
            top: `${Math.min(contextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 300 : contextMenu.y)}px` 
          }}
        >
          {/* 
            菜单项列表
            
            当前是静态骨架版本，目的是先把右键菜单这种交互容器搭起来。
            后续如果要根据不同场景显示不同内容，应优先升级为：
            - 配置驱动菜单
            - 按节点类型动态生成菜单
            - 按权限显示菜单项
            - 按选中状态显示批量操作
            
            如果复杂度上来，建议拆出：
            - `CanvasContextMenu`
            - `buildCanvasContextMenuItems`
            - `NodeContextMenu`
            等独立文件。
          */}
          <div className="flex flex-col px-1 min-w-[180px] pt-1">
            <button
              onClick={createFileUploadNodeFromContextMenu}
              className="flex items-center px-3 py-1.5 hover:bg-white/5 rounded-md group transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              <span className="text-[13px] text-gray-300 group-hover:text-white">上传文件</span>
            </button>
            <button
              onClick={createImageGenerationNodeFromContextMenu}
              className="flex items-center px-3 py-1.5 hover:bg-white/5 rounded-md group transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              <span className="text-[13px] text-gray-300 group-hover:text-white">图片</span>
            </button>
            <button
              onClick={createPreviewNodeFromContextMenu}
              className="flex items-center px-3 py-1.5 hover:bg-white/5 rounded-md group transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              <span className="text-[13px] text-gray-300 group-hover:text-white">预览</span>
            </button>
            <button
              onClick={createCompareNodeFromContextMenu}
              className="flex items-center px-3 py-1.5 hover:bg-white/5 rounded-md group transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
              <span className="text-[13px] text-gray-300 group-hover:text-white">对比</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. 弹窗区 (Modals) */}
      {/* ========================================================= */}

      {/* 
        弹窗区总说明
        
        这里是当前页面统一放置弹窗挂载点的位置。
        这个思路本身是对的，因为弹窗属于页面浮层的一部分。
        
        但要特别注意：
        “弹窗挂载在这里” 不等于 “弹窗实现必须全部写在这里”。
        
        后续正确姿势：
        - 这里保留条件渲染入口
        - 具体弹窗内容拆到独立文件
        - 当前主组件只负责 open / close 和必要数据传递
        
        后续常见预留项：
        - 存储管理弹窗
        - API 设置弹窗
        - 工作流卡片详情弹窗
        - 删除确认弹窗
        - 导出设置弹窗
        - 模板选择弹窗
      */}

      {/*
        存储管理弹窗

        此弹窗已拆分为独立组件：
        - 组件位置：src/presentation/pages/canvas/components/modals/StorageModal.tsx
        - 数据管理：src/presentation/hooks/useStorage.ts
        - 应用层：src/application/storage/
        - 领域层：src/domain/storage/

        【当前工作模式】
        - 使用 Mock 数据（无需后端即可测试）
        - 后端对接时，修改 useStorage(true) 为 useStorage(false)

        【详细对接步骤】
        请查看以下文件顶部的注释说明：
        1. src/domain/storage/ - 领域模型和仓库接口
        2. src/application/storage/ - 应用用例和命令
        3. src/presentation/hooks/useStorage.ts - Hook 和后端对接说明
        4. src/presentation/pages/canvas/components/modals/StorageModal.tsx - UI 组件
      */}
      <StorageModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        config={storageConfig}
        loading={storageLoading}
        onSelectDownloadDirectory={onSelectDownloadDirectory}
        onSelectCacheDirectory={onSelectCacheDirectory}
        onUpdateAutoSave={onUpdateAutoSave}
        onSaveWorkflowNow={onSaveWorkflowNow}
        onImportAutoSave={onImportAutoSave}
        qiniuConfig={qiniuConfig}
        onUpdateQiniuConfigDraft={onUpdateQiniuConfigDraft}
        onTestQiniuConnection={onTestQiniuConnection}
        onSaveQiniuConfig={onSaveQiniuConfig}
      />

      {/*
        API 设置弹窗

        此弹窗已拆分为独立组件：
        - 组件位置：src/presentation/pages/canvas/components/modals/ApiSettingsModal.tsx
        - 数据管理：src/presentation/hooks/useApiConfigs.ts
        - 应用层：src/application/apiConfig/
        - 领域层：src/domain/apiConfig/

        【当前工作模式】
        - 使用 Mock 数据（无需后端即可测试）
        - 后端对接时，修改 useApiConfigs(true) 为 useApiConfigs(false)

        【详细对接步骤】
        请查看以下文件顶部的注释说明：
        1. src/domain/apiConfig/ - 领域模型和仓库接口
        2. src/application/apiConfig/ - 应用用例和命令
        3. src/presentation/hooks/useApiConfigs.ts - Hook 和后端对接说明
        4. src/presentation/pages/canvas/components/modals/ApiSettingsModal.tsx - UI 组件
      */}
      <ApiSettingsModal
        isOpen={isApiSettingsModalOpen}
        onClose={() => setIsApiSettingsModalOpen(false)}
        configs={configs}
        loading={loading}
        onTestConnection={testConnection}
        onDeleteConfig={deleteConfig}
      />

    </div>
  );
}
