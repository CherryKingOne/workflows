# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2.1] - 2026-04-10

### Added
- Import workflow feature: Import JSON workflow files via system file dialog
- Export workflow feature: Export current canvas as JSON file

### Fixed
- Fixed issue where imported workflow nodes could not be deleted
- Fixed node hydration when importing workflows to properly bind callback functions

### Changed
- Import workflow now uses system native file dialog (like "Open File") instead of custom modal
- Export workflow uses system native save dialog
- Improved import/export button feedback with status labels

### Technical Details
- Uses `@tauri-apps/plugin-dialog` open/save APIs for native file dialogs
- Supports both Tauri and Web environments
- Imported nodes are properly hydrated with `hydratePersistedCanvasNode` function

## [0.0.1] - 2026-04-09

### Added
- Initial release of WeiMeng workflow application
- Tauri + Next.js desktop application architecture
- Project management functionality
- Canvas-based workflow editor with React Flow
- AI model integration (chat and image generation)
- SQLite database persistence via Tauri commands
- Qiniu cloud storage integration
- Dark/light theme support

### Technical Details
- Frontend: Next.js 16.2.2 with React 19
- Backend: Tauri 2.10.3 with Rust
- Database: SQLite with rusqlite
- Node-based UI: @xyflow/react 12.10.2
- AI Integration: OpenAI API client 6.33.0

### Platform Support
- macOS (Intel x64 and Apple Silicon aarch64)
- Windows (x64)
- Linux (x64, AppImage and DEB)
