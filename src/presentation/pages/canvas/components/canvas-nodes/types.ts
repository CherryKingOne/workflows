import { type Node } from '@xyflow/react';

/**
 * 上传文件节点类型常量
 *
 * 这类常量建议集中定义，避免未来多人维护时出现：
 * - A 文件写成 `fileUpload`
 * - B 文件写成 `file-upload`
 * - C 文件写成 `upload_file`
 *
 * 统一常量是新手最容易忽略、但长期最影响稳定性的细节之一。
 */
export const FILE_UPLOAD_NODE_TYPE = 'fileUpload';
export const IMAGE_GENERATION_NODE_TYPE = 'imageGeneration';
export const PREVIEW_NODE_TYPE = 'preview';
export const COMPARE_NODE_TYPE = 'compare';

/**
 * 前端文件展示摘要
 *
 * 这个结构只保存“展示和交互需要”的轻量信息，
 * 不直接持有真实 File 对象，避免节点状态过重。
 */
export interface FileUploadAssetSummary {
  id: string;
  name: string;
  mimeType: string;
  sizeInBytes: number;
  /**
   * 预览地址（后端返回）
   *
   * 说明：
   * - 已配置七牛时：这里是七牛 CDN / 域名 URL
   * - 未配置七牛且为图片时：这里是 Base64 Data URL
   * - 历史版本可能仍是 `blob:`，所以清理逻辑仍需做兼容
   */
  previewUrl?: string;
  /**
   * 存储策略来源（便于后续排查和扩展多存储）
   */
  storageProvider?: 'qiniu' | 'base64';
  /**
   * 七牛对象键（仅当 storageProvider = qiniu 时存在）
   */
  objectKey?: string;
  /**
   * 媒体类型（用于未来扩展更细粒度渲染策略）
   */
  mediaType?: 'image' | 'video' | 'audio';
}

/**
 * 上传文件节点的数据结构
 *
 * 这是“展示层节点数据契约”，负责约束前端节点渲染和交互所需的数据。
 * 注意这里不放领域规则，只放 UI 需要的数据与交互回调引用。
 *
 * 为什么要这样拆：
 * - 领域规则在 domain/application 层维护
 * - 当前类型只负责“节点怎么画、点击后向上抛出什么事件”
 *
 * 未来后端接入时，推荐流程：
 * 1. 节点按钮触发 `onRequestBackendUpload`
 * 2. `CanvasBoard`（装配层）调用 application 层函数
 * 3. application 层再调用 infrastructure 适配器（例如 Tauri command）
 */
export interface FileUploadNodeData extends Record<string, unknown> {
  title: string;
  hintLines: string[];
  cardWidth?: number;
  cardHeight?: number;
  selectedAssets?: FileUploadAssetSummary[];
  uploadErrorMessage?: string;
  onRequestRemove?: (nodeId: string) => void;
  onRequestBackendUpload?: (nodeId: string, files: File[]) => void;
}

/**
 * 画布内“上传文件节点”的强类型定义
 *
 * 使用统一类型能带来两个直接收益：
 * - 新手改字段时，TypeScript 会立即提醒哪里没同步
 * - 在节点层、菜单层、调用层之间传值更安全
 */
export type FileUploadWorkflowNode = Node<FileUploadNodeData, typeof FILE_UPLOAD_NODE_TYPE>;

/**
 * 图片生成比例类型
 *
 * 这里先收敛为固定联合类型，原因：
 * - 当前原型里展示的是固定比例按钮（例如 1:1）
 * - 用联合类型能让后续 UI 按钮和后端参数约束保持一致
 *
 * 后续如需支持“任意宽高自定义”，建议新增：
 * - `custom` 类型
 * - 对应的宽高数值字段
 */
export type ImageGenerationAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

/**
 * 图片生成分辨率档位
 *
 * 这是一层“展示层可读值”，后续后端可在应用层做映射，例如：
 * - `1K` -> 1024
 * - `2K` -> 2048
 */
export type ImageGenerationResolution = '1K' | '2K';

