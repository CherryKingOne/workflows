use rusqlite::{params, Connection, Result as SqliteResult};
use std::path::PathBuf;
use std::str::FromStr;
use chrono::{DateTime, Utc};
use crate::domain::model_config::{ModelConfig, ModelType};

/// SQLite 模型配置仓储
pub struct SqliteModelConfigRepository {
    db_path: PathBuf,
}

impl SqliteModelConfigRepository {
    /// 创建新的仓储实例
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    /// 获取数据库连接
    fn get_connection(&self) -> SqliteResult<Connection> {
        // 确保目录存在
        if let Some(parent) = self.db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(&self.db_path)?;
        self.init_database(&conn)?;
        Ok(conn)
    }

    /// 初始化数据库表
    fn init_database(&self, conn: &Connection) -> SqliteResult<()> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS model_configs (
                model_id TEXT PRIMARY KEY,
                model_name TEXT NOT NULL,
                model_type TEXT NOT NULL CHECK(model_type IN ('image', 'chat')),
                base_url TEXT NOT NULL,
                api_key TEXT NOT NULL,
                api_url TEXT,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;
        Ok(())
    }

    /// 根据模型ID查找配置
    pub fn find_by_id(&self, model_id: &str) -> SqliteResult<Option<ModelConfig>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(
            "SELECT model_id, model_name, model_type, base_url, api_key, api_url,
                    enabled, created_at, updated_at
             FROM model_configs WHERE model_id = ?1"
        )?;

        let result = stmt.query_row(params![model_id], |row| {
            let created_str: String = row.get(7)?;
            let updated_str: String = row.get(8)?;

            Ok(ModelConfig {
                model_id: row.get(0)?,
                model_name: row.get(1)?,
                model_type: ModelType::from_str(&row.get::<_, String>(2)?).unwrap(),
                base_url: row.get(3)?,
                api_key: row.get(4)?,
                api_url: row.get(5)?,
                enabled: row.get::<_, i32>(6)? == 1,
                created_at: DateTime::parse_from_rfc3339(&created_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: DateTime::parse_from_rfc3339(&updated_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
            })
        });

        match result {
            Ok(config) => Ok(Some(config)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// 查找所有配置
    pub fn find_all(&self, model_type: Option<ModelType>) -> SqliteResult<Vec<ModelConfig>> {
        let conn = self.get_connection()?;

        let mut stmt = match model_type {
            Some(mt) => {
                let mut s = conn.prepare(
                    "SELECT model_id, model_name, model_type, base_url, api_key, api_url,
                            enabled, created_at, updated_at
                     FROM model_configs WHERE model_type = ?1 ORDER BY created_at DESC"
                )?;
                let rows = s.query_map(params![mt.to_string()], Self::map_row)?;
                return rows.collect();
            }
            None => conn.prepare(
                "SELECT model_id, model_name, model_type, base_url, api_key, api_url,
                        enabled, created_at, updated_at
                 FROM model_configs ORDER BY created_at DESC"
            )?,
        };

        let rows = stmt.query_map([], Self::map_row)?;
        rows.collect()
    }

    /// 映射数据库行到 ModelConfig
    fn map_row(row: &rusqlite::Row) -> SqliteResult<ModelConfig> {
        let created_str: String = row.get(7)?;
        let updated_str: String = row.get(8)?;

        Ok(ModelConfig {
            model_id: row.get(0)?,
            model_name: row.get(1)?,
            model_type: ModelType::from_str(&row.get::<_, String>(2)?).unwrap(),
            base_url: row.get(3)?,
            api_key: row.get(4)?,
            api_url: row.get(5)?,
            enabled: row.get::<_, i32>(6)? == 1,
            created_at: DateTime::parse_from_rfc3339(&created_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&updated_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    }

    /// 保存或更新配置
    pub fn save(&self, config: &ModelConfig) -> SqliteResult<()> {
        let conn = self.get_connection()?;
        conn.execute(
            "INSERT OR REPLACE INTO model_configs
             (model_id, model_name, model_type, base_url, api_key, api_url, enabled, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                config.model_id,
                config.model_name,
                config.model_type.to_string(),
                config.base_url,
                config.api_key,
                config.api_url,
                if config.enabled { 1 } else { 0 },
                config.created_at.to_rfc3339(),
                config.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// 更新配置
    pub fn update(
        &self,
        model_id: &str,
        model_name: Option<String>,
        base_url: Option<String>,
        api_key: Option<String>,
        api_url: Option<String>,
        enabled: Option<bool>,
    ) -> SqliteResult<()> {
        let mut config = self.find_by_id(model_id)?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

        config.update(model_name, base_url, api_key, api_url, enabled);
        self.save(&config)
    }

    /// 删除配置
    pub fn delete(&self, model_id: &str) -> SqliteResult<()> {
        let conn = self.get_connection()?;
        conn.execute("DELETE FROM model_configs WHERE model_id = ?1", params![model_id])?;
        Ok(())
    }

    /// 批量保存配置
    pub fn batch_upsert(&self, configs: &[ModelConfig]) -> SqliteResult<()> {
        let conn = self.get_connection()?;
        let tx = conn.unchecked_transaction()?;

        for config in configs {
            tx.execute(
                "INSERT OR REPLACE INTO model_configs
                 (model_id, model_name, model_type, base_url, api_key, api_url, enabled, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    config.model_id,
                    config.model_name,
                    config.model_type.to_string(),
                    config.base_url,
                    config.api_key,
                    config.api_url,
                    if config.enabled { 1 } else { 0 },
                    config.created_at.to_rfc3339(),
                    config.updated_at.to_rfc3339(),
                ],
            )?;
        }

        tx.commit()?;
        Ok(())
    }
}
