mod db;
mod insight;

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
struct CoachMode {
    coach_mode: String,
}

#[derive(Deserialize)]
struct CoachModePayload {
    mode: String,
}

#[derive(Serialize)]
pub(crate) struct PoolsSummary {
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

fn floor_to_thousand(value: i64) -> i64 {
    if value <= 0 {
        0
    } else {
        (value / 1_000) * 1_000
    }
}

pub(crate) fn compute_pools_summary(conn: &Connection) -> Result<PoolsSummary, String> {
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
    let clamped = clamp_i64(recommended_spend_today_raw, min_bound, config.max_ceil);
    // Rounded for UX; if min_floor isn't a round thousand, keep min_floor when penyangga tercapai.
    let rounded = floor_to_thousand(clamped);
    let recommended_spend_today = if penyangga_tercapai {
        std::cmp::max(min_bound, rounded)
    } else {
        rounded
    };

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

fn cleanup_fixed_cost_payments(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM fixed_cost_payments WHERE tx_id IS NULL", [])
        .map_err(|err| err.to_string())?;
    conn.execute(
        "DELETE FROM fixed_cost_payments
         WHERE tx_id IS NOT NULL
           AND tx_id NOT IN (
             SELECT id FROM transactions
             WHERE kind = 'OUT' AND source = 'fixed_cost'
               AND fixed_cost_id = fixed_cost_payments.fixed_cost_id
           )",
        [],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
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

fn fetch_coach_mode(conn: &Connection) -> Result<CoachMode, String> {
    let mode: Option<String> = conn
        .query_row("SELECT coach_mode FROM config WHERE id = 1", [], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|err| err.to_string())?;
    Ok(CoachMode {
        coach_mode: mode.unwrap_or_else(|| "calm".to_string()),
    })
}

fn save_coach_mode(conn: &Connection, mode: &str) -> Result<CoachMode, String> {
    if mode != "calm" && mode != "watchful" {
        return Err("mode must be 'calm' or 'watchful'".to_string());
    }
    conn.execute(
        "UPDATE config SET coach_mode = ?1, updated_ts_utc = ?2 WHERE id = 1",
        params![mode, Utc::now().timestamp_millis()],
    )
    .map_err(|err| err.to_string())?;
    fetch_coach_mode(conn)
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

fn resolve_period_for_unpaid(
    conn: &Connection,
    fixed_cost_id: i64,
    paid_date_local: Option<String>,
) -> Result<String, String> {
    let desired_period = paid_date_local
        .as_deref()
        .map(period_ym_from_date)
        .unwrap_or_else(|| Local::now().format("%Y-%m").to_string());

    let existing: Option<String> = conn
        .query_row(
            "SELECT period_ym FROM fixed_cost_payments WHERE fixed_cost_id = ?1 AND period_ym = ?2",
            params![fixed_cost_id, &desired_period],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| err.to_string())?;

    if let Some(period) = existing {
        return Ok(period);
    }

    let fallback: Option<String> = conn
        .query_row(
            "SELECT period_ym FROM fixed_cost_payments WHERE fixed_cost_id = ?1 ORDER BY period_ym DESC LIMIT 1",
            params![fixed_cost_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| err.to_string())?;

    Ok(fallback.unwrap_or(desired_period))
}

fn mark_fixed_cost_unpaid_with_conn(
    conn: &mut Connection,
    fixed_cost_id: i64,
    paid_date_local: Option<String>,
) -> Result<FixedCost, String> {
    let paid_date_local = paid_date_local.map(|value| resolve_date_local(Some(value)));
    let period_ym = resolve_period_for_unpaid(conn, fixed_cost_id, paid_date_local)?;
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
    }

    tx.execute(
        "DELETE FROM fixed_cost_payments WHERE fixed_cost_id = ?1 AND period_ym = ?2",
        params![fixed_cost_id, &period_ym],
    )
    .map_err(|err| err.to_string())?;

    tx.commit().map_err(|err| err.to_string())?;

    fetch_fixed_cost_for_period(conn, fixed_cost_id, &period_ym)
}

fn delete_transaction_with_conn(conn: &mut Connection, transaction_id: i64) -> Result<(), String> {
    if transaction_id <= 0 {
        return Err("ID transaksi tidak valid".to_string());
    }
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    tx.execute(
        "DELETE FROM fixed_cost_payments WHERE tx_id = ?1",
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
fn list_transactions_between(
    app: AppHandle,
    start_date: String,
    end_date: String,
    limit: u32,
    offset: u32,
    kind: Option<String>,
) -> Result<Vec<Transaction>, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    let limit = limit as i64;
    let offset = offset as i64;

    let (sql, params): (&str, Vec<rusqlite::types::Value>) = if let Some(kind) = kind {
        (
            "SELECT id, ts_utc, date_local, kind, amount, source, fixed_cost_id
             FROM transactions
             WHERE date_local >= ?1 AND date_local <= ?2 AND kind = ?3
             ORDER BY date_local DESC, ts_utc DESC
             LIMIT ?4 OFFSET ?5",
            vec![
                start_date.into(),
                end_date.into(),
                kind.into(),
                limit.into(),
                offset.into(),
            ],
        )
    } else {
        (
            "SELECT id, ts_utc, date_local, kind, amount, source, fixed_cost_id
             FROM transactions
             WHERE date_local >= ?1 AND date_local <= ?2
             ORDER BY date_local DESC, ts_utc DESC
             LIMIT ?3 OFFSET ?4",
            vec![
                start_date.into(),
                end_date.into(),
                limit.into(),
                offset.into(),
            ],
        )
    };

    let mut stmt = conn.prepare(sql).map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
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
    delete_transaction_with_conn(&mut conn, transaction_id)
}

#[tauri::command(rename_all = "snake_case")]
fn get_config(app: AppHandle) -> Result<Config, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    fetch_config(&conn)
}

#[tauri::command(rename_all = "snake_case")]
fn get_coach_mode(app: AppHandle) -> Result<CoachMode, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    fetch_coach_mode(&conn)
}

#[tauri::command(rename_all = "snake_case")]
fn set_coach_mode(app: AppHandle, payload: CoachModePayload) -> Result<CoachMode, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    save_coach_mode(&conn, payload.mode.trim())
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
    cleanup_fixed_cost_payments(&conn)?;
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
    let mut conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    mark_fixed_cost_paid_with_conn(&mut conn, fixed_cost_id, paid_date_local)
}

#[tauri::command(rename_all = "snake_case")]
fn mark_fixed_cost_unpaid(
    app: AppHandle,
    fixed_cost_id: i64,
    paid_date_local: Option<String>,
) -> Result<FixedCost, String> {
    let mut conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    mark_fixed_cost_unpaid_with_conn(&mut conn, fixed_cost_id, paid_date_local)
}

fn mark_fixed_cost_paid_with_conn(
    conn: &mut Connection,
    fixed_cost_id: i64,
    paid_date_local: Option<String>,
) -> Result<FixedCost, String> {
    let paid_date_local = resolve_date_local(paid_date_local);
    let period_ym = period_ym_from_date(&paid_date_local);
    let paid_ts_utc = Utc::now().timestamp_millis();
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
                "SELECT COUNT(*) FROM transactions
                 WHERE id = ?1 AND kind = 'OUT' AND source = 'fixed_cost' AND fixed_cost_id = ?2",
                params![tx_id, fixed_cost_id],
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
            return fetch_fixed_cost_for_period(conn, fixed_cost_id, &period_ym);
        }

        tx.execute(
            "DELETE FROM fixed_cost_payments WHERE fixed_cost_id = ?1 AND period_ym = ?2",
            params![fixed_cost_id, &period_ym],
        )
        .map_err(|err| err.to_string())?;
    } else if existing_payment.is_some() {
        tx.execute(
            "DELETE FROM fixed_cost_payments WHERE fixed_cost_id = ?1 AND period_ym = ?2",
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

    fetch_fixed_cost_for_period(conn, fixed_cost_id, &period_ym)
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

#[tauri::command(rename_all = "snake_case")]
fn get_coaching_insight(app: AppHandle) -> Result<insight::CoachingInsight, String> {
    let conn = db::open_connection(&app).map_err(|err| err.to_string())?;
    insight::compute_coaching_insight(&conn)
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
            list_transactions_between,
            delete_transaction,
            get_config,
            get_coach_mode,
            set_coach_mode,
            update_config,
            list_fixed_costs,
            add_fixed_cost,
            delete_fixed_cost,
            mark_fixed_cost_paid,
            mark_fixed_cost_unpaid,
            get_today_summary,
            get_pools_summary,
            get_coaching_insight
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

    fn setup_fixed_cost_schema(conn: &Connection) {
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
            CREATE TABLE fixed_costs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              amount INTEGER NOT NULL,
              is_active INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE transactions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              ts_utc INTEGER NOT NULL,
              date_local TEXT NOT NULL,
              kind TEXT NOT NULL,
              amount INTEGER NOT NULL,
              source TEXT NOT NULL DEFAULT 'manual',
              fixed_cost_id INTEGER
            );
            CREATE TABLE fixed_cost_payments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              fixed_cost_id INTEGER NOT NULL,
              period_ym TEXT NOT NULL,
              paid_date_local TEXT NOT NULL,
              paid_ts_utc INTEGER NOT NULL,
              tx_id INTEGER,
              FOREIGN KEY(fixed_cost_id) REFERENCES fixed_costs(id)
            );",
        )
        .expect("create schema");
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

    #[test]
    fn recommended_floor_to_thousand() {
        let conn = setup_conn(0, 100_000, 1);
        insert_tx(&conn, "IN", 29_285);

        let summary = compute_pools_summary(&conn).expect("summary");
        assert_eq!(summary.recommended_spend_today, 29_000);
    }

    #[test]
    fn recommended_respects_min_floor_when_not_round() {
        let conn = setup_conn(20_500, 100_000, 1);
        insert_tx(&conn, "IN", 20_700);

        let summary = compute_pools_summary(&conn).expect("summary");
        assert_eq!(summary.recommended_spend_today, 20_500);
    }

    #[test]
    fn recommended_rounds_down_when_penyangga_belum_aman() {
        let conn = setup_conn(1_000, 100_000, 2);
        insert_tx(&conn, "IN", 1_500);

        let summary = compute_pools_summary(&conn).expect("summary");
        assert_eq!(summary.recommended_spend_today, 0);
    }

    #[test]
    fn hari_ketahanan_stop_pemasukan_never_negative() {
        let conn = setup_conn(100, 500, 10);
        insert_tx(&conn, "OUT", 500);

        let summary = compute_pools_summary(&conn).expect("summary");
        assert_eq!(summary.hari_ketahanan_stop_pemasukan, 0);
    }

    #[test]
    fn unpaid_deletes_payment_and_transaction_on_legacy_not_null() {
        let mut conn = Connection::open_in_memory().expect("open in-memory");
        setup_fixed_cost_schema(&conn);

        conn.execute(
            "INSERT INTO fixed_costs (name, amount, is_active) VALUES ('Internet', 150000, 1)",
            [],
        )
        .expect("insert fixed_cost");
        let fixed_cost_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO transactions (ts_utc, date_local, kind, amount, source, fixed_cost_id)
             VALUES (?1, '2025-01-10', 'OUT', 150000, 'fixed_cost', ?2)",
            params![Utc::now().timestamp_millis(), fixed_cost_id],
        )
        .expect("insert tx");
        let tx_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO fixed_cost_payments (fixed_cost_id, period_ym, paid_date_local, paid_ts_utc, tx_id)
             VALUES (?1, '2025-01', '2025-01-10', ?2, ?3)",
            params![fixed_cost_id, Utc::now().timestamp_millis(), tx_id],
        )
        .expect("insert payment");

        let result =
            mark_fixed_cost_unpaid_with_conn(&mut conn, fixed_cost_id, None).expect("unpaid");
        assert!(result.paid_date_local.is_none());
        let payment_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM fixed_cost_payments WHERE fixed_cost_id = ?1",
                [fixed_cost_id],
                |row| row.get(0),
            )
            .expect("count payments");
        assert_eq!(payment_count, 0);
        let tx_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE id = ?1",
                [tx_id],
                |row| row.get(0),
            )
            .expect("count tx");
        assert_eq!(tx_count, 0);
    }

    #[test]
    fn unpaid_uses_latest_period_when_none_provided() {
        let mut conn = Connection::open_in_memory().expect("open in-memory");
        setup_fixed_cost_schema(&conn);
        conn.execute(
            "INSERT INTO fixed_costs (name, amount, is_active) VALUES ('Sewa', 500000, 1)",
            [],
        )
        .expect("insert fixed_cost");
        let fixed_cost_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO fixed_cost_payments (fixed_cost_id, period_ym, paid_date_local, paid_ts_utc, tx_id)
             VALUES (?1, '2025-01', '2025-01-05', 1, NULL)",
            [fixed_cost_id],
        )
        .expect("insert old payment");
        conn.execute(
            "INSERT INTO fixed_cost_payments (fixed_cost_id, period_ym, paid_date_local, paid_ts_utc, tx_id)
             VALUES (?1, '2025-02', '2025-02-05', 1, NULL)",
            [fixed_cost_id],
        )
        .expect("insert latest payment");

        let _ = mark_fixed_cost_unpaid_with_conn(&mut conn, fixed_cost_id, None).expect("unpaid");
        let remaining: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM fixed_cost_payments WHERE fixed_cost_id = ?1",
                [fixed_cost_id],
                |row| row.get(0),
            )
            .expect("count payments");
        assert_eq!(remaining, 1);
        let period: String = conn
            .query_row(
                "SELECT period_ym FROM fixed_cost_payments WHERE fixed_cost_id = ?1",
                [fixed_cost_id],
                |row| row.get(0),
            )
            .expect("fetch period");
        assert_eq!(period, "2025-01");
    }

    #[test]
    fn paid_recreates_payment_when_tx_missing() {
        let mut conn = Connection::open_in_memory().expect("open in-memory");
        setup_fixed_cost_schema(&conn);
        conn.execute(
            "INSERT INTO fixed_costs (name, amount, is_active) VALUES ('Listrik', 200000, 1)",
            [],
        )
        .expect("insert fixed_cost");
        let fixed_cost_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO fixed_cost_payments (fixed_cost_id, period_ym, paid_date_local, paid_ts_utc, tx_id)
             VALUES (?1, '2025-03', '2025-03-10', 1, 999)",
            [fixed_cost_id],
        )
        .expect("insert stale payment");

        let result = mark_fixed_cost_paid_with_conn(
            &mut conn,
            fixed_cost_id,
            Some("2025-03-10".to_string()),
        )
        .expect("paid");
        assert!(result.paid_date_local.is_some());
        let payment_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM fixed_cost_payments WHERE fixed_cost_id = ?1",
                [fixed_cost_id],
                |row| row.get(0),
            )
            .expect("count payments");
        assert_eq!(payment_count, 1);
        let tx_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE fixed_cost_id = ?1 AND source = 'fixed_cost' AND kind = 'OUT'",
                [fixed_cost_id],
                |row| row.get(0),
            )
            .expect("count tx");
        assert_eq!(tx_count, 1);
    }

    #[test]
    fn delete_transaction_removes_payment_row() {
        let mut conn = Connection::open_in_memory().expect("open in-memory");
        setup_fixed_cost_schema(&conn);
        conn.execute(
            "INSERT INTO fixed_costs (name, amount, is_active) VALUES ('Air', 100000, 1)",
            [],
        )
        .expect("insert fixed_cost");
        let fixed_cost_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO transactions (ts_utc, date_local, kind, amount, source, fixed_cost_id)
             VALUES (1, '2025-04-01', 'OUT', 100000, 'fixed_cost', ?1)",
            [fixed_cost_id],
        )
        .expect("insert tx");
        let tx_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO fixed_cost_payments (fixed_cost_id, period_ym, paid_date_local, paid_ts_utc, tx_id)
             VALUES (?1, '2025-04', '2025-04-01', 1, ?2)",
            params![fixed_cost_id, tx_id],
        )
        .expect("insert payment");

        delete_transaction_with_conn(&mut conn, tx_id).expect("delete tx");
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM fixed_cost_payments WHERE tx_id = ?1",
                [tx_id],
                |row| row.get(0),
            )
            .expect("count payment");
        assert_eq!(count, 0);
    }

    #[test]
    fn unpaid_is_idempotent() {
        let mut conn = Connection::open_in_memory().expect("open in-memory");
        setup_fixed_cost_schema(&conn);
        conn.execute(
            "INSERT INTO fixed_costs (name, amount, is_active) VALUES ('Wifi', 250000, 1)",
            [],
        )
        .expect("insert fixed_cost");
        let fixed_cost_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO fixed_cost_payments (fixed_cost_id, period_ym, paid_date_local, paid_ts_utc, tx_id)
             VALUES (?1, '2025-05', '2025-05-01', 1, NULL)",
            [fixed_cost_id],
        )
        .expect("insert payment");

        mark_fixed_cost_unpaid_with_conn(&mut conn, fixed_cost_id, None).expect("unpaid");
        mark_fixed_cost_unpaid_with_conn(&mut conn, fixed_cost_id, None).expect("unpaid again");
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM fixed_cost_payments WHERE fixed_cost_id = ?1",
                [fixed_cost_id],
                |row| row.get(0),
            )
            .expect("count payments");
        assert_eq!(count, 0);
    }
}
