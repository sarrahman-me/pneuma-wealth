mod db;

use chrono::{Local, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Serialize)]
struct Transaction {
    id: i64,
    ts_utc: i64,
    date_local: String,
    kind: String,
    amount: i64,
    source: String,
    fixed_cost_id: Option<i64>,
}

#[derive(Serialize)]
struct FixedCost {
    id: i64,
    name: String,
    amount: i64,
    is_active: bool,
    paid_date_local: Option<String>,
    paid_ts_utc: Option<i64>,
    paid_tx_id: Option<i64>,
}

#[derive(Serialize)]
struct TodaySummary {
    recommended_spend_today: i64,
    today_out: i64,
    today_remaining: i64,
    today_remaining_clamped: i64,
    overspent_today: bool,
}

#[derive(Serialize)]
struct Config {
    min_floor: i64,
    max_ceil: i64,
    resilience_days: i64,
}

#[derive(Deserialize)]
struct ConfigPayload {
    min_floor: i64,
    max_ceil: i64,
    resilience_days: i64,
}

#[derive(Serialize)]
struct PoolsSummary {
    total_in: i64,
    total_out: i64,
    net_balance: i64,
    min_floor: i64,
    max_ceil: i64,
    resilience_days: i64,
    target_penyangga: i64,
    dana_fleksibel: i64,
    recommended_spend_today: i64,
    today_out: i64,
    today_remaining: i64,
    today_remaining_clamped: i64,
    overspent_today: bool,
    hari_ketahanan_stop_pemasukan: i64,
}
fn resolve_date_local(date_local: Option<String>) -> String {
    date_local.unwrap_or_else(|| Local::now().format("%Y-%m-%d").to_string())
}

fn period_ym_from_date(date_local: &str) -> String {
    date_local.get(0..7).unwrap_or(date_local).to_string()
}

fn clamp_i64(value: i64, min: i64, max: i64) -> i64 {
    if value < min {
        min
    } else if value > max {
        max
    } else {
        value
    }
}

fn compute_pools_summary(conn: &Connection) -> Result<PoolsSummary, String> {
    let config = fetch_config(conn)?;

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

    let net_balance = total_in - total_out;
    // resilience_days berperan ganda: target penyangga dan horizon pembagian dana fleksibel.
    let target_penyangga = config.min_floor * config.resilience_days;
    let dana_fleksibel = std::cmp::max(0, net_balance - target_penyangga);

    let per_day_fleksibel = if config.resilience_days > 0 {
        dana_fleksibel / config.resilience_days
    } else {
        0
    };
    let penyangga_tercapai = net_balance >= target_penyangga;
    let recommended_spend_today_raw = if penyangga_tercapai {
        std::cmp::max(config.min_floor, per_day_fleksibel)
    } else {
        per_day_fleksibel
    };
    let min_bound = if penyangga_tercapai {
        config.min_floor
    } else {
        0
    };
    let recommended_spend_today =
        clamp_i64(recommended_spend_today_raw, min_bound, config.max_ceil);

    let today_local = Local::now().format("%Y-%m-%d").to_string();
    let today_out: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE kind = 'OUT' AND date_local = ?1",
            [today_local],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;

    let today_remaining = recommended_spend_today - today_out;
    let today_remaining_clamped = std::cmp::max(0, today_remaining);
    let overspent_today = today_out > recommended_spend_today;

    let hari_ketahanan_stop_pemasukan = if config.min_floor > 0 {
        std::cmp::max(0, net_balance.div_euclid(config.min_floor))
    } else {
        0
    };

    Ok(PoolsSummary {
        total_in,
        total_out,
        net_balance,
        min_floor: config.min_floor,
        max_ceil: config.max_ceil,
        resilience_days: config.resilience_days,
        target_penyangga,
        dana_fleksibel,
        recommended_spend_today,
        today_out,
        today_remaining,
        today_remaining_clamped,
        overspent_today,
        hari_ketahanan_stop_pemasukan,
    })
}

fn fetch_config(conn: &Connection) -> Result<Config, String> {
    conn.query_row(
        "SELECT min_floor, max_ceil, resilience_days FROM config WHERE id = 1",
        [],
        |row| {
            Ok(Config {
                min_floor: row.get(0)?,
                max_ceil: row.get(1)?,
                resilience_days: row.get(2)?,
            })
        },
    )
    .map_err(|err| err.to_string())
}

fn fetch_fixed_cost_amount(conn: &Connection, fixed_cost_id: i64) -> Result<i64, String> {
    conn.query_row(
        "SELECT amount FROM fixed_costs WHERE id = ?1",
        [fixed_cost_id],
        |row| row.get(0),
    )
    .map_err(|err| err.to_string())
}

