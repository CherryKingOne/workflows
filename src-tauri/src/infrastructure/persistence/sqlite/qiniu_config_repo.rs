use std::sync::{Arc, Mutex};

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::storage::entities::QiniuStorageConfig;
use crate::domain::storage::repositories::QiniuStorageRepository;

/// SQLite 持久化：七牛配置仓储。
///
/// 设计说明：
/// - 当前模型只有“一份全局七牛配置”，因此采用固定主键 `id = 1` 的单行表结构；
/// - 这样读取路径稳定，前端始终调用一次 `get_qiniu_config` 即可拿到完整配置；
/// - 后续若要支持多账号，可在此层扩展为多行结构而不影响 command 名称。
#[derive(Clone)]
pub struct SqliteQiniuConfigRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteQiniuConfigRepository {
    fn ensure_domain_column_exists(conn: &Connection) -> Result<(), rusqlite::Error> {
        let has_domain: i64 = conn.query_row(
            "SELECT EXISTS(
                SELECT 1
                FROM pragma_table_info('qiniu_storage_configs')
                WHERE name = 'domain'
            )",
            [],
            |row| row.get(0),
        )?;

        if has_domain == 0 {
            conn.execute(
                "ALTER TABLE qiniu_storage_configs
                 ADD COLUMN domain TEXT NOT NULL DEFAULT ''",
                [],
            )?;

            conn.execute(
                "UPDATE qiniu_storage_configs
                 SET is_configured = 0
                 WHERE TRIM(domain) = ''",
                [],
            )?;
        }

        Ok(())
    }

    pub fn new(db_path: &str) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(db_path)?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS qiniu_storage_configs (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                access_key TEXT NOT NULL DEFAULT '',
                secret_key TEXT NOT NULL DEFAULT '',
                bucket TEXT NOT NULL DEFAULT '',
                domain TEXT NOT NULL DEFAULT '',
                is_configured INTEGER NOT NULL DEFAULT 0,
                last_test_succeeded_at TEXT,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        Self::ensure_domain_column_exists(&conn)?;

        // 保证单行记录存在，避免首次读取时前端额外处理“空结果”。
        conn.execute(
            "INSERT INTO qiniu_storage_configs (
                id,
                access_key,
                secret_key,
                bucket,
                domain,
                is_configured,
                last_test_succeeded_at,
                updated_at
            ) VALUES (1, '', '', '', '', 0, NULL, ?1)
            ON CONFLICT(id) DO NOTHING",
            params![Utc::now().to_rfc3339()],
        )?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    fn row_to_config(row: &rusqlite::Row) -> Result<QiniuStorageConfig, rusqlite::Error> {
        let is_configured: i64 = row.get(4)?;

        Ok(QiniuStorageConfig {
            access_key: row.get(0)?,
            secret_key: row.get(1)?,
            bucket: row.get(2)?,
            domain: row.get(3)?,
            is_configured: is_configured != 0,
            last_test_succeeded_at: row.get(5)?,
        })
    }
}

