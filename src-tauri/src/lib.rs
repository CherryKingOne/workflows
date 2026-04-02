pub mod domain;
pub mod application;
pub mod infrastructure;
pub mod commands;

use std::fs;
use tauri::Manager;
use infrastructure::persistence::sqlite::project_repo::SqliteProjectRepository;
use application::project::services::ProjectService;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // 初始化应用的本地数据目录以存放 SQLite 数据库
      let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
      if !app_data_dir.exists() {
          fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
      }
      
      let db_path = app_data_dir.join("workflow.db");
      let db_path_str = db_path.to_str().expect("Invalid DB path");
      
      // 初始化仓储实例 (会顺带创建数据库和表)
      let repo = SqliteProjectRepository::new(db_path_str)
          .expect("Failed to initialize SQLite database");
      
      // 初始化并注入 Application Service 到 Tauri 的上下文中
      let project_service = ProjectService::new(repo);
      app.manage(project_service);

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::project::get_projects,
      commands::project::create_project,
      commands::project::update_project,
      commands::project::delete_project,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
