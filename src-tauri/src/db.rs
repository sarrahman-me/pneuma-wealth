use std::{error::Error, fs, path::PathBuf};

use rusqlite::Connection;
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
        CREATE TABLE IF NOT EXISTS fixed_costs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          amount INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS fixed_cost_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fixed_cost_id INTEGER NOT NULL,
          paid_date_local TEXT NOT NULL,
          paid_ts_utc INTEGER NOT NULL,
          FOREIGN KEY(fixed_cost_id) REFERENCES fixed_costs(id)
        );",
    )?;
    Ok(())
}
