use std::io::Cursor;
use std::time::Duration;

use qiniu_sdk::upload::{
    apis::credential::Credential, AutoUploader, AutoUploaderObjectParams, UploadManager,
    UploadTokenSigner,
};

use crate::domain::storage::entities::QiniuStorageConfig;
use crate::domain::storage::repositories::QiniuObjectUploader;

/// 基于七牛 Rust SDK 的上传器实现（基础设施层）。
///
/// 维护建议（给新手）：
/// - 如果后续七牛 SDK 升级导致 API 变更，只改这个文件；
/// - 应用层不应直接引用 SDK 类型；
/// - 如果新增其它云存储，实现新的 uploader 并在应用层策略里接入即可。
#[derive(Debug, Clone, Copy, Default)]
pub struct QiniuSdkUploader;

impl QiniuSdkUploader {
    pub fn new() -> Self {
        Self
    }
}

impl QiniuObjectUploader for QiniuSdkUploader {
    fn upload_bytes(
        &self,
        config: &QiniuStorageConfig,
        object_key: &str,
        file_name: &str,
        file_bytes: &[u8],
    ) -> Result<(), String> {
        let credential = Credential::new(config.access_key.clone(), config.secret_key.clone());
        let signer = UploadTokenSigner::new_credential_provider(
            credential,
            config.bucket.as_str(),
            Duration::from_secs(3600),
        );

        let upload_manager = UploadManager::builder(signer).build();
        let uploader: AutoUploader = upload_manager.auto_uploader();
        let params = AutoUploaderObjectParams::builder()
            .object_name(object_key)
            .file_name(file_name)
            .build();

        uploader
            .upload_reader(Cursor::new(file_bytes.to_vec()), params)
            .map_err(|err| format!("七牛上传失败: {err}"))?;

        Ok(())
    }
}
