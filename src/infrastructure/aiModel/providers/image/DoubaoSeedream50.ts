import { IImageModelProvider } from '@/src/domain/aiModel/services/IImageModelProvider';

/**
 * Doubao Seedream 5.0 分辨率配置
 *
 * 支持的分辨率档位：
 * - 2K: 标准分辨率
 * - 3K: 高分辨率
 */
type DoubaoResolution = '2K' | '3K';

/**
 * Doubao Seedream 5.0 宽高比配置
 */
type DoubaoAspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16' | '3:2' | '2:3' | '21:9';

const DOUBAO_SUPPORTED_IMAGE_COUNT_MIN = 1;
const DOUBAO_SUPPORTED_IMAGE_COUNT_MAX = 15;
const DOUBAO_DEFAULT_IMAGE_COUNT = 1;

/**
 * Doubao Seedream 5.0 分辨率映射表
 *
 * 根据分辨率档位和宽高比返回具体的像素尺寸
 */
const DOUBAO_RESOLUTION_MAP: Record<DoubaoResolution, Record<DoubaoAspectRatio, string>> = {
  '2K': {
    '1:1': '2048x2048',
    '3:4': '1728x2304',
    '4:3': '2304x1728',
    '16:9': '2848x1600',
    '9:16': '1600x2848',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '21:9': '3136x1344',
  },
  '3K': {
    '1:1': '3072x3072',
    '3:4': '2592x3456',
    '4:3': '3456x2592',
    '16:9': '4096x2304',
    '9:16': '2304x4096',
    '2:3': '2496x3744',
    '3:2': '3744x2496',
    '21:9': '4704x2016',
  },
};

/**
 * Doubao Seedream 5.0 模型专属参数推荐（供该模型独立使用）
 *
 * 说明：
 * - 仅支持 2K、3K
 * - n: 生图数量范围 1~15
 */
export const DOUBAO_SEEDREAM_50_PARAM_RECOMMENDATIONS = {
  resolution: [
    {
      value: '2K' as DoubaoResolution,
      label: '2K（推荐）',
      supported: true,
    },
    {
      value: '3K' as DoubaoResolution,
      label: '3K（推荐）',
      supported: true,
    },
  ],
  aspectRatio: {
    '2K': [
      { value: '1:1' as DoubaoAspectRatio, size: '2048x2048', supported: true },
      { value: '3:4' as DoubaoAspectRatio, size: '1728x2304', supported: true },
      { value: '4:3' as DoubaoAspectRatio, size: '2304x1728', supported: true },
      { value: '16:9' as DoubaoAspectRatio, size: '2848x1600', supported: true },
      { value: '9:16' as DoubaoAspectRatio, size: '1600x2848', supported: true },
      { value: '3:2' as DoubaoAspectRatio, size: '2496x1664', supported: true },
      { value: '2:3' as DoubaoAspectRatio, size: '1664x2496', supported: true },
      { value: '21:9' as DoubaoAspectRatio, size: '3136x1344', supported: true },
    ],
    '3K': [
      { value: '1:1' as DoubaoAspectRatio, size: '3072x3072', supported: true },
      { value: '3:4' as DoubaoAspectRatio, size: '2592x3456', supported: true },
      { value: '4:3' as DoubaoAspectRatio, size: '3456x2592', supported: true },
      { value: '16:9' as DoubaoAspectRatio, size: '4096x2304', supported: true },
      { value: '9:16' as DoubaoAspectRatio, size: '2304x4096', supported: true },
      { value: '2:3' as DoubaoAspectRatio, size: '2496x3744', supported: true },
      { value: '3:2' as DoubaoAspectRatio, size: '3744x2496', supported: true },
      { value: '21:9' as DoubaoAspectRatio, size: '4704x2016', supported: true },
    ],
  } as Record<DoubaoResolution, Array<{ value: DoubaoAspectRatio; size: string; supported: boolean }>>,
  n: {
    min: DOUBAO_SUPPORTED_IMAGE_COUNT_MIN,
    max: DOUBAO_SUPPORTED_IMAGE_COUNT_MAX,
    default: DOUBAO_DEFAULT_IMAGE_COUNT,
  },
};

const DOUBAO_RESOLUTION_VALUES: DoubaoResolution[] = ['2K', '3K'];
const DOUBAO_ASPECT_RATIO_VALUES: DoubaoAspectRatio[] = ['1:1', '3:4', '4:3', '16:9', '9:16', '3:2', '2:3', '21:9'];

