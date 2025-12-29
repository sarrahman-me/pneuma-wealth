'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { formatRupiah } from '../lib/format'

type PoolsSummary = {
  burn_pool_balance: number
  stabilizer_pool_balance: number
  recommended_spend_today: number
  today_out: number
  today_remaining: number
  today_remaining_clamped: number
  resilience_days_estimate: number
  total_in: number
  total_out: number
  net_balance: number
  stabilizer_guard: number
  burn_budget: number
}

export default function PoolsPage() {
  const [summary, setSummary] = useState<PoolsSummary | null>(null)
  const [error, setError] = useState('')

  const refresh = async () => {
    setError('')
    try {
      const data = await invoke<PoolsSummary>('get_pools_summary')
      setSummary(data)
    } catch (err) {
      setError(String(err))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <main>
      <h1>Pos Keuangan</h1>
      <p>Ringkasan alokasi dana yang dihitung dari transaksi dan aturan.</p>

      <section>
        <div className="row" style={{ marginBottom: 16 }}>
          <button onClick={refresh}>Muat Ulang</button>
        </div>
        <div className="list" style={{ marginBottom: 16 }}>
          <div className="list-item">
            <strong>Cara Membaca Halaman Ini</strong>
          </div>
          <div className="list-item">
            Cocokkan Saldo Bersih dengan saldo rekening; jika beda berarti ada
            transaksi yang belum dicatat.
          </div>
          <div className="list-item">
            Dana Penyangga Minimum adalah batas aman yang sebaiknya selalu ada.
          </div>
          <div className="list-item">
            Sisa Dana Belanja Fleksibel adalah ruang gerak belanja di atas batas
            aman.
          </div>
          <div className="list-item">
            Jika muncul “Melebihi Anggaran Hari Ini”, berarti hari ini sudah
            melewati rekomendasi (tetap boleh dicatat).
          </div>
        </div>
        {error && <p style={{ color: '#a4433f' }}>{error}</p>}
        {summary && (
          <div className="grid">
            <div className="badge">
              <div>Total Pemasukan</div>
              <div>{formatRupiah(summary.total_in)}</div>
              <div>Jumlah semua uang masuk yang kamu catat.</div>
            </div>
            <div className="badge">
              <div>Total Pengeluaran</div>
              <div>{formatRupiah(summary.total_out)}</div>
              <div>
                Jumlah semua uang keluar yang kamu catat (termasuk biaya tetap
                yang ditandai lunas).
              </div>
            </div>
            <div className="badge">
              <div>Saldo Bersih</div>
              <div>{formatRupiah(summary.net_balance)}</div>
              <div>Total pemasukan dikurangi total pengeluaran.</div>
            </div>
            <div className="badge">
              <div>Dana Penyangga Minimum</div>
              <div>{formatRupiah(summary.stabilizer_guard)}</div>
              <div>Batas aman yang sebaiknya selalu ada: min_floor × resilience_days.</div>
            </div>
            <div className="badge">
              <div>Sisa Dana Belanja Fleksibel</div>
              <div>{formatRupiah(summary.burn_budget)}</div>
              <div>
                Bagian saldo yang boleh dipakai untuk belanja setelah dana
                penyangga aman terpenuhi.
              </div>
            </div>
            <div className="badge">
              <div>Pos Belanja Fleksibel (Target)</div>
              <div>{formatRupiah(summary.burn_pool_balance)}</div>
              <div>Porsi dana belanja fleksibel berdasarkan burn_pool_ratio.</div>
            </div>
            <div className="badge">
              <div>Pos Penyangga (Target)</div>
              <div>{formatRupiah(summary.stabilizer_pool_balance)}</div>
              <div>Sisa porsi dana sebagai penyangga (target).</div>
            </div>
            <div className="badge">
              <div>Rekomendasi Belanja Hari Ini</div>
              <div>{formatRupiah(summary.recommended_spend_today)}</div>
              <div>Batas belanja harian yang disarankan (dijepit oleh min_floor dan max_ceil).</div>
            </div>
            <div className="badge">
              <div>Pengeluaran Hari Ini</div>
              <div>{formatRupiah(summary.today_out)}</div>
              <div>Total pengeluaran pada tanggal hari ini.</div>
            </div>
            <div className="badge">
              <div>Sisa Anggaran Hari Ini</div>
              <div>{formatRupiah(summary.today_remaining_clamped)}</div>
              <div>Rekomendasi belanja hari ini dikurangi pengeluaran hari ini.</div>
            </div>
            {summary.today_remaining < 0 && (
              <div className="badge">
                <div>Melebihi Anggaran Hari Ini</div>
                <div>Pengeluaran hari ini sudah melewati rekomendasi.</div>
              </div>
            )}
            <div className="badge">
              <div>Perkiraan Hari Bertahan</div>
              <div>{summary.resilience_days_estimate}</div>
              <div>
                Perkiraan berapa hari penyangga cukup jika belanja minimal
                min_floor per hari.
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
