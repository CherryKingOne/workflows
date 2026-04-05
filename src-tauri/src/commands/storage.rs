use serde::Deserialize;
use tauri::State;

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
