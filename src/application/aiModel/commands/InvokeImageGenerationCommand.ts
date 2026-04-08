/**
 * 调用图像生成模型的命令对象
 *
 * 设计原则：
 * - 封装前端传来的所有必要参数
 * - modelParams 使用 any 类型，由具体模型内部校验
 */
export interface InvokeImageGenerationCommand {
  /** 要调用的模型ID */
  modelId: string;
  /** 用户输入的提示词 */
  prompt: string;
  /** 模型特定参数（由各模型独立定义） */
  modelParams: any;
}
