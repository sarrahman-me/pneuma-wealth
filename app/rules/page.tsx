'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { formatRupiah } from '../lib/format'

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

      <section className="rules-hero">
        <div className="hero-grid">
          <div className="hero-card">
            <div className="hero-label">Min Harian</div>
            <div className="hero-value">{formatRupiah(config.min_floor)}</div>
          </div>
          <div className="hero-card">
            <div className="hero-label">Max Harian</div>
            <div className="hero-value">{formatRupiah(config.max_ceil)}</div>
          </div>
          <div className="hero-card">
            <div className="hero-label">Target Hari Penyangga</div>
            <div className="hero-value">{config.resilience_days} hari</div>
          </div>
          <div className="hero-card">
            <div className="hero-label">Target Dana Penyangga</div>
            <div className="hero-value">
              {formatRupiah(config.min_floor * config.resilience_days)}
            </div>
          </div>
        </div>
      </section>

      <section className="rules-editor">
        <div className="metric-card">
          <div className="metric-title">Edit Aturan</div>
          <div className="form-grid">
            <div>
              <label htmlFor="min-floor">Batas Minimum (Rp)</label>
              <input
                id="min-floor"
                type="number"
                value={config.min_floor}
                onChange={(event) => updateField('min_floor', event.target.value)}
              />
              <div className="helper-text">
                Patokan pengeluaran harian minimum.
              </div>
            </div>
            <div>
              <label htmlFor="max-ceil">Batas Maksimum (Rp)</label>
              <input
                id="max-ceil"
                type="number"
                value={config.max_ceil}
                onChange={(event) => updateField('max_ceil', event.target.value)}
              />
              <div className="helper-text">
                Batas atas rekomendasi belanja harian.
              </div>
            </div>
            <div>
              <label htmlFor="resilience-days">Target Hari Dana Penyangga</label>
              <input
                id="resilience-days"
                type="number"
                value={config.resilience_days}
                onChange={(event) => updateField('resilience_days', event.target.value)}
              />
              <div className="helper-text">
                Menentukan target penyangga dan horizon pembagian dana fleksibel.
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button onClick={handleSave}>Simpan</button>
            {status && <span className="pill pill-muted">{status}</span>}
          </div>
          <div className="helper-text" style={{ marginTop: 10 }}>
            Dengan set ini, target penyangga kamu{' '}
            {formatRupiah(config.min_floor * config.resilience_days)} dan
            rekomendasi harian dibatasi {formatRupiah(config.min_floor)} hingga{' '}
            {formatRupiah(config.max_ceil)}.
          </div>
          {error && <div className="alert-error">{error}</div>}
        </div>
      </section>

    </main>
  )
}
