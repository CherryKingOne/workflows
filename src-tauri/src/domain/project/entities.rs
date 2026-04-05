use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 项目唯一标识符
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectId {
    pub value: String,
}

/// 项目元数据，包括名称、描述以及时间戳
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    pub name: String,
    pub description: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ProjectMeta {
    pub fn new(name: String, description: String) -> Self {
        let now = Utc::now();
        Self {
            name,
            description,
            created_at: now,
            updated_at: now,
        }
    }
}

/// 项目聚合根实体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: ProjectId,
    pub meta: ProjectMeta,
}

impl Project {
    /// 构造一个新的项目实体
    pub fn new(id: String, name: String, description: String) -> Self {
        Self {
            id: ProjectId { value: id },
            meta: ProjectMeta::new(name, description),
        }
    }

    /// 更新项目的元数据
    pub fn update_meta(&mut self, name: String, description: String) {
        self.meta.name = name;
        self.meta.description = description;
        self.meta.updated_at = Utc::now();
    }
}
