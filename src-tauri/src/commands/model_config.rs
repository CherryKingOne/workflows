use tauri::State;
use std::sync::Mutex;
use crate::domain::model_config::{ModelConfig, ModelType};
use crate::infrastructure::model_config_repository::SqliteModelConfigRepository;
use serde::Deserialize;

/// 模型配置状态管理
pub struct ModelConfigState {
    pub repository: Mutex<SqliteModelConfigRepository>,
}

/// 更新配置的请求参数
#[derive(Debug, Deserialize)]
pub struct UpdateConfigRequest {
    pub model_name: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub api_url: Option<String>,
    pub enabled: Option<bool>,
}

/// 初始化配置的请求参数
#[derive(Debug, Deserialize)]
pub struct InitConfigRequest {
    pub model_id: String,
    pub model_name: String,
    pub model_type: ModelType,
    pub base_url: String,
    pub api_key: String,
    pub api_url: Option<String>,
}

/// 获取所有模型配置
#[tauri::command]
pub fn get_all_model_configs(
    state: State<ModelConfigState>,
    model_type: Option<String>,
) -> Result<Vec<ModelConfig>, String> {
    let repo = state.repository.lock().map_err(|e| e.to_string())?;

    let mt = match model_type {
        Some(t) => Some(t.parse::<ModelType>().map_err(|e| e.to_string())?),
        None => None,
    };

    repo.find_all(mt).map_err(|e| e.to_string())
}

/// 根据ID获取模型配置
#[tauri::command]
pub fn get_model_config(
    state: State<ModelConfigState>,
    model_id: String,
) -> Result<Option<ModelConfig>, String> {
    let repo = state.repository.lock().map_err(|e| e.to_string())?;
    repo.find_by_id(&model_id).map_err(|e| e.to_string())
}

/// 更新模型配置
#[tauri::command]
pub fn update_model_config(
    state: State<ModelConfigState>,
    model_id: String,
    request: UpdateConfigRequest,
) -> Result<(), String> {
    let repo = state.repository.lock().map_err(|e| e.to_string())?;

    repo.update(
        &model_id,
        request.model_name,
        request.base_url,
        request.api_key,
        request.api_url,
        request.enabled,
    )
    .map_err(|e| e.to_string())
}

/// 批量初始化模型配置
#[tauri::command]
pub fn init_model_configs(
    state: State<ModelConfigState>,
    configs: Vec<InitConfigRequest>,
) -> Result<(), String> {
    let repo = state.repository.lock().map_err(|e| e.to_string())?;

    let model_configs: Vec<ModelConfig> = configs
        .into_iter()
        .map(|req| {
            ModelConfig::new(
                req.model_id,
                req.model_name,
                req.model_type,
                req.base_url,
                req.api_key,
                req.api_url,
            )
        })
        .collect();

    repo.batch_upsert(&model_configs).map_err(|e| e.to_string())
}

/// 删除模型配置（仅供内部清理使用）
#[tauri::command]
pub fn delete_model_config(
    state: State<ModelConfigState>,
    model_id: String,
) -> Result<(), String> {
    let repo = state.repository.lock().map_err(|e| e.to_string())?;
    repo.delete(&model_id).map_err(|e| e.to_string())
}
