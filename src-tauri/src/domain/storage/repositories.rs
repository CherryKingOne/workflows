use super::entities::QiniuStorageConfig;

/// 七牛配置仓储抽象。
///
/// 读取路径（供后续功能对接参考）：
/// 1. 前端弹窗打开 / 页面初始化时调用 `get_qiniu_config`。
/// 2. command -> application service -> repository。
/// 3. repository 从 SQLite 读取单行配置并映射为领域实体返回。
pub trait QiniuStorageRepository {
    /// 读取当前七牛配置（若未配置，返回默认空配置）。
    fn get_config(&self) -> Result<QiniuStorageConfig, String>;

    /// 保存七牛配置并返回落库后的最新配置。
    fn save_config(&self, config: &QiniuStorageConfig) -> Result<QiniuStorageConfig, String>;
}

/// 七牛对象上传网关抽象（基础设施适配点）。
///
/// 设计意图：
/// - 应用层只关心“把二进制内容传到七牛”这个能力，不直接依赖具体 SDK 细节；
/// - 基础设施层负责用真正的七牛 SDK 实现该 trait；
/// - 后续如果要替换 SDK 或接入 mock，实现新 struct 即可，不影响应用层用例代码。
pub trait QiniuObjectUploader {
    /// 上传二进制内容到七牛指定对象键。
    ///
    /// 参数约定：
    /// - `config`: 已持久化的七牛配置（含鉴权与 bucket 信息）；
    /// - `object_key`: 对象键（业务生成，保证可追踪和可读）；
    /// - `file_name`: 原始文件名（用于元信息）；
    /// - `file_bytes`: 文件内容。
    fn upload_bytes(
        &self,
        config: &QiniuStorageConfig,
        object_key: &str,
        file_name: &str,
        file_bytes: &[u8],
    ) -> Result<(), String>;
}
