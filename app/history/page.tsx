"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { formatRupiah } from "../lib/format";

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

const subtractDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

export default function HistoryPage() {
  const [rangeDays, setRangeDays] = useState<0 | 7 | 30>(30);
  const [kindFilter, setKindFilter] = useState<"all" | "IN" | "OUT">("all");
  const [items, setItems] = useState<Transaction[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const todayString = useMemo(() => formatLocalDate(new Date()), []);
  const startDate = useMemo(() => {
    if (rangeDays === 0) {
      return todayString;
    }
    return formatLocalDate(subtractDays(rangeDays - 1));
  }, [rangeDays, todayString]);

  const fetchTransactions = useCallback(
    async (nextOffset: number, reset: boolean) => {
      setLoading(true);
      setError("");
      try {
        const data = await invoke<Transaction[]>("list_transactions_between", {
          start_date: startDate,
          end_date: todayString,
          limit: 30,
          offset: nextOffset,
          kind: kindFilter === "all" ? null : kindFilter,
        });
        setItems((prev) => (reset ? data : [...prev, ...data]));
        setHasMore(data.length === 30);
        setOffset(nextOffset + data.length);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [startDate, todayString, kindFilter],
  );

  useEffect(() => {
    setOffset(0);
    fetchTransactions(0, true);
  }, [fetchTransactions]);

  const handleDelete = async (tx: Transaction) => {
    const confirmed = await confirm(
      "Hapus transaksi ini? Tindakan ini tidak bisa dibatalkan.",
      { title: "Konfirmasi", kind: "warning" },
    );
    if (!confirmed) {
      return;
    }
    setStatus("");
    setDeletingId(tx.id);
    try {
      await invoke("delete_transaction", { transaction_id: tx.id });
      setStatus("Transaksi berhasil dihapus.");
      setOffset(0);
      fetchTransactions(0, true);
    } catch (err) {
      setError(`Gagal menghapus transaksi: ${String(err)}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main>
      <h1>Riwayat Transaksi</h1>
      <p>Telusuri transaksi berdasarkan rentang tanggal dan jenis.</p>

      <section>
        <div className="history-toolbar">
          <div className="segmented">
            <button
              type="button"
              className={rangeDays === 0 ? "active" : ""}
              onClick={() => setRangeDays(0)}
            >
              Hari ini
            </button>
            <button
              type="button"
              className={rangeDays === 7 ? "active" : ""}
              onClick={() => setRangeDays(7)}
            >
              7 hari
            </button>
            <button
              type="button"
              className={rangeDays === 30 ? "active" : ""}
              onClick={() => setRangeDays(30)}
            >
              30 hari
            </button>
          </div>
          <div className="filter-row">
            <label htmlFor="kind-filter">Jenis</label>
            <select
              id="kind-filter"
              value={kindFilter}
              onChange={(event) =>
                setKindFilter(event.target.value as "all" | "IN" | "OUT")
              }
            >
              <option value="all">Semua</option>
              <option value="OUT">Pengeluaran</option>
              <option value="IN">Pemasukan</option>
            </select>
          </div>
        </div>

        {status && <span className="pill pill-muted">{status}</span>}
        {error && <div className="metric-error">{error}</div>}

        <div className="tx-list">
          {loading && items.length === 0 && (
            <div className="skeleton">
              <span className="skeleton-line" />
              <span className="skeleton-line" />
              <span className="skeleton-line" />
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="empty-state">
              <div className="empty-title">Kosong untuk rentang ini.</div>
              <div className="empty-desc">
                Coba ganti ke 30 hari atau pilih “Semua” untuk melihat lebih banyak.
              </div>
            </div>
          )}
          {items.map((tx) => (
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
                  <span>{tx.date_local}</span>
                  <span>{formatLocalTime(tx.ts_utc)}</span>
                  <span className="pill pill-muted">
                    {tx.source === "fixed_cost" ? "Biaya Tetap" : "Manual"}
                  </span>
                </div>
              </div>
              <button
                className="link-button"
                type="button"
                onClick={() => handleDelete(tx)}
                disabled={deletingId === tx.id}
              >
                {deletingId === tx.id ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          ))}
        </div>

        <div className="history-footer">
          <button
            type="button"
            className="secondary"
            onClick={() => fetchTransactions(offset, false)}
            disabled={!hasMore || loading}
          >
            {loading ? "Memuat..." : hasMore ? "Muat lebih banyak" : "Tidak ada lagi"}
          </button>
        </div>
      </section>
    </main>
  );
}
