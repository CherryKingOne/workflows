import OpenAI from "openai";
import { IChatModelProvider } from '@/src/domain/aiModel/services/IChatModelProvider';

/**
 * DeepSeek Chat 模型专属参数
 * 完全独立的参数定义，不与其他模型共享
 */
interface DeepSeekChatParams {
  apiKey: string;
  baseUrl?: string; // Base URL，默认 'https://api.deepseek.com/v1'
  model?: string; // 默认 'deepseek-chat'
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

/**
 * DeepSeek Chat 对话模型提供者
 *
 * 设计原则：
 * - 完全独立的参数定义和实现
 * - 使用 OpenAI SDK 调用 DeepSeek API
 * - 删除此模型只需删除此文件并从注册表移除
 */
export class DeepSeekChatProvider implements IChatModelProvider {
  getModelId(): string {
    return 'deepseek-chat';
  }

  /**
   * 发送聊天消息
   * @param messages 消息历史数组
   * @param params 模型参数
   * @returns 模型回复内容
   */
  async chat(
    messages: Array<{ role: string; content: string }>,
    params: unknown
  ): Promise<string> {
    // 类型断言与校验
    const typedParams = params as DeepSeekChatParams;

    if (!typedParams.apiKey) {
      throw new Error('DeepSeek-Chat: API Key is required');
    }

    // 初始化 OpenAI 客户端（指向 DeepSeek API）
    const openai = new OpenAI({
      baseURL: typedParams.baseUrl || 'https://api.deepseek.com/v1',
      apiKey: typedParams.apiKey,
    });

    // 调用 API（使用硬编码的默认配置）
    const completion = await openai.chat.completions.create({
      messages: messages as any,
      model: typedParams.model || 'deepseek-chat',
      temperature: typedParams.temperature ?? 0.7,
      max_tokens: typedParams.max_tokens ?? 128000,
      top_p: typedParams.top_p ?? 0.7,
      stream: false,
    });

    return completion.choices[0].message.content || '';
  }

  /**
   * 流式聊天
   * @param messages 消息历史数组
   * @param params 模型参数
   * @param onChunk 接收每个数据块的回调
   */
  async chatStream(
    messages: Array<{ role: string; content: string }>,
    params: unknown,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const typedParams = params as DeepSeekChatParams;

    if (!typedParams.apiKey) {
      throw new Error('DeepSeek-Chat: API Key is required');
    }

    const openai = new OpenAI({
      baseURL: typedParams.baseUrl || 'https://api.deepseek.com/v1',
      apiKey: typedParams.apiKey,
    });

    // 流式输出（使用硬编码的默认配置）
    const stream = await openai.chat.completions.create({
      messages: messages as any,
      model: typedParams.model || 'deepseek-chat',
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
    console.log(' DeepSeek Chat 模型测试\n');

    const provider = new DeepSeekChatProvider();
    const modelId = provider.getModelId();

    // 从环境变量读取配置
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

    if (!apiKey) {
      console.error(' 未设置 DEEPSEEK_API_KEY 环境变量');
      console.log(' 使用方法：');
      console.log('   DEEPSEEK_API_KEY="sk-xxx" npx tsx src/infrastructure/aiModel/providers/chat/DeepSeekChat.ts');
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
    const params: DeepSeekChatParams = {
      apiKey,
      baseUrl,
      temperature: 0.7,
      max_tokens: 1000,
    };

    // 测试消息
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello! Can you introduce yourself in one sentence?' },
    ];

    try {
      console.log(' 发送消息:', messages[messages.length - 1].content);
      console.log(' 等待回复...\n');

      // 测试普通聊天
      const response = await provider.chat(messages, params);
      console.log(' 模型回复:', response);

      console.log('\n' + '='.repeat(50));
      console.log(' 测试流式输出:\n');

      // 测试流式聊天
      await provider.chatStream(
        [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: '帮我写1000字的自我介绍' },
        ],
        params,
        (chunk) => {
          process.stdout.write(chunk);
        }
      );

      console.log('\n\n 测试完成！');
    } catch (error) {
      console.error(' 错误:', error);
      process.exit(1);
    }
  })().catch(console.error);
}
