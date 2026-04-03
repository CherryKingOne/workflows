# Repository Guidelines

## Project Structure & Module Organization
This repository is a desktop-first app built with Next.js (frontend) and Tauri/Rust (backend).

- `app/`: Next.js App Router entrypoints (`(routes)/projects`, `(routes)/canvas/[projectId]`, root layout and globals).
- `src/`: TypeScript business code organized by DDD layers: `domain/`, `application/`, `infrastructure/`, `presentation/`.
- `src-tauri/`: Rust backend and Tauri commands (`commands/`, `application/`, `domain/`, `infrastructure/`).
- `public/`: static assets.
- `docs/`: architecture notes and development guides.

## Build, Test, and Development Commands
- `npm run dev`: start Next.js development server.
- `npm run build`: build production web assets.
- `npm run start`: run the built Next.js app.
- `npm run lint`: run ESLint checks (`eslint-config-next` + TypeScript rules).
- `npm run tauri:dev`: run desktop app in Tauri dev mode.
- `npm run tauri:build`: build desktop binaries.
- `cargo test --manifest-path src-tauri/Cargo.toml`: run Rust tests.

## Coding Style & Naming Conventions
- TypeScript is strict (`tsconfig.json`), keep types explicit at boundaries.
- Use 2-space indentation and existing import/style conventions in touched files.
- Keep DDD boundaries clear: UI logic in `presentation`, orchestration in `application`, invariants in `domain`, IO in `infrastructure`.
- Name files by role and domain, e.g. `CreateProjectCommand.ts`, `project.rs`, `useProjects.ts`.

## Testing Guidelines
- There are currently no committed frontend test suites; add tests with new features or bug fixes.
- Frontend test files should use `*.test.ts` or `*.test.tsx` and live near the module under test.
- Rust tests should follow `*_test.rs` or inline module tests and be runnable with `cargo test`.

## Commit & Pull Request Guidelines
- Prefer Conventional Commit prefixes seen in history: `feat:`, `fix:`, `docs:`, `chore:`.
- Keep commit messages imperative and scoped to one change.
- PRs should include: purpose, key files changed, verification steps, linked issue/task, and screenshots/GIFs for UI changes.

## Agent-Specific Instruction
This repo uses a non-standard Next.js version. Before changing framework APIs, conventions, or file structure, read the relevant guide in `node_modules/next/dist/docs/` and follow current deprecation notices.
