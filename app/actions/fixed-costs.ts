'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db'
import { accounts, fixedCostPayments, fixedCosts, transactions } from '@/lib/db/schema'
import { nextDue, periodKeyFor, type Recurrence } from '@/lib/core/due'
import { todayIn } from '@/lib/core/timezone'
import { requireCurrentUser } from '@/lib/server/user'
import type { ActionResult } from './transactions'

const refresh = () => {
  revalidatePath('/')
  revalidatePath('/fixed-costs')
  revalidatePath('/summary')
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Memastikan biaya tetap benar-benar milik pengguna ini. */
const ownedFixedCost = async (userId: string, id: string) => {
  if (!UUID_PATTERN.test(id)) throw new Error('Biaya tetap tidak ditemukan.')

  const [cost] = await getDb()
    .select()
    .from(fixedCosts)
    .where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId)))
    .limit(1)
  if (!cost) throw new Error('Biaya tetap tidak ditemukan.')
  return cost
}

const RECURRENCES: Recurrence[] = ['daily', 'weekly', 'monthly', 'yearly']

/**
 * `due_day` berarti hal berbeda per siklus, jadi batasnya juga berbeda: hari
 * dalam pekan untuk mingguan, tanggal untuk bulanan dan tahunan, dan tidak
 * dipakai sama sekali untuk harian.
 */
const parseSchedule = (formData: FormData) => {
  const raw = String(formData.get('recurrence') ?? 'monthly')
  const recurrence = RECURRENCES.find((candidate) => candidate === raw)
  if (!recurrence) throw new Error('Siklus tidak dikenali.')

  if (recurrence === 'daily') {
    return { recurrence, dueDay: 1, dueMonth: 1 }
  }

  const dueDay = Math.trunc(Number(formData.get('due_day') ?? 1))
  if (recurrence === 'weekly') {
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 7) {
      throw new Error('Pilih hari jatuh temponya dulu.')
    }
    return { recurrence, dueDay, dueMonth: 1 }
  }

  if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error('Tanggal jatuh tempo harus antara 1 dan 31.')
  }

  if (recurrence === 'monthly') {
    return { recurrence, dueDay, dueMonth: 1 }
  }

  const dueMonth = Math.trunc(Number(formData.get('due_month') ?? 1))
  if (!Number.isFinite(dueMonth) || dueMonth < 1 || dueMonth > 12) {
    throw new Error('Bulan jatuh tempo harus antara 1 dan 12.')
  }
  return { recurrence, dueDay, dueMonth }
}

export const addFixedCost = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()
    const name = String(formData.get('name') ?? '').trim()
    const amount = Math.trunc(Number(String(formData.get('amount') ?? '').replace(/[^\d]/g, '')))

    if (!name) throw new Error('Nama biaya tetap wajib diisi.')
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Jumlah harus lebih dari 0.')

    await getDb()
      .insert(fixedCosts)
      .values({ userId: user.id, name, amount, ...parseSchedule(formData) })

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
    const period = periodKeyFor(cost.recurrence, nextDue(today, cost))

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
