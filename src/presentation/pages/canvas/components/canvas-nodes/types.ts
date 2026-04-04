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
   * 预览地址（前端临时 Object URL）
   *
   * 说明：
   * - 这个字段只用于前端预览，不是可持久化 URL
   * - 页面卸载、节点删除、文件被替换时需要主动 revoke，避免内存泄漏
   */
  previewUrl?: string;
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
 * 画布可渲染节点联合类型
 *
 * 说明：
 * - 画布会逐步扩展更多节点
 * - 用联合类型可以在一个数组里安全存放不同节点
 * - TypeScript 会帮助我们在读写数据时做类型收窄
 */
export type CanvasWorkflowNode = FileUploadWorkflowNode | ImageGenerationWorkflowNode;
