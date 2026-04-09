use chrono::{TimeZone, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use std::sync::{Arc, Mutex};

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
        Self::ensure_workflow_snapshot_columns_exist(&conn)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    fn has_column(conn: &Connection, column_name: &str) -> Result<bool, rusqlite::Error> {
        let exists: i64 = conn.query_row(
            "SELECT EXISTS(
                SELECT 1
                FROM pragma_table_info('projects')
                WHERE name = ?1
            )",
            params![column_name],
            |row| row.get(0),
        )?;
        Ok(exists != 0)
    }

    fn ensure_workflow_snapshot_columns_exist(conn: &Connection) -> Result<(), rusqlite::Error> {
        if !Self::has_column(conn, "workflow_snapshot_json")? {
            conn.execute(
                "ALTER TABLE projects
                 ADD COLUMN workflow_snapshot_json TEXT",
                [],
            )?;
        }

        if !Self::has_column(conn, "workflow_snapshot_updated_at")? {
            conn.execute(
                "ALTER TABLE projects
                 ADD COLUMN workflow_snapshot_updated_at INTEGER",
                [],
            )?;
        }

        Ok(())
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
            .prepare(
                "SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?1",
            )
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
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    fn delete(&self, id: &ProjectId) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id.value])
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    fn save_workflow_snapshot(&self, id: &ProjectId, snapshot_json: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now_ms = Utc::now().timestamp_millis();

        let affected = conn
            .execute(
                "UPDATE projects
                 SET workflow_snapshot_json = ?2,
                     workflow_snapshot_updated_at = ?3,
                     updated_at = ?3
                 WHERE id = ?1",
                params![id.value, snapshot_json, now_ms],
            )
            .map_err(|e| e.to_string())?;

        if affected == 0 {
            return Err(format!("Project with ID {} not found", id.value));
        }

        Ok(())
    }

    fn get_workflow_snapshot(&self, id: &ProjectId) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let snapshot = conn
            .query_row(
                "SELECT workflow_snapshot_json FROM projects WHERE id = ?1",
                params![id.value],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        match snapshot {
            Some(value) => Ok(value),
            None => Err(format!("Project with ID {} not found", id.value)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_db_path() -> String {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before UNIX_EPOCH")
            .as_nanos();

        std::env::temp_dir()
            .join(format!("project-repo-{nanos}.db"))
            .to_string_lossy()
            .to_string()
    }

    #[test]
    fn should_migrate_legacy_projects_table_to_add_snapshot_columns() {
        let db_path = temp_db_path();
        let conn = Connection::open(&db_path).expect("legacy db should open");
        conn.execute(
            "CREATE TABLE projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )
        .expect("legacy projects table should be created");
        drop(conn);

        let _repo = SqliteProjectRepository::new(&db_path).expect("repo should initialize");
        let migrated_conn = Connection::open(&db_path).expect("migrated db should open");

        let has_snapshot_json: i64 = migrated_conn
            .query_row(
                "SELECT EXISTS(
                    SELECT 1
                    FROM pragma_table_info('projects')
                    WHERE name = 'workflow_snapshot_json'
                )",
                [],
                |row| row.get(0),
            )
            .expect("workflow_snapshot_json existence query should succeed");
        let has_snapshot_updated_at: i64 = migrated_conn
            .query_row(
                "SELECT EXISTS(
                    SELECT 1
                    FROM pragma_table_info('projects')
                    WHERE name = 'workflow_snapshot_updated_at'
                )",
                [],
                |row| row.get(0),
            )
            .expect("workflow_snapshot_updated_at existence query should succeed");

        assert_eq!(has_snapshot_json, 1);
        assert_eq!(has_snapshot_updated_at, 1);
    }

    #[test]
    fn should_save_and_load_project_workflow_snapshot() {
        let db_path = temp_db_path();
        let repo = SqliteProjectRepository::new(&db_path).expect("repo should initialize");

        let project = Project::new(
            "project-123".to_string(),
            "Test Project".to_string(),
            "Description".to_string(),
        );
        repo.save(&project).expect("project should be saved");

        let snapshot_json = r#"{"version":"v1","nodes":[],"edges":[]}"#;
        repo.save_workflow_snapshot(&project.id, snapshot_json)
            .expect("snapshot should be saved");

        let loaded = repo
            .get_workflow_snapshot(&project.id)
            .expect("snapshot should be loaded");
        assert_eq!(loaded, Some(snapshot_json.to_string()));
    }

    #[test]
    fn should_return_none_when_project_has_no_workflow_snapshot() {
        let db_path = temp_db_path();
        let repo = SqliteProjectRepository::new(&db_path).expect("repo should initialize");

        let project = Project::new(
            "project-no-snapshot".to_string(),
            "No Snapshot".to_string(),
            "Description".to_string(),
        );
        repo.save(&project).expect("project should be saved");

        let loaded = repo
            .get_workflow_snapshot(&project.id)
            .expect("snapshot query should succeed");
        assert!(loaded.is_none());
    }

    #[test]
    fn should_return_error_for_missing_project_when_reading_or_saving_snapshot() {
        let db_path = temp_db_path();
        let repo = SqliteProjectRepository::new(&db_path).expect("repo should initialize");
        let missing_id = ProjectId {
            value: "missing-project".to_string(),
        };

        let save_result = repo.save_workflow_snapshot(&missing_id, r#"{"version":"v1"}"#);
        assert!(save_result.is_err());
        assert!(save_result
            .err()
            .expect("save should fail")
            .contains("not found"));

        let load_result = repo.get_workflow_snapshot(&missing_id);
        assert!(load_result.is_err());
        assert!(load_result
            .err()
            .expect("load should fail")
            .contains("not found"));
    }
}
