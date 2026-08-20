import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '../db'
import { accounts, categories, settings, users } from '../db/schema'
import { DEFAULT_SETTINGS } from '../core/types'
import { resolveIdentity, type Identity } from './auth'

/** Kategori awal. Sengaja sedikit dan tetap — daftar bebas membuat data jadi berantakan. */
const DEFAULT_CATEGORIES: { name: string; nature: 'essential' | 'discretionary' }[] = [
  { name: 'Makan', nature: 'essential' },
  { name: 'Transport', nature: 'essential' },
  { name: 'Tagihan', nature: 'essential' },
  { name: 'Kesehatan', nature: 'essential' },
  { name: 'Belanja', nature: 'discretionary' },
  { name: 'Hiburan', nature: 'discretionary' },
  { name: 'Lainnya', nature: 'discretionary' },
]

export type CurrentUser = {
  id: string
  email: string
  timezone: string
  settings: typeof settings.$inferSelect
}

const bootstrap = async (identity: Identity) => {
  const db = getDb()

  const [user] = await db
    .insert(users)
    .values({
      email: identity.email,
      externalId: identity.externalId,
      name: identity.name,
    })
    .onConflictDoUpdate({
      target: users.externalId,
      set: { email: identity.email, name: identity.name },
    })
    .returning()

  await db
    .insert(settings)
    .values({ userId: user.id, ...DEFAULT_SETTINGS, dailyLivingCost: 0 })
    .onConflictDoNothing()

  // Satu akun harian supaya pengguna bisa langsung mencatat tanpa menyiapkan apa pun.
  await db
    .insert(accounts)
    .values({ userId: user.id, name: 'Dompet Harian', kind: 'spendable' })
    .onConflictDoNothing({ target: [accounts.userId, accounts.name] })

  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((category) => ({ ...category, userId: user.id })))
    .onConflictDoNothing({ target: [categories.userId, categories.name] })

  return user
}

/** Pengguna saat ini, dibuat otomatis pada kunjungan pertama. Null bila belum login. */
export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  const identity = await resolveIdentity()
  if (!identity) return null

  const db = getDb()
  const existing = await db.query.users.findFirst({
    where: eq(users.externalId, identity.externalId),
    with: { settings: true },
  })

  const user = existing ?? (await bootstrap(identity))
  const config =
    existing?.settings ??
    (await db.query.settings.findFirst({ where: eq(settings.userId, user.id) }))

  if (!config) {
    throw new Error('Pengaturan pengguna gagal dibuat.')
  }

  return {
    id: user.id,
    email: user.email,
    timezone: user.timezone,
    settings: config,
  }
}

export const requireCurrentUser = async (): Promise<CurrentUser> => {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Belum masuk.')
  }
  return user
}

export const listAccounts = async (userId: string) =>
  getDb()
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))

export const listCategories = async (userId: string) =>
  getDb()
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.archivedAt)))
