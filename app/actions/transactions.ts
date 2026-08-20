'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db'
import { accounts, transactions } from '@/lib/db/schema'
import { todayIn } from '@/lib/core/timezone'
import { requireCurrentUser } from '@/lib/server/user'

export type ActionResult = { ok: true } | { ok: false; error: string }

const parseAmount = (raw: FormDataEntryValue | null): number => {
  const amount = Number(String(raw ?? '').replace(/[^\d]/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Jumlah harus lebih dari 0.')
  }
  return Math.trunc(amount)
}

const optional = (raw: FormDataEntryValue | null): string | null => {
  const value = String(raw ?? '').trim()
  return value.length > 0 ? value : null
}

/** Memastikan akun benar-benar milik pengguna ini sebelum dipakai. */
const resolveAccountId = async (userId: string, raw: FormDataEntryValue | null) => {
  const db = getDb()
  const requested = optional(raw)

  if (requested) {
    const [owned] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, requested), eq(accounts.userId, userId)))
      .limit(1)
    if (!owned) throw new Error('Akun tidak ditemukan.')
    return owned.id
  }

  const [fallback] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.kind, 'spendable')))
    .limit(1)
  if (!fallback) throw new Error('Belum ada akun.')
  return fallback.id
}

const refresh = () => {
  revalidatePath('/')
  revalidatePath('/history')
  revalidatePath('/summary')
}

export const addTransaction = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const kind = String(formData.get('kind')) === 'IN' ? 'IN' : 'OUT'

    await getDb()
      .insert(transactions)
      .values({
        userId: user.id,
        accountId: await resolveAccountId(user.id, formData.get('account_id')),
        categoryId: kind === 'OUT' ? optional(formData.get('category_id')) : null,
        kind,
        amount: parseAmount(formData.get('amount')),
        dateLocal: optional(formData.get('date_local')) ?? todayIn(user.timezone),
        description: optional(formData.get('description')),
        source: 'manual',
      })

    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal menyimpan.' }
  }
}

export const updateTransaction = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const id = optional(formData.get('id'))
    if (!id) throw new Error('Transaksi tidak valid.')

    const updated = await getDb()
      .update(transactions)
      .set({
        amount: parseAmount(formData.get('amount')),
        description: optional(formData.get('description')),
        categoryId: optional(formData.get('category_id')),
        dateLocal: optional(formData.get('date_local')) ?? todayIn(user.timezone),
        updatedAt: new Date(),
      })
      // Pembayaran biaya tetap diubah lewat halaman Biaya Tetap, bukan di sini.
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, user.id),
          eq(transactions.source, 'manual'),
        ),
      )
      .returning({ id: transactions.id })

    if (updated.length === 0) throw new Error('Transaksi tidak ditemukan.')

    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal mengubah.' }
  }
}

export const deleteTransaction = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const id = optional(formData.get('id'))
    if (!id) throw new Error('Transaksi tidak valid.')

    const removed = await getDb()
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning({ id: transactions.id })

    if (removed.length === 0) throw new Error('Transaksi tidak ditemukan.')

    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal menghapus.' }
  }
}