/**
 * 图片节点提交到后端前的“草稿参数”
 *
 * 说明：
 * - 该结构只描述前端已经收集到的输入
 * - 不在这里放后端返回内容（比如任务 ID、进度、结果 URL）
 *
 * 后续接后端时，建议把这个结构映射到 application 层命令对象，例如：
 * - `CreateImageGenerationTaskCommandInput`
 */
export interface ImageGenerationPromptDraft {
  promptText: string;
  modelName: string;
  aspectRatio: ImageGenerationAspectRatio;
  resolution: ImageGenerationResolution;
}

/**
 * 图片生成节点数据契约
 *
 * 职责边界（给新手）：
 * - 这里只描述“卡片渲染与交互需要什么数据”
 * - 不承载复杂业务规则（配额、鉴权、计费、审核等）
 * - 不承载基础设施细节（HTTP、Tauri、SDK）
 *
 * 后端对接推荐流程（函数调用优先）：
 * 1. 节点卡片点击“生成” -> 调用 `onRequestGenerateImage`
 * 2. `CanvasBoard` 作为装配层接住事件并调用 application 层函数
 * 3. application 层编排领域规则与基础设施适配器
 */
export interface ImageGenerationNodeData extends Record<string, unknown> {
  title: string;
  promptText: string;
  modelName: string;
  aspectRatio: ImageGenerationAspectRatio;
  resolution: ImageGenerationResolution;
  cardWidth?: number;
  expandedHeight?: number;
  collapsedHeight?: number;
  isCollapsed?: boolean;
  onRequestRemove?: (nodeId: string) => void;
  onRequestGenerateImage?: (nodeId: string, draft: ImageGenerationPromptDraft) => void;
  onRequestUpdatePromptText?: (nodeId: string, nextPromptText: string) => void;
}

/**
 * 画布内“图片生成节点”的强类型定义
 */
export type ImageGenerationWorkflowNode = Node<
  ImageGenerationNodeData,
  typeof IMAGE_GENERATION_NODE_TYPE
>;

/**
 * 对比节点数据契约
 *
 * 职责边界（给新手）：
 * - 这里只描述“对比节点 UI 需要哪些数据”
 * - 不在这里写后端调用细节、权限、计费、审核等业务规则
 *
 * 当前实现状态：
 * - 本次先实现“空状态卡片视觉”
 * - 真实图片/视频对比内容属于后续增量功能
 *
 * 未来扩展建议（图片/视频/音频）：
 * 1. 先扩展 `compareMedia`，使用 `kind` 区分类型
 * 2. 再在卡片组件里按 `kind` 分支渲染 image/video/audio UI
 * 3. 复杂 UI（滑块、波形、时间轴）优先拆子组件，避免单文件膨胀
 *
 * 删除与重构建议：
 * - 删除统一走 `onRequestRemove(nodeId)` 上抛，不要让卡片组件直接改全局状态
 * - 当字段数量明显增长时，建议拆成 `CompareMediaPayload`、`CompareState`、`CompareActions`
 */
export interface CompareNodeData extends Record<string, unknown> {
  title: string;
  emptyHintText: string;
  cardWidth?: number;
  cardHeight?: number;
  /**
   * 对比内容状态（当前默认 `empty`）
   *
   * - `empty`: 还未接入对比素材
   * - `ready`: 已有可展示的对比内容（后续实现）
   */
  compareStatus?: 'empty' | 'ready';
  /**
   * 后续真实对比内容载荷（当前只作为预留契约，不在本次实现中渲染）
   *
   * 推荐说明：
   * - leftMedia: 原始素材
   * - rightMedia: 结果素材
   * - `kind` 统一媒体类型，便于前端分支渲染与后端参数对齐
   */
  compareMedia?: {
    kind: 'image' | 'video' | 'audio';
    leftMediaUrl: string;
    rightMediaUrl: string;
    leftMimeType: string;
    rightMimeType: string;
    leftLabel?: string;
    rightLabel?: string;
  };
  /**
   * 对比节点错误文案（前端可直接展示）
   *
   * 典型场景：
   * - 连入了不足两路素材
   * - 两路素材媒体类型不一致（例如 image + video）
   */
  compareErrorMessage?: string;
  onRequestRemove?: (nodeId: string) => void;
  /**
   * 请求同步对比素材（后端联调入口）
   *
   * 推荐链路：
   * CompareNodeCard -> CanvasBoard -> application use case -> infrastructure(Tauri/Rust)
   */
  onRequestSyncCompareMedia?: (nodeId: string) => void;
}

