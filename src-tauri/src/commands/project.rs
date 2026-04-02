use tauri::State;
use crate::domain::project::entities::Project;
use crate::application::project::services::ProjectService;
use crate::infrastructure::persistence::sqlite::project_repo::SqliteProjectRepository;

/// 类型别名：为了在 Tauri State 中方便注入
pub type AppProjectService = ProjectService<SqliteProjectRepository>;

/// 获取所有项目列表的 Tauri Command
/// 
/// 这是一个供前端调用的接口 (通过 `invoke('get_projects')`)。
/// 
/// # Errors
/// 如果数据库查询失败，返回包含错误信息的 String。
#[tauri::command]
pub fn get_projects(service: State<'_, AppProjectService>) -> Result<Vec<Project>, String> {
    service.get_projects()
}

/// 创建项目的 Tauri Command
/// 
/// 供前端调用的接口 (通过 `invoke('create_project', { name, description })`)。
#[tauri::command]
pub fn create_project(
    name: String, 
    description: String, 
    service: State<'_, AppProjectService>
) -> Result<Project, String> {
    service.create_project(name, description)
}

/// 更新项目的 Tauri Command
/// 
/// 供前端调用的接口 (通过 `invoke('update_project', { id, name, description })`)。
#[tauri::command]
pub fn update_project(
    id: String,
    name: String,
    description: String,
    service: State<'_, AppProjectService>
) -> Result<Project, String> {
    service.update_project(id, name, description)
}

/// 删除项目的 Tauri Command
/// 
/// 供前端调用的接口 (通过 `invoke('delete_project', { id })`)。
#[tauri::command]
pub fn delete_project(
    id: String,
    service: State<'_, AppProjectService>
) -> Result<(), String> {
    service.delete_project(id)
}
