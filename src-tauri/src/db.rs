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
          amount INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          min_floor INTEGER NOT NULL,
          max_ceil INTEGER NOT NULL,
          resilience_days INTEGER NOT NULL,
          burn_pool_ratio INTEGER NOT NULL,
          created_ts_utc INTEGER NOT NULL,
          updated_ts_utc INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS fixed_costs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          amount INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          paid_date_local TEXT,
          paid_ts_utc INTEGER
        );
        CREATE TABLE IF NOT EXISTS fixed_cost_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fixed_cost_id INTEGER NOT NULL,
          paid_date_local TEXT NOT NULL,
          paid_ts_utc INTEGER NOT NULL,
          FOREIGN KEY(fixed_cost_id) REFERENCES fixed_costs(id)
        );",
    )?;

    ensure_config_row(&conn)?;
    ensure_fixed_cost_columns(&conn)?;
    Ok(())
}

fn ensure_config_row(conn: &Connection) -> AnyResult<()> {
    let existing: i64 = conn.query_row("SELECT COUNT(*) FROM config", [], |row| row.get(0))?;
    if existing == 0 {
        conn.execute(
            "INSERT INTO config (id, min_floor, max_ceil, resilience_days, burn_pool_ratio, created_ts_utc, updated_ts_utc)
             VALUES (1, ?1, ?2, ?3, ?4, ?5, ?5)",
            params![0_i64, 100_000_i64, 30_i64, 50_i64, chrono::Utc::now().timestamp_millis()],
        )?;
    }
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
