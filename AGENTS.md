# Repository Guidelines

## Project Structure & Module Organization
This is a Tauri + Next.js desktop app with a Rust backend and a React UI.
- `app/` contains the Next.js App Router pages, layouts, and UI modules.
- `app/components/` holds reusable UI components; feature folders like `app/history/` or `app/fixed-costs/` group page logic.
- `src-tauri/` contains the Rust backend, Tauri config, and build artifacts (`src-tauri/src/` is the main code).
- `public/` stores static assets (icons/images).
- `scripts/` has local tooling like UI smoke checks.

## Build, Test, and Development Commands
- `npm run dev`: start Next.js dev server on port 3000 for UI work.
- `npm run tauri dev`: run the desktop app with live reload.
- `npm run build`: build the Next.js frontend.
- `npm run tauri build`: build the Tauri desktop bundle (macOS app/dmg output).
- `npm run lint`: run Next.js ESLint rules.
- `npm run typecheck`: run TypeScript type checks.
- `npm run ui:smoke`: execute the scripted UI smoke check (`scripts/ui-smoke.mjs`).
- `npm run check`: lint + typecheck + ui smoke in one pass.

## Coding Style & Naming Conventions
- TypeScript + React in `app/` using Next.js App Router conventions (e.g., `page.tsx`, `layout.tsx`).
- Follow existing file naming: kebab-case for feature folders (e.g., `fixed-costs`) and camelCase for JS/TS identifiers.
- No dedicated formatter is configured; keep formatting consistent with existing files and run `npm run lint`.

## Testing Guidelines
Automated unit tests are not set up. UI regression is documented in `docs/ui-regression.md`.
- Use `npm run ui:smoke` for scripted checks.
- For UI changes, run the manual checklist in `docs/ui-regression.md`.

## Commit & Pull Request Guidelines
Git history uses emoji-style prefixes and Indonesian descriptions (e.g., `:hammer: menambahkan fitur ...`).
- Match the emoji-prefix pattern when possible.
- PRs should include a short summary, testing notes (commands run), and screenshots/GIFs for UI changes.
- Link related issues if they exist.

## Architecture Notes
- SQLite is stored in the Tauri app data directory and accessed via Rust (`src-tauri/src/`).
- Coaching insight rules live in `src-tauri/src/insight.rs` and are deterministic by priority.
