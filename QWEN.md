# Workflow - QWEN Context

## Project Overview

**Workflow** is a desktop application built with **Next.js** (App Router) and **Tauri 2.x**, using **SQLite** for local data persistence. The app follows a **Domain-Driven Design (DDD)** architecture in both its TypeScript frontend and Rust backend.

The application provides a canvas-based workspace where users can create and manage projects, with a visual board for each project.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Desktop** | Tauri 2.x (Rust) |
| **Database** | SQLite (via `rusqlite`) |
| **Linting** | ESLint 9 |
| **Font** | Geist Sans + Mono |

### Architecture

The project uses a clean **DDD layered architecture**:

```
src/
├── domain/          # Entities, repositories interfaces, value objects
│   ├── node/        # Canvas node domain model
│   └── project/     # Project domain model
├── application/     # Application services and use-case logic
│   ├── node/
│   └── project/
├── infrastructure/  # External concerns (API calls, persistence)
│   ├── api/
│   └── persistence/
└── presentation/    # UI components, hooks, and pages
    ├── components/
    ├── hooks/
    └── pages/
```

The **Tauri backend** (`src-tauri/`) mirrors this structure:

```
src-tauri/src/
├── domain/          # Rust domain models
├── application/     # Rust application services
├── infrastructure/  # SQLite persistence layer
├── commands/        # Tauri IPC command handlers
├── lib.rs           # Library entry point (Tauri setup + DI)
└── main.rs          # Binary entry point
```

### Routes

| Route | Description |
|-------|------------|
| `/` | Redirects to `/projects` |
| `/projects` | Project list page |
| `/canvas/[projectId]` | Canvas board for a specific project |

## Building and Running

### Development

```bash
# Start Next.js dev server (web only)
npm run dev

# Start Tauri dev mode (desktop app with hot reload)
npm run tauri:dev
```

### Production

```bash
# Build Next.js static site
npm run build

# Build Tauri desktop application (production binary)
npm run tauri:build
```

### Other Commands

```bash
# Run ESLint
npm run lint

# Direct Tauri CLI access
npm run tauri -- <command>
```

## Database

The app uses **SQLite** for local persistence. The database file (`workflow.db`) is stored in the platform-specific app data directory (e.g., `~/Library/Application Support/com.tauri.dev/workflow.db` on macOS).

The database is auto-created on first launch via `SqliteProjectRepository::new()`.

## Key Files

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | Tauri app setup, DI, and command registration |
| `src-tauri/tauri.conf.json` | Tauri configuration (window, build, bundle) |
| `src-tauri/Cargo.toml` | Rust dependencies |
| `package.json` | Node.js dependencies and scripts |
| `next.config.ts` | Next.js configuration |
| `tsconfig.json` | TypeScript configuration (paths: `@/*`) |
| `app/layout.tsx` | Root layout with Geist fonts and dark theme |
| `app/page.tsx` | Root redirect to `/projects` |

## Development Conventions

- **TypeScript**: Strict mode enabled, `ES2017` target, path aliases (`@/*`)
- **React**: Uses React 19 with App Router patterns (`use()` for params, server/client components)
- **Styling**: Tailwind CSS v4 with utility-first approach, dark theme by default
- **Architecture**: Strict DDD layering - domain entities are pure, repositories are interfaces in domain and implementations in infrastructure, application services orchestrate use cases
- **Tauri IPC**: Commands are defined in `src-tauri/src/commands/` and invoked from the frontend via `@tauri-apps/api`
