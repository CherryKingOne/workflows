import { useState } from 'react';
import { aiModelService } from '@/src/application/aiModel/AiModelApplicationService';

/**
 * AI 模型调用 Hook
 * 为 React 组件提供图像生成能力
 *
 * 使用示例：
 * ```tsx
 * const { generateImage, loading, error } = useAiModel();
 *
 * const handleGenerate = async () => {
 *   const config = {
 *     width: 1024,
 *     height: 1024,
 *     quality: 'hd',
 *     apiKey: 'sk-xxxxx'
 *   };
 *   const url = await generateImage('DallE-3', '一只可爱的猫咪', config);
 * };
 * ```
 */
export const useAiModel = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 生成图像
   * @param modelId 模型ID（如 'DallE-3', 'SD-XL'）
   * @param prompt 提示词
   * @param params 模型特定参数
   * @returns 生成的图片URL或Base64字符串
   */
  const generateImage = async (modelId: string, prompt: string, params: any): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const url = await aiModelService.invokeImageModel({
        modelId,
        prompt,
        modelParams: params
      });
      return url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('[useAiModel] Error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取所有可用的模型列表
   * @returns 模型ID数组
   */
  const getAvailableModels = (): string[] => {
    return aiModelService.getAvailableModels();
  };

  return {
    generateImage,
    getAvailableModels,
    loading,
    error
  };
};
