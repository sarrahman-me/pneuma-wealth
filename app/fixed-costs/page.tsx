'use client'

import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { formatRupiah } from '../lib/format'

type FixedCost = {
  id: number
  name: string
  amount: number
  is_active: boolean
  paid_date_local: string | null
  paid_ts_utc: number | null
  paid_tx_id: number | null
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatPeriodYm = (dateString: string) => dateString.slice(0, 7)

export default function FixedCostsPage() {
  const [items, setItems] = useState<FixedCost[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [paidDate, setPaidDate] = useState('')
  const [error, setError] = useState('')

  const todayString = useMemo(() => formatLocalDate(new Date()), [])
  const currentPeriod = useMemo(() => formatPeriodYm(todayString), [todayString])

  const refresh = async () => {
    const data = await invoke<FixedCost[]>('list_fixed_costs')
    setItems(data)
  }

  useEffect(() => {
    setPaidDate(todayString)
    refresh()
  }, [todayString])

  const handleAdd = async () => {
    setError('')
    const parsedAmount = Number(amount)
    if (!name.trim()) {
      setError('Nama wajib diisi')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Jumlah harus > 0')
      return
    }

    await invoke('add_fixed_cost', {
      name: name.trim(),
      amount: Math.trunc(parsedAmount),
    })
    setName('')
    setAmount('')
    refresh()
  }

  const handleTogglePaid = async (item: FixedCost) => {
    if (item.paid_date_local) {
      await invoke('mark_fixed_cost_unpaid', {
        fixed_cost_id: item.id,
        paid_date_local: item.paid_date_local,
      })
    } else {
      await invoke('mark_fixed_cost_paid', {
        fixed_cost_id: item.id,
        paid_date_local: paidDate || todayString,
      })
    }
    refresh()
  }

  const handleDelete = async (item: FixedCost) => {
    await invoke('delete_fixed_cost', { fixed_cost_id: item.id })
    refresh()
  }

  return (
    <main>
      <h1>Biaya Tetap</h1>
      <p>Kelola biaya bulanan dan status lunas per periode.</p>

      <section>
        <div className="grid">
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
            <label htmlFor="paid-date">Tanggal Bayar (opsional)</label>
            <input
              id="paid-date"
              type="date"
              value={paidDate}
              onChange={(event) => setPaidDate(event.target.value)}
            />
          </div>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button onClick={handleAdd}>Tambah Biaya Tetap</button>
        </div>
        {error && <p style={{ color: '#a4433f' }}>{error}</p>}
      </section>

      <section>
        <h2 style={{ marginTop: 0 }}>Daftar</h2>
        <div className="list">
          {items.length === 0 && (
            <div className="list-item">Belum ada biaya tetap.</div>
          )}
          {items.map((item) => (
            <div className="list-item" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <div style={{ color: '#706a63' }}>
                  {formatRupiah(item.amount)}
                </div>
              </div>
              <div className="row">
                <span className="badge">
                  {item.paid_date_local
                    ? `Lunas ${item.paid_date_local}`
                    : `Belum Lunas (${currentPeriod})`}
                </span>
                <button className="secondary" onClick={() => handleTogglePaid(item)}>
                  {item.paid_date_local ? 'Batalkan Lunas' : 'Tandai Lunas'}
                </button>
                <button onClick={() => handleDelete(item)}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