function isDoubaoResolution(value: string): value is DoubaoResolution {
  return DOUBAO_RESOLUTION_VALUES.includes(value as DoubaoResolution);
}

function isDoubaoAspectRatio(value: string): value is DoubaoAspectRatio {
  return DOUBAO_ASPECT_RATIO_VALUES.includes(value as DoubaoAspectRatio);
}

/**
 * Doubao Seedream 5.0 模型专属参数
 * 注意：此参数定义完全独立，不与其他模型共享
 */
interface DoubaoSeedream50Params {
  apiKey: string;
  baseUrl?: string; // Base URL，默认 'https://ark.cn-beijing.volces.com/api/v3'
  model?: string; // 默认 'doubao-seedream-5-0-260128'
  resolution?: DoubaoResolution; // 分辨率档位：'2K' | '3K'，默认 '2K'
  aspectRatio?: DoubaoAspectRatio; // 宽高比，默认 '1:1'
  n?: number; // 生图数量，范围 1-15，默认 1
  image?: string | string[]; // 参考图片 URL 或 Base64，支持单图或多图
  output_format?: 'png'; // 输出格式，仅支持 png
  response_format?: 'url' | 'b64_json'; // 返回格式
}

interface DoubaoSeedream50RequestBody {
  model: string;
  prompt: string;
  size: string;
  n: number;
  response_format: 'url' | 'b64_json';
  stream: false;
  watermark: false;
  image?: string | string[];
  output_format?: 'png';
}

/**
 * Doubao Seedream 5.0 图像生成模型提供者
 *
 * 设计原则：
 * - 完全独立的参数定义和实现
 * - 使用 Doubao API 生成图像
 * - 支持文生图、图生图、多图融合、组图生成
 * - 删除此模型只需删除此文件并从注册表移除
 */
export class DoubaoSeedream50Provider implements IImageModelProvider {
  getModelId(): string {
    return 'doubao-seedream-5-0-260128';
  }

  /**
   * 获取该模型专属参数推荐（仅当前模型使用）
   */
  getParamRecommendations() {
    return DOUBAO_SEEDREAM_50_PARAM_RECOMMENDATIONS;
  }