/**
 * 画布内“对比节点”的强类型定义
 */
export type CompareWorkflowNode = Node<CompareNodeData, typeof COMPARE_NODE_TYPE>;

/**
 * 预览节点数据契约
 *
 * 这一层仍属于展示层（presentation）：
 * - 只描述“这个节点要显示什么”
 * - 只暴露“这个节点向上抛什么交互事件”
 * - 不在这里实现后端调用细节
 *
 * 为什么要留 `onRequestSyncPreview`：
 * - 预览节点未来一定要和后端能力联动（例如读取最新任务结果、刷新素材状态）
 * - 但卡片组件不应直接知道 Tauri/Rust 细节
 * - 所以由卡片抛事件 -> CanvasBoard（装配层）接住 -> application 层函数编排
 *
 * 当前状态说明（非常重要）：
 * - 这个契约目前还没有“真实媒体载荷字段”
 * - 现阶段预览卡片展示的是空状态文案，不是图片/视频播放器
 *
 * 后续支持图片/视频时，建议新增如下字段（示例，仅说明方向）：
 * - `previewMedia?: { kind: 'image' | 'video'; url: string; mimeType: string }`
 * - `previewStatus?: 'idle' | 'loading' | 'success' | 'error'`
 * - `previewErrorMessage?: string`
 *
 * 后续新增音频时，建议最小改动路径：
 * 1. 把 `kind` 扩展到 `'audio'`
 * 2. 在卡片渲染层增加 `audio` 分支
 * 3. 如果音频需要复杂展示（波形、时长、字幕），优先拆独立子组件
 *
 * 删除能力扩展建议：
 * - 保持 `onRequestRemove(nodeId)` 作为统一删除入口
 * - 如果未来支持“软删除/回收站/撤销删除”，不要改卡片层签名，
 *   在 application 层扩展命令对象并由装配层透传
 *
 * 重构建议：
 * - 当 `PreviewNodeData` 字段明显增多时，建议按功能拆分类型：
 *   例如 `PreviewMediaPayload`、`PreviewLifecycleState`、`PreviewActions`
 * - 拆分后在这里组合，避免单个 interface 失控增长
 */
export interface PreviewNodeData extends Record<string, unknown> {
  /**
   * 顶部标题（目前显示“预览节点”）
   */
  title: string;
  /**
   * 主提示文案（当前空状态第一行）
   */
  primaryHintText: string;
  /**
   * 次提示文案（当前空状态第二行）
   */
  secondaryHintText: string;
  /**
   * 卡片宽度（像素）
   */
  cardWidth?: number;
  /**
   * 卡片高度（像素）
   */
  cardHeight?: number;
  /**
   * 删除节点请求（只上抛，不在卡片内部直接删全局数据）
   */
  onRequestRemove?: (nodeId: string) => void;
  /**
   * 请求同步预览数据（后端联调入口）
   *
   * 预期职责：
   * - 触发 application 层去获取最新预览内容
   * - 不在卡片内部直接发请求
   */
  onRequestSyncPreview?: (nodeId: string) => void;
}

/**
 * 画布内“预览节点”的强类型定义
 */
export type PreviewWorkflowNode = Node<PreviewNodeData, typeof PREVIEW_NODE_TYPE>;

/**
 * 画布可渲染节点联合类型
 *
 * 说明：
 * - 画布会逐步扩展更多节点
 * - 用联合类型可以在一个数组里安全存放不同节点
 * - TypeScript 会帮助我们在读写数据时做类型收窄
 */
export type CanvasWorkflowNode =
  | FileUploadWorkflowNode
  | ImageGenerationWorkflowNode
  | PreviewWorkflowNode
  | CompareWorkflowNode;
