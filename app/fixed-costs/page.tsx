"use client";

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { formatRupiah } from "../lib/format";

type FixedCost = {
  id: number;
  name: string;
  amount: number;
  is_active: boolean;
  paid_date_local: string | null;
  paid_ts_utc: number | null;
  paid_tx_id: number | null;
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatPeriodYm = (dateString: string) => dateString.slice(0, 7);

export default function FixedCostsPage() {
  const [items, setItems] = useState<FixedCost[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const todayString = useMemo(() => formatLocalDate(new Date()), []);
  const currentPeriod = useMemo(
    () => formatPeriodYm(todayString),
    [todayString],
  );

  const refresh = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<FixedCost[]>("list_fixed_costs");
      setItems(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPaidDate(todayString);
    refresh();
  }, [todayString]);

  const handleAdd = async () => {
    setError("");
    const parsedAmount = Number(amount);
    if (!name.trim()) {
      setError("Nama wajib diisi");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Jumlah harus > 0");
      return;
    }

    setIsSubmitting(true);
    try {
      await invoke("add_fixed_cost", {
        name: name.trim(),
        amount: Math.trunc(parsedAmount),
      });
      setName("");
      setAmount("");
      refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePaid = async (item: FixedCost) => {
    setBusyId(item.id);
    if (item.paid_date_local) {
      await invoke("mark_fixed_cost_unpaid", {
        fixed_cost_id: item.id,
        paid_date_local: item.paid_date_local,
      });
    } else {
      await invoke("mark_fixed_cost_paid", {
        fixed_cost_id: item.id,
        paid_date_local: paidDate || todayString,
      });
    }
    refresh();
    setBusyId(null);
  };

  const handleDelete = async (item: FixedCost) => {
    setBusyId(item.id);
    await invoke("delete_fixed_cost", { fixed_cost_id: item.id });
    refresh();
    setBusyId(null);
  };

  const filteredItems = items.filter((item) => {
    if (filter === "paid") {
      return Boolean(item.paid_date_local);
    }
    if (filter === "unpaid") {
      return !item.paid_date_local;
    }
    return true;
  });

  const totalPeriod = items.reduce((sum, item) => sum + item.amount, 0);
  const totalPaid = items.reduce(
    (sum, item) => (item.paid_date_local ? sum + item.amount : sum),
    0,
  );
  const totalUnpaid = totalPeriod - totalPaid;

  const emptyCopy = () => {
    if (filter === "paid") {
      return "Belum ada biaya tetap yang lunas di periode ini.";
    }
    if (filter === "unpaid") {
      return "Semua biaya tetap sudah lunas untuk periode ini.";
    }
    return "Belum ada biaya tetap. Tambahkan listrik, wifi, sewa — biar pengeluaran bulanan kebaca.";
  };

  return (
    <main>
      <h1>Biaya Tetap</h1>
      <p>Kelola biaya bulanan dan status lunas per periode.</p>

      <section className="fixed-form">
        <div className="metric-card">
          <div className="metric-title">Tambah Biaya Tetap</div>
          <div className="form-grid">
            <div>
              <label htmlFor="fixed-name">Nama</label>
              <input
                id="fixed-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Sewa"
              />
            </div>
            <div>
              <label htmlFor="fixed-amount">Jumlah (Rp)</label>
              <input
                id="fixed-amount"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="1500000"
              />
            </div>
            <div>
              <label htmlFor="paid-date">
                Tanggal Bayar Default (opsional)
              </label>
              <input
                id="paid-date"
                type="date"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
              />
            </div>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button onClick={handleAdd} disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Tambah"}
            </button>
          </div>
          {error && <div className="alert-error">{error}</div>}
        </div>
      </section>

      <section>
        <div className="fixed-header">
          <h2>Daftar</h2>
          <div className="segmented">
            <button
              type="button"
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              Semua
            </button>
            <button
              type="button"
              className={filter === "unpaid" ? "active" : ""}
              onClick={() => setFilter("unpaid")}
            >
              Belum Lunas
            </button>
            <button
              type="button"
              className={filter === "paid" ? "active" : ""}
              onClick={() => setFilter("paid")}
            >
              Lunas
            </button>
          </div>
        </div>

        <div className="hero-grid fixed-summary">
          <div className="hero-card">
            <div className="hero-label">Total Periode</div>
            <div className="hero-value">{formatRupiah(totalPeriod)}</div>
          </div>
          <div className="hero-card">
            <div className="hero-label">Sudah Lunas</div>
            <div className="hero-value">{formatRupiah(totalPaid)}</div>
          </div>
          <div className="hero-card">
            <div className="hero-label">Sisa Belum Lunas</div>
            <div className="hero-value">{formatRupiah(totalUnpaid)}</div>
          </div>
        </div>

        <div className="fixed-list">
          {isLoading && filteredItems.length === 0 && (
            <div className="skeleton">
              <span className="skeleton-line" />
              <span className="skeleton-line" />
              <span className="skeleton-line" />
            </div>
          )}
          {!isLoading && filteredItems.length === 0 && (
            <div className="empty-state">
              <div className="empty-title">{emptyCopy()}</div>
              <div className="empty-desc">
                Kamu bisa menambahkan biaya tetap di atas untuk periode ini.
              </div>
            </div>
          )}
          {filteredItems.map((item) => (
            <div className="fixed-row" key={item.id}>
              <div className="tx-main">
                <div className="tx-title">
                  <span className="tx-amount">{item.name}</span>
                </div>
                <div className="tx-meta">
                  <span>{formatRupiah(item.amount)}</span>
                  <span
                    className={`pill ${
                      item.paid_date_local ? "pill-in" : "pill-muted"
                    }`}
                  >
                    {item.paid_date_local
                      ? `Lunas ${item.paid_date_local}`
                      : `Belum Lunas (${currentPeriod})`}
                  </span>
                </div>
              </div>
              <div className="fixed-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => handleTogglePaid(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id
                    ? "Memproses..."
                    : item.paid_date_local
                      ? "Batalkan Lunas"
                      : "Tandai Lunas"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? "Menghapus..." : "Hapus"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
