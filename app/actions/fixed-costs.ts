'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db'
import { accounts, fixedCostPayments, fixedCosts, transactions } from '@/lib/db/schema'
import { nextMonthlyDue } from '@/lib/core/due'
import { periodOf } from '@/lib/core/money'
import { todayIn } from '@/lib/core/timezone'
import { requireCurrentUser } from '@/lib/server/user'
import type { ActionResult } from './transactions'

const refresh = () => {
  revalidatePath('/')
  revalidatePath('/fixed-costs')
  revalidatePath('/summary')
}

/** Memastikan biaya tetap benar-benar milik pengguna ini. */
const ownedFixedCost = async (userId: string, id: string) => {
  const [cost] = await getDb()
    .select()
    .from(fixedCosts)
    .where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId)))
    .limit(1)
  if (!cost) throw new Error('Biaya tetap tidak ditemukan.')
  return cost
}

export const addFixedCost = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const name = String(formData.get('name') ?? '').trim()
    const amount = Math.trunc(Number(String(formData.get('amount') ?? '').replace(/[^\d]/g, '')))
    const dueDay = Math.trunc(Number(formData.get('due_day') ?? 1))

    if (!name) throw new Error('Nama biaya tetap wajib diisi.')
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Jumlah harus lebih dari 0.')
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      throw new Error('Tanggal jatuh tempo harus antara 1 dan 31.')
    }

    await getDb()
      .insert(fixedCosts)
      .values({ userId: user.id, name, amount, dueDay, recurrence: 'monthly' })

    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal menyimpan.' }
  }
}

export const deleteFixedCost = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const cost = await ownedFixedCost(user.id, String(formData.get('id') ?? ''))

    // Transaksi pembayarannya ikut terhapus lewat cascade pada fixed_cost_payments,
    // jadi hapus transaksinya lebih dulu agar saldo tidak menyimpan sisa.
    const payments = await getDb()
      .select({ transactionId: fixedCostPayments.transactionId })
      .from(fixedCostPayments)
      .where(eq(fixedCostPayments.fixedCostId, cost.id))

    for (const payment of payments) {
      if (payment.transactionId) {
        await getDb().delete(transactions).where(eq(transactions.id, payment.transactionId))
      }
    }

    await getDb().delete(fixedCosts).where(eq(fixedCosts.id, cost.id))

    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal menghapus.' }
  }
}

export const markFixedCostPaid = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const cost = await ownedFixedCost(user.id, String(formData.get('id') ?? ''))
    const db = getDb()

    const today = todayIn(user.timezone)
    const period = periodOf(nextMonthlyDue(today, cost.dueDay))

    const [existing] = await db
      .select()
      .from(fixedCostPayments)
      .where(
        and(
          eq(fixedCostPayments.fixedCostId, cost.id),
          eq(fixedCostPayments.period, period),
        ),
      )
      .limit(1)
    if (existing?.transactionId) {
      return { ok: true }
    }

    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.kind, 'spendable')))
      .limit(1)
    if (!account) throw new Error('Belum ada akun.')

    // Sumber `fixed_cost` membuat transaksi ini tidak ikut memakan jatah harian.
    const [tx] = await db
      .insert(transactions)
      .values({
        userId: user.id,
        accountId: account.id,
        kind: 'OUT',
        amount: cost.amount,
        dateLocal: today,
        description: cost.name,
        source: 'fixed_cost',
        fixedCostId: cost.id,
      })
      .returning({ id: transactions.id })

    await db
      .insert(fixedCostPayments)
      .values({
        fixedCostId: cost.id,
        period,
        paidDateLocal: today,
        transactionId: tx.id,
      })
      .onConflictDoUpdate({
        target: [fixedCostPayments.fixedCostId, fixedCostPayments.period],
        set: { paidDateLocal: today, transactionId: tx.id },
      })

    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal menandai.' }
  }
}

export const markFixedCostUnpaid = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const cost = await ownedFixedCost(user.id, String(formData.get('id') ?? ''))
    const period = String(formData.get('period') ?? '')
    const db = getDb()

    const [payment] = await db
      .select()
      .from(fixedCostPayments)
      .where(
        and(
          eq(fixedCostPayments.fixedCostId, cost.id),
          eq(fixedCostPayments.period, period),
        ),
      )
      .limit(1)

    if (payment) {
      if (payment.transactionId) {
        await db.delete(transactions).where(eq(transactions.id, payment.transactionId))
      }
      await db.delete(fixedCostPayments).where(eq(fixedCostPayments.id, payment.id))
    }

    refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal membatalkan.' }
  }
}
