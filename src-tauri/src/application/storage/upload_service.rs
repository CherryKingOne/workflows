use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use chrono::Utc;
use urlencoding::encode;

use crate::domain::storage::entities::QiniuStorageConfig;
use crate::domain::storage::repositories::{QiniuObjectUploader, QiniuStorageRepository};
use crate::domain::storage::upload::{
    detect_media_type_by_extension, normalize_mime_type, png_has_transparency_channel,
    UploadAssetRequest, UploadMediaType, UploadStorageProvider, UploadedAsset,
};

/// 画布“上传文件节点”应用服务。
///
/// 职责边界（DDD）：
/// - application 层：编排流程与策略选择（七牛优先 / Base64 降级）；
/// - domain 层：格式规则、媒体分类、透明 PNG 规则；
/// - infrastructure 层：七牛 SDK 的具体上传实现。
///
/// 为什么单独建服务：
/// - 避免把“配置管理”和“文件上传”耦合在一个巨大服务中；
/// - 后续新增 S3/OSS/本地磁盘等策略时，可保持最小修改范围；
/// - 新手接手时能快速定位“上传能力应该改哪里”。
pub struct CanvasFileUploadService<R: QiniuStorageRepository, U: QiniuObjectUploader> {
    config_repository: R,
    qiniu_uploader: U,
}

impl<R: QiniuStorageRepository, U: QiniuObjectUploader> CanvasFileUploadService<R, U> {
    pub fn new(config_repository: R, qiniu_uploader: U) -> Self {
        Self {
            config_repository,
            qiniu_uploader,
        }
    }

    /// 上传单个文件，并返回可直接绑定节点卡片的数据。
    ///
    /// 规则总结：
    /// 1. 先走领域规则校验：扩展名白名单、PNG 透明通道限制；
    /// 2. 若已配置七牛：上传到七牛并返回公网 URL；
    /// 3. 若未配置七牛：
    ///    - 图片：转 Base64 Data URL 作为预览地址；
    ///    - 视频/音频：直接返回错误（避免不可预览/不可持久化状态）。
    pub fn upload_file(&self, request: UploadAssetRequest) -> Result<UploadedAsset, String> {
        let normalized = self.normalize_and_validate_request(request)?;
        let qiniu_config = self.config_repository.get_config()?;

        if Self::should_use_qiniu(&qiniu_config) {
            return self.upload_via_qiniu(&normalized, &qiniu_config);
        }

        self.upload_via_base64_fallback(&normalized)
    }

    fn normalize_and_validate_request(
        &self,
        request: UploadAssetRequest,
    ) -> Result<NormalizedUploadAsset, String> {
        let node_id = request.node_id.trim().to_string();
        let file_name = request.file_name.trim().to_string();
        let file_bytes = request.file_bytes;

        if node_id.is_empty() {
            return Err("nodeId 不能为空。".to_string());
        }

        if file_name.is_empty() {
            return Err("fileName 不能为空。".to_string());
        }

        if file_bytes.is_empty() {
            return Err("文件内容为空，无法上传。".to_string());
        }

        let media_type = detect_media_type_by_extension(&file_name)?;
        if Self::is_png_file(&file_name) && png_has_transparency_channel(&file_bytes)? {
            return Err(
                "PNG 文件包含透明通道，当前版本不支持透明 PNG，请先转为不透明 PNG 或 JPG。"
                    .to_string(),
            );
        }

        Ok(NormalizedUploadAsset {
            node_id,
            file_name: file_name.clone(),
            mime_type: normalize_mime_type(&file_name, &request.mime_type),
            media_type,
            file_bytes,
        })
    }

