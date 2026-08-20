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
          Dipakai untuk menghitung dana cadangan dan berapa lama uangmu bertahan. Bukan
          jatah belanja.
        </p>
        <div className="form-grid">
          <label>
            Biaya hidup harian
            <MoneyInput name="daily_living_cost" defaultValue={settings.dailyLivingCost} required />
            <span className="helper-text">
              Kira-kira berapa yang kamu butuhkan sehari untuk hidup: makan, transport,
              hal yang tidak bisa dilewati.
            </span>
          </label>

          <label>
            Dana cadangan untuk berapa hari
            <input
              name="buffer_days"
              inputMode="numeric"
              defaultValue={settings.bufferDays}
              required
            />
            <span className="helper-text">
              Berapa hari kamu ingin tetap bisa hidup walau tidak ada uang masuk.
              {suggestedBufferDays !== null && suggestedBufferDays !== settings.bufferDays
                ? ` Dari riwayatmu, ${suggestedBufferDays} hari terlihat lebih pas.`
                : ''}
            </span>
          </label>

          <label>
            Berapa persen tiap uang masuk untuk dana cadangan
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
              Selama dana cadangan belum penuh, sekian persen uang masuk dipakai untuk
              mengisinya dan sisanya tetap jadi jatah harian. Makin besar, makin cepat aman
              tapi makin ketat sehari-hari.
            </span>
          </label>

          <label>
            Tagihan berapa hari ke depan yang disisihkan
            <input
              name="obligation_horizon_days"
              inputMode="numeric"
              defaultValue={settings.obligationHorizonDays}
              required
            />
            <span className="helper-text">
              Tagihan yang jatuh tempo dalam sekian hari ke depan uangnya dipisahkan lebih
              dulu.
            </span>
          </label>
        </div>
      </section>

      <section className="rules-hero">
        <h2>Jatah belanja</h2>
        <p className="helper-text">
          Angka-angka ini hanya membentuk jatah harian; dana cadangan tidak ikut terpengaruh.
        </p>
        <div className="form-grid">
          <label>
            Uang dibagi untuk berapa hari
            <input
              name="allowance_horizon_days"
              inputMode="numeric"
              defaultValue={settings.allowanceHorizonDays}
              required
            />
            <span className="helper-text">
              Uang yang boleh dibelanjakan dibagi untuk sekian hari ke depan. Kalau jarak
              uang masukmu ternyata lebih panjang, aplikasi ikut jarak itu — angka ini jadi
              batas paling pendek, tidak pernah dipercepat.
            </span>
          </label>

          <label>
            Jatah minimum
            <MoneyInput name="allowance_min" defaultValue={settings.allowanceMin} required />
            <span className="helper-text">
              Jatah tidak akan turun di bawah angka ini — kecuali uangmu memang tidak cukup
              untuk menutup semua harinya.
            </span>
          </label>

          <label>
            Jatah maksimum
            <MoneyInput name="allowance_max" defaultValue={settings.allowanceMax} required />
            <span className="helper-text">
              Menahan jatah melonjak setelah dapat uang besar.
            </span>
          </label>

          <label>
            Zona waktu
            <input name="timezone" defaultValue={timezone} />
            <span className="helper-text">Menentukan kapan &quot;hari ini&quot; berganti.</span>
          </label>
        </div>
      </section>

      <button type="submit" className="btn btn-cta" disabled={pending}>
        {pending ? 'Menyimpan…' : 'Simpan'}
      </button>

      {state?.ok ? <p className="helper-text">Tersimpan.</p> : null}
      {state && !state.ok ? <p className="alert-error">{state.error}</p> : null}
    </form>
  )
}
