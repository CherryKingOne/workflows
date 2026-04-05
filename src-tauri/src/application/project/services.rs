use crate::domain::project::entities::{Project, ProjectId};
use crate::domain::project::repositories::ProjectRepository;
use std::time::{SystemTime, UNIX_EPOCH};

/// 项目管理应用服务 (Application Service)
/// 负责编排项目管理的各个用例 (Use Cases)
pub struct ProjectService<R: ProjectRepository> {
    repository: R,
}

impl<R: ProjectRepository> ProjectService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    /// 用例：获取所有项目列表
    pub fn get_projects(&self) -> Result<Vec<Project>, String> {
        self.repository.find_all()
    }

    /// 用例：创建新项目
    pub fn create_project(&self, name: String, description: String) -> Result<Project, String> {
        // 简单的时间戳 ID 生成策略，生产环境中应考虑使用 UUID
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis()
            .to_string();

        let project = Project::new(id, name, description);
        self.repository.save(&project)?;
        Ok(project)
    }

    /// 用例：更新现有项目
    pub fn update_project(
        &self,
        id: String,
        name: String,
        description: String,
    ) -> Result<Project, String> {
        let project_id = ProjectId { value: id };

        let mut project = match self.repository.find_by_id(&project_id)? {
            Some(p) => p,
            None => return Err(format!("Project with ID {} not found", project_id.value)),
        };

        project.update_meta(name, description);
        self.repository.save(&project)?;

        Ok(project)
    }

    /// 用例：删除项目
    pub fn delete_project(&self, id: String) -> Result<(), String> {
        let project_id = ProjectId { value: id };
        self.repository.delete(&project_id)
    }
}