    fn upload_via_qiniu(
        &self,
        normalized: &NormalizedUploadAsset,
        config: &QiniuStorageConfig,
    ) -> Result<UploadedAsset, String> {
        let object_key = self.build_qiniu_object_key(normalized);
        self.qiniu_uploader.upload_bytes(
            config,
            &object_key,
            &normalized.file_name,
            &normalized.file_bytes,
        )?;

        let preview_url = self.build_qiniu_public_url(&config.domain, &object_key);
        Ok(UploadedAsset {
            id: self.build_asset_id(&normalized.node_id),
            name: normalized.file_name.clone(),
            mime_type: normalized.mime_type.clone(),
            size_in_bytes: normalized.file_bytes.len(),
            preview_url,
            media_type: normalized.media_type,
            storage_provider: UploadStorageProvider::Qiniu,
            object_key: Some(object_key),
        })
    }

    fn upload_via_base64_fallback(
        &self,
        normalized: &NormalizedUploadAsset,
    ) -> Result<UploadedAsset, String> {
        if normalized.media_type != UploadMediaType::Image {
            return Err("未配置七牛云时，仅支持图片使用 Base64。音频仅支持 wav/mp3，视频仅支持 mp4/mov，请先在“存储”中配置七牛云。".to_string());
        }

        let preview_url = format!(
            "data:{};base64,{}",
            normalized.mime_type,
            BASE64_STANDARD.encode(&normalized.file_bytes)
        );

        Ok(UploadedAsset {
            id: self.build_asset_id(&normalized.node_id),
            name: normalized.file_name.clone(),
            mime_type: normalized.mime_type.clone(),
            size_in_bytes: normalized.file_bytes.len(),
            preview_url,
            media_type: normalized.media_type,
            storage_provider: UploadStorageProvider::Base64,
            object_key: None,
        })
    }

    fn should_use_qiniu(config: &QiniuStorageConfig) -> bool {
        config.is_configured && config.is_complete()
    }

    fn is_png_file(file_name: &str) -> bool {
        file_name.to_ascii_lowercase().ends_with(".png")
    }

    fn build_asset_id(&self, node_id: &str) -> String {
        format!("{}-asset-{}", node_id, Utc::now().timestamp_micros())
    }

    fn build_qiniu_object_key(&self, normalized: &NormalizedUploadAsset) -> String {
        // 统一对象键命名，方便后续排查来源节点和上传时间。
        format!(
            "canvas-upload/{}/{}-{}",
            normalized.node_id,
            Utc::now().format("%Y%m%d%H%M%S%3f"),
            normalized.file_name
        )
    }

    fn build_qiniu_public_url(&self, domain: &str, object_key: &str) -> String {
        let normalized_domain = Self::normalize_domain(domain);
        let encoded_key = object_key
            .split('/')
            .map(encode)
            .map(|s| s.into_owned())
            .collect::<Vec<String>>()
            .join("/");
        format!("{normalized_domain}/{encoded_key}")
    }

    fn normalize_domain(domain: &str) -> String {
        let trimmed = domain.trim().trim_end_matches('/');
        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            return trimmed.to_string();
        }
        // 按当前产品约定：用户只填域名时默认走 http。
        // 若后续要改为 https 优先，只需要改这里一行即可。
        format!("http://{trimmed}")
    }
}

struct NormalizedUploadAsset {
    node_id: String,
    file_name: String,
    mime_type: String,
    media_type: UploadMediaType,
    file_bytes: Vec<u8>,
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use super::*;

    #[derive(Clone)]
    struct FakeQiniuRepo {
        config: QiniuStorageConfig,
    }

    impl QiniuStorageRepository for FakeQiniuRepo {
        fn get_config(&self) -> Result<QiniuStorageConfig, String> {
            Ok(self.config.clone())
        }

        fn save_config(&self, config: &QiniuStorageConfig) -> Result<QiniuStorageConfig, String> {
            Ok(config.clone())
        }
    }

    #[derive(Clone, Default)]
    struct FakeQiniuUploader {
        uploaded_keys: Arc<Mutex<Vec<String>>>,
    }

    impl QiniuObjectUploader for FakeQiniuUploader {
        fn upload_bytes(
            &self,
            _config: &QiniuStorageConfig,
            object_key: &str,
            _file_name: &str,
            _file_bytes: &[u8],
        ) -> Result<(), String> {
            let mut keys = self
                .uploaded_keys
                .lock()
                .expect("uploaded keys mutex should not be poisoned");
            keys.push(object_key.to_string());
            Ok(())
        }
    }