fn fetch_fixed_cost_for_period(
    conn: &Connection,
    fixed_cost_id: i64,
    period_ym: &str,
) -> Result<FixedCost, String> {
    conn.query_row(
        "SELECT fc.id, fc.name, fc.amount, fc.is_active, p.paid_date_local, p.paid_ts_utc, p.tx_id
         FROM fixed_costs fc
         LEFT JOIN fixed_cost_payments p
           ON p.fixed_cost_id = fc.id AND p.period_ym = ?1
         WHERE fc.id = ?2",
        params![period_ym, fixed_cost_id],
        |row| {
            let active: i64 = row.get(3)?;
            Ok(FixedCost {
                id: row.get(0)?,
                name: row.get(1)?,
                amount: row.get(2)?,
                is_active: active != 0,
                paid_date_local: row.get(4)?,
                paid_ts_utc: row.get(5)?,
                paid_tx_id: row.get(6)?,
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
    source: &str,
    fixed_cost_id: Option<i64>,
) -> Result<Transaction, String> {
    if amount < 0 {
        return Err("amount must be >= 0".to_string());
    }
    let date_local = resolve_date_local(date_local);
    let ts_utc = Utc::now().timestamp_millis();
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;

    conn.execute(
        "INSERT INTO transactions (ts_utc, date_local, kind, amount, source, fixed_cost_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![ts_utc, date_local, kind, amount, source, fixed_cost_id],
    )
    .map_err(|err| err.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(Transaction {
        id,
        ts_utc,
        date_local,
        kind: kind.to_string(),
        amount,
        source: source.to_string(),
        fixed_cost_id,
    })
}

#[tauri::command(rename_all = "snake_case")]
fn add_income(
    app: AppHandle,
    amount: i64,
    date_local: Option<String>,
) -> Result<Transaction, String> {
    insert_transaction(app, "IN", amount, date_local, "manual", None)
}

#[tauri::command(rename_all = "snake_case")]
fn add_expense(
    app: AppHandle,
    amount: i64,
    date_local: Option<String>,
) -> Result<Transaction, String> {
    insert_transaction(app, "OUT", amount, date_local, "manual", None)
}

#[tauri::command(rename_all = "snake_case")]
fn list_recent_transactions(app: AppHandle, limit: u32) -> Result<Vec<Transaction>, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, ts_utc, date_local, kind, amount, source, fixed_cost_id
             FROM transactions
             ORDER BY ts_utc DESC
             LIMIT ?1",
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
                source: row.get(5)?,
                fixed_cost_id: row.get(6)?,
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
fn delete_transaction(app: AppHandle, transaction_id: i64) -> Result<(), String> {
    if transaction_id <= 0 {
        return Err("ID transaksi tidak valid".to_string());
    }
    let mut conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    tx.execute(
        "UPDATE fixed_cost_payments
         SET paid_date_local = NULL, paid_ts_utc = NULL, tx_id = NULL
         WHERE tx_id = ?1",
        params![transaction_id],
    )
    .map_err(|err| err.to_string())?;
    let affected = tx
        .execute(
            "DELETE FROM transactions WHERE id = ?1",
            params![transaction_id],
        )
        .map_err(|err| err.to_string())?;
    if affected == 0 {
        return Err("Transaksi tidak ditemukan".to_string());
    }
    tx.commit().map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn get_config(app: AppHandle) -> Result<Config, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    fetch_config(&conn)
}

#[tauri::command(rename_all = "snake_case")]
fn update_config(app: AppHandle, payload: ConfigPayload) -> Result<Config, String> {
    if payload.min_floor < 0 || payload.max_ceil < 0 {
        return Err("min_floor and max_ceil must be >= 0".to_string());
    }
    if payload.resilience_days < 1 {
        return Err("resilience_days must be >= 1".to_string());
    }
    if payload.min_floor > payload.max_ceil {
        return Err("min_floor must be <= max_ceil".to_string());
    }

    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    conn.execute(
        "UPDATE config SET min_floor = ?1, max_ceil = ?2, resilience_days = ?3, updated_ts_utc = ?4 WHERE id = 1",
        params![
            payload.min_floor,
            payload.max_ceil,
            payload.resilience_days,
            Utc::now().timestamp_millis()
        ],
    )
    .map_err(|err| err.to_string())?;

    fetch_config(&conn)
}

#[tauri::command(rename_all = "snake_case")]
fn list_fixed_costs(app: AppHandle) -> Result<Vec<FixedCost>, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let period_ym = Local::now().format("%Y-%m").to_string();
    let mut stmt = conn
        .prepare(
            "SELECT fc.id, fc.name, fc.amount, fc.is_active, p.paid_date_local, p.paid_ts_utc, p.tx_id
             FROM fixed_costs fc
             LEFT JOIN fixed_cost_payments p
               ON p.fixed_cost_id = fc.id AND p.period_ym = ?1
             ORDER BY fc.id DESC",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([period_ym], |row| {
            let active: i64 = row.get(3)?;
            Ok(FixedCost {
                id: row.get(0)?,
                name: row.get(1)?,
                amount: row.get(2)?,
                is_active: active != 0,
                paid_date_local: row.get(4)?,
                paid_ts_utc: row.get(5)?,
                paid_tx_id: row.get(6)?,
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
    if amount < 0 {
        return Err("amount must be >= 0".to_string());
    }
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;

    conn.execute(
        "INSERT INTO fixed_costs (name, amount, is_active) VALUES (?1, ?2, 1)",
        params![name, amount],
    )
    .map_err(|err| err.to_string())?;

    let id = conn.last_insert_rowid();

    fetch_fixed_cost_for_period(&conn, id, &Local::now().format("%Y-%m").to_string())
}

#[tauri::command(rename_all = "snake_case")]
fn delete_fixed_cost(app: AppHandle, fixed_cost_id: i64) -> Result<(), String> {
    let mut conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;

    tx.execute(
        "DELETE FROM transactions WHERE id IN (
            SELECT tx_id FROM fixed_cost_payments WHERE fixed_cost_id = ?1 AND tx_id IS NOT NULL
         )",
        params![fixed_cost_id],
    )
    .map_err(|err| err.to_string())?;
    tx.execute(
        "DELETE FROM transactions WHERE source = 'fixed_cost' AND fixed_cost_id = ?1",
        params![fixed_cost_id],
    )
    .map_err(|err| err.to_string())?;
    tx.execute(
        "DELETE FROM fixed_cost_payments WHERE fixed_cost_id = ?1",
        params![fixed_cost_id],
    )
    .map_err(|err| err.to_string())?;
    tx.execute(
        "DELETE FROM fixed_costs WHERE id = ?1",
        params![fixed_cost_id],
    )
    .map_err(|err| err.to_string())?;
    tx.commit().map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
fn mark_fixed_cost_paid(
    app: AppHandle,
    fixed_cost_id: i64,
    paid_date_local: Option<String>,
) -> Result<FixedCost, String> {
    let paid_date_local = resolve_date_local(paid_date_local);
    let period_ym = period_ym_from_date(&paid_date_local);
    let paid_ts_utc = Utc::now().timestamp_millis();
    let mut conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;

    let amount = fetch_fixed_cost_amount(&tx, fixed_cost_id)?;
    if amount < 0 {
        return Err("amount must be >= 0".to_string());
    }

    let existing_payment: Option<Option<i64>> = tx
        .query_row(
            "SELECT tx_id FROM fixed_cost_payments WHERE fixed_cost_id = ?1 AND period_ym = ?2",
            params![fixed_cost_id, &period_ym],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| err.to_string())?;

    if let Some(Some(tx_id)) = existing_payment {
        let tx_exists: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE id = ?1",
                [tx_id],
                |row| row.get(0),
            )
            .map_err(|err| err.to_string())?;
        if tx_exists > 0 {
            tx.execute(
                "UPDATE fixed_cost_payments
                 SET paid_date_local = ?1, paid_ts_utc = ?2
                 WHERE fixed_cost_id = ?3 AND period_ym = ?4",
                params![paid_date_local, paid_ts_utc, fixed_cost_id, &period_ym],
            )
            .map_err(|err| err.to_string())?;
            tx.commit().map_err(|err| err.to_string())?;
            return fetch_fixed_cost_for_period(&conn, fixed_cost_id, &period_ym);
        }

        tx.execute(
            "UPDATE fixed_cost_payments
             SET paid_date_local = NULL, paid_ts_utc = NULL, tx_id = NULL
             WHERE fixed_cost_id = ?1 AND period_ym = ?2",
            params![fixed_cost_id, &period_ym],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.execute(
        "INSERT INTO transactions (ts_utc, date_local, kind, amount, source, fixed_cost_id)
         VALUES (?1, ?2, 'OUT', ?3, 'fixed_cost', ?4)",
        params![paid_ts_utc, paid_date_local, amount, fixed_cost_id],
    )
    .map_err(|err| err.to_string())?;
    let tx_id = tx.last_insert_rowid();

    tx.execute(
        "INSERT INTO fixed_cost_payments (fixed_cost_id, period_ym, paid_date_local, paid_ts_utc, tx_id)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(fixed_cost_id, period_ym) DO UPDATE SET
           paid_date_local = excluded.paid_date_local,
           paid_ts_utc = excluded.paid_ts_utc,
           tx_id = excluded.tx_id",
        params![
            fixed_cost_id,
            &period_ym,
            paid_date_local,
            paid_ts_utc,
            tx_id
        ],
    )
    .map_err(|err| err.to_string())?;

    tx.commit().map_err(|err| err.to_string())?;

    fetch_fixed_cost_for_period(&conn, fixed_cost_id, &period_ym)
}

#[tauri::command(rename_all = "snake_case")]
fn mark_fixed_cost_unpaid(
    app: AppHandle,
    fixed_cost_id: i64,
    paid_date_local: Option<String>,
) -> Result<FixedCost, String> {
    let paid_date_local = paid_date_local.map(|value| resolve_date_local(Some(value)));
    let period_ym = paid_date_local
        .as_deref()
        .map(period_ym_from_date)
        .unwrap_or_else(|| Local::now().format("%Y-%m").to_string());

    let mut conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;

    let tx_id: Option<Option<i64>> = tx
        .query_row(
            "SELECT tx_id FROM fixed_cost_payments WHERE fixed_cost_id = ?1 AND period_ym = ?2",
            params![fixed_cost_id, &period_ym],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| err.to_string())?;

    if let Some(Some(tx_id)) = tx_id {
        tx.execute("DELETE FROM transactions WHERE id = ?1", params![tx_id])
            .map_err(|err| err.to_string())?;
        tx.execute(
            "UPDATE fixed_cost_payments
             SET paid_date_local = NULL, paid_ts_utc = NULL, tx_id = NULL
             WHERE fixed_cost_id = ?1 AND period_ym = ?2",
            params![fixed_cost_id, &period_ym],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.commit().map_err(|err| err.to_string())?;

    fetch_fixed_cost_for_period(&conn, fixed_cost_id, &period_ym)
}

#[tauri::command(rename_all = "snake_case")]
fn get_today_summary(app: AppHandle) -> Result<TodaySummary, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let summary = compute_pools_summary(&conn)?;
    Ok(TodaySummary {
        recommended_spend_today: summary.recommended_spend_today,
        today_out: summary.today_out,
        today_remaining: summary.today_remaining,
        today_remaining_clamped: summary.today_remaining_clamped,
        overspent_today: summary.overspent_today,
    })
}

#[tauri::command(rename_all = "snake_case")]
fn get_pools_summary(app: AppHandle) -> Result<PoolsSummary, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    compute_pools_summary(&conn)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            db::init_db(app.handle())?;
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            add_income,
            add_expense,
            list_recent_transactions,
            delete_transaction,
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

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_conn(min_floor: i64, max_ceil: i64, resilience_days: i64) -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory");
        conn.execute_batch(
            "CREATE TABLE config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                min_floor INTEGER NOT NULL,
                max_ceil INTEGER NOT NULL,
                resilience_days INTEGER NOT NULL,
                created_ts_utc INTEGER NOT NULL,
                updated_ts_utc INTEGER NOT NULL
            );
            CREATE TABLE transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts_utc INTEGER NOT NULL,
                date_local TEXT NOT NULL,
                kind TEXT NOT NULL,
                amount INTEGER NOT NULL,
                source TEXT NOT NULL DEFAULT 'manual',
                fixed_cost_id INTEGER
            );",
        )
        .expect("create tables");

        let now = Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO config (id, min_floor, max_ceil, resilience_days, created_ts_utc, updated_ts_utc)
             VALUES (1, ?1, ?2, ?3, ?4, ?4)",
            params![min_floor, max_ceil, resilience_days, now],
        )
        .expect("insert config");

        conn
    }

    fn insert_tx(conn: &Connection, kind: &str, amount: i64) {
        let date_local = Local::now().format("%Y-%m-%d").to_string();
        conn.execute(
            "INSERT INTO transactions (ts_utc, date_local, kind, amount, source, fixed_cost_id)
             VALUES (?1, ?2, ?3, ?4, 'manual', NULL)",
            params![Utc::now().timestamp_millis(), date_local, kind, amount],
        )
        .expect("insert tx");
    }

    #[test]
    fn recommended_min_floor_when_penyangga_tercapai() {
        let conn = setup_conn(100, 1000, 10);
        insert_tx(&conn, "IN", 1100);

        let summary = compute_pools_summary(&conn).expect("summary");
        assert_eq!(summary.recommended_spend_today, 100);
    }

    #[test]
    fn recommended_max_ceil_when_fleksibel_besar() {
        let conn = setup_conn(100, 500, 10);
        insert_tx(&conn, "IN", 7000);

        let summary = compute_pools_summary(&conn).expect("summary");
        assert_eq!(summary.recommended_spend_today, 500);
    }

    #[test]
    fn recommended_can_be_below_min_floor_when_penyangga_belum_aman() {
        let conn = setup_conn(100, 500, 10);
        insert_tx(&conn, "IN", 500);

        let summary = compute_pools_summary(&conn).expect("summary");
        assert_eq!(summary.recommended_spend_today, 0);
    }
}
