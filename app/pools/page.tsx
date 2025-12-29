'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

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
      <h1>Pools</h1>
      <p>Read-only balances derived from transactions + rules.</p>

      <section>
        <div className="row" style={{ marginBottom: 16 }}>
          <button onClick={refresh}>Refresh</button>
        </div>
        {error && <p style={{ color: '#a4433f' }}>{error}</p>}
        {summary && (
          <div className="grid">
            <div className="badge">Total In: Rp {summary.total_in}</div>
            <div className="badge">Total Out: Rp {summary.total_out}</div>
            <div className="badge">Net Balance: Rp {summary.net_balance}</div>
            <div className="badge">
              Stabilizer Guard: Rp {summary.stabilizer_guard}
            </div>
            <div className="badge">Burn Budget: Rp {summary.burn_budget}</div>
            <div className="badge">
              Burn Pool Target: Rp {summary.burn_pool_balance}
            </div>
            <div className="badge">
              Stabilizer Pool Target: Rp {summary.stabilizer_pool_balance}
            </div>
            <div className="badge">
              Recommended Spend Today: Rp {summary.recommended_spend_today}
            </div>
            <div className="badge">Today Out: Rp {summary.today_out}</div>
            <div className="badge">
              Today Remaining: Rp {summary.today_remaining_clamped}
            </div>
            {summary.today_remaining < 0 && (
              <div className="badge">Overspent today</div>
            )}
            <div className="badge">
              Resilience Days Estimate: {summary.resilience_days_estimate}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
