use chrono::{DateTime, Duration, Local, NaiveDate, Timelike};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::json;

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
    pub coach_mode: String,
    pub continuity_line: Option<String>,
    pub memory_reflection: Option<String>,
    pub debug_meta: Option<InsightDebugMeta>,
}

struct TimeContext {
    now_local: DateTime<Local>,
    time_bucket: String,
    is_new_day_first_open: bool,
}

struct CoachingMemoryEntry {
    date_local: String,
    mode: String,
    headline: String,
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

fn today_local_string(now_local: DateTime<Local>) -> String {
    now_local.format("%Y-%m-%d").to_string()
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

fn fetch_coach_mode(conn: &Connection) -> Result<String, String> {
    let mode: Option<String> = conn
        .query_row("SELECT coach_mode FROM config WHERE id = 1", [], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|err| err.to_string())?;
    Ok(mode.unwrap_or_else(|| "calm".to_string()))
}

fn build_time_context(
    now_local: DateTime<Local>,
    tx_count_today: i64,
    has_memory_today: bool,
) -> TimeContext {
    let hour = now_local.hour();
    let time_bucket = if (5..10).contains(&hour) {
        "morning"
    } else if (10..15).contains(&hour) {
        "midday"
    } else if (15..18).contains(&hour) {
        "afternoon"
    } else if (18..22).contains(&hour) {
        "evening"
    } else {
        "night"
    }
    .to_string();

    TimeContext {
        now_local,
        time_bucket,
        is_new_day_first_open: !has_memory_today && tx_count_today == 0,
    }
}

fn fetch_last_memory(conn: &Connection) -> Result<Option<CoachingMemoryEntry>, String> {
    conn.query_row(
        "SELECT date_local, mode, headline
         FROM coaching_memory
         ORDER BY ts_utc DESC
         LIMIT 1",
        [],
        |row| {
            Ok(CoachingMemoryEntry {
                date_local: row.get(0)?,
                mode: row.get(1)?,
                headline: row.get(2)?,
            })
        },
    )
    .optional()
    .map_err(|err| err.to_string())
}

fn fetch_memory_for_date(
    conn: &Connection,
    date_local: &str,
) -> Result<Option<CoachingMemoryEntry>, String> {
    conn.query_row(
        "SELECT date_local, mode, headline
         FROM coaching_memory
         WHERE date_local = ?1
         ORDER BY ts_utc DESC
         LIMIT 1",
        [date_local],
        |row| {
            Ok(CoachingMemoryEntry {
                date_local: row.get(0)?,
                mode: row.get(1)?,
                headline: row.get(2)?,
            })
        },
    )
    .optional()
    .map_err(|err| err.to_string())
}

fn build_continuity_line(
    time_context: &TimeContext,
    last_memory: Option<&CoachingMemoryEntry>,
    tone: &str,
) -> Option<String> {
    if let Some(memory) = last_memory {
        let today_local = today_local_string(time_context.now_local);
        if memory.date_local != today_local {
            if memory.mode == "alert" && tone == "calm" {
                return Some(
                    "Kemarin sempat ketat, hari ini kita mulai lagi pelan-pelan.".to_string(),
                );
            }
            if memory.mode == "calm" && tone == "alert" {
                return Some(
                    "Hari ini lebih ketat dari kemarin. Kita jaga pelan-pelan.".to_string(),
                );
            }
        }
    }

    if time_context.is_new_day_first_open {
        let line = match time_context.time_bucket.as_str() {
            "morning" => "Pagi ini kita mulai pelan-pelan.",
            "night" => "Hari ini hampir selesai, besok kita mulai lagi.",
            _ => "Hari ini kita mulai pelan-pelan.",
        };
        return Some(line.to_string());
    }

    None
}

fn build_memory_reflection(
    last_memory: Option<&CoachingMemoryEntry>,
    today_local: &str,
) -> Option<String> {
    let memory = last_memory?;
    if memory.date_local == today_local {
        return None;
    }
    Some(format!("Catatan terakhir: {}.", memory.headline))
}

pub fn compute_coaching_insight(conn: &Connection) -> Result<CoachingInsight, String> {
    compute_coaching_insight_with_time(conn, Local::now())
}

fn compute_coaching_insight_with_time(
    conn: &Connection,
    now_local: DateTime<Local>,
) -> Result<CoachingInsight, String> {
    let today_local = today_local_string(now_local);
    let summary = compute_pools_summary(conn)?;
    let tx_count_total: i64 = conn
        .query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
        .map_err(|err| err.to_string())?;
    let tx_count_today: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM transactions WHERE date_local = ?1",
            [today_local.as_str()],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;

    let (start_7d, end_7d) = date_range_last_7_days(&today_local)?;
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

    let period_ym = period_ym_from_date(&today_local);
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

    let coach_mode = fetch_coach_mode(conn)?;
    let last_memory = fetch_last_memory(conn)?;
    let has_memory_today = fetch_memory_for_date(conn, &today_local)?.is_some();
    let time_context = build_time_context(now_local, tx_count_today, has_memory_today);

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
    let mut insight = select_insight_rule(&inputs, &coach_mode, &time_context);
    insight.continuity_line =
        build_continuity_line(&time_context, last_memory.as_ref(), &insight.tone);
    insight.memory_reflection = build_memory_reflection(last_memory.as_ref(), &today_local);
    insight.coach_mode = coach_mode.clone();

    maybe_record_memory(
        conn,
        &inputs,
        &insight,
        &coach_mode,
        last_memory.as_ref(),
        &today_local,
    )?;

    Ok(insight)
}

fn select_insight_rule(
    inputs: &InsightInputs,
    coach_mode: &str,
    time_context: &TimeContext,
) -> CoachingInsight {
    let summary = &inputs.summary;
    let watchful = coach_mode == "watchful";

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
            tone: "calm".to_string(),
            coach_mode: coach_mode.to_string(),
            continuity_line: None,
            memory_reflection: None,
            debug_meta: Some(InsightDebugMeta {
                rule_id: "onboarding".to_string(),
                key_numbers: vec![inputs.tx_count_total, summary.recommended_spend_today],
            }),
        };
    }

