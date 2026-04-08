/**
 * 图像模型提供者接口
 * 所有图像生成模型必须实现此接口
 *
 * 设计原则：
 * - 只定义最低契约，不限制具体实现
 * - 参数使用 unknown 类型，由各模型内部自行校验
 * - 保持极低耦合，各模型完全独立
 */
export interface IImageModelProvider {
  /**
   * 返回模型的唯一标识
   * @returns 模型ID，如 'DallE-3', 'SD-XL' 等
   */
  getModelId(): string;

  /**
   * 生成图像的统一入口
   * @param prompt 用户输入的提示词
   * @param specificParams 模型特定参数（由各模型内部定义和校验）
   * @returns 生成的图片URL或Base64字符串
   */
  generateImage(prompt: string, specificParams: unknown): Promise<string>;
}
