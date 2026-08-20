'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db'
import { settings, users } from '@/lib/db/schema'
import { requireCurrentUser } from '@/lib/server/user'
import type { ActionResult } from './transactions'

const positiveInt = (raw: FormDataEntryValue | null, label: string): number => {
  const value = Number(String(raw ?? '').replace(/[^\d]/g, ''))
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} tidak valid.`)
  }
  return Math.trunc(value)
}

export const updateSettings = async (formData: FormData): Promise<ActionResult> => {
  try {
    const user = await requireCurrentUser()

    const dailyLivingCost = positiveInt(formData.get('daily_living_cost'), 'Biaya hidup harian')
    const bufferDays = positiveInt(formData.get('buffer_days'), 'Hari penyangga')
    const bufferFillPercent = positiveInt(
      formData.get('buffer_fill_percent'),
      'Porsi pengisian penyangga',
    )
    const allowanceHorizonDays = positiveInt(
      formData.get('allowance_horizon_days'),
      'Horizon jatah',
    )
    const allowanceMin = positiveInt(formData.get('allowance_min'), 'Jatah minimum')
    const allowanceMax = positiveInt(formData.get('allowance_max'), 'Jatah maksimum')

    if (bufferDays < 1) throw new Error('Hari penyangga minimal 1.')
    if (allowanceHorizonDays < 1) throw new Error('Horizon jatah minimal 1.')
    // 100% berarti jatah harian nol lagi — persis kebuntuan yang mau dihindari.
    if (bufferFillPercent > 90) {
      throw new Error('Porsi pengisian penyangga maksimal 90%, supaya jatah harian tetap ada.')
    }
    if (allowanceMin > allowanceMax) {
      throw new Error('Jatah minimum tidak boleh melebihi jatah maksimum.')
    }

    await getDb()
      .update(settings)
      .set({
        dailyLivingCost,
        bufferDays,
        bufferFillPercent,
        allowanceHorizonDays,
        allowanceMin,
        allowanceMax,
        obligationHorizonDays: positiveInt(
          formData.get('obligation_horizon_days') ?? '30',
          'Horizon kewajiban',
        ),
        // Onboarding dianggap selesai begitu biaya hidup harian terisi.
        onboardedAt: dailyLivingCost > 0 ? (user.settings.onboardedAt ?? new Date()) : null,
        updatedAt: new Date(),
      })
      .where(eq(settings.userId, user.id))

    const timezone = String(formData.get('timezone') ?? '').trim()
    if (timezone) {
      await getDb().update(users).set({ timezone }).where(eq(users.id, user.id))
    }

    revalidatePath('/')
    revalidatePath('/rules')
    revalidatePath('/summary')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal menyimpan.' }
  }
}
