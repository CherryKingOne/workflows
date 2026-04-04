"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import { useRouter } from 'next/navigation';
import { Project } from '../../../../domain/project/entities/Project';
import { ApiSettingsModal } from './modals/ApiSettingsModal';
import { StorageModal } from './modals/StorageModal';
import { useApiConfigs } from '../../../hooks/useApiConfigs';
import { useStorage } from '../../../hooks/useStorage';
import { CanvasNodeLayer } from './canvas-nodes/CanvasNodeLayer';
import { UploadedAssetFloatingToolbar } from './toolbars/UploadedAssetFloatingToolbar';
import {
  FILE_UPLOAD_NODE_TYPE,
  type FileUploadAssetSummary,
  type FileUploadWorkflowNode,
} from './canvas-nodes/types';

/**
 * 上传文件支持的 MIME 前缀
 *
 * 当前需求明确只支持图片、视频、音频，所以前端先做一层兜底校验。
 * 后续后端仍需保留同等校验，前后端双保险更稳妥。
 */
const SUPPORTED_UPLOAD_MIME_PREFIXES = ['image/', 'video/', 'audio/'] as const;
const DEFAULT_FILE_UPLOAD_CARD_WIDTH = 320;
const DEFAULT_FILE_UPLOAD_CARD_HEIGHT = 320;
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
 * 释放节点文件预览 URL
 *
 * 注意：
 * 这些 URL 来自 `URL.createObjectURL`，浏览器不会自动释放。
 * 必须在替换文件、删除节点、页面退出时显式释放，避免内存持续增长。
 */
