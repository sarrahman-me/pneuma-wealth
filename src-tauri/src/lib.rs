mod db;

use chrono::{Local, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
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
    paid_date_local: Option<String>,
    paid_ts_utc: Option<i64>,
}

#[derive(Serialize)]
struct TodaySummary {
    recommended_spend_today: i64,
    today_remaining: i64,
}

#[derive(Serialize)]
struct Config {
    min_floor: i64,
    max_ceil: i64,
    resilience_days: i64,
    burn_pool_ratio: i64,
}

#[derive(Deserialize)]
struct ConfigPayload {
    min_floor: i64,
    max_ceil: i64,
    resilience_days: i64,
    burn_pool_ratio: i64,
}

#[derive(Serialize)]
struct PoolsSummary {
    burn_pool_balance: i64,
    stabilizer_pool_balance: i64,
    recommended_spend_today: i64,
    today_remaining: i64,
    resilience_days_estimate: i64,
}
fn resolve_date_local(date_local: Option<String>) -> String {
    date_local.unwrap_or_else(|| Local::now().format("%Y-%m-%d").to_string())
}

fn fetch_config(conn: &Connection) -> Result<Config, String> {
    conn.query_row(
        "SELECT min_floor, max_ceil, resilience_days, burn_pool_ratio FROM config WHERE id = 1",
        [],
        |row| {
            Ok(Config {
                min_floor: row.get(0)?,
                max_ceil: row.get(1)?,
                resilience_days: row.get(2)?,
                burn_pool_ratio: row.get(3)?,
            })
        },
    )
    .map_err(|err| err.to_string())
}

fn fetch_fixed_cost(conn: &Connection, fixed_cost_id: i64) -> Result<FixedCost, String> {
    conn.query_row(
        "SELECT id, name, amount, is_active, paid_date_local, paid_ts_utc FROM fixed_costs WHERE id = ?1",
        [fixed_cost_id],
        |row| {
            let active: i64 = row.get(3)?;
            Ok(FixedCost {
                id: row.get(0)?,
                name: row.get(1)?,
                amount: row.get(2)?,
                is_active: active != 0,
                paid_date_local: row.get(4)?,
                paid_ts_utc: row.get(5)?,
            })
        },
    )
    .map_err(|err| err.to_string())
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

#[tauri::command(rename_all = "snake_case")]
fn add_income(
    app: AppHandle,
    amount: i64,
    date_local: Option<String>,
) -> Result<Transaction, String> {
    insert_transaction(app, "IN", amount, date_local)
}

#[tauri::command(rename_all = "snake_case")]
fn add_expense(
    app: AppHandle,
    amount: i64,
    date_local: Option<String>,
) -> Result<Transaction, String> {
    insert_transaction(app, "OUT", amount, date_local)
}

#[tauri::command(rename_all = "snake_case")]
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

#[tauri::command(rename_all = "snake_case")]
fn get_config(app: AppHandle) -> Result<Config, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    fetch_config(&conn)
}

#[tauri::command(rename_all = "snake_case")]
fn update_config(app: AppHandle, payload: ConfigPayload) -> Result<Config, String> {
    if payload.resilience_days < 1 {
        return Err("resilience_days must be >= 1".to_string());
    }
    if payload.min_floor > payload.max_ceil {
        return Err("min_floor must be <= max_ceil".to_string());
    }
    if !(0..=100).contains(&payload.burn_pool_ratio) {
        return Err("burn_pool_ratio must be between 0 and 100".to_string());
    }

    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    conn.execute(
        "UPDATE config SET min_floor = ?1, max_ceil = ?2, resilience_days = ?3, burn_pool_ratio = ?4, updated_ts_utc = ?5 WHERE id = 1",
        params![
            payload.min_floor,
            payload.max_ceil,
            payload.resilience_days,
            payload.burn_pool_ratio,
            Utc::now().timestamp_millis()
        ],
    )
    .map_err(|err| err.to_string())?;

    fetch_config(&conn)
}

