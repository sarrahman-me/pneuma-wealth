'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db'
import { accounts, categories, transactions } from '@/lib/db/schema'
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

/**
 * Id yang tidak berbentuk UUID membuat Postgres melempar galat mentah berisi
 * seluruh query — bukan sesuatu yang layak dibaca pengguna. Disaring di sini.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const transactionId = (raw: FormDataEntryValue | null): string => {
  const id = String(raw ?? '').trim()
  if (!UUID_PATTERN.test(id)) throw new Error('Transaksi tidak ditemukan.')
  return id
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

/** Kategori juga wajib diverifikasi kepemilikannya sebelum ditulis. */
const resolveCategoryId = async (userId: string, raw: FormDataEntryValue | null) => {
  const requested = optional(raw)
  if (!requested) return null

  const [owned] = await getDb()
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, requested), eq(categories.userId, userId)))
    .limit(1)
  if (!owned) throw new Error('Kategori tidak ditemukan.')
  return owned.id
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
        categoryId:
          kind === 'OUT' ? await resolveCategoryId(user.id, formData.get('category_id')) : null,
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
    const id = transactionId(formData.get('id'))

    const updated = await getDb()
      .update(transactions)
      .set({
        amount: parseAmount(formData.get('amount')),
        description: optional(formData.get('description')),
        categoryId: await resolveCategoryId(user.id, formData.get('category_id')),
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
    const id = transactionId(formData.get('id'))

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
