use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 模型配置实体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    /// 模型唯一标识
    pub model_id: String,

    /// 模型显示名称
    pub model_name: String,

    /// 模型类型：image | chat
    pub model_type: ModelType,

    /// API 基础 URL
    pub base_url: String,

    /// API Key
    pub api_key: String,

    /// 完整的 API URL（可选）
    pub api_url: Option<String>,

    /// 是否启用
    pub enabled: bool,

    /// 创建时间
    pub created_at: DateTime<Utc>,

    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

/// 模型类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ModelType {
    Image,
    Chat,
}

impl ModelConfig {
    /// 创建新的模型配置
    pub fn new(
        model_id: String,
        model_name: String,
        model_type: ModelType,
        base_url: String,
        api_key: String,
        api_url: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            model_id,
            model_name,
            model_type,
            base_url,
            api_key,
            api_url,
            enabled: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// 更新配置
    pub fn update(
        &mut self,
        model_name: Option<String>,
        base_url: Option<String>,
        api_key: Option<String>,
        api_url: Option<String>,
        enabled: Option<bool>,
    ) {
        if let Some(name) = model_name {
            self.model_name = name;
        }
        if let Some(url) = base_url {
            self.base_url = url;
        }
        if let Some(key) = api_key {
            self.api_key = key;
        }
        if let Some(url) = api_url {
            self.api_url = Some(url);
        }
        if let Some(en) = enabled {
            self.enabled = en;
        }
        self.updated_at = Utc::now();
    }
}

impl std::fmt::Display for ModelType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ModelType::Image => write!(f, "image"),
            ModelType::Chat => write!(f, "chat"),
        }
    }
}

impl std::str::FromStr for ModelType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "image" => Ok(ModelType::Image),
            "chat" => Ok(ModelType::Chat),
            _ => Err(format!("Invalid model type: {}", s)),
        }
    }
}
