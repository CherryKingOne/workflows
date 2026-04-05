use crate::domain::storage::entities::QiniuStorageConfig;
use crate::domain::storage::repositories::QiniuStorageRepository;

/// 七牛配置应用服务。
///
/// 职责：
/// - 编排“读取配置 / 保存配置”用例；
/// - 保持前端通过函数调用后端（Tauri command），无需 HTTP；
/// - 为后续扩展（如加密、鉴权验证、审计）预留单一入口。
pub struct QiniuStorageService<R: QiniuStorageRepository> {
    repository: R,
}

impl<R: QiniuStorageRepository> QiniuStorageService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    /// 查询用例：读取当前七牛配置。
    pub fn get_qiniu_config(&self) -> Result<QiniuStorageConfig, String> {
        self.repository.get_config()
    }

    /// 命令用例：保存七牛配置。
    ///
    /// 规则：
    /// - 保存时会 trim 文本输入，避免因为前后空格导致“看起来填了但不可用”；
    /// - 仅当四项核心字段齐全时标记 `is_configured = true`。
    pub fn save_qiniu_config(
        &self,
        access_key: String,
        secret_key: String,
        bucket: String,
        domain: String,
        last_test_succeeded_at: Option<String>,
    ) -> Result<QiniuStorageConfig, String> {
        let mut config = QiniuStorageConfig {
            access_key: access_key.trim().to_string(),
            secret_key: secret_key.trim().to_string(),
            bucket: bucket.trim().to_string(),
            domain: domain.trim().to_string(),
            is_configured: false,
            last_test_succeeded_at,
        };

        config.is_configured = config.is_complete();

        self.repository.save_config(&config)
    }
}
