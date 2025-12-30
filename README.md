# PNEUMA

## Project Overview
PNEUMA is a local-first personal finance desktop app for people who want calm, daily guidance without the weight of complex tools. It focuses on a simple rhythm: what you can spend today, how safe your buffer is, and what to do next. The app is intentionally minimal so you can build awareness without being pushed, judged, or overwhelmed.

## Core Philosophy (Non-Technical)
- Daily limits exist to protect tomorrow, not to punish today. A clear daily number reduces decision fatigue.
- The buffer fund (Dana Penyangga) matters more than total balance because it is your safety margin.
- The app avoids loud alerts, charts overload, and gamification to keep attention on daily clarity.
- Calm mode: the buffer is safe; guidance is gentle and steady.
- Tight mode: the buffer is being used; guidance becomes more strict and protective.

## Key Features
- Daily spending recommendation (rounded down to stay conservative).
- Dana Penyangga (buffer fund) tracking.
- Coaching Insight: short status, bullet points, and a next step.
- Automatic mode switching between calm and tight based on buffer usage.
- Local-only SQLite storage.
- No account, no login, no sync.

## Coaching Insight Engine (Technical + Conceptual)
The coaching insight engine is a small rules system that produces human-readable guidance from your current financial state. It lives in the Rust backend so it can stay close to the data and remain deterministic. Rules are evaluated in a fixed priority order so the output never contradicts itself.

Example logic in prose: if onboarding is incomplete, show a setup prompt; otherwise if spending is over budget, show an overspend warning; otherwise if there are no transactions, suggest logging the first one; otherwise continue with buffer and consistency guidance.

See `src-tauri/src/insight.rs` for the implementation.

## Architecture Overview (Technical)
PNEUMA combines a Rust backend with a Next.js frontend to keep the app fast, local, and easy to iterate on.

```
Next.js UI (App Router)
        |
Tauri bridge (commands)
        |
Rust backend (rules + SQLite)
        |
Local SQLite file (app data dir)
```

- Rust handles data storage, rule evaluation, and system-level work.
- Next.js renders the UI, navigation, and interaction flows.
- SQLite is used as a local database with no external services.
- There is no cloud by design to keep data private and portable.

## Data & Privacy
All data lives on your machine in the Tauri app data directory. You own the data entirely.
- No telemetry
- No analytics
- No accounts
- No internet required

## Screenshots
(Screenshots will be added here)

## Development Setup
Prerequisites:
- Xcode Command Line Tools (`xcode-select -p`)
- Node.js + npm
- Rust toolchain (macOS target for your architecture)

Local development:
```bash
npm install
npm run tauri dev
```

Build:
```bash
npm install
npm run build
npm run tauri build
```

Artifacts:
- `.app`: `src-tauri/target/release/bundle/macos/PNEUMA.app`
- `.dmg`: `src-tauri/target/release/bundle/dmg/PNEUMA_0.1.0_aarch64.dmg` (name varies by arch/version)

## macOS Distribution Notes
- `.app` is the raw application bundle produced by Tauri.
- `.dmg` is the disk image used for distribution and drag-and-drop install.
- Unsigned builds may be blocked by Gatekeeper. If blocked, open System Settings → Privacy & Security → Open Anyway for PNEUMA.
- For signing and notarization (optional), set:
  - `APPLE_SIGNING_IDENTITY` for codesigning
  - `APPLE_ID`, `APPLE_PASSWORD` (app-specific), and `APPLE_TEAM_ID` for notarization

## Project Status & Scope
PNEUMA is a personal project and is intentionally local-first. There is no public roadmap or promise of long-term support. Contributions are welcome but not required.

## License
License to be added.
