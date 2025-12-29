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
      setError('Batas minimum harus <= batas maksimum')
      return
    }
    if (config.resilience_days < 1) {
      setError('Hari ketahanan minimal 1')
      return
    }
    if (config.burn_pool_ratio < 0 || config.burn_pool_ratio > 100) {
      setError('Rasio burn pool harus antara 0 dan 100')
      return
    }

    try {
      const data = await invoke<Config>('update_config', { payload: config })
      setConfig(data)
      setStatus('Tersimpan')
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <main>
      <h1>Aturan / Konfigurasi</h1>
      <p>Parameter inti untuk pool dan rekomendasi.</p>

      <section>
        <div className="grid">
          <div>
            <label htmlFor="min-floor">Batas Minimum (Rp)</label>
            <input
              id="min-floor"
              type="number"
              value={config.min_floor}
              onChange={(event) => updateField('min_floor', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="max-ceil">Batas Maksimum (Rp)</label>
            <input
              id="max-ceil"
              type="number"
              value={config.max_ceil}
              onChange={(event) => updateField('max_ceil', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="resilience-days">Hari Ketahanan</label>
            <input
              id="resilience-days"
              type="number"
              value={config.resilience_days}
              onChange={(event) => updateField('resilience_days', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="burn-ratio">Rasio Burn Pool (%)</label>
            <input
              id="burn-ratio"
              type="number"
              value={config.burn_pool_ratio}
              onChange={(event) => updateField('burn_pool_ratio', event.target.value)}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <button onClick={handleSave}>Simpan</button>
          {status && <span className="badge">{status}</span>}
        </div>
        {error && <p style={{ color: '#a4433f' }}>{error}</p>}
      </section>
    </main>
  )
}
