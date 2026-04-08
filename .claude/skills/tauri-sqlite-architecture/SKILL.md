---
name: tauri-sqlite-architecture
description: Enforce proper SQLite usage in Tauri applications. Frontend must use Tauri Commands, not direct database access. Use this when working with database operations, model configuration, or data persistence.
---

# Tauri SQLite Architecture

## Role
Act as the architecture enforcer for SQLite database access in Tauri applications.

## Goals
- Ensure frontend never directly imports or uses database libraries (better-sqlite3, rusqlite, etc.)
- Maintain clear separation between frontend (TypeScript) and backend (Rust)
- Enforce proper use of Tauri Commands for all database operations

## Architecture Rules

### Frontend (TypeScript/React)
- NEVER import `better-sqlite3` or any Node.js database library
- NEVER create Repository implementations that directly access SQLite
- ALWAYS use Tauri Commands via `@tauri-apps/api/core` invoke
- Use API layer files (e.g., `ModelConfigApi.ts`) that wrap Tauri Commands

### Backend (Rust)
- SQLite operations ONLY in Rust code (`src-tauri/`)
- Use `rusqlite` or similar Rust database libraries
- Expose database operations through Tauri Commands
- Implement Repository pattern in Rust

## File Structure

### Correct Structure
```
src/
  infrastructure/
    aiModel/
      api/
        ModelConfigApi.ts          ✓ Uses Tauri Commands
      registry/
        LocalModelRegistry.ts      ✓ In-memory registry, no DB

src-tauri/
  src/
    commands/
      model_config.rs              ✓ Tauri Commands
    infrastructure/
      model_config_repository.rs   ✓ SQLite access in Rust
```

### Incorrect Structure (DO NOT CREATE)
```
src/
  infrastructure/
    aiModel/
      persistence/
        SqliteModelConfigRepository.ts  ✗ WRONG: Frontend accessing SQLite
```

## Common Mistakes

### Mistake 1: Frontend SQLite Repository
```typescript
// WRONG - Do not create this in frontend
import Database from 'better-sqlite3';

export class SqliteModelConfigRepository {
  private db: Database.Database;
  // ...
}
```

**Why it's wrong:**
- `better-sqlite3` is a Node.js library, not available in Tauri frontend
- Violates Tauri's security model (frontend should not access filesystem directly)
- Causes build errors when trying to bundle for production

**Correct approach:**
```typescript
// CORRECT - Use Tauri Commands
import { invoke } from '@tauri-apps/api/core';

export class ModelConfigApi {
  static async getConfig(modelId: string) {
    return await invoke('get_model_config', { modelId });
  }
}
```

### Mistake 2: Installing Database Libraries in Frontend
```bash
# WRONG - Do not install in frontend package.json
npm install better-sqlite3
```

**Why it's wrong:**
- Frontend runs in browser context (even in Tauri)
- Database libraries require Node.js native modules
- Increases bundle size unnecessarily

**Correct approach:**
- Database libraries only in `src-tauri/Cargo.toml`
- Frontend uses lightweight API wrappers

## Implementation Checklist

When implementing database features:

- [ ] Database operations defined as Tauri Commands in `src-tauri/src/commands/`
- [ ] Rust Repository implementation in `src-tauri/src/infrastructure/`
- [ ] Frontend API wrapper using `invoke()` in `src/infrastructure/*/api/`
- [ ] No database library imports in frontend code
- [ ] No `better-sqlite3` in `package.json`
- [ ] Build passes without database-related errors

## Verification Commands

Check for violations:
```bash
# Check for forbidden imports in frontend
grep -r "better-sqlite3\|rusqlite\|sqlite3" src/ --include="*.ts" --include="*.tsx"

# Check package.json for database libraries
grep "better-sqlite3\|sqlite3" package.json

# Verify Tauri Commands are used
grep -r "invoke(" src/infrastructure --include="*.ts"
```

## Example: Model Configuration

### Backend (Rust)
```rust
// src-tauri/src/commands/model_config.rs
#[tauri::command]
pub async fn get_model_config(model_id: String) -> Result<ModelConfig, String> {
    let repo = ModelConfigRepository::new()?;
    repo.find_by_id(&model_id)
}
```

### Frontend (TypeScript)
```typescript
// src/infrastructure/aiModel/api/ModelConfigApi.ts
import { invoke } from '@tauri-apps/api/core';

export class ModelConfigApi {
  static async getConfig(modelId: string): Promise<ModelConfig | null> {
    return await invoke('get_model_config', { modelId });
  }
}
```

## When to Use This Skill

- Adding new database operations
- Implementing data persistence features
- Reviewing pull requests with database code
- Debugging "Cannot find module 'better-sqlite3'" errors
- Refactoring data access layer

## Related Documentation

- Tauri Commands: `docs/tauri-model-config.md`
- Model Config Architecture: `docs/aiModel-architecture.md`
- DDD Layer Separation: `AGENTS.md`
