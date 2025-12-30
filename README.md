# PNEUMA

Local Tauri + Next.js finance tracker. SQLite is stored in the Tauri app data directory and accessed from Rust via rusqlite.

## Coaching Insight

Backend rule engine in `src-tauri/src/insight.rs` generates a short status, bullets, and next step based on PoolsSummary + aggregate queries. Rule priority is deterministic (onboarding → overspent → no-tx → fixed cost unpaid → low buffer → near limit → consistency → normal) so the copy never contradicts core numbers.

## Run (local desktop)

```bash
npm install
npm run tauri dev
```
