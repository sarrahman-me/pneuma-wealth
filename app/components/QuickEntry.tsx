'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { addTransaction, type ActionResult } from '@/app/actions/transactions'
import MoneyInput from './MoneyInput'

type Option = { id: string; name: string }

export default function QuickEntry({
  accounts,
  categories,
  today,
}: {
  accounts: Option[]
  categories: Option[]
  today: string
}) {
  const [kind, setKind] = useState<'OUT' | 'IN'>('OUT')
  // Field uang terkendali, jadi form.reset() saja tidak cukup: kuncinya diganti
  // supaya MoneyInput dipasang ulang dalam keadaan kosong.
  const [resetKey, setResetKey] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => addTransaction(formData),
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset()
      setResetKey((previous) => previous + 1)
    }
  }, [state])

  return (
    <section className="quick-entry">
      <div className="segmented">
        <button
          type="button"
          className={kind === 'OUT' ? 'pill pill-out' : 'pill pill-muted'}
          onClick={() => setKind('OUT')}
        >
          Pengeluaran
        </button>
        <button
          type="button"
          className={kind === 'IN' ? 'pill pill-in' : 'pill pill-muted'}
          onClick={() => setKind('IN')}
        >
          Pemasukan
        </button>
      </div>

      <form ref={formRef} action={formAction} className="quick-entry-body">
        <input type="hidden" name="kind" value={kind} />

        <div className="form-grid">
          <label>
            Jumlah
            <MoneyInput key={resetKey} className="amount-input" name="amount" required />
          </label>

          <label>
            Tanggal
            <input type="date" name="date_local" defaultValue={today} />
          </label>

          {kind === 'OUT' ? (
            <label>
              Kategori
              <select name="category_id" defaultValue="">
                <option value="">Tanpa kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {accounts.length > 1 ? (
            <label>
              Akun
              <select name="account_id" defaultValue={accounts[0]?.id}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            Keterangan
            <input name="description" placeholder="Opsional" />
          </label>
        </div>

        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan'}
        </button>

        {state && !state.ok ? <p className="alert-error">{state.error}</p> : null}
      </form>
    </section>
  )
}