  async generateImage(prompt: string, params: unknown): Promise<string> {
    // 类型断言与校验（仅限本文件内部）
    const typedParams = params as DoubaoSeedream50Params;

    // 参数校验
    if (!typedParams.apiKey) {
      throw new Error('Doubao-Seedream-5.0: API Key is required');
    }

    const baseUrl = typedParams.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
    const model = typedParams.model || 'doubao-seedream-5-0-260128';
    const resolution = typedParams.resolution || '2K';
    const aspectRatio = typedParams.aspectRatio || '1:1';
    const n = typedParams.n ?? DOUBAO_DEFAULT_IMAGE_COUNT;

    if (!isDoubaoResolution(resolution)) {
      throw new Error(`Doubao-Seedream-5.0: Unsupported resolution "${resolution}". Available: ${DOUBAO_RESOLUTION_VALUES.join(', ')}`);
    }

    if (!isDoubaoAspectRatio(aspectRatio)) {
      throw new Error(`Doubao-Seedream-5.0: Unsupported aspectRatio "${aspectRatio}". Available: ${DOUBAO_ASPECT_RATIO_VALUES.join(', ')}`);
    }

    if (!Number.isInteger(n) || n < DOUBAO_SUPPORTED_IMAGE_COUNT_MIN || n > DOUBAO_SUPPORTED_IMAGE_COUNT_MAX) {
      throw new Error(`Doubao-Seedream-5.0: "n" must be an integer between ${DOUBAO_SUPPORTED_IMAGE_COUNT_MIN} and ${DOUBAO_SUPPORTED_IMAGE_COUNT_MAX}`);
    }

    const size = DOUBAO_RESOLUTION_MAP[resolution][aspectRatio];

    // 构建请求体（按照官方文档格式）
    const requestBody: DoubaoSeedream50RequestBody = {
      model: model,
      prompt: prompt,
      size,
      n,
      response_format: typedParams.response_format || 'url',
      stream: false, // 固定为 false，不开启流式输出
      watermark: false, // 默认不添加水印（内部参数，不对外暴露）
    };

    // 添加可选参数
    if (typedParams.image) {
      requestBody.image = typedParams.image;
    }

    if (typedParams.output_format) {
      requestBody.output_format = typedParams.output_format;
    }

    // 独立的网络请求逻辑
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${typedParams.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Doubao-Seedream-5.0 API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // 返回第一张图片的 URL
    if (data.data && data.data.length > 0) {
      return data.data[0].url || data.data[0].b64_json;
    }

    throw new Error('Doubao-Seedream-5.0: No image generated');
  }
}

// ============================================
// 直接执行测试：使用环境变量
// ============================================
const isDirectExecution =
  typeof require !== 'undefined'
  && typeof module !== 'undefined'
  && require.main === module;

if (isDirectExecution) {
  (async () => {
    console.log(' Doubao Seedream 5.0 模型测试\n');

    const provider = new DoubaoSeedream50Provider();
    const modelId = provider.getModelId();

    // 从环境变量读取配置
    const apiKey = process.env.DOUBAO_API_KEY;
    const baseUrl = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';

    if (!apiKey) {
      console.error(' 未设置 DOUBAO_API_KEY 环境变量');
      console.log(' 使用方法：');
      console.log('   DOUBAO_API_KEY="your-key" npx tsx src/infrastructure/aiModel/providers/image/DoubaoSeedream50.ts');
      console.log('');
      console.log(' 或者在应用中配置后，通过应用调用模型（推荐）');
      process.exit(1);
    }

    console.log(` 使用配置`);
    console.log(`   Model ID: ${modelId}`);
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   API Key: ${apiKey.substring(0, 10)}...`);
    console.log('');

    // 测试1: 文生图
    console.log(' 测试1: 文生图（纯文本输入）');
    const textPrompt = '充满活力的特写编辑肖像，模特眼神犀利，头戴雕塑感帽子，色彩拼接丰富，眼部焦点锐利，景深较浅，具有Vogue杂志封面的美学风格，采用中画幅拍摄，工作室灯光效果强烈。';

    try {
      console.log(`   提示词: ${textPrompt}`);
      console.log(' 等待生成...\n');

      const params1: DoubaoSeedream50Params = {
        apiKey,
        baseUrl,
        resolution: '2K',
        aspectRatio: '1:1',
        n: 1,
        output_format: 'png',
      };

      const imageUrl1 = await provider.generateImage(textPrompt, params1);
      console.log(' 图像生成成功！');
      console.log(`   图像URL: ${imageUrl1}`);

      console.log('\n' + '='.repeat(50));
      console.log('  测试2: 图生图（单图输入）\n');

      const imagePrompt = '保持模特姿势和液态服装的流动形状不变。将服装材质从银色金属改为完全透明的清水（或玻璃）。透过液态水流，可以看到模特的皮肤细节。光影从反射变为折射。';
      const referenceImage = 'https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_5_imageToimage.png';

      console.log(`   提示词: ${imagePrompt}`);
      console.log(`   参考图: ${referenceImage}`);
      console.log(' 等待生成...\n');

      const params2: DoubaoSeedream50Params = {
        apiKey,
        baseUrl,
        resolution: '2K',
        aspectRatio: '1:1',
        n: 1,
        image: referenceImage,
        output_format: 'png',
      };

      const imageUrl2 = await provider.generateImage(imagePrompt, params2);
      console.log(' 图像生成成功！');
      console.log(`   图像URL: ${imageUrl2}`);

      console.log('\n' + '='.repeat(50));
      console.log(' 测试3: 多图融合（多图输入）\n');

      const multiImagePrompt = '将图1的服装换为图2的服装';
      const referenceImages = [
        'https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_imagesToimage_1.png',
        'https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_5_imagesToimage_2.png'
      ];

      console.log(`   提示词: ${multiImagePrompt}`);
      console.log(`   参考图数量: ${referenceImages.length}`);
      console.log(' 等待生成...\n');

      const params3: DoubaoSeedream50Params = {
        apiKey,
        baseUrl,
        resolution: '2K',
        aspectRatio: '1:1',
        n: 1,
        image: referenceImages,
        output_format: 'png',
      };

      const imageUrl3 = await provider.generateImage(multiImagePrompt, params3);
      console.log(' 图像生成成功！');
      console.log(`   图像URL: ${imageUrl3}`);

      console.log('\n 所有测试完成！');
      console.log('\n 支持的功能：');
      console.log('   - 文生图: 纯文本输入生成图片');
      console.log('   - 图生图: 单图输入 + 文本描述');
      console.log('   - 多图融合: 多图输入 + 文本描述');
      console.log('   - 输出格式: 仅支持 png');
    } catch (error) {
      console.error(' 错误:', error);
      process.exit(1);
    }
  })().catch(console.error);
}
