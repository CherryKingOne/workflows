use std::sync::{Arc, Mutex};
use rusqlite::{Connection, params, OptionalExtension};
use chrono::{Utc, TimeZone};

use crate::domain::project::entities::{Project, ProjectId, ProjectMeta};
use crate::domain::project::repositories::ProjectRepository;

/// SQLite 持久化实现 (SQLite Infrastructure Implementation)
/// 负责将 Domain 层的 Project 实体与 SQLite 数据库表进行映射
pub struct SqliteProjectRepository {
    /// 使用 Arc<Mutex<>> 保证多线程下的线程安全 (Tauri 命令是并发的)
    conn: Arc<Mutex<Connection>>,
}

impl SqliteProjectRepository {
    /// 初始化仓储并自动建表
    pub fn new(db_path: &str) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        
        // 创建项目表
        // 注意：SQLite 中没有内置的 DateTime 类型，我们将其存储为 INTEGER (时间戳 Unix 毫秒)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// 辅助函数：将 SQLite 行转换为 Project 实体
    fn row_to_project(row: &rusqlite::Row) -> Result<Project, rusqlite::Error> {
        let id: String = row.get(0)?;
        let name: String = row.get(1)?;
        let description: String = row.get(2)?;
        
        let created_at_ms: i64 = row.get(3)?;
        let updated_at_ms: i64 = row.get(4)?;

        // 从毫秒时间戳恢复为 DateTime<Utc>
        let created_at = Utc.timestamp_millis_opt(created_at_ms).unwrap();
        let updated_at = Utc.timestamp_millis_opt(updated_at_ms).unwrap();

        Ok(Project {
            id: ProjectId { value: id },
            meta: ProjectMeta {
                name,
                description,
                created_at,
                updated_at,
            },
        })
    }
}

/// 实现项目仓储的 Domain 接口
impl ProjectRepository for SqliteProjectRepository {
    fn find_all(&self) -> Result<Vec<Project>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, description, created_at, updated_at FROM projects ORDER BY updated_at DESC")
            .map_err(|e| e.to_string())?;
            
        let project_iter = stmt
            .query_map([], Self::row_to_project)
            .map_err(|e| e.to_string())?;

        let mut projects = Vec::new();
        for project in project_iter {
            projects.push(project.map_err(|e| e.to_string())?);
        }

        Ok(projects)
    }

    fn find_by_id(&self, id: &ProjectId) -> Result<Option<Project>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?1")
            .map_err(|e| e.to_string())?;

        let project = stmt
            .query_row(params![id.value], Self::row_to_project)
            .optional()
            .map_err(|e| e.to_string())?;

        Ok(project)
    }

    fn save(&self, project: &Project) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        
        // 将时间转换为 Unix 毫秒存储
        let created_at_ms = project.meta.created_at.timestamp_millis();
        let updated_at_ms = project.meta.updated_at.timestamp_millis();

        // 使用 UPSERT 语法（存在则更新，不存在则插入）
        conn.execute(
            "INSERT INTO projects (id, name, description, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET 
                name = excluded.name, 
                description = excluded.description,
                updated_at = excluded.updated_at",
            params![
                project.id.value,
                project.meta.name,
                project.meta.description,
                created_at_ms,
                updated_at_ms
            ],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    fn delete(&self, id: &ProjectId) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM projects WHERE id = ?1",
            params![id.value],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }
}
