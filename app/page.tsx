"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { formatRupiah } from "./lib/format";
import CoachingInsightCard, {
  type CoachingInsight,
} from "./components/CoachingInsightCard";

type Transaction = {
  id: number;
  ts_utc: number;
  date_local: string;
  kind: "IN" | "OUT";
  amount: number;
  source: "manual" | "fixed_cost";
  fixed_cost_id: number | null;
  description: string | null;
};

type TodaySummary = {
  recommended_spend_today: number;
  today_out: number;
  today_remaining: number;
  today_remaining_clamped: number;
  overspent_today: boolean;
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatLocalTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Home() {
  const [activeKind, setActiveKind] = useState<"OUT" | "IN">("OUT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dateLocal, setDateLocal] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TodaySummary>({
    recommended_spend_today: 0,
    today_out: 0,
    today_remaining: 0,
    today_remaining_clamped: 0,
    overspent_today: false,
  });
  const [submitStatus, setSubmitStatus] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [insight, setInsight] = useState<CoachingInsight | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const todayString = useMemo(() => formatLocalDate(new Date()), []);

  const refreshTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      const data = await invoke<Transaction[]>("list_transactions_between", {
        start_date: todayString,
        end_date: todayString,
        limit: 50,
        offset: 0,
        kind: null,
      });
      setTransactions(data);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [todayString]);

  const refreshSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    try {
      const data = await invoke<TodaySummary>("get_today_summary");
      setSummary(data);
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  const refreshInsight = useCallback(async (showToast?: boolean) => {
    setIsLoadingInsight(true);
    try {
      const data = await invoke<CoachingInsight>("get_coaching_insight");
      setInsight(data);
      if (showToast) {
        setToastMessage(data.status_title);
      }
    } finally {
      setIsLoadingInsight(false);
    }
  }, []);

  useEffect(() => {
    setDateLocal(todayString);
    refreshTransactions();
    refreshSummary();
    refreshInsight();
  }, [todayString, refreshTransactions, refreshSummary, refreshInsight]);

  useEffect(() => {
    if (!submitStatus) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setSubmitStatus("");
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [submitStatus]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setToastMessage("");
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const handleSubmit = async () => {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }
    const resolvedDate = dateLocal || todayString;
    const isToday = resolvedDate === todayString;
    const willOverspend =
      isToday &&
      activeKind === "OUT" &&
      (summary.overspent_today ||
        summary.today_out + Math.trunc(parsedAmount) >
          summary.recommended_spend_today);
    if (willOverspend) {
      const confirmed = await confirm(
        "Kamu sudah melewati rekomendasi belanja hari ini. Tetap catat pengeluaran ini?",
        { title: "Lewat rekomendasi hari ini", kind: "warning" },
      );
      if (!confirmed) {
        return;
      }
    }
    setSubmitStatus("");
    setIsSubmitting(true);
    const command = activeKind === "OUT" ? "add_expense" : "add_income";
    try {
      await invoke(command, {
        amount: Math.trunc(parsedAmount),
        date_local: resolvedDate,
        description: description || null,
      });
      setAmount("");
      setDescription("");
      setSubmitStatus("Tercatat.");
      await Promise.all([
        refreshTransactions(),
        refreshSummary(),
        refreshInsight(true),
      ]);
      if (amountInputRef.current) {
        amountInputRef.current.focus();
        amountInputRef.current.select();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    const confirmed = await confirm(
      "Hapus transaksi ini? Tindakan ini tidak bisa dibatalkan.",
      { title: "Konfirmasi", kind: "warning" },
    );
    if (!confirmed) {
      return;
    }
    setDeleteMessage("");
    setDeleteError("");
    setDeletingId(tx.id);
    try {
      await invoke("delete_transaction", { transaction_id: tx.id });
      await Promise.all([refreshTransactions(), refreshSummary()]);
      setDeleteMessage("Transaksi berhasil dihapus.");
    } catch (err) {
      console.error("delete_transaction failed", err);
      setDeleteError(`Gagal menghapus transaksi: ${String(err)}`);
    } finally {
      setDeletingId(null);
    }
  };

  const showSoftWarn =
    summary.recommended_spend_today > 0 &&
    summary.today_out >= summary.recommended_spend_today * 0.8 &&
    !summary.overspent_today;

  return (
    <main>
      <h1>PNEUMA</h1>
      <p>
        Pelacak keuangan lokal untuk mencatat transaksi dan ringkasan dana
        harian.
      </p>

      <section>
        {isLoadingInsight && !insight && (
          <div className="insight-card">
            <span className="skeleton-line" />
          </div>
        )}
        {insight && <CoachingInsightCard insight={insight} />}
      </section>

      <section className="home-hero">
        <div className="hero-grid">
          <div className="hero-card">
            <div className="hero-label">Rekomendasi Belanja Hari Ini</div>
            <div className="hero-value">
              {isLoadingSummary ? (
                <span className="skeleton-line" />
              ) : (
                formatRupiah(summary.recommended_spend_today)
              )}
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-label">Sisa Hari Ini</div>
            <div className="hero-value">
              {isLoadingSummary ? (
                <span className="skeleton-line" />
              ) : (
                formatRupiah(summary.today_remaining_clamped)
              )}
            </div>
          </div>
          {summary.overspent_today && (
            <div className="hero-card hero-warn">
              <div className="hero-label">Status Hari Ini</div>
              <div className="hero-value">Melebihi Anggaran</div>
            </div>
          )}
        </div>
        {summary.overspent_today && (
          <div className="soft-warn">
            Hari ini melewati rekomendasi. Tidak apa-apa—yang penting tercatat.
            Besok kita atur lagi.
          </div>
        )}
        {showSoftWarn && (
          <div className="soft-warn">
            Mendekati batas hari ini. Kalau masih perlu belanja, tetap catat ya
            — biar kamu tetap sadar ritmenya.
          </div>
        )}
      </section>

      <section className="quick-entry">
        <div className="segmented">
          <button
            type="button"
            className={activeKind === "OUT" ? "active" : ""}
            onClick={() => setActiveKind("OUT")}
          >
            Pengeluaran
          </button>
          <button
            type="button"
            className={activeKind === "IN" ? "active" : ""}
            onClick={() => setActiveKind("IN")}
          >
            Pemasukan
          </button>
        </div>
        <div className="quick-entry-body">
          <input
            className="amount-input"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
            inputMode="numeric"
            ref={amountInputRef}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSubmit();
              }
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !Number.isFinite(Number(amount)) ||
              Number(amount) <= 0
            }
          >
            {isSubmitting
              ? "Menyimpan..."
              : activeKind === "OUT"
                ? "Catat Pengeluaran"
                : "Catat Pemasukan"}
          </button>
        </div>
        <input
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Keterangan (opsional)"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSubmit();
            }
          }}
        />
        <details className="inline-details">
          <summary>Ubah tanggal</summary>
          <div className="inline-details-body">
            <label htmlFor="date-local">Tanggal (opsional)</label>
            <input
              id="date-local"
              type="date"
              value={dateLocal}
              onChange={(event) => setDateLocal(event.target.value)}
            />
          </div>
        </details>
        {submitStatus && <span className="pill pill-muted">{submitStatus}</span>}
        {toastMessage && <div className="insight-toast">{toastMessage}</div>}
      </section>

      <section>
        <div className="tx-header">
          <h2>Transaksi Hari Ini</h2>
          <Link className="link-button" href="/history">
            Lihat semua riwayat →
          </Link>
        </div>
        {deleteMessage && <span className="pill pill-muted">{deleteMessage}</span>}
        {deleteError && <div className="metric-error">{deleteError}</div>}
        <div className="tx-list">
          {isLoadingTransactions && transactions.length === 0 && (
            <div className="skeleton">
              <span className="skeleton-line" />
              <span className="skeleton-line" />
              <span className="skeleton-line" />
            </div>
          )}
          {!isLoadingTransactions && transactions.length === 0 && (
            <div className="empty-state">
              <div className="empty-title">Belum ada transaksi hari ini.</div>
              <div className="empty-desc">
                Catat pengeluaran pertama kamu biar batas hari ini lebih terasa.
              </div>
            </div>
          )}
          {transactions.map((tx) => (
            <div className="tx-row" key={tx.id}>
              <div className="tx-main">
                <div className="tx-title">
                  <span className={`pill ${tx.kind === "OUT" ? "pill-out" : "pill-in"}`}>
                    {tx.kind === "OUT" ? "Keluar" : "Masuk"}
                  </span>
                  <span className="tx-amount">{formatRupiah(tx.amount)}</span>
                </div>
                {tx.description && <div className="tx-desc">{tx.description}</div>}
                <div className="tx-meta">
                  <span>{formatLocalTime(tx.ts_utc)}</span>
                  <span className="pill pill-muted">
                    {tx.source === "fixed_cost" ? "Biaya Tetap" : "Manual"}
                  </span>
                </div>
              </div>
              <button
                className="link-button"
                type="button"
                onClick={() => handleDeleteTransaction(tx)}
                disabled={deletingId === tx.id}
              >
                {deletingId === tx.id ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
