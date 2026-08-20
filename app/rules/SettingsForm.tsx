'use client'

import { useActionState } from 'react'
import { updateSettings } from '@/app/actions/settings'
import MoneyInput from '@/app/components/MoneyInput'
import type { ActionResult } from '@/app/actions/transactions'
import type { settings as settingsTable } from '@/lib/db/schema'

export default function SettingsForm({
  settings,
  timezone,
  suggestedBufferDays,
}: {
  settings: typeof settingsTable.$inferSelect
  timezone: string
  /** Saran dari jeda pemasukan yang benar-benar pernah terjadi. Null bila data belum cukup. */
  suggestedBufferDays: number | null
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => updateSettings(formData),
    null,
  )

  return (
    <form action={formAction} className="rules-editor">
      <section className="rules-hero">
        <h2>Rasa aman</h2>
        <p className="helper-text">
          Dipakai untuk menghitung dana penyangga dan runway. Bukan jatah belanja.
        </p>
        <div className="form-grid">
          <label>
            Biaya hidup harian
            <MoneyInput name="daily_living_cost" defaultValue={settings.dailyLivingCost} required />
            <span className="helper-text">Perkiraan kasar biaya bertahan hidup per hari.</span>
          </label>

          <label>
            Target hari penyangga
            <input
              name="buffer_days"
              inputMode="numeric"
              defaultValue={settings.bufferDays}
              required
            />
            <span className="helper-text">
              Berapa hari hidup yang ingin dijamin.
              {suggestedBufferDays !== null && suggestedBufferDays !== settings.bufferDays
                ? ` Riwayat pemasukanmu menyarankan ${suggestedBufferDays} hari.`
                : ''}
            </span>
          </label>

          <label>
            Porsi pengisian penyangga (%)
            <input
              name="buffer_fill_percent"
              inputMode="numeric"
              type="number"
              min={0}
              max={90}
              defaultValue={settings.bufferFillPercent}
              required
            />
            <span className="helper-text">
              Selama penyangga belum penuh, sekian persen uangmu mengisi penyangga dan
              sisanya tetap jadi jatah harian. Makin tinggi, makin cepat aman tapi makin
              ketat sehari-hari.
            </span>
          </label>

          <label>
            Horizon kewajiban (hari)
            <input
              name="obligation_horizon_days"
              inputMode="numeric"
              defaultValue={settings.obligationHorizonDays}
              required
            />
            <span className="helper-text">
              Tagihan yang jatuh tempo dalam rentang ini disisihkan lebih dulu.
            </span>
          </label>
        </div>
      </section>

      <section className="rules-hero">
        <h2>Jatah belanja</h2>
        <p className="helper-text">
          Batas ini hanya membentuk angka harian; tidak memengaruhi penyangga.
        </p>
        <div className="form-grid">
          <label>
            Horizon jatah (hari)
            <input
              name="allowance_horizon_days"
              inputMode="numeric"
              defaultValue={settings.allowanceHorizonDays}
              required
            />
            <span className="helper-text">
              Dana fleksibel dibagi sepanjang rentang ini. Kalau jeda pemasukanmu ternyata
              lebih panjang, aplikasi memakai jeda itu — angka ini jadi batas bawahnya, tidak
              pernah dipersempit.
            </span>
          </label>

          <label>
            Jatah minimum
            <MoneyInput name="allowance_min" defaultValue={settings.allowanceMin} required />
            <span className="helper-text">
              Jatah tidak turun di bawah angka ini — kecuali uangmu memang tidak sanggup
              menopangnya sepanjang horizon.
            </span>
          </label>

          <label>
            Jatah maksimum
            <MoneyInput name="allowance_max" defaultValue={settings.allowanceMax} required />
            <span className="helper-text">Menahan lonjakan setelah pemasukan besar.</span>
          </label>

          <label>
            Zona waktu
            <input name="timezone" defaultValue={timezone} />
            <span className="helper-text">Menentukan kapan &quot;hari ini&quot; berganti.</span>
          </label>
        </div>
      </section>

      <button type="submit" className="btn" disabled={pending}>
        {pending ? 'Menyimpan…' : 'Simpan'}
      </button>

      {state?.ok ? <p className="helper-text">Tersimpan.</p> : null}
      {state && !state.ok ? <p className="alert-error">{state.error}</p> : null}
    </form>
  )
}
