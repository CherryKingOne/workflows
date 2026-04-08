import OpenAI from "openai";
import { IChatModelProvider } from '@/src/domain/aiModel/services/IChatModelProvider';

/**
 * Doubao Seed 2.0 Pro 支持的内容类型
 */
type DoubaoContentType =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; input_image: { url: string } | { base64: string } }
  | { type: 'input_video'; input_video: { url: string } | { base64: string } }
  | { type: 'input_file'; input_file: { url: string } | { base64: string } };

/**
 * Doubao 消息格式（支持多模态）
 */
interface DoubaoMessage {
  role: string;
  content: string | DoubaoContentType[];
}

/**
 * Doubao Seed 2.0 Pro 模型专属参数
 * 完全独立的参数定义，不与其他模型共享
 */
interface DoubaoSeed20ProParams {
  apiKey: string;
  baseUrl?: string; // Base URL，默认 'https://ark.cn-beijing.volces.com/api/v3'
  model?: string; // 默认 'doubao-seed-2-0-pro-260215'
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

/**
 * Doubao Seed 2.0 Pro 对话模型提供者
 *
 * 设计原则：
 * - 完全独立的参数定义和实现
 * - 使用 OpenAI SDK 调用 Doubao API
 * - 支持多模态输入（文本、图片、视频、文档）
 * - 删除此模型只需删除此文件并从注册表移除
 */
export class DoubaoSeed20ProProvider implements IChatModelProvider {
  getModelId(): string {
    return 'doubao-seed-2-0-pro-260215';
  }

  /**
   * 发送聊天消息（支持多模态）
   * @param messages 消息历史数组，支持文本或多模态内容
   * @param params 模型参数
   * @returns 模型回复内容
   */
  async chat(
    messages: Array<{ role: string; content: string }>,
    params: unknown
  ): Promise<string> {
    // 类型断言与校验
    const typedParams = params as DoubaoSeed20ProParams;

    if (!typedParams.apiKey) {
      throw new Error('Doubao-Seed-2.0-Pro: API Key is required');
    }

    // 初始化 OpenAI 客户端（指向 Doubao API）
    const openai = new OpenAI({
      baseURL: typedParams.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: typedParams.apiKey,
    });

    // 转换消息格式以支持多模态
    const doubaoMessages = this.convertMessages(messages);

    // 调用 API（使用硬编码的默认配置）
    const completion = await openai.chat.completions.create({
      messages: doubaoMessages as any,
      model: typedParams.model || 'doubao-seed-2-0-pro-260215',
      temperature: typedParams.temperature ?? 0.7,
      max_tokens: typedParams.max_tokens ?? 128000,
      top_p: typedParams.top_p ?? 0.7,
      stream: false,
    });

    return completion.choices[0].message.content || '';
  }

  /**
   * 转换消息格式，保持向后兼容
   * 简单文本消息保持不变，多模态消息直接传递
   */
  private convertMessages(
    messages: Array<{ role: string; content: string | any }>
  ): DoubaoMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * 流式聊天（支持多模态）
   * @param messages 消息历史数组，支持文本或多模态内容
   * @param params 模型参数
   * @param onChunk 接收每个数据块的回调
   */
  async chatStream(
    messages: Array<{ role: string; content: string }>,
    params: unknown,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const typedParams = params as DoubaoSeed20ProParams;

    if (!typedParams.apiKey) {
      throw new Error('Doubao-Seed-2.0-Pro: API Key is required');
    }

    const openai = new OpenAI({
      baseURL: typedParams.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: typedParams.apiKey,
    });

    // 转换消息格式以支持多模态
    const doubaoMessages = this.convertMessages(messages);

    // 流式输出（使用硬编码的默认配置）
    const stream = await openai.chat.completions.create({
      messages: doubaoMessages as any,
      model: typedParams.model || 'doubao-seed-2-0-pro-260215',
      temperature: typedParams.temperature ?? 0.7,
      max_tokens: typedParams.max_tokens ?? 128000,
      top_p: typedParams.top_p ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        onChunk(content);
      }
    }
  }
}

// ============================================
// 直接执行测试：使用环境变量
// ============================================
if (require.main === module) {
  (async () => {
    console.log(' Doubao Seed 2.0 Pro 模型测试（支持多模态）\n');

    const provider = new DoubaoSeed20ProProvider();
    const modelId = provider.getModelId();

    // 从环境变量读取配置
    const apiKey = process.env.DOUBAO_API_KEY;
    const baseUrl = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';

    if (!apiKey) {
      console.error(' 未设置 DOUBAO_API_KEY 环境变量');
      console.log(' 使用方法：');
      console.log('   DOUBAO_API_KEY="your-key" npx tsx src/infrastructure/aiModel/providers/chat/DoubaoSeed20Pro.ts');
      console.log('');
      console.log(' 或者在应用中配置后，通过应用调用模型（推荐）');
      process.exit(1);
    }

    console.log(` 使用配置`);
    console.log(`   Model ID: ${modelId}`);
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   API Key: ${apiKey.substring(0, 10)}...`);
    console.log('');

    // 测试参数
    const params: DoubaoSeed20ProParams = {
      apiKey,
      baseUrl,
    };

    // 测试1: 纯文本消息
    console.log(' 测试1: 纯文本对话');
    const textMessages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello! Can you introduce yourself in one sentence?' },
    ];

    try {
      console.log(' 发送消息:', textMessages[textMessages.length - 1].content);
      console.log(' 等待回复...\n');

      const response = await provider.chat(textMessages, params);
      console.log(' 模型回复:', response);

      console.log('\n' + '='.repeat(50));
      console.log(' 测试2: 流式输出\n');

      await provider.chatStream(
        [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Count from 1 to 5.' },
        ],
        params,
        (chunk) => {
          process.stdout.write(chunk);
        }
      );

      console.log('\n\n' + '='.repeat(50));
      console.log('  测试3: 多模态消息（图片理解）\n');

      // 测试多模态消息
      const multimodalMessages = [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: '这张图片里有什么？' },
            {
              type: 'input_image',
              input_image: {
                url: 'https://example.com/image.jpg', // 替换为实际图片URL
              },
            },
          ],
        },
      ];

      console.log(' 发送多模态消息（包含图片）');
      console.log('  注意：需要替换为实际的图片URL才能测试');
      console.log('');

      console.log(' 测试完成！');
      console.log('\n 支持的内容类型：');
      console.log('   - input_text: 文本内容');
      console.log('   - input_image: 图片（URL或Base64）');
      console.log('   - input_video: 视频（URL或Base64）');
      console.log('   - input_file: 文档（URL或Base64）');
    } catch (error) {
      console.error(' 错误:', error);
      process.exit(1);
    }
  })().catch(console.error);
}
