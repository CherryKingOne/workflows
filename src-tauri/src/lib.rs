pub mod application;
pub mod commands;
pub mod domain;
pub mod infrastructure;

use application::project::services::ProjectService;
use application::storage::services::QiniuStorageService;
use application::storage::upload_service::CanvasFileUploadService;
use commands::model_config::ModelConfigState;
use infrastructure::model_config_repository::SqliteModelConfigRepository;
use infrastructure::persistence::sqlite::project_repo::SqliteProjectRepository;
use infrastructure::persistence::sqlite::qiniu_config_repo::SqliteQiniuConfigRepository;
use infrastructure::storage::qiniu_uploader::QiniuSdkUploader;
use std::fs;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 初始化应用的本地数据目录以存放 SQLite 数据库
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
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

            // 初始化七牛配置仓储与应用服务
            let qiniu_repo = SqliteQiniuConfigRepository::new(db_path_str)
                .expect("Failed to initialize qiniu config SQLite repository");
            let qiniu_service = QiniuStorageService::new(qiniu_repo.clone());
            app.manage(qiniu_service);

            // 初始化上传服务（优先七牛，未配置时图片走 Base64）
            let file_upload_service =
                CanvasFileUploadService::new(qiniu_repo, QiniuSdkUploader::new());
            app.manage(file_upload_service);

            // 初始化模型配置仓储
            let model_config_db_path = app_data_dir.join("models.db");
            let model_config_repo = SqliteModelConfigRepository::new(model_config_db_path);
            app.manage(ModelConfigState {
                repository: Mutex::new(model_config_repo),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::project::get_projects,
            commands::project::create_project,
            commands::project::update_project,
            commands::project::delete_project,
            commands::project::save_project_workflow_snapshot,
            commands::project::get_project_workflow_snapshot,
            commands::storage::get_qiniu_config,
            commands::storage::save_qiniu_config,
            commands::storage::upload_canvas_file_asset,
            commands::storage::download_remote_file,
            commands::storage::download_and_save_file,
            commands::model_config::get_all_model_configs,
            commands::model_config::get_model_config,
            commands::model_config::update_model_config,
            commands::model_config::init_model_configs,
            commands::model_config::delete_model_config,
            commands::updater::check_update,
            commands::updater::download_update,
            commands::updater::install_and_restart,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
