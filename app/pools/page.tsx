'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { formatRupiah } from '../lib/format'

type PoolsSummary = {
  total_in: number
  total_out: number
  net_balance: number
  min_floor: number
  max_ceil: number
  resilience_days: number
  target_penyangga: number
  dana_fleksibel: number
  recommended_spend_today: number
  today_out: number
  today_remaining: number
  today_remaining_clamped: number
  overspent_today: boolean
  hari_ketahanan_stop_pemasukan: number
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
      <h1>Ringkasan Dana</h1>
      <p>Ringkasan angka utama untuk memantau saldo, penyangga, dan batas belanja harian.</p>

      <section>
        <div className="row" style={{ marginBottom: 16 }}>
          <button onClick={refresh}>Muat Ulang</button>
        </div>
        <div className="list" style={{ marginBottom: 16 }}>
          <div className="list-item">
            <strong>Cara Membaca Halaman Ini</strong>
          </div>
          <div className="list-item">
            Cocokkan Saldo Bersih dengan saldo rekening; jika beda berarti ada transaksi yang belum dicatat.
          </div>
          <div className="list-item">
            Target Dana Penyangga adalah batas aman yang ingin dijaga agar tetap kuat.
          </div>
          <div className="list-item">
            Dana Fleksibel adalah bagian saldo yang boleh dipakai untuk belanja setelah penyangga aman.
          </div>
          <div className="list-item">
            Jika muncul “Melebihi Anggaran Hari Ini”, berarti hari ini sudah lewat batas rekomendasi (tetap boleh dicatat).
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
              <div>Jumlah semua uang keluar yang kamu catat (termasuk biaya tetap yang ditandai lunas).</div>
            </div>
            <div className="badge">
              <div>Saldo Bersih</div>
              <div>{formatRupiah(summary.net_balance)}</div>
              <div>Total pemasukan dikurangi total pengeluaran.</div>
            </div>
            <div className="badge">
              <div>Patokan Pengeluaran Harian</div>
              <div>{formatRupiah(summary.min_floor)}</div>
              <div>Target pengeluaran harian minimum yang ingin dijaga.</div>
            </div>
            <div className="badge">
              <div>Batas Maks Belanja Harian</div>
              <div>{formatRupiah(summary.max_ceil)}</div>
              <div>Batas atas rekomendasi belanja harian agar tidak berlebihan.</div>
            </div>
            <div className="badge">
              <div>Target Dana Penyangga</div>
              <div>{formatRupiah(summary.target_penyangga)}</div>
              <div>Target saldo aman: patokan harian × target hari penyangga.</div>
            </div>
            <div className="badge">
              <div>Dana Fleksibel</div>
              <div>{formatRupiah(summary.dana_fleksibel)}</div>
              <div>Bagian saldo yang boleh dipakai setelah target penyangga terpenuhi.</div>
            </div>
            <div className="badge">
              <div>Rekomendasi Belanja Hari Ini</div>
              <div>{formatRupiah(summary.recommended_spend_today)}</div>
              <div>
                Rekomendasi belanja harian dari dana fleksibel; jika penyangga sudah aman,
                minimal mengikuti patokan harian.
              </div>
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
            {summary.overspent_today && (
              <div className="badge">
                <div>Melebihi Anggaran Hari Ini</div>
                <div>Pengeluaran hari ini sudah melewati rekomendasi.</div>
              </div>
            )}
            <div className="badge">
              <div>Hari Ketahanan jika Stop Pemasukan</div>
              <div>{summary.hari_ketahanan_stop_pemasukan}</div>
              <div>Perkiraan berapa hari saldo cukup jika tidak ada pemasukan baru.</div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
