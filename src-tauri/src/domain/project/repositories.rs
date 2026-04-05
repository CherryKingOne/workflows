use super::entities::{Project, ProjectId};

/// 项目仓储接口定义 (Project Repository Trait)
/// 定义了所有针对项目数据的持久化操作行为
pub trait ProjectRepository {
    /// 查找所有项目
    fn find_all(&self) -> Result<Vec<Project>, String>;

    /// 根据 ID 查找单个项目
    fn find_by_id(&self, id: &ProjectId) -> Result<Option<Project>, String>;

    /// 保存项目 (包括新增和更新)
    fn save(&self, project: &Project) -> Result<(), String>;

    /// 根据 ID 删除项目
    fn delete(&self, id: &ProjectId) -> Result<(), String>;
}
