use serde::{Deserialize, Serialize};

/// 七牛对象存储配置聚合根。
///
/// 说明：
/// - 当前版本先按“前端表单直存”落地，便于尽快对接持久化能力。
/// - `secret_key` 暂为明文存储，后续可在基础设施层替换为加密存储。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QiniuStorageConfig {
    pub access_key: String,
    pub secret_key: String,
    pub bucket: String,
    pub domain: String,
    pub is_configured: bool,
    pub last_test_succeeded_at: Option<String>,
}

impl Default for QiniuStorageConfig {
    fn default() -> Self {
        Self {
            access_key: String::new(),
            secret_key: String::new(),
            bucket: String::new(),
            domain: String::new(),
            is_configured: false,
            last_test_succeeded_at: None,
        }
    }
}

impl QiniuStorageConfig {
    /// 领域层最小完整性判断：用于“是否可保存为已配置”。
    pub fn is_complete(&self) -> bool {
        !self.access_key.trim().is_empty()
            && !self.secret_key.trim().is_empty()
            && !self.bucket.trim().is_empty()
            && !self.domain.trim().is_empty()
    }
}