function revokePreviewUrls(assets?: FileUploadAssetSummary[]) {
  assets?.forEach((asset) => {
    if (asset.previewUrl) {
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
  const canvasNodesRef = useRef<FileUploadWorkflowNode[]>([]);
  const toolbarUploadInputRef = useRef<HTMLInputElement | null>(null);
  const toolbarUploadTargetNodeIdRef = useRef<string | null>(null);
  
  /**
   * 画布拖拽状态
   *
   * 这是最基础的交互状态之一，用来控制用户是否正在拖动整张画布。
   * 后续如果要支持：
   * - 触控板拖拽
   * - 触摸手势
   * - 空格键拖动画布
   * - 缩放后的拖拽修正
   * 可以继续围绕这一组状态演进，但建议逐步抽离到专门的交互 hook 中。
   */
  const [isDragging, setIsDragging] = useState(false);

  /**
   * 画布逻辑坐标
   *
   * `position` 控制当前画布内容相对视口的偏移量。
   * 简单理解就是“用户已经把整张画布拖到了哪里”。
   *
   * 后续如果加入：
   * - 缩放
   * - 自动聚焦到某个节点
   * - 小地图联动
   * - 恢复上次视图位置
   * 这组状态会继续扩展为更完整的 viewport / camera 概念。
   */
  const [position, setPosition] = useState({ x: -1500, y: -1200 });

  /**
   * 拖拽起点缓存
   *
   * 用 ref 而不是 state，是因为这里只需要跨事件保存即时数据，
   * 不需要每次修改都触发重新渲染。
   */
  const dragStartRef = useRef({ x: 0, y: 0 });

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
  const [canvasNodes, setCanvasNodes] = useState<FileUploadWorkflowNode[]>([]);

  /**
   * 画布连线状态（仅前端 UI）
   *
   * 这一版主要目的是把连线样式和交互做成与原型一致。
   * 后续接后端时，应与节点一起由应用层命令统一管理。
   */
  const [canvasEdges, setCanvasEdges] = useState<Edge[]>([]);

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
    (node) => node.selected && (node.data.selectedAssets?.length ?? 0) > 0,
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
          position.x +
          activeUploadedNode.position.x +
          (activeUploadedNode.data.cardWidth ?? DEFAULT_FILE_UPLOAD_CARD_WIDTH) / 2,
        y: position.y + activeUploadedNode.position.y,
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
  const handleCanvasNodesChange = useCallback<OnNodesChange<FileUploadWorkflowNode>>((changes) => {
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
      revokePreviewUrls(removingNode?.data.selectedAssets);
      return previousNodes.filter((node) => node.id !== nodeId);
    });
    setCanvasEdges((previousEdges) =>
      previousEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    );
  }, []);

  /**
   * 上传动作占位函数（后端对接预留）
   *
   * 当前前端任务只做 UI，暂不接真实上传逻辑。
   * 这里保留函数入口，目的是明确未来后端函数调用的挂接点。
   *
   * 推荐后续对接路径（函数调用优先）：
   * - presentation: 触发该回调
   * - application: 调用 UploadFileUseCase
   * - infrastructure: 通过 Tauri 命令适配本地文件能力
   */
  const handleRequestUpload = useCallback(async (nodeId: string, files: File[]) => {
    const hasInvalidFile = files.some((file) =>
      !SUPPORTED_UPLOAD_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix)),
    );

    if (hasInvalidFile) {
      setCanvasNodes((previousNodes) =>
        previousNodes.map((node) => {
          if (node.id !== nodeId) {
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

    const selectedAssets: FileUploadAssetSummary[] = files.map((file, index) => ({
      id: `${nodeId}-asset-${Date.now()}-${index}`,
      name: file.name,
      mimeType: file.type,
      sizeInBytes: file.size,
      previewUrl: URL.createObjectURL(file),
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
        if (node.id !== nodeId) {
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

    /**
     * 后端函数调用预留位
     *
     * 下一步后端接入时，把这里替换为 application 层函数调用。
     * 示例方向：
     * - await uploadFileUseCase.execute({ nodeId, files })
     */
    console.info(
      '[UI Placeholder] 已选择上传文件，后续在这里调用后端函数。节点 ID:',
      nodeId,
      '文件数量:',
      files.length,
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
        revokePreviewUrls(node.data.selectedAssets);
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

    setCanvasNodes((previousNodes) => [...previousNodes, nextNode]);
    setContextMenu((previous) => ({ ...previous, visible: false }));
  }, [contextMenu.canvasX, contextMenu.canvasY, handleRemoveNode, handleRequestUpload]);

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
  } = useStorage(true); // true = 使用 Mock 数据，后端对接时改为 false

  /**
   * 处理鼠标按下
   *
   * 这里只允许在真正的画布背景区域开始拖拽。
   * 如果点击的是顶部导航、固定 UI、右键菜单等交互区，则不触发画布拖动。
   *
   * 这是非常重要的边界判断：
   * 画布层和浮层 UI 必须解耦，否则用户会在点击按钮时误拖动画布。
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    // 忽略点击在 UI 元素上的拖拽，只允许在画布背景上拖拽
    if (
      (e.target as Element).closest('header') ||
      (e.target as Element).closest('.fixed-ui') ||
      (e.target as Element).closest('#context-menu') ||
      (e.target as Element).closest('.react-flow__node')
    ) {
      return;
    }
    // 左键拖拽，右键显示菜单（这里屏蔽掉左键点击直接显示菜单的行为，改为右键或者后续通过别的交互显示）
    if (e.button !== 0) return;

    setIsDragging(true);
    setContextMenu(prev => ({ ...prev, visible: false })); // 开始拖拽时隐藏菜单
    
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  /**
   * 处理鼠标移动
   *
   * 当前逻辑非常纯粹：
   * 只要处于拖拽中，就实时更新画布位置。
   *
   * 如果未来要加入性能优化，可以考虑：
   * - requestAnimationFrame 节流
   * - 更独立的 viewport reducer
   * - 拖拽与缩放统一状态机
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  /**
   * 结束拖拽
   *
   * 当前只负责关闭拖拽状态。
   * 后续如果需要记录埋点、保存视口位置、触发吸附或边界回弹，
   * 可以在这里或提取后的交互 hook 中扩展。
   */
  const handleMouseUp = () => {
    setIsDragging(false);
  };

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
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      canvasX: e.clientX - position.x,
      canvasY: e.clientY - position.y,
      visible: true
    });
  };

  /**
   * 全局事件绑定
   *
   * 这里处理的是“超出组件局部范围也要生效”的页面级交互：
   * - 鼠标抬起时结束拖拽
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
    const handleGlobalMouseUp = () => setIsDragging(false);
    
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

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
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
        className={`absolute inset-0 overflow-hidden transition-cursor duration-75 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} bg-black`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
            backgroundPosition: `${position.x}px ${position.y}px`,
            backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
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
        <div 
          className="absolute z-10" 
          style={{ 
            left: `${position.x}px`, 
            top: `${position.y}px`,
          }}
        >
          {/* 
            节点渲染层（已接入 React Flow）

            当前版本已完成：
            - 右键菜单点击“上传文件”后创建节点卡片
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
            nodes={canvasNodes}
            edges={canvasEdges}
            onNodesChange={handleCanvasNodesChange}
            onEdgesChange={handleCanvasEdgesChange}
            onConnect={handleConnect}
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
                <span>90%</span>
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
      {/* 3. 左下角帮助 & 右下角导航小地图 */}
      {/* ========================================================= */}
      <div className="fixed bottom-4 left-4 z-20 fixed-ui">
        <button className="w-8 h-8 bg-[#171717]/80 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors shadow-lg text-white">
          <span className="text-xs font-medium">?</span>
        </button>
      </div>

      <div className="fixed bottom-4 right-4 z-20 fixed-ui pointer-events-none">
        <div className="w-48 h-28 bg-[#171717]/80 backdrop-blur-md rounded-lg border border-white/10 relative overflow-hidden shadow-lg">
          <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '10px 10px'}}></div>
          {/* 当前视口框指示器 */}
          <div className="absolute bottom-2 right-2 w-12 h-8 border border-white/40 bg-white/5 rounded-sm"></div>
        </div>
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
            accept="image/*,video/*,audio/*"
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
            <button className="flex items-center px-3 py-1.5 hover:bg-white/5 rounded-md group transition-colors">
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              <span className="text-[13px] text-gray-300 group-hover:text-white">图片</span>
            </button>
            <button className="flex items-center px-3 py-1.5 hover:bg-white/5 rounded-md group transition-colors">
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              <span className="text-[13px] text-gray-300 group-hover:text-white">预览</span>
            </button>
            <button className="flex items-center px-3 py-1.5 hover:bg-white/5 rounded-md group transition-colors">
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
