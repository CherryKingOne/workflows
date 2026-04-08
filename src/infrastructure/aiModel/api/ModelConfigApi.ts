import { invoke } from '@tauri-apps/api/core';

/**
 * 模型配置类型定义
 */
export interface ModelConfig {
  model_id: string;
  model_name: string;
  model_type: 'image' | 'chat';
  base_url: string;
  api_key: string;
  api_url?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 更新配置请求参数
 */
export interface UpdateConfigRequest {
  model_name?: string;
  base_url?: string;
  api_key?: string;
  api_url?: string;
  enabled?: boolean;
}

/**
 * 初始化配置请求参数
 */
export interface InitConfigRequest {
  model_id: string;
  model_name: string;
  model_type: 'image' | 'chat';
  base_url: string;
  api_key: string;
  api_url?: string;
}

/**
 * 模型配置 API 服务
 * 通过 Tauri Commands 调用 Rust 后端
 */
export class ModelConfigApi {
  /**
   * 获取所有模型配置
   */
  static async getAllConfigs(modelType?: 'image' | 'chat'): Promise<ModelConfig[]> {
    return await invoke<ModelConfig[]>('get_all_model_configs', {
      modelType: modelType || null,
    });
  }

  /**
   * 根据ID获取模型配置
   */
  static async getConfig(modelId: string): Promise<ModelConfig | null> {
    return await invoke<ModelConfig | null>('get_model_config', {
      modelId,
    });
  }

  /**
   * 更新模型配置
   */
  static async updateConfig(
    modelId: string,
    request: UpdateConfigRequest
  ): Promise<void> {
    await invoke('update_model_config', {
      modelId,
      request,
    });
  }

  /**
   * 批量初始化模型配置
   */
  static async initConfigs(configs: InitConfigRequest[]): Promise<void> {
    await invoke('init_model_configs', {
      configs,
    });
  }

  /**
   * 删除模型配置
   */
  static async deleteConfig(modelId: string): Promise<void> {
    await invoke('delete_model_config', {
      modelId,
    });
  }
}