impl QiniuStorageRepository for SqliteQiniuConfigRepository {
    fn get_config(&self) -> Result<QiniuStorageConfig, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "SELECT access_key, secret_key, bucket, domain, is_configured, last_test_succeeded_at
                FROM qiniu_storage_configs
                WHERE id = 1",
            )
            .map_err(|e| e.to_string())?;

        let config = stmt
            .query_row([], Self::row_to_config)
            .optional()
            .map_err(|e| e.to_string())?
            .unwrap_or_default();

        Ok(config)
    }

    fn save_config(&self, config: &QiniuStorageConfig) -> Result<QiniuStorageConfig, String> {
        {
            let conn = self.conn.lock().map_err(|e| e.to_string())?;

            conn.execute(
                "INSERT INTO qiniu_storage_configs (
                    id,
                    access_key,
                    secret_key,
                    bucket,
                    domain,
                    is_configured,
                    last_test_succeeded_at,
                    updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                ON CONFLICT(id) DO UPDATE SET
                    access_key = excluded.access_key,
                    secret_key = excluded.secret_key,
                    bucket = excluded.bucket,
                    domain = excluded.domain,
                    is_configured = excluded.is_configured,
                    last_test_succeeded_at = excluded.last_test_succeeded_at,
                    updated_at = excluded.updated_at",
                params![
                    1,
                    config.access_key,
                    config.secret_key,
                    config.bucket,
                    config.domain,
                    if config.is_configured { 1 } else { 0 },
                    config.last_test_succeeded_at,
                    Utc::now().to_rfc3339(),
                ],
            )
            .map_err(|e| e.to_string())?;
        }

        self.get_config()
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
            .join(format!("qiniu-config-{nanos}.db"))
            .to_string_lossy()
            .to_string()
    }

    #[test]
    fn should_return_default_config_when_database_is_new() {
        let db_path = temp_db_path();
        let repo = SqliteQiniuConfigRepository::new(&db_path).expect("repo should initialize");

        let config = repo.get_config().expect("get_config should succeed");

        assert_eq!(config, QiniuStorageConfig::default());
        assert_eq!(config.domain, "");
    }

    #[test]
    fn should_persist_and_reload_saved_config() {
        let db_path = temp_db_path();
        let repo = SqliteQiniuConfigRepository::new(&db_path).expect("repo should initialize");

        let to_save = QiniuStorageConfig {
            access_key: "ak-demo".to_string(),
            secret_key: "sk-demo".to_string(),
            bucket: "bucket-demo".to_string(),
            domain: "https://cdn.example.com".to_string(),
            is_configured: true,
            last_test_succeeded_at: Some("2026-04-05T20:12:00.000Z".to_string()),
        };

        let saved = repo
            .save_config(&to_save)
            .expect("save_config should succeed");

        let loaded = repo.get_config().expect("get_config should succeed");

        assert_eq!(saved, loaded);
        assert_eq!(loaded.access_key, "ak-demo");
        assert_eq!(loaded.secret_key, "sk-demo");
        assert_eq!(loaded.bucket, "bucket-demo");
        assert_eq!(loaded.domain, "https://cdn.example.com");
        assert!(loaded.is_configured);
        assert_eq!(
            loaded.last_test_succeeded_at,
            Some("2026-04-05T20:12:00.000Z".to_string())
        );
    }

    #[test]
    fn should_migrate_legacy_table_without_domain_column() {
        let db_path = temp_db_path();

        let legacy_conn = Connection::open(&db_path).expect("legacy db should open");
        legacy_conn
            .execute(
                "CREATE TABLE qiniu_storage_configs (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    access_key TEXT NOT NULL DEFAULT '',
                    secret_key TEXT NOT NULL DEFAULT '',
                    bucket TEXT NOT NULL DEFAULT '',
                    is_configured INTEGER NOT NULL DEFAULT 0,
                    last_test_succeeded_at TEXT,
                    updated_at TEXT NOT NULL
                )",
                [],
            )
            .expect("legacy schema should be created");
        legacy_conn
            .execute(
                "INSERT INTO qiniu_storage_configs (
                    id,
                    access_key,
                    secret_key,
                    bucket,
                    is_configured,
                    last_test_succeeded_at,
                    updated_at
                ) VALUES (1, 'legacy-ak', 'legacy-sk', 'legacy-bucket', 1, NULL, ?1)",
                params![Utc::now().to_rfc3339()],
            )
            .expect("legacy seed row should be inserted");
        drop(legacy_conn);

        let repo = SqliteQiniuConfigRepository::new(&db_path).expect("repo should initialize");
        let config = repo.get_config().expect("get_config should succeed");

        assert_eq!(config.access_key, "legacy-ak");
        assert_eq!(config.secret_key, "legacy-sk");
        assert_eq!(config.bucket, "legacy-bucket");
        assert_eq!(config.domain, "");
        assert!(!config.is_configured);
    }
}
