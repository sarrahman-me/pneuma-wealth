'use client'

import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

type FixedCost = {
  id: number
  name: string
  amount: number
  is_active: boolean
  paid_date_local: string | null
  paid_ts_utc: number | null
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function FixedCostsPage() {
  const [items, setItems] = useState<FixedCost[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [paidDate, setPaidDate] = useState('')
  const [error, setError] = useState('')

  const todayString = useMemo(() => formatLocalDate(new Date()), [])

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
      setError('Name is required')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be > 0')
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
      await invoke('mark_fixed_cost_unpaid', { fixed_cost_id: item.id })
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
      <h1>Fixed Costs</h1>
      <p>Manual paid toggle for recurring costs.</p>

      <section>
        <div className="grid">
          <div>
            <label htmlFor="fixed-name">Name</label>
            <input
              id="fixed-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Rent"
            />
          </div>
          <div>
            <label htmlFor="fixed-amount">Amount (Rp)</label>
            <input
              id="fixed-amount"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1500000"
            />
          </div>
          <div>
            <label htmlFor="paid-date">Paid Date (optional)</label>
            <input
              id="paid-date"
              type="date"
              value={paidDate}
              onChange={(event) => setPaidDate(event.target.value)}
            />
          </div>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button onClick={handleAdd}>Add Fixed Cost</button>
        </div>
        {error && <p style={{ color: '#a4433f' }}>{error}</p>}
      </section>

      <section>
        <h2 style={{ marginTop: 0 }}>List</h2>
        <div className="list">
          {items.length === 0 && <div className="list-item">No fixed costs yet.</div>}
          {items.map((item) => (
            <div className="list-item" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <div style={{ color: '#706a63' }}>Rp {item.amount}</div>
              </div>
              <div className="row">
                <span className="badge">
                  {item.paid_date_local ? `Paid ${item.paid_date_local}` : 'Unpaid'}
                </span>
                <button className="secondary" onClick={() => handleTogglePaid(item)}>
                  {item.paid_date_local ? 'Mark Unpaid' : 'Mark Paid'}
                </button>
                <button onClick={() => handleDelete(item)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
