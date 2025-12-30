use chrono::{Duration, Local, NaiveDate};
use rusqlite::{params, Connection};
use serde::Serialize;

use crate::{compute_pools_summary, PoolsSummary};

#[derive(Serialize)]
pub struct InsightDebugMeta {
    pub rule_id: String,
    pub key_numbers: Vec<i64>,
}

#[derive(Serialize)]
pub struct CoachingInsight {
    pub status_title: String,
    pub bullets: Vec<String>,
    pub next_step: String,
    pub tone: String,
    pub debug_meta: Option<InsightDebugMeta>,
}

struct InsightInputs {
    summary: PoolsSummary,
    tx_count_total: i64,
    tx_count_today: i64,
    total_out_7d: i64,
    avg_out_7d: i64,
    days_with_tx_7d: i64,
    fixed_cost_unpaid_count_month: i64,
    fixed_cost_unpaid_amount_month: i64,
}

fn rupiah(value: i64) -> String {
    format!("Rp{}", value)
}

fn today_local_string() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn period_ym_from_date(date_local: &str) -> String {
    date_local.get(0..7).unwrap_or(date_local).to_string()
}

fn date_range_last_7_days(today_local: &str) -> Result<(String, String), String> {
    let today = NaiveDate::parse_from_str(today_local, "%Y-%m-%d")
        .map_err(|err| format!("invalid date_local: {}", err))?;
    let start = today
        .checked_sub_signed(Duration::days(6))
        .ok_or_else(|| "date underflow".to_string())?;
    Ok((
        start.format("%Y-%m-%d").to_string(),
        today.format("%Y-%m-%d").to_string(),
    ))
}

pub fn compute_coaching_insight(conn: &Connection) -> Result<CoachingInsight, String> {
    let today_local = today_local_string();
    compute_coaching_insight_for_date(conn, &today_local)
}

fn compute_coaching_insight_for_date(
    conn: &Connection,
    today_local: &str,
) -> Result<CoachingInsight, String> {
    let summary = compute_pools_summary(conn)?;
    let tx_count_total: i64 = conn
        .query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    let tx_count_today: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM transactions WHERE date_local = ?1",
            [today_local],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;

    let (start_7d, end_7d) = date_range_last_7_days(today_local)?;
    let total_out_7d: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE kind = 'OUT' AND date_local >= ?1 AND date_local <= ?2",
            params![start_7d, end_7d],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    let avg_out_7d = total_out_7d / 7;
    let days_with_tx_7d: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT date_local) FROM transactions
             WHERE date_local >= ?1 AND date_local <= ?2",
            params![start_7d, end_7d],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;

    let period_ym = period_ym_from_date(today_local);
    let fixed_cost_unpaid_count_month: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM fixed_costs fc
             LEFT JOIN fixed_cost_payments p
               ON p.fixed_cost_id = fc.id AND p.period_ym = ?1
             WHERE fc.is_active = 1 AND p.tx_id IS NULL",
            [period_ym.as_str()],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    let fixed_cost_unpaid_amount_month: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(fc.amount), 0) FROM fixed_costs fc
             LEFT JOIN fixed_cost_payments p
               ON p.fixed_cost_id = fc.id AND p.period_ym = ?1
             WHERE fc.is_active = 1 AND p.tx_id IS NULL",
            [period_ym.as_str()],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;

    let inputs = InsightInputs {
        summary,
        tx_count_total,
        tx_count_today,
        total_out_7d,
        avg_out_7d,
        days_with_tx_7d,
        fixed_cost_unpaid_count_month,
        fixed_cost_unpaid_amount_month,
    };

    Ok(select_insight_rule(&inputs))
}

