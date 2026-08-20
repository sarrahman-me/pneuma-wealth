'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db'
import { accounts, transactions, wishItems } from '@/lib/db/schema'
import { readyDateFor } from '@/lib/core/wish'
import { todayIn } from '@/lib/core/timezone'
import { requireCurrentUser } from '@/lib/server/user'
import { getDailyState } from '@/lib/server/state'
import type { ActionResult } from './transactions'

const refresh = () => {
  revalidatePath('/')
  revalidatePath('/wishlist')
  revalidatePath('/history')
  revalidatePath('/summary')
}

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

/** Memastikan keinginan benar-benar milik pengguna ini sebelum disentuh. */
const ownedWish = async (userId: string, id: string) => {
  if (!UUID_PATTERN.test(id)) throw new Error('Keinginan tidak ditemukan.')

  const [wish] = await getDb()
    .select()
    .from(wishItems)
    .where(and(eq(wishItems.id, id), eq(wishItems.userId, userId)))
    .limit(1)
  if (!wish) throw new Error('Keinginan tidak ditemukan.')
  return wish
}

/**
 * Masa tunggu ditentukan dari jatah harian yang berlaku saat keinginan dicatat,
 * lalu dibekukan di `ready_on`. Kalau dihitung ulang tiap kali dibaca, jatah
 * yang naik akan memperpendek masa tunggu yang sedang berjalan — persis celah
 * yang dicari dorongan impulsif.
 */
export const addWish = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const name = String(formData.get('name') ?? '').trim()
    if (!name) throw new Error('Nama keinginan wajib diisi.')

    const amount = parseAmount(formData.get('amount'))
    const today = todayIn(user.timezone)
    const { allowance } = await getDailyState(user)

    await getDb()
      .insert(wishItems)
      .values({
        userId: user.id,
        name,
        amount,
        createdOn: today,
        readyOn: readyDateFor(today, amount, allowance.allowed),
        note: String(formData.get('note') ?? '').trim() || null,
      })

    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal menyimpan.' }
  }
}

/**
 * Keinginan yang jadi dibeli berubah menjadi transaksi biasa, jadi uangnya
 * ikut memakan jatah harian seperti pengeluaran lain.
 */
export const buyWish = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const wish = await ownedWish(user.id, String(formData.get('id') ?? ''))
    if (wish.status !== 'waiting') return { ok: true }

    const today = todayIn(user.timezone)
    if (wish.readyOn > today) {
      throw new Error('Masa tunggunya belum habis.')
    }

    const db = getDb()
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.kind, 'spendable')))
      .limit(1)
    if (!account) throw new Error('Belum ada akun.')

    const [tx] = await db
      .insert(transactions)
      .values({
        userId: user.id,
        accountId: account.id,
        kind: 'OUT',
        amount: wish.amount,
        dateLocal: today,
        description: wish.name,
        source: 'manual',
      })
      .returning({ id: transactions.id })

    await db
      .update(wishItems)
      .set({ status: 'bought', decidedAt: new Date(), transactionId: tx.id })
      .where(eq(wishItems.id, wish.id))

    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal mencatat.' }
  }
}

/** Melepaskan keinginan. Sengaja disimpan, bukan dihapus — ini bukti bahwa menunggu berhasil. */
export const releaseWish = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const wish = await ownedWish(user.id, String(formData.get('id') ?? ''))

    await getDb()
      .update(wishItems)
      .set({ status: 'released', decidedAt: new Date() })
      .where(eq(wishItems.id, wish.id))

    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal melepaskan.' }
  }
}

export const deleteWish = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const wish = await ownedWish(user.id, String(formData.get('id') ?? ''))

    await getDb().delete(wishItems).where(eq(wishItems.id, wish.id))

    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal menghapus.' }
  }
}
