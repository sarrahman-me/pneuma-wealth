"use client";

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { formatRupiah } from "./lib/format";

type Transaction = {
  id: number;
  ts_utc: number;
  date_local: string;
  kind: "IN" | "OUT";
  amount: number;
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

export default function Home() {
  const [inAmount, setInAmount] = useState("");
  const [outAmount, setOutAmount] = useState("");
  const [dateLocal, setDateLocal] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TodaySummary>({
    recommended_spend_today: 0,
    today_out: 0,
    today_remaining: 0,
    today_remaining_clamped: 0,
    overspent_today: false,
  });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const todayString = useMemo(() => formatLocalDate(new Date()), []);

  const refreshTransactions = async () => {
    const data = await invoke<Transaction[]>("list_recent_transactions", {
      limit: 20,
    });
    setTransactions(data);
  };

  const refreshSummary = async () => {
    const data = await invoke<TodaySummary>("get_today_summary");
    setSummary(data);
  };

  useEffect(() => {
    setDateLocal(todayString);
    refreshTransactions();
    refreshSummary();
  }, [todayString]);

  const handleAddIncome = async () => {
    const amount = Number(inAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    await invoke("add_income", {
      amount: Math.trunc(amount),
      date_local: dateLocal || todayString,
    });
    setInAmount("");
    await Promise.all([refreshTransactions(), refreshSummary()]);
  };

  const handleAddExpense = async () => {
    const amount = Number(outAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    await invoke("add_expense", {
      amount: Math.trunc(amount),
      date_local: dateLocal || todayString,
    });
    setOutAmount("");
    await Promise.all([refreshTransactions(), refreshSummary()]);
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

  return (
    <main>
      <h1>PNEUMA</h1>
      <p>Pelacak keuangan lokal dengan kontrol BURN_POOL + STABILIZER_POOL.</p>

      <section>
        <div className="grid">
          <div className="badge">
            Rekomendasi Belanja Hari Ini:{" "}
            {formatRupiah(summary.recommended_spend_today)}
          </div>
          <div className="badge">
            Sisa Hari Ini: {formatRupiah(summary.today_remaining_clamped)}
          </div>
          {summary.overspent_today && (
            <div className="badge">Melebihi Anggaran Hari Ini</div>
          )}
        </div>
      </section>

      <section>
        <div className="grid">
          <div>
            <label htmlFor="in-amount">Pemasukan (Rp)</label>
            <input
              id="in-amount"
              type="number"
              value={inAmount}
              onChange={(event) => setInAmount(event.target.value)}
              placeholder="100000"
            />
          </div>
          <div>
            <label htmlFor="out-amount">Pengeluaran (Rp)</label>
            <input
              id="out-amount"
              type="number"
              value={outAmount}
              onChange={(event) => setOutAmount(event.target.value)}
              placeholder="25000"
            />
          </div>
          <div>
            <label htmlFor="date-local">Tanggal (opsional)</label>
            <input
              id="date-local"
              type="date"
              value={dateLocal}
              onChange={(event) => setDateLocal(event.target.value)}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <button onClick={handleAddIncome}>Tambah Pemasukan</button>
          <button className="secondary" onClick={handleAddExpense}>
            Tambah Pengeluaran
          </button>
        </div>
      </section>

      <section>
        <h2 style={{ marginTop: 0 }}>Transaksi Terbaru</h2>
        {deleteMessage && <p>{deleteMessage}</p>}
        {deleteError && <p style={{ color: "#a4433f" }}>{deleteError}</p>}
        <div className="list">
          {transactions.length === 0 && (
            <div className="list-item">Belum ada transaksi.</div>
          )}
          {transactions.map((tx) => (
            <div className="list-item" key={tx.id}>
              <strong>
                {tx.kind === "IN" ? "Masuk" : "Keluar"}{" "}
                {formatRupiah(tx.amount)}
              </strong>
              <div className="row">
                <span>{tx.date_local}</span>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => handleDeleteTransaction(tx)}
                  disabled={deletingId === tx.id}
                >
                  {deletingId === tx.id ? "Menghapus..." : "Hapus"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
