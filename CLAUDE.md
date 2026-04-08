# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Tauri + Next.js application for workflow management with AI model integration. The frontend uses React with TypeScript, and the backend uses Rust with SQLite for data persistence.

## Development Commands

### Frontend Development
```bash
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Build Next.js for production
npm run lint             # Run ESLint
```

### Tauri Development
```bash
npm run tauri:dev        # Start Tauri app in dev mode (runs Next.js + Tauri)
npm run tauri:build      # Build production Tauri app
npm run tauri            # Direct access to Tauri CLI
```

### Important Notes
- `tauri:dev` automatically runs `npm run dev` via `beforeDevCommand` in tauri.conf.json
- Frontend builds to `out/` directory (static export for Tauri)
- SQLite databases are stored in platform-specific app data directories

## Architecture

### DDD Layered Architecture

The project follows Domain-Driven Design with strict layer separation:

**Frontend (TypeScript)**
```
src/
├── domain/              # Domain entities, value objects, repository interfaces
├── application/         # Application services, commands, queries
├── infrastructure/      # External integrations, API wrappers, registries
└── presentation/        # React components, hooks, UI logic
```

**Backend (Rust)**
```
src-tauri/src/
├── domain/              # Domain entities, repository traits
├── application/         # Application services (currently minimal)
├── infrastructure/      # SQLite repositories, external service implementations
└── commands/            # Tauri Commands (IPC layer)
```

### Critical Architecture Rules

#### 1. SQLite Access Pattern (MANDATORY)
- **Frontend NEVER directly accesses SQLite**
- Frontend uses Tauri Commands via `@tauri-apps/api/core` invoke
- All database operations happen in Rust backend
- DO NOT install `better-sqlite3` in package.json
- DO NOT create SQLite repositories in TypeScript

**Correct Pattern:**
```typescript
// src/infrastructure/aiModel/api/ModelConfigApi.ts
import { invoke } from '@tauri-apps/api/core';

export class ModelConfigApi {
  static async getConfig(modelId: string) {
    return await invoke('get_model_config', { modelId });
  }
}
```

**Wrong Pattern (DO NOT DO THIS):**
```typescript
// WRONG - Frontend should never import database libraries
import Database from 'better-sqlite3';
```

#### 2. AI Model Registry Pattern

Models are managed through a registry system with extreme decoupling:

- Each model is a separate file implementing a provider interface
- Models are registered in registry files (e.g., `ImageModelRegistry.ts`, `ChatModelRegistry.ts`)
- Model configurations are persisted in SQLite via Tauri Commands
- To add a model: create provider file → register in registry → add to `ModelConfigInitializer.ts`
- To remove a model: delete provider file → remove from registry → remove from initializer

**Key Files:**
- `src/infrastructure/aiModel/registry/LocalModelRegistry.ts` - Image model registry
- `src/infrastructure/aiModel/registry/ChatModelRegistry.ts` - Chat model registry
- `src/application/aiModel/ModelConfigInitializer.ts` - Default configurations
- `src-tauri/src/commands/model_config.rs` - Backend commands
- `src-tauri/src/infrastructure/model_config_repository.rs` - SQLite persistence

#### 3. Tauri Commands

All backend operations are exposed through Tauri Commands registered in `src-tauri/src/lib.rs`:

**Available Commands:**
- Project management: `get_projects`, `create_project`, `update_project`, `delete_project`
- Storage: `get_qiniu_config`, `save_qiniu_config`, `upload_canvas_file_asset`
- Model config: `get_all_model_configs`, `get_model_config`, `update_model_config`, `init_model_configs`, `delete_model_config`

**Adding New Commands:**
1. Define command function in `src-tauri/src/commands/`
2. Register in `invoke_handler![]` macro in `lib.rs`
3. Create TypeScript wrapper in `src/infrastructure/*/api/`

### React Flow Integration

