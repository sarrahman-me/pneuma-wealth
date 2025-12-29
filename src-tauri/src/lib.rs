mod db;

use chrono::{Local, Utc};
use rusqlite::params;
use serde::Serialize;
use tauri::AppHandle;

#[derive(Serialize)]
struct Transaction {
    id: i64,
    ts_utc: i64,
    date_local: String,
    kind: String,
    amount: i64,
}

#[derive(Serialize)]
struct FixedCost {
    id: i64,
    name: String,
    amount: i64,
    is_active: bool,
}

#[derive(Serialize)]
struct FixedCostPayment {
    id: i64,
    fixed_cost_id: i64,
    paid_date_local: String,
    paid_ts_utc: i64,
}

#[derive(Serialize)]
struct TodaySummary {
    recommended_spend_today: i64,
    today_remaining: i64,
}

fn resolve_date_local(date_local: Option<String>) -> String {
    date_local.unwrap_or_else(|| Local::now().format("%Y-%m-%d").to_string())
}

fn insert_transaction(
    app: AppHandle,
    kind: &str,
    amount: i64,
    date_local: Option<String>,
) -> Result<Transaction, String> {
    let date_local = resolve_date_local(date_local);
    let ts_utc = Utc::now().timestamp_millis();
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;

    conn.execute(
        "INSERT INTO transactions (ts_utc, date_local, kind, amount) VALUES (?1, ?2, ?3, ?4)",
        params![ts_utc, date_local, kind, amount],
    )
    .map_err(|err| err.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(Transaction {
        id,
        ts_utc,
        date_local,
        kind: kind.to_string(),
        amount,
    })
}

#[tauri::command]
fn add_income(app: AppHandle, amount: i64, date_local: Option<String>) -> Result<Transaction, String> {
    insert_transaction(app, "IN", amount, date_local)
}

#[tauri::command]
fn add_expense(app: AppHandle, amount: i64, date_local: Option<String>) -> Result<Transaction, String> {
    insert_transaction(app, "OUT", amount, date_local)
}

#[tauri::command]
fn list_recent_transactions(app: AppHandle, limit: u32) -> Result<Vec<Transaction>, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, ts_utc, date_local, kind, amount FROM transactions ORDER BY ts_utc DESC LIMIT ?1",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([limit], |row| {
            Ok(Transaction {
                id: row.get(0)?,
                ts_utc: row.get(1)?,
                date_local: row.get(2)?,
                kind: row.get(3)?,
                amount: row.get(4)?,
            })
        })
        .map_err(|err| err.to_string())?;

    let mut transactions = Vec::new();
    for row in rows {
        transactions.push(row.map_err(|err| err.to_string())?);
    }

    Ok(transactions)
}

#[tauri::command]
fn list_fixed_costs(app: AppHandle) -> Result<Vec<FixedCost>, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, amount, is_active FROM fixed_costs ORDER BY id DESC")
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let active: i64 = row.get(3)?;
            Ok(FixedCost {
                id: row.get(0)?,
                name: row.get(1)?,
                amount: row.get(2)?,
                is_active: active != 0,
            })
        })
        .map_err(|err| err.to_string())?;

    let mut costs = Vec::new();
    for row in rows {
        costs.push(row.map_err(|err| err.to_string())?);
    }

    Ok(costs)
}

#[tauri::command]
fn toggle_fixed_cost_paid(
    app: AppHandle,
    fixed_cost_id: i64,
    paid_date_local: Option<String>,
) -> Result<FixedCostPayment, String> {
    let paid_date_local = resolve_date_local(paid_date_local);
    let paid_ts_utc = Utc::now().timestamp_millis();
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;

    conn.execute(
        "INSERT INTO fixed_cost_payments (fixed_cost_id, paid_date_local, paid_ts_utc) VALUES (?1, ?2, ?3)",
        params![fixed_cost_id, paid_date_local, paid_ts_utc],
    )
    .map_err(|err| err.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(FixedCostPayment {
        id,
        fixed_cost_id,
        paid_date_local,
        paid_ts_utc,
    })
}

#[tauri::command]
fn get_today_summary() -> TodaySummary {
    TodaySummary {
        recommended_spend_today: 0,
        today_remaining: 0,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            db::init_db(&app.handle())?;
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            add_income,
            add_expense,
            list_recent_transactions,
            list_fixed_costs,
            toggle_fixed_cost_paid,
            get_today_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
