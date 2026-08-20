'use client'

import { useActionState } from 'react'
import { updateSettings } from '@/app/actions/settings'
import type { ActionResult } from '@/app/actions/transactions'
import type { settings as settingsTable } from '@/lib/db/schema'

export default function SettingsForm({
  settings,
  timezone,
}: {
  settings: typeof settingsTable.$inferSelect
  timezone: string
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
            <input
              name="daily_living_cost"
              inputMode="numeric"
              defaultValue={settings.dailyLivingCost}
              required
            />
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
            <span className="helper-text">Berapa hari hidup yang ingin dijamin.</span>
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
            <span className="helper-text">Dana fleksibel dibagi sepanjang rentang ini.</span>
          </label>

          <label>
            Jatah minimum
            <input
              name="allowance_min"
              inputMode="numeric"
              defaultValue={settings.allowanceMin}
              required
            />
            <span className="helper-text">Berlaku hanya setelah penyangga penuh.</span>
          </label>

          <label>
            Jatah maksimum
            <input
              name="allowance_max"
              inputMode="numeric"
              defaultValue={settings.allowanceMax}
              required
            />
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