The canvas uses `@xyflow/react` for node-based workflow visualization:
- Custom nodes in `src/presentation/pages/canvas/components/canvas-nodes/`
- Main canvas component: `src/presentation/pages/canvas/components/CanvasBoard.tsx`
- Node types: ImageGeneration, FileUpload, Preview, Compare

## Code Style Rules

### No Emoji Policy
- **Strictly forbidden** in all code, comments, documentation, UI text, commit messages
- Use `.codex/skills/no-emoji-policy/scripts/check_emoji.sh` to scan
- Use `.codex/skills/no-emoji-policy/scripts/remove_emoji.sh` to clean

### TypeScript Conventions
- Use interfaces for domain contracts (e.g., `IModelRegistry`, `IImageModelProvider`)
- Use classes for implementations
- Prefer explicit types over inference for public APIs
- Use `@/src/` path alias for imports

### Rust Conventions
- Use traits for repository interfaces
- Use `Result<T, String>` for error handling in Tauri Commands
- Use `Mutex` for shared state in Tauri managed state
- Follow Rust 2021 edition conventions

## Database Management

### SQLite Databases

**Location:**
- macOS: `~/Library/Application Support/com.tauri.dev/`
- Windows: `C:\Users\<username>\AppData\Roaming\com.tauri.dev\`
- Linux: `~/.local/share/com.tauri.dev/`

**Databases:**
- `workflow.db` - Projects, storage configs
- `models.db` - AI model configurations

**Schema Management:**
- Tables are created automatically on first run
- Repository constructors handle table creation
- No migration system currently implemented

## Common Workflows

### Adding a New AI Model

1. Create provider file in `src/infrastructure/aiModel/providers/{type}/ModelName.ts`
2. Implement `IImageModelProvider` or `IChatModelProvider`
3. Register in appropriate registry (`ImageModelRegistry.ts` or `ChatModelRegistry.ts`)
4. Add default config in `ModelConfigInitializer.ts`
5. Model will be auto-initialized on app startup

### Adding a New Tauri Command

1. Define domain entity in `src-tauri/src/domain/`
2. Create repository trait and implementation in `src-tauri/src/infrastructure/`
3. Add command function in `src-tauri/src/commands/`
4. Register in `lib.rs` invoke_handler
5. Create TypeScript API wrapper in `src/infrastructure/*/api/`
6. Create React hook in `src/presentation/hooks/` if needed

### Working with Canvas Nodes

1. Define node type in `src/presentation/pages/canvas/components/canvas-nodes/types.ts`
2. Create node card component in same directory
3. Register in `CanvasBoard.tsx` nodeTypes
4. Add node creation logic in toolbar/menu

## Dependencies

### Key Frontend Libraries
- `next` (16.2.2) - React framework
- `@tauri-apps/api` (2.10.1) - Tauri frontend API
- `@xyflow/react` (12.10.2) - Node-based UI
- `openai` (6.33.0) - OpenAI API client

### Key Backend Libraries
- `tauri` (2.10.3) - Desktop app framework
- `rusqlite` (0.39.0) - SQLite bindings
- `serde` / `serde_json` - Serialization
- `qiniu-sdk` (0.2) - Qiniu cloud storage

## Troubleshooting

### "Cannot find module 'better-sqlite3'"
- This means frontend code is trying to import a database library
- Remove the import and use Tauri Commands instead
- Check `package.json` and remove `better-sqlite3` if present

### Tauri Commands Not Working
- Verify command is registered in `lib.rs` invoke_handler
- Check command signature matches TypeScript invoke call
- Ensure managed state is initialized in `setup()` closure

### Model Not Appearing in UI
- Check model is registered in appropriate registry
- Verify default config exists in `ModelConfigInitializer.ts`
- Check `models.db` to confirm initialization ran
- Restart app to trigger initialization

## Documentation

- `docs/aiModel-architecture.md` - AI model system design
- `docs/tauri-model-config.md` - Model configuration management
- `docs/model-config-management.md` - Config management details
- `docs/model-config-panel-usage.md` - UI usage guide
