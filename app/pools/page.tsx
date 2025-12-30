"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { formatRupiah } from "../lib/format";
import CoachingInsightCard, {
  type CoachingInsight,
} from "../components/CoachingInsightCard";

type PoolsSummary = {
  total_in: number;
  total_out: number;
  net_balance: number;
  min_floor: number;
  max_ceil: number;
  resilience_days: number;
  target_penyangga: number;
  dana_fleksibel: number;
  recommended_spend_today: number;
  today_out: number;
  today_remaining: number;
  today_remaining_clamped: number;
  overspent_today: boolean;
  hari_ketahanan_stop_pemasukan: number;
};

type MetricCardProps = {
  title: string;
  value: string;
  description?: string;
  warning?: boolean;
  children?: React.ReactNode;
};

const MetricCard = ({
  title,
  value,
  description,
  warning,
  children,
}: MetricCardProps) => (
  <div className={`metric-card${warning ? " metric-warn" : ""}`}>
    <div className="metric-title">{title}</div>
    <div className="metric-value">{value}</div>
    {description && <div className="metric-desc">{description}</div>}
    {children}
  </div>
);

export default function PoolsPage() {
  const [summary, setSummary] = useState<PoolsSummary | null>(null);
  const [insight, setInsight] = useState<CoachingInsight | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    setError("");
    try {
      const [summaryData, insightData] = await Promise.all([
        invoke<PoolsSummary>("get_pools_summary"),
        invoke<CoachingInsight>("get_coaching_insight"),
      ]);
      setSummary(summaryData);
      setInsight(insightData);
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const showSoftWarn =
    summary &&
    summary.recommended_spend_today > 0 &&
    summary.today_out >= summary.recommended_spend_today * 0.8 &&
    !summary.overspent_today;

  return (
    <main>
      <h1>Ringkasan Dana</h1>
      <p>
        Ringkasan angka utama untuk memantau saldo, penyangga, dan batas belanja
        harian.
      </p>

      <section>
        <div className="pools-toolbar">
          <button onClick={refresh}>Muat Ulang</button>
          {error && <span className="metric-error">{error}</span>}
        </div>
        <details className="metric-helper">
          <summary>Panduan singkat</summary>
          <div className="metric-helper-body">
            <p>
              Cocokkan Saldo Bersih dengan saldo rekening; jika beda berarti ada
              transaksi yang belum dicatat.
            </p>
            <p>
              Target Dana Penyangga adalah batas aman yang ingin dijaga agar
              tetap kuat.
            </p>
            <p>
              Dana Fleksibel = saldo di atas Target Dana Penyangga. Ini bukan
              saldo total. Jika Dana Fleksibel = 0 artinya saldo kamu tepat di
              target penyangga. Saat penyangga sudah aman, rekomendasi harian
              tetap minimal mengikuti Patokan Pengeluaran Harian (min_floor),
              sehingga belanja tetap mungkin walau Dana Fleksibel 0.
            </p>
            <p>
              Jika muncul “Melebihi Anggaran Hari Ini”, berarti hari ini sudah
              lewat batas rekomendasi (tetap boleh dicatat).
            </p>
          </div>
        </details>
        {summary && summary.total_in === 0 && summary.total_out === 0 && (
          <div className="empty-state">
            <div className="empty-title">Belum ada transaksi.</div>
            <div className="empty-desc">
              Mulai catat pemasukan atau pengeluaran agar ringkasan dana lebih terasa.
            </div>
          </div>
        )}
        {summary?.overspent_today && (
          <div className="soft-warn">
            Hari ini melewati rekomendasi. Tidak apa-apa—yang penting tercatat. Besok kita atur
            lagi.
          </div>
        )}
        {showSoftWarn && (
          <div className="soft-warn">
            Mendekati batas hari ini. Kalau masih perlu belanja, tetap catat ya — biar kamu tetap
            sadar ritmenya.
          </div>
        )}
        {insight && <CoachingInsightCard insight={insight} compact />}
        {summary && (
          <div className="metric-grid">
            <MetricCard
              title="Total Pemasukan"
              value={formatRupiah(summary.total_in)}
              description="Jumlah semua uang masuk yang kamu catat."
            />
            <MetricCard
              title="Total Pengeluaran"
              value={formatRupiah(summary.total_out)}
              description="Jumlah semua uang keluar yang kamu catat (termasuk biaya tetap yang ditandai lunas)."
            />
            <MetricCard
              title="Saldo Bersih"
              value={formatRupiah(summary.net_balance)}
              description="Total pemasukan dikurangi total pengeluaran."
            />
            <MetricCard
              title="Patokan Pengeluaran Harian"
              value={formatRupiah(summary.min_floor)}
              description="Target pengeluaran harian minimum yang ingin dijaga."
            />
            <MetricCard
              title="Batas Maks Belanja Harian"
              value={formatRupiah(summary.max_ceil)}
              description="Batas atas rekomendasi belanja harian agar tidak berlebihan."
            />
            <MetricCard
              title="Target Dana Penyangga"
              value={formatRupiah(summary.target_penyangga)}
              description="Target saldo aman: patokan harian × target hari penyangga."
            />
            <MetricCard
              title="Dana Fleksibel"
              value={formatRupiah(summary.dana_fleksibel)}
            >
              <details className="metric-details">
                <summary className="metric-desc">
                  Dana Fleksibel = saldo di atas Target Dana Penyangga. Ini bukan saldo total.
                </summary>
                <div className="metric-desc">
                  Jika Dana Fleksibel = 0 artinya saldo kamu tepat di target penyangga. Saat
                  penyangga sudah aman, rekomendasi harian tetap minimal mengikuti Patokan
                  Pengeluaran Harian (min_floor), sehingga belanja tetap mungkin walau Dana
                  Fleksibel 0.
                </div>
              </details>
            </MetricCard>
            <MetricCard
              title="Rekomendasi Belanja Hari Ini"
              value={formatRupiah(summary.recommended_spend_today)}
              description="Rekomendasi belanja harian dari dana fleksibel, dibagi menurut target hari penyangga, dan dibatasi maksimum."
            />
            <MetricCard
              title="Pengeluaran Hari Ini"
              value={formatRupiah(summary.today_out)}
              description="Total pengeluaran pada tanggal hari ini."
            />
            <MetricCard
              title="Sisa Anggaran Hari Ini"
              value={formatRupiah(summary.today_remaining_clamped)}
              description="Rekomendasi belanja hari ini dikurangi pengeluaran hari ini."
            />
            {summary.overspent_today && (
              <MetricCard
                title="Melebihi Anggaran Hari Ini"
                value="Perlu perhatian"
                description="Pengeluaran hari ini sudah melewati rekomendasi."
                warning
              />
            )}
            <MetricCard
              title="Hari Ketahanan jika Stop Pemasukan"
              value={String(summary.hari_ketahanan_stop_pemasukan)}
              description="Perkiraan berapa hari saldo cukup jika tidak ada pemasukan baru."
            />
          </div>
        )}
        {summary && (
          <div className="metric-desc" style={{ marginTop: 12 }}>
            Rekomendasi harian dibulatkan ke bawah agar lebih nyaman dipakai. Selisihnya otomatis
            kembali menjadi ruang fleksibel.
          </div>
        )}
      </section>
    </main>
  );
}