    fn build_service(
        config: QiniuStorageConfig,
    ) -> CanvasFileUploadService<FakeQiniuRepo, FakeQiniuUploader> {
        CanvasFileUploadService::new(FakeQiniuRepo { config }, FakeQiniuUploader::default())
    }

    #[test]
    fn should_upload_to_qiniu_when_configured() {
        let service = build_service(QiniuStorageConfig {
            access_key: "ak".to_string(),
            secret_key: "sk".to_string(),
            bucket: "bucket-a".to_string(),
            domain: "cdn.example.com".to_string(),
            is_configured: true,
            last_test_succeeded_at: None,
        });

        let result = service
            .upload_file(UploadAssetRequest {
                node_id: "node-1".to_string(),
                file_name: "demo.jpg".to_string(),
                mime_type: "image/jpeg".to_string(),
                file_bytes: vec![1, 2, 3],
            })
            .expect("configured qiniu should upload successfully");

        assert_eq!(result.storage_provider, UploadStorageProvider::Qiniu);
        assert!(
            result
                .preview_url
                .starts_with("http://cdn.example.com/canvas-upload/node-1/"),
            "preview url should be qiniu public url"
        );
        assert!(result.object_key.is_some());
    }

    #[test]
    fn should_fallback_to_base64_for_image_when_qiniu_not_configured() {
        let service = build_service(QiniuStorageConfig::default());

        let result = service
            .upload_file(UploadAssetRequest {
                node_id: "node-2".to_string(),
                file_name: "cover.jpeg".to_string(),
                mime_type: "".to_string(),
                file_bytes: vec![255, 216, 255, 224],
            })
            .expect("image should fallback to base64");

        assert_eq!(result.storage_provider, UploadStorageProvider::Base64);
        assert!(result.preview_url.starts_with("data:image/jpeg;base64,"));
        assert!(result.object_key.is_none());
    }

    #[test]
    fn should_reject_video_when_qiniu_not_configured() {
        let service = build_service(QiniuStorageConfig::default());

        let error = service
            .upload_file(UploadAssetRequest {
                node_id: "node-3".to_string(),
                file_name: "clip.mp4".to_string(),
                mime_type: "video/mp4".to_string(),
                file_bytes: vec![0, 0, 0, 1],
            })
            .expect_err("video should be rejected without qiniu");

        assert!(error.contains("未配置七牛云时，仅支持图片使用 Base64"));
    }

    #[test]
    fn should_reject_transparent_png_even_when_qiniu_configured() {
        let service = build_service(QiniuStorageConfig {
            access_key: "ak".to_string(),
            secret_key: "sk".to_string(),
            bucket: "bucket-a".to_string(),
            domain: "https://cdn.example.com".to_string(),
            is_configured: true,
            last_test_succeeded_at: None,
        });

        let transparent_png = vec![
            137, 80, 78, 71, 13, 10, 26, 10, // signature
            0, 0, 0, 13, // IHDR length
            73, 72, 68, 82, // IHDR
            0, 0, 0, 1, // width
            0, 0, 0, 1, // height
            8, // bit depth
            6, // RGBA
            0, 0, 0, // compression, filter, interlace
            0, 0, 0, 0, // fake crc
            0, 0, 0, 1, // IDAT length
            73, 68, 65, 84, // IDAT
            0,  // data
            0, 0, 0, 0, // fake crc
            0, 0, 0, 0, // IEND length
            73, 69, 78, 68, // IEND
            0, 0, 0, 0, // fake crc
        ];

        let error = service
            .upload_file(UploadAssetRequest {
                node_id: "node-4".to_string(),
                file_name: "alpha.png".to_string(),
                mime_type: "image/png".to_string(),
                file_bytes: transparent_png,
            })
            .expect_err("transparent png should be rejected");

        assert!(error.contains("不支持透明 PNG"));
    }
}
