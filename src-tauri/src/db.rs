use std::{error::Error, fs, path::PathBuf};

use rusqlite::{params, Connection};
use tauri::{AppHandle, Manager};

type AnyResult<T> = Result<T, Box<dyn Error>>;

fn db_path(app: &AppHandle) -> AnyResult<PathBuf> {
    let data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&data_dir)?;
    Ok(data_dir.join("pneuma.sqlite"))
}

pub fn open_connection(app: &AppHandle) -> AnyResult<Connection> {
    let path = db_path(app)?;
    Ok(Connection::open(path)?)
}

pub fn init_db(app: &AppHandle) -> AnyResult<()> {
    let conn = open_connection(app)?;
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts_utc INTEGER NOT NULL,
          date_local TEXT NOT NULL,
          kind TEXT NOT NULL,
          amount INTEGER NOT NULL,
          source TEXT NOT NULL DEFAULT 'manual',
          fixed_cost_id INTEGER
        );
        CREATE TABLE IF NOT EXISTS config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          min_floor INTEGER NOT NULL,
          max_ceil INTEGER NOT NULL,
          resilience_days INTEGER NOT NULL,
          created_ts_utc INTEGER NOT NULL,
          updated_ts_utc INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS fixed_costs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          amount INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          paid_date_local TEXT,
          paid_ts_utc INTEGER,
          paid_tx_id INTEGER
        );
        CREATE TABLE IF NOT EXISTS fixed_cost_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fixed_cost_id INTEGER NOT NULL,
          period_ym TEXT NOT NULL,
          paid_date_local TEXT,
          paid_ts_utc INTEGER,
          tx_id INTEGER,
          FOREIGN KEY(fixed_cost_id) REFERENCES fixed_costs(id)
        );",
    )?;

    ensure_config_row(&conn)?;
    ensure_transactions_columns(&conn)?;
    ensure_fixed_cost_columns(&conn)?;
    ensure_fixed_cost_payments_columns(&conn)?;
    ensure_fixed_cost_payments_index(&conn)?;
    migrate_legacy_fixed_cost_payments(&conn)?;
    Ok(())
}

fn ensure_config_row(conn: &Connection) -> AnyResult<()> {
    let existing: i64 = conn.query_row("SELECT COUNT(*) FROM config", [], |row| row.get(0))?;
    if existing == 0 {
        let now = chrono::Utc::now().timestamp_millis();
        if table_has_column(conn, "config", "burn_pool_ratio")? {
            conn.execute(
                "INSERT INTO config (id, min_floor, max_ceil, resilience_days, burn_pool_ratio, created_ts_utc, updated_ts_utc)
                 VALUES (1, ?1, ?2, ?3, ?4, ?5, ?5)",
                params![0_i64, 100_000_i64, 30_i64, 50_i64, now],
            )?;
        } else {
            conn.execute(
                "INSERT INTO config (id, min_floor, max_ceil, resilience_days, created_ts_utc, updated_ts_utc)
                 VALUES (1, ?1, ?2, ?3, ?4, ?4)",
                params![0_i64, 100_000_i64, 30_i64, now],
            )?;
        }
    }
    Ok(())
}

fn ensure_transactions_columns(conn: &Connection) -> AnyResult<()> {
    if !table_has_column(conn, "transactions", "source")? {
        conn.execute(
            "ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'",
            [],
        )?;
    }
    if !table_has_column(conn, "transactions", "fixed_cost_id")? {
        conn.execute(
            "ALTER TABLE transactions ADD COLUMN fixed_cost_id INTEGER",
            [],
        )?;
    }
    conn.execute(
        "UPDATE transactions SET source = 'manual' WHERE source IS NULL OR source = ''",
        [],
    )?;
    Ok(())
}

fn ensure_fixed_cost_columns(conn: &Connection) -> AnyResult<()> {
    if !table_has_column(conn, "fixed_costs", "paid_date_local")? {
        conn.execute(
            "ALTER TABLE fixed_costs ADD COLUMN paid_date_local TEXT",
            [],
        )?;
    }
    if !table_has_column(conn, "fixed_costs", "paid_ts_utc")? {
        conn.execute("ALTER TABLE fixed_costs ADD COLUMN paid_ts_utc INTEGER", [])?;
    }
    if !table_has_column(conn, "fixed_costs", "paid_tx_id")? {
        conn.execute("ALTER TABLE fixed_costs ADD COLUMN paid_tx_id INTEGER", [])?;
    }
    Ok(())
}

fn ensure_fixed_cost_payments_columns(conn: &Connection) -> AnyResult<()> {
    if !table_has_column(conn, "fixed_cost_payments", "period_ym")? {
        conn.execute(
            "ALTER TABLE fixed_cost_payments ADD COLUMN period_ym TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }
    if !table_has_column(conn, "fixed_cost_payments", "tx_id")? {
        conn.execute(
            "ALTER TABLE fixed_cost_payments ADD COLUMN tx_id INTEGER",
            [],
        )?;
    }
    conn.execute(
        "UPDATE fixed_cost_payments SET period_ym = substr(paid_date_local, 1, 7)
         WHERE (period_ym IS NULL OR period_ym = '') AND paid_date_local IS NOT NULL",
        [],
    )?;
    Ok(())
}

fn ensure_fixed_cost_payments_index(conn: &Connection) -> AnyResult<()> {
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_fixed_cost_payments_period
         ON fixed_cost_payments(fixed_cost_id, period_ym)",
        [],
    )?;
    Ok(())
}

fn migrate_legacy_fixed_cost_payments(conn: &Connection) -> AnyResult<()> {
    if table_has_column(conn, "fixed_costs", "paid_date_local")? {
        conn.execute(
            "INSERT OR IGNORE INTO fixed_cost_payments (fixed_cost_id, period_ym, paid_date_local, paid_ts_utc, tx_id)
             SELECT id, substr(paid_date_local, 1, 7), paid_date_local, paid_ts_utc, paid_tx_id
             FROM fixed_costs
             WHERE paid_date_local IS NOT NULL",
            [],
        )?;
    }
    conn.execute(
        "UPDATE transactions
         SET source = 'fixed_cost', fixed_cost_id = (
           SELECT fixed_cost_id FROM fixed_cost_payments WHERE tx_id = transactions.id
         )
         WHERE id IN (SELECT tx_id FROM fixed_cost_payments WHERE tx_id IS NOT NULL)
           AND (source IS NULL OR source = 'manual' OR fixed_cost_id IS NULL)",
        [],
    )?;
    Ok(())
}

fn table_has_column(conn: &Connection, table: &str, column: &str) -> AnyResult<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(true);
        }
    }
    Ok(false)
}
