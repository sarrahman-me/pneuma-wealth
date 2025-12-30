# PNEUMA

Local Tauri + Next.js finance tracker. SQLite is stored in the Tauri app data directory and accessed from Rust via rusqlite.

## Coaching Insight

Backend rule engine in `src-tauri/src/insight.rs` generates a short status, bullets, and next step based on PoolsSummary + aggregate queries. Rule priority is deterministic (onboarding → overspent → no-tx → fixed cost unpaid → low buffer → near limit → consistency → normal) so the copy never contradicts core numbers.

## Build macOS

Prerequisites:
- Xcode Command Line Tools (`xcode-select -p`)
- Node.js + npm
- Rust toolchain (macOS target for your architecture)

Build commands:
```bash
npm install
npm run build
npm run tauri build
```

Artifacts:
- `.app`: `src-tauri/target/release/bundle/macos/PNEUMA.app`
- `.dmg`: `src-tauri/target/release/bundle/dmg/PNEUMA_0.1.0_aarch64.dmg` (name varies by arch/version)

Unsigned build notes:
- If Gatekeeper blocks the app, use System Settings → Privacy & Security → Open Anyway for PNEUMA.

Signing/notarization (optional):
- Set `APPLE_SIGNING_IDENTITY` for codesigning.
- Set `APPLE_ID`, `APPLE_PASSWORD` (app-specific), and `APPLE_TEAM_ID` for notarization.

## Run (local desktop)

```bash
npm install
npm run tauri dev
```
