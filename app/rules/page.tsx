'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

type Config = {
  min_floor: number
  max_ceil: number
  resilience_days: number
}

const DEFAULT_CONFIG: Config = {
  min_floor: 0,
  max_ceil: 100000,
  resilience_days: 30,
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
      setError('Target hari penyangga minimal 1')
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
      <p>
        Parameter inti untuk ringkasan dana dan rekomendasi. Target hari
        penyangga menentukan target dana penyangga (min_floor × hari) sekaligus
        menjadi horizon pembagian Dana Fleksibel untuk rekomendasi harian.
      </p>

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
            <label htmlFor="resilience-days">Target Hari Dana Penyangga</label>
            <input
              id="resilience-days"
              type="number"
              value={config.resilience_days}
              onChange={(event) => updateField('resilience_days', event.target.value)}
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