fn select_insight_rule(inputs: &InsightInputs) -> CoachingInsight {
    let summary = &inputs.summary;

    if inputs.tx_count_total < 5 {
        return CoachingInsight {
            status_title: format!(
                "Baru {} transaksi, pelan-pelan bangun ritme.",
                inputs.tx_count_total
            ),
            bullets: vec![
                format!(
                    "Total catatan saat ini {} transaksi.",
                    inputs.tx_count_total
                ),
                format!(
                    "Rekomendasi hari ini {}.",
                    rupiah(summary.recommended_spend_today)
                ),
            ],
            next_step: "Langkah kecil: catat 1 transaksi hari ini agar ritme terasa.".to_string(),
            tone: "neutral".to_string(),
            debug_meta: Some(InsightDebugMeta {
                rule_id: "onboarding".to_string(),
                key_numbers: vec![inputs.tx_count_total, summary.recommended_spend_today],
            }),
        };
    }

    if summary.recommended_spend_today > 0 && summary.today_out > summary.recommended_spend_today {
        return CoachingInsight {
            status_title: format!(
                "Hari ini melewati batas {}.",
                rupiah(summary.recommended_spend_today)
            ),
            bullets: vec![
                format!("Pengeluaran hari ini {}.", rupiah(summary.today_out)),
                format!("Sisa hari ini {}.", rupiah(summary.today_remaining)),
            ],
            next_step: format!(
                "Hari ini aman kalau tahan belanja tambahan; besok reset dengan target {}.",
                rupiah(summary.recommended_spend_today)
            ),
            tone: "warn".to_string(),
            debug_meta: Some(InsightDebugMeta {
                rule_id: "overspent_today".to_string(),
                key_numbers: vec![
                    summary.today_out,
                    summary.recommended_spend_today,
                    summary.today_remaining,
                ],
            }),
        };
    }

    if inputs.tx_count_today == 0 {
        return CoachingInsight {
            status_title: "Belum ada catatan hari ini, 0 transaksi.".to_string(),
            bullets: vec![
                format!(
                    "Rekomendasi hari ini {}.",
                    rupiah(summary.recommended_spend_today)
                ),
                format!("Pengeluaran hari ini {}.", rupiah(summary.today_out)),
            ],
            next_step: "Langkah kecil: catat 1 transaksi pertama hari ini.".to_string(),
            tone: "neutral".to_string(),
            debug_meta: Some(InsightDebugMeta {
                rule_id: "no_tx_today".to_string(),
                key_numbers: vec![
                    inputs.tx_count_today,
                    summary.recommended_spend_today,
                    summary.today_out,
                ],
            }),
        };
    }

    if inputs.fixed_cost_unpaid_count_month > 0 {
        return CoachingInsight {
            status_title: format!(
                "Ada {} biaya tetap belum lunas bulan ini.",
                inputs.fixed_cost_unpaid_count_month
            ),
            bullets: vec![
                format!(
                    "Total belum lunas {}.",
                    rupiah(inputs.fixed_cost_unpaid_amount_month)
                ),
                format!("Saldo bersih {}.", rupiah(summary.net_balance)),
            ],
            next_step: "Langkah kecil: pilih 1 biaya tetap yang paling dekat jatuh tempo."
                .to_string(),
            tone: "calm".to_string(),
            debug_meta: Some(InsightDebugMeta {
                rule_id: "fixed_cost_unpaid".to_string(),
                key_numbers: vec![
                    inputs.fixed_cost_unpaid_count_month,
                    inputs.fixed_cost_unpaid_amount_month,
                    summary.net_balance,
                ],
            }),
        };
    }

    if summary.target_penyangga > 0
        && summary.net_balance < summary.target_penyangga
        && summary.hari_ketahanan_stop_pemasukan <= 7
    {
        return CoachingInsight {
            status_title: format!(
                "Penyangga belum aman, ketahanan {} hari.",
                summary.hari_ketahanan_stop_pemasukan
            ),
            bullets: vec![
                format!(
                    "Saldo bersih {} vs target {}.",
                    rupiah(summary.net_balance),
                    rupiah(summary.target_penyangga)
                ),
                format!(
                    "Rekomendasi hari ini {}.",
                    rupiah(summary.recommended_spend_today)
                ),
            ],
            next_step: format!(
                "Hari ini aman kalau jaga pengeluaran di bawah {}.",
                rupiah(summary.recommended_spend_today)
            ),
            tone: "warn".to_string(),
            debug_meta: Some(InsightDebugMeta {
                rule_id: "low_buffer".to_string(),
                key_numbers: vec![
                    summary.net_balance,
                    summary.target_penyangga,
                    summary.hari_ketahanan_stop_pemasukan,
                ],
            }),
        };
    }

    if summary.recommended_spend_today > 0
        && summary.today_out >= (summary.recommended_spend_today * 8) / 10
    {
        return CoachingInsight {
            status_title: format!(
                "Hampir menyentuh batas {}.",
                rupiah(summary.recommended_spend_today)
            ),
            bullets: vec![
                format!("Sudah terpakai {} hari ini.", rupiah(summary.today_out)),
                format!(
                    "Sisa {} untuk hari ini.",
                    rupiah(summary.today_remaining_clamped)
                ),
            ],
            next_step: format!(
                "Langkah kecil: kalau perlu belanja lagi, pilih yang paling penting di bawah {}.",
                rupiah(summary.today_remaining_clamped)
            ),
            tone: "calm".to_string(),
            debug_meta: Some(InsightDebugMeta {
                rule_id: "near_limit".to_string(),
                key_numbers: vec![
                    summary.today_out,
                    summary.recommended_spend_today,
                    summary.today_remaining_clamped,
                ],
            }),
        };
    }

    if inputs.days_with_tx_7d >= 6 {
        return CoachingInsight {
            status_title: format!("Kamu konsisten {} dari 7 hari.", inputs.days_with_tx_7d),
            bullets: vec![
                format!("Total pengeluaran 7 hari {}.", rupiah(inputs.total_out_7d)),
                format!(
                    "Rata-rata pengeluaran 7 hari {} per hari.",
                    rupiah(inputs.avg_out_7d)
                ),
                format!("Total transaksi tercatat {}.", inputs.tx_count_total),
            ],
            next_step: "Pertahankan: cukup 1 catatan per hari selama 2 hari lagi.".to_string(),
            tone: "praise".to_string(),
            debug_meta: Some(InsightDebugMeta {
                rule_id: "consistency_praise".to_string(),
                key_numbers: vec![inputs.days_with_tx_7d, inputs.avg_out_7d],
            }),
        };
    }

    CoachingInsight {
        status_title: format!(
            "Kondisi hari ini cukup stabil, saldo {}.",
            rupiah(summary.net_balance)
        ),
        bullets: vec![
            format!(
                "Dana fleksibel {} di atas penyangga.",
                rupiah(summary.dana_fleksibel)
            ),
            format!(
                "Rekomendasi hari ini {}.",
                rupiah(summary.recommended_spend_today)
            ),
        ],
        next_step: format!(
            "Langkah kecil: belanja aman jika tetap di bawah {}.",
            rupiah(summary.recommended_spend_today)
        ),
        tone: "neutral".to_string(),
        debug_meta: Some(InsightDebugMeta {
            rule_id: "normal".to_string(),
            key_numbers: vec![summary.net_balance, summary.recommended_spend_today],
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_conn(min_floor: i64, max_ceil: i64, resilience_days: i64) -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory");
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
            CREATE TABLE config (
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
            );
            CREATE TABLE fixed_costs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                amount INTEGER NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                paid_date_local TEXT,
                paid_ts_utc INTEGER,
                paid_tx_id INTEGER
            );
            CREATE TABLE fixed_cost_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fixed_cost_id INTEGER NOT NULL,
                period_ym TEXT NOT NULL,
                paid_date_local TEXT,
                paid_ts_utc INTEGER,
                tx_id INTEGER,
                FOREIGN KEY(fixed_cost_id) REFERENCES fixed_costs(id)
            );",
        )
        .expect("create schema");
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO config (id, min_floor, max_ceil, resilience_days, created_ts_utc, updated_ts_utc)
             VALUES (1, ?1, ?2, ?3, ?4, ?4)",
            params![min_floor, max_ceil, resilience_days, now],
        )
        .expect("insert config");
        conn
    }

    fn insert_tx(conn: &Connection, date_local: &str, kind: &str, amount: i64) {
        conn.execute(
            "INSERT INTO transactions (ts_utc, date_local, kind, amount, source, fixed_cost_id)
             VALUES (?1, ?2, ?3, ?4, 'manual', NULL)",
            params![
                chrono::Utc::now().timestamp_millis(),
                date_local,
                kind,
                amount
            ],
        )
        .expect("insert tx");
    }

    fn insert_fixed_cost(conn: &Connection, name: &str, amount: i64) -> i64 {
        conn.execute(
            "INSERT INTO fixed_costs (name, amount, is_active) VALUES (?1, ?2, 1)",
            params![name, amount],
        )
        .expect("insert fixed_cost");
        conn.last_insert_rowid()
    }

    #[test]
    fn rule_onboarding_when_low_tx() {
        let conn = setup_conn(100, 1000, 10);
        insert_tx(&conn, "2025-05-10", "IN", 1000);

        let insight = compute_coaching_insight_for_date(&conn, "2025-05-10").expect("insight");
        assert_eq!(insight.debug_meta.unwrap().rule_id, "onboarding");
    }

    #[test]
    fn rule_overspent_today() {
        let conn = setup_conn(100, 1000, 10);
        insert_tx(&conn, "2025-05-10", "IN", 2000);
        insert_tx(&conn, "2025-05-10", "OUT", 200);
        insert_tx(&conn, "2025-05-09", "IN", 200);
        insert_tx(&conn, "2025-05-08", "IN", 200);
        insert_tx(&conn, "2025-05-07", "IN", 200);
        insert_tx(&conn, "2025-05-06", "IN", 200);

        let insight = compute_coaching_insight_for_date(&conn, "2025-05-10").expect("insight");
        assert_eq!(insight.debug_meta.unwrap().rule_id, "overspent_today");
    }

    #[test]
    fn rule_no_tx_today() {
        let conn = setup_conn(100, 1000, 10);
        for day in 1..=5 {
            insert_tx(&conn, &format!("2025-05-0{}", day), "IN", 200);
        }

        let insight = compute_coaching_insight_for_date(&conn, "2025-05-10").expect("insight");
        assert_eq!(insight.debug_meta.unwrap().rule_id, "no_tx_today");
    }

    #[test]
    fn rule_fixed_cost_unpaid() {
        let conn = setup_conn(100, 1000, 10);
        for day in 1..=5 {
            insert_tx(&conn, &format!("2025-05-0{}", day), "IN", 200);
        }
        insert_tx(&conn, "2025-05-10", "OUT", 10);
        insert_fixed_cost(&conn, "Sewa", 500);

        let insight = compute_coaching_insight_for_date(&conn, "2025-05-10").expect("insight");
        assert_eq!(insight.debug_meta.unwrap().rule_id, "fixed_cost_unpaid");
    }

    #[test]
    fn rule_consistency_praise() {
        let conn = setup_conn(100, 1000, 10);
        insert_tx(&conn, "2025-05-10", "IN", 2000);
        insert_tx(&conn, "2025-05-10", "OUT", 10);
        insert_tx(&conn, "2025-05-09", "OUT", 10);
        insert_tx(&conn, "2025-05-08", "OUT", 10);
        insert_tx(&conn, "2025-05-07", "OUT", 10);
        insert_tx(&conn, "2025-05-06", "OUT", 10);
        insert_tx(&conn, "2025-05-05", "OUT", 10);

        let insight = compute_coaching_insight_for_date(&conn, "2025-05-10").expect("insight");
        assert_eq!(insight.debug_meta.unwrap().rule_id, "consistency_praise");
    }

    #[test]
    fn rule_normal() {
        let conn = setup_conn(100, 1000, 10);
        insert_tx(&conn, "2025-05-10", "IN", 2000);
        insert_tx(&conn, "2025-05-10", "OUT", 10);
        insert_tx(&conn, "2025-05-09", "OUT", 10);
        insert_tx(&conn, "2025-05-08", "OUT", 10);
        insert_tx(&conn, "2025-05-07", "OUT", 10);
        insert_tx(&conn, "2025-05-06", "OUT", 10);

        let insight = compute_coaching_insight_for_date(&conn, "2025-05-10").expect("insight");
        assert_eq!(insight.debug_meta.unwrap().rule_id, "normal");
    }
}
