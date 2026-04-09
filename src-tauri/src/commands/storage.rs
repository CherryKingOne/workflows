use serde::Deserialize;
use std::fs;
use std::io::Read;
use tauri::State;
use ureq::Response;

use crate::application::storage::services::QiniuStorageService;
use crate::application::storage::upload_service::CanvasFileUploadService;
use crate::domain::storage::entities::QiniuStorageConfig;
use crate::domain::storage::upload::{UploadAssetRequest, UploadedAsset};
use crate::infrastructure::persistence::sqlite::qiniu_config_repo::SqliteQiniuConfigRepository;
use crate::infrastructure::storage::qiniu_uploader::QiniuSdkUploader;

/// 在 Tauri State 中注入的七牛配置应用服务。
pub type AppQiniuStorageService = QiniuStorageService<SqliteQiniuConfigRepository>;
/// 在 Tauri State 中注入的“上传文件”应用服务。
pub type AppCanvasFileUploadService =
    CanvasFileUploadService<SqliteQiniuConfigRepository, QiniuSdkUploader>;

/// 保存七牛配置的入参 DTO。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveQiniuConfigInput {
    pub access_key: String,
    pub secret_key: String,
    pub bucket: String,
    pub domain: String,
    pub last_test_succeeded_at: Option<String>,
}

/// 上传文件到节点卡片的入参 DTO。
///
/// 说明：
/// - 这是“函数调用参数”，前端通过 `invoke` 直接传递；
/// - 不走 HTTP，因此无需额外的 REST 协议层对象。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadCanvasFileInput {
    pub node_id: String,
    pub file_name: String,
    pub mime_type: String,
    pub file_bytes: Vec<u8>,
}

/// 读取当前七牛配置。
///
/// 前端调用：
/// `invoke<QiniuConfigDto>('get_qiniu_config')`
#[tauri::command]
pub fn get_qiniu_config(
    service: State<'_, AppQiniuStorageService>,
) -> Result<QiniuStorageConfig, String> {
    service.get_qiniu_config()
}

/// 保存七牛配置到 SQLite，并返回落库后的配置快照。
///
/// 前端调用：
/// `invoke<QiniuConfigDto>('save_qiniu_config', { input })`
#[tauri::command]
pub fn save_qiniu_config(
    input: SaveQiniuConfigInput,
    service: State<'_, AppQiniuStorageService>,
) -> Result<QiniuStorageConfig, String> {
    service.save_qiniu_config(
        input.access_key,
        input.secret_key,
        input.bucket,
        input.domain,
        input.last_test_succeeded_at,
    )
}

/// 上传文件并返回节点可直接消费的资产信息。
///
/// 前端调用：
/// `invoke<UploadedAsset>('upload_canvas_file_asset', { input })`
#[tauri::command]
pub fn upload_canvas_file_asset(
    input: UploadCanvasFileInput,
    service: State<'_, AppCanvasFileUploadService>,
) -> Result<UploadedAsset, String> {
    service.upload_file(UploadAssetRequest {
        node_id: input.node_id,
        file_name: input.file_name,
        mime_type: input.mime_type,
        file_bytes: input.file_bytes,
    })
}

/// 下载远程文件到本地（绕过浏览器 CORS 限制）。
///
/// 前端调用：
/// `invoke<{ bytes: Vec<u8> }>('download_remote_file', { url })`
///
/// 说明：
/// - 用于在 Tauri 后端下载远程文件，避免浏览器的 CORS 限制；
/// - 返回文件的二进制内容，前端再通过 save dialog 保存到用户选择的位置。
#[tauri::command]
pub fn download_remote_file(url: String) -> Result<Vec<u8>, String> {
    let response: Response = ureq::get(&url)
        .call()
        .map_err(|e| format!("Failed to fetch remote file: {}", e))?;

    let mut bytes: Vec<u8> = Vec::new();
    response
        .into_reader()
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    Ok(bytes)
}

/// 下载远程文件并保存到指定路径。
///
/// 前端调用：
/// `invoke('download_and_save_file', { url, path })`
///
/// 说明：
/// - 在 Tauri 后端下载远程文件并直接写入到指定路径；
/// - 绕过浏览器 CORS 限制和 fs plugin 权限限制。
#[tauri::command]
pub fn download_and_save_file(url: String, path: String) -> Result<(), String> {
    // 下载文件
    let response: Response = ureq::get(&url)
        .call()
        .map_err(|e| format!("Failed to fetch remote file: {}", e))?;

    let mut bytes: Vec<u8> = Vec::new();
    response
        .into_reader()
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // 写入文件
    fs::write(&path, bytes).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}