#[tauri::command(rename_all = "snake_case")]
fn list_fixed_costs(app: AppHandle) -> Result<Vec<FixedCost>, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, amount, is_active, paid_date_local, paid_ts_utc FROM fixed_costs ORDER BY id DESC",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let active: i64 = row.get(3)?;
            Ok(FixedCost {
                id: row.get(0)?,
                name: row.get(1)?,
                amount: row.get(2)?,
                is_active: active != 0,
                paid_date_local: row.get(4)?,
                paid_ts_utc: row.get(5)?,
            })
        })
        .map_err(|err| err.to_string())?;

    let mut costs = Vec::new();
    for row in rows {
        costs.push(row.map_err(|err| err.to_string())?);
    }

    Ok(costs)
}

#[tauri::command(rename_all = "snake_case")]
fn add_fixed_cost(app: AppHandle, name: String, amount: i64) -> Result<FixedCost, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;

    conn.execute(
        "INSERT INTO fixed_costs (name, amount, is_active, paid_date_local, paid_ts_utc) VALUES (?1, ?2, 1, NULL, NULL)",
        params![name, amount],
    )
    .map_err(|err| err.to_string())?;

    let id = conn.last_insert_rowid();

    fetch_fixed_cost(&conn, id)
}

#[tauri::command(rename_all = "snake_case")]
fn delete_fixed_cost(app: AppHandle, fixed_cost_id: i64) -> Result<(), String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    conn.execute(
        "DELETE FROM fixed_costs WHERE id = ?1",
        params![fixed_cost_id],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn mark_fixed_cost_paid(
    app: AppHandle,
    fixed_cost_id: i64,
    paid_date_local: Option<String>,
) -> Result<FixedCost, String> {
    let paid_date_local = resolve_date_local(paid_date_local);
    let paid_ts_utc = Utc::now().timestamp_millis();
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;

    conn.execute(
        "UPDATE fixed_costs SET paid_date_local = ?1, paid_ts_utc = ?2 WHERE id = ?3",
        params![paid_date_local, paid_ts_utc, fixed_cost_id],
    )
    .map_err(|err| err.to_string())?;

    fetch_fixed_cost(&conn, fixed_cost_id)
}

#[tauri::command(rename_all = "snake_case")]
fn mark_fixed_cost_unpaid(app: AppHandle, fixed_cost_id: i64) -> Result<FixedCost, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    conn.execute(
        "UPDATE fixed_costs SET paid_date_local = NULL, paid_ts_utc = NULL WHERE id = ?1",
        params![fixed_cost_id],
    )
    .map_err(|err| err.to_string())?;

    fetch_fixed_cost(&conn, fixed_cost_id)
}

#[tauri::command(rename_all = "snake_case")]
fn get_today_summary() -> TodaySummary {
    TodaySummary {
        recommended_spend_today: 0,
        today_remaining: 0,
    }
}

#[tauri::command(rename_all = "snake_case")]
fn get_pools_summary(app: AppHandle) -> Result<PoolsSummary, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let config = fetch_config(&conn)?;

    let total_in: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE kind = 'IN'",
            [],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    let total_out: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE kind = 'OUT'",
            [],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;

    let today_local = Local::now().format("%Y-%m-%d").to_string();
    let today_out: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE kind = 'OUT' AND date_local = ?1",
            [today_local],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;

    let days_with_out: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT date_local) FROM transactions WHERE kind = 'OUT'",
            [],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;

    let net_balance = total_in - total_out;
    let burn_pool_balance = net_balance * config.burn_pool_ratio / 100;
    let stabilizer_pool_balance = net_balance - burn_pool_balance;

    let avg_daily_out = if days_with_out > 0 {
        total_out / days_with_out
    } else {
        0
    };
    let resilience_days_estimate = if avg_daily_out > 0 {
        stabilizer_pool_balance / avg_daily_out
    } else {
        0
    };

    Ok(PoolsSummary {
        burn_pool_balance,
        stabilizer_pool_balance,
        recommended_spend_today: config.max_ceil,
        today_remaining: config.max_ceil - today_out,
        resilience_days_estimate,
    })
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
            get_config,
            update_config,
            list_fixed_costs,
            add_fixed_cost,
            delete_fixed_cost,
            mark_fixed_cost_paid,
            mark_fixed_cost_unpaid,
            get_today_summary,
            get_pools_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