    if summary.recommended_spend_today > 0 && summary.today_out > summary.recommended_spend_today {
        let next_step = if watchful {
            "Jika bisa, hentikan pengeluaran tambahan sampai besok.".to_string()
        } else {
            format!(
                "Hari ini aman kalau tahan belanja tambahan; besok reset dengan target {}.",
                rupiah(summary.recommended_spend_today)
            )
        };
        return CoachingInsight {
            status_title: format!(
                "Hari ini melewati batas {}.",
                rupiah(summary.recommended_spend_today)
            ),
            bullets: vec![
                format!("Pengeluaran hari ini {}.", rupiah(summary.today_out)),
                format!("Sisa hari ini {}.", rupiah(summary.today_remaining)),
            ],
            next_step,
            tone: "alert".to_string(),
            coach_mode: coach_mode.to_string(),
            continuity_line: None,
            memory_reflection: None,
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
            next_step: time_bucket_no_tx_next_step(time_context),
            tone: "calm".to_string(),
            coach_mode: coach_mode.to_string(),
            continuity_line: None,
            memory_reflection: None,
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
            coach_mode: coach_mode.to_string(),
            continuity_line: None,
            memory_reflection: None,
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
        let next_step = if watchful {
            format!(
                "Prioritaskan kebutuhan inti; jaga pengeluaran di bawah {}.",
                rupiah(summary.recommended_spend_today)
            )
        } else {
            format!(
                "Hari ini aman kalau jaga pengeluaran di bawah {}.",
                rupiah(summary.recommended_spend_today)
            )
        };
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
            next_step,
            tone: "alert".to_string(),
            coach_mode: coach_mode.to_string(),
            continuity_line: None,
            memory_reflection: None,
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
        let next_step = if watchful {
            format!(
                "Tekan belanja tambahan; sisa aman {} untuk hari ini.",
                rupiah(summary.today_remaining_clamped)
            )
        } else {
            format!(
                "Langkah kecil: kalau perlu belanja lagi, pilih yang paling penting di bawah {}.",
                rupiah(summary.today_remaining_clamped)
            )
        };
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
            next_step,
            tone: "calm".to_string(),
            coach_mode: coach_mode.to_string(),
            continuity_line: None,
            memory_reflection: None,
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
            tone: "calm".to_string(),
            coach_mode: coach_mode.to_string(),
            continuity_line: None,
            memory_reflection: None,
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
        tone: "calm".to_string(),
        coach_mode: coach_mode.to_string(),
        continuity_line: None,
        memory_reflection: None,
        debug_meta: Some(InsightDebugMeta {
            rule_id: "normal".to_string(),
            key_numbers: vec![summary.net_balance, summary.recommended_spend_today],
        }),
    }
}

fn time_bucket_no_tx_next_step(time_context: &TimeContext) -> String {
    match time_context.time_bucket.as_str() {
        "morning" => "Kalau ada satu catatan kecil pagi ini, ritmenya lebih terasa.".to_string(),
        "night" => "Hari ini sudah hampir selesai; besok kita mulai lagi.".to_string(),
        _ => "Langkah kecil: catat 1 transaksi pertama hari ini.".to_string(),
    }
}

fn maybe_record_memory(
    conn: &Connection,
    inputs: &InsightInputs,
    insight: &CoachingInsight,
    coach_mode: &str,
    last_memory: Option<&CoachingMemoryEntry>,
    today_local: &str,
) -> Result<(), String> {
    let existing_today = fetch_memory_for_date(conn, today_local)?;
    let tone_changed = last_memory
        .map(|entry| entry.mode != insight.tone)
        .unwrap_or(false);
    let overspent = insight
        .debug_meta
        .as_ref()
        .map(|meta| meta.rule_id == "overspent_today")
        .unwrap_or(false);
    let streak_milestone = inputs.days_with_tx_7d == 3 || inputs.days_with_tx_7d == 7;
    let first_tx_today = inputs.tx_count_today == 1;
    let event_significant = overspent || streak_milestone || first_tx_today || tone_changed;

    if existing_today.is_some() && !event_significant {
        return Ok(());
    }

    let tags = build_memory_tags(insight, streak_milestone, first_tx_today);
    let context_json = json!({
        "recommended_spend_today": inputs.summary.recommended_spend_today,
        "today_out": inputs.summary.today_out,
        "net_balance": inputs.summary.net_balance,
        "hari_ketahanan": inputs.summary.hari_ketahanan_stop_pemasukan,
        "unpaid_count": inputs.fixed_cost_unpaid_count_month,
        "mode": coach_mode,
    })
    .to_string();

    conn.execute(
        "INSERT INTO coaching_memory (ts_utc, date_local, mode, headline, tags, context_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            chrono::Utc::now().timestamp_millis(),
            today_local,
            insight.tone,
            insight.status_title,
            tags,
            context_json
        ],
    )
    .map_err(|err| err.to_string())?;

