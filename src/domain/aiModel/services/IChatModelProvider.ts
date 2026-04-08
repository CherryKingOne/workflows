/**
 * 聊天模型提供者接口
 * 所有聊天/对话模型必须实现此接口
 *
 * 设计原则：
 * - 只定义最低契约，不限制具体实现
 * - 参数使用 unknown 类型，由各模型内部自行校验
 * - 保持极低耦合，各模型完全独立
 */
export interface IChatModelProvider {
  /**
   * 返回模型的唯一标识
   * @returns 模型ID，如 'DeepSeek-Chat', 'GPT-4' 等
   */
  getModelId(): string;

  /**
   * 发送聊天消息的统一入口
   * @param messages 消息历史数组
   * @param specificParams 模型特定参数（由各模型内部定义和校验）
   * @returns 模型的回复内容
   */
  chat(messages: Array<{ role: string; content: string }>, specificParams: unknown): Promise<string>;

  /**
   * 流式聊天（可选实现）
   * @param messages 消息历史数组
   * @param specificParams 模型特定参数
   * @param onChunk 接收每个数据块的回调函数
   */
  chatStream?(
    messages: Array<{ role: string; content: string }>,
    specificParams: unknown,
    onChunk: (chunk: string) => void
  ): Promise<void>;
}
