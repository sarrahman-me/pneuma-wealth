'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

type Config = {
  min_floor: number
  max_ceil: number
  resilience_days: number
  burn_pool_ratio: number
}

const DEFAULT_CONFIG: Config = {
  min_floor: 0,
  max_ceil: 100000,
  resilience_days: 30,
  burn_pool_ratio: 50,
}

export default function RulesPage() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await invoke<Config>('get_config')
        setConfig(data)
      } catch (err) {
        setError(String(err))
      }
    }

    loadConfig()
  }, [])

  const updateField = (field: keyof Config, value: string) => {
    const numeric = Number(value)
    setConfig((prev) => ({
      ...prev,
      [field]: Number.isFinite(numeric) ? Math.trunc(numeric) : 0,
    }))
  }

  const handleSave = async () => {
    setError('')
    setStatus('')

    if (config.min_floor > config.max_ceil) {
      setError('min_floor must be <= max_ceil')
      return
    }
    if (config.resilience_days < 1) {
      setError('resilience_days must be >= 1')
      return
    }
    if (config.burn_pool_ratio < 0 || config.burn_pool_ratio > 100) {
      setError('burn_pool_ratio must be between 0 and 100')
      return
    }

    try {
      const data = await invoke<Config>('update_config', { payload: config })
      setConfig(data)
      setStatus('Saved')
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <main>
      <h1>Rules / Configuration</h1>
      <p>Core parameters that drive pools and recommendations.</p>

      <section>
        <div className="grid">
          <div>
            <label htmlFor="min-floor">Min Floor (Rp)</label>
            <input
              id="min-floor"
              type="number"
              value={config.min_floor}
              onChange={(event) => updateField('min_floor', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="max-ceil">Max Ceil (Rp)</label>
            <input
              id="max-ceil"
              type="number"
              value={config.max_ceil}
              onChange={(event) => updateField('max_ceil', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="resilience-days">Resilience Days</label>
            <input
              id="resilience-days"
              type="number"
              value={config.resilience_days}
              onChange={(event) => updateField('resilience_days', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="burn-ratio">Burn Pool Ratio (%)</label>
            <input
              id="burn-ratio"
              type="number"
              value={config.burn_pool_ratio}
              onChange={(event) => updateField('burn_pool_ratio', event.target.value)}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <button onClick={handleSave}>Save</button>
          {status && <span className="badge">{status}</span>}
        </div>
        {error && <p style={{ color: '#a4433f' }}>{error}</p>}
      </section>
    </main>
  )
}