    trim_memory(conn, 200)?;
    Ok(())
}

fn build_memory_tags(
    insight: &CoachingInsight,
    streak_milestone: bool,
    first_tx_today: bool,
) -> String {
    let mut tags = Vec::new();
    if let Some(meta) = insight.debug_meta.as_ref() {
        tags.push(meta.rule_id.as_str());
    }
    if streak_milestone {
        tags.push("streak");
    }
    if first_tx_today {
        tags.push("first_tx");
    }
    if insight.tone == "alert" {
        tags.push("alert");
    }
    tags.join(",")
}

fn trim_memory(conn: &Connection, limit: i64) -> Result<(), String> {
    conn.execute(
        "DELETE FROM coaching_memory
         WHERE id NOT IN (
            SELECT id FROM coaching_memory
            ORDER BY ts_utc DESC
            LIMIT ?1
         )",
        [limit],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Datelike, TimeZone};
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
                coach_mode TEXT NOT NULL,
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
            );
            CREATE TABLE coaching_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts_utc INTEGER NOT NULL,
                date_local TEXT NOT NULL,
                mode TEXT NOT NULL,
                headline TEXT NOT NULL,
                tags TEXT NOT NULL,
                context_json TEXT
            );",
        )
        .expect("create schema");
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO config (id, min_floor, max_ceil, resilience_days, coach_mode, created_ts_utc, updated_ts_utc)
             VALUES (1, ?1, ?2, ?3, 'calm', ?4, ?4)",
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

    fn compute_for(conn: &Connection, date_local: &str, hour: u32) -> CoachingInsight {
        let date = NaiveDate::parse_from_str(date_local, "%Y-%m-%d").expect("date");
        let dt = Local
            .with_ymd_and_hms(date.year(), date.month(), date.day(), hour, 0, 0)
            .single()
            .expect("dt");
        compute_coaching_insight_with_time(conn, dt).expect("insight")
    }

    #[test]
    fn rule_onboarding_when_low_tx() {
        let conn = setup_conn(100, 1000, 10);
        insert_tx(&conn, "2025-05-10", "IN", 1000);

        let insight = compute_for(&conn, "2025-05-10", 9);
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

        let insight = compute_for(&conn, "2025-05-10", 12);
        assert_eq!(insight.debug_meta.unwrap().rule_id, "overspent_today");
        assert_eq!(insight.tone, "alert");
    }

    #[test]
    fn rule_no_tx_today() {
        let conn = setup_conn(100, 1000, 10);
        for day in 1..=5 {
            insert_tx(&conn, &format!("2025-05-0{}", day), "IN", 200);
        }

        let insight = compute_for(&conn, "2025-05-10", 8);
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

        let insight = compute_for(&conn, "2025-05-10", 14);
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

        let insight = compute_for(&conn, "2025-05-10", 16);
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

        let insight = compute_for(&conn, "2025-05-10", 16);
        assert_eq!(insight.debug_meta.unwrap().rule_id, "normal");
    }

    #[test]
    fn watchful_mode_changes_overspent_copy() {
        let conn = setup_conn(100, 1000, 10);
        conn.execute("UPDATE config SET coach_mode = 'watchful' WHERE id = 1", [])
            .expect("set mode");
        insert_tx(&conn, "2025-05-10", "IN", 2000);
        insert_tx(&conn, "2025-05-10", "OUT", 200);
        insert_tx(&conn, "2025-05-09", "IN", 200);
        insert_tx(&conn, "2025-05-08", "IN", 200);
        insert_tx(&conn, "2025-05-07", "IN", 200);
        insert_tx(&conn, "2025-05-06", "IN", 200);

        let insight = compute_for(&conn, "2025-05-10", 19);
        assert_eq!(insight.debug_meta.unwrap().rule_id, "overspent_today");
        assert!(insight.next_step.contains("hentikan pengeluaran"));
        assert_eq!(insight.coach_mode, "watchful");
    }

    #[test]
    fn memory_not_added_twice_without_event() {
        let conn = setup_conn(100, 1000, 10);
        insert_tx(&conn, "2025-05-10", "IN", 2000);
        insert_tx(&conn, "2025-05-10", "OUT", 10);
        insert_tx(&conn, "2025-05-09", "OUT", 10);
        insert_tx(&conn, "2025-05-08", "OUT", 10);
        insert_tx(&conn, "2025-05-07", "OUT", 10);
        insert_tx(&conn, "2025-05-06", "OUT", 10);

        let _ = compute_for(&conn, "2025-05-10", 11);
        let _ = compute_for(&conn, "2025-05-10", 12);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM coaching_memory", [], |row| row.get(0))
            .expect("count");
        assert_eq!(count, 1);
    }

    #[test]
    fn memory_added_on_overspent() {
        let conn = setup_conn(100, 1000, 10);
        insert_tx(&conn, "2025-05-10", "IN", 2000);
        insert_tx(&conn, "2025-05-10", "OUT", 200);
        insert_tx(&conn, "2025-05-09", "IN", 200);
        insert_tx(&conn, "2025-05-08", "IN", 200);
        insert_tx(&conn, "2025-05-07", "IN", 200);
        insert_tx(&conn, "2025-05-06", "IN", 200);

        let _ = compute_for(&conn, "2025-05-10", 13);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM coaching_memory", [], |row| row.get(0))
            .expect("count");
        assert_eq!(count, 1);
    }
}
