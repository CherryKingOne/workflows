/**
 * Updater 命令模块
 *
 * 【职责说明】
 * 提供前端可调用的更新相关命令：
 * - check_update: 检查是否有新版本
 * - download_update: 后台静默下载更新（下载后自动安装）
 * - install_and_restart: 重启应用（使用 tauri-plugin-process）
 *
 * 【事件说明】
 * 通过 Tauri Event 向前端推送状态：
 * - "update://available": 发现新版本
 * - "update://progress": 下载进度
 * - "update://downloaded": 下载并安装完成
 * - "update://error": 更新出错
 */

use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

/// 更新信息结构体
#[derive(Clone, serde::Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub date: Option<String>,
    pub body: Option<String>,
}

/// 下载进度信息
#[derive(Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percent: f64,
}

/// 检查更新
///
/// 返回 Option<UpdateInfo>，如果有更新则返回更新信息
#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app
        .updater()
        .map_err(|e| format!("Failed to get updater: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check update: {}", e))?;

    match update {
        Some(update) => {
            let info = UpdateInfo {
                version: update.version.clone(),
                current_version: app.config().version.clone().unwrap_or_default(),
                date: update.date.map(|d| d.to_string()),
                body: update.body.clone(),
            };

            // 发送事件通知前端
            app.emit("update://available", &info)
                .map_err(|e| format!("Failed to emit event: {}", e))?;

            Ok(Some(info))
        }
        None => Ok(None),
    }
}

/// 后台静默下载并安装更新
///
/// 下载过程中会发送进度事件，下载安装完成后发送完成事件
/// 注意：下载完成后会自动安装，调用者需要调用 install_and_restart 重启应用
#[tauri::command]
pub async fn download_update(app: AppHandle) -> Result<(), String> {
    let updater = app
        .updater()
        .map_err(|e| format!("Failed to get updater: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check update: {}", e))?;

    let update = match update {
        Some(u) => u,
        None => return Err("No update available".to_string()),
    };

    // 开始下载并发送进度事件
    let app_clone = app.clone();
    update
        .download_and_install(
            move |downloaded: usize, total: Option<u64>| {
                let downloaded_u64 = downloaded as u64;

                let percent = if let Some(t) = total {
                    (downloaded_u64 as f64 / t as f64) * 100.0
                } else {
                    0.0
                };

                let progress = DownloadProgress {
                    downloaded: downloaded_u64,
                    total,
                    percent,
                };

                let _ = app_clone.emit("update://progress", &progress);
            },
            || {
                // 下载并安装完成
                let _ = app.emit("update://downloaded", ());
            },
        )
        .await
        .map_err(|e| {
            let _ = app.emit("update://error", format!("Download failed: {}", e));
            format!("Failed to download update: {}", e)
        })?;

    Ok(())
}

/// 重启应用
///
/// 使用 tauri-plugin-process 提供的重启功能
/// 在更新下载安装完成后调用
#[tauri::command]
pub async fn install_and_restart(app: AppHandle) {
    // 使用 tauri-plugin-process 的 restart 功能
    // 这会重启整个应用，让新版本生效
    app.restart();
}
