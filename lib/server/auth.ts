import 'server-only'

import { auth, currentUser } from '@clerk/nextjs/server'

export type Identity = {
  externalId: string
  email: string
  name: string | null
}

/** Clerk baru aktif setelah kunci-kuncinya terpasang di environment. */
export const isAuthConfigured = () =>
  Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

/**
 * Identitas pengguna dev lokal, dipakai HANYA saat Clerk belum terpasang dan
 * hanya di luar produksi. Di produksi, tanpa Clerk aplikasi menolak jalan
 * daripada melayani data keuangan tanpa autentikasi.
 */
const DEV_IDENTITY: Identity = {
  externalId: 'local-dev',
  email: 'dev@localhost',
  name: 'Dev',
}

export const resolveIdentity = async (): Promise<Identity | null> => {
  if (!isAuthConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Clerk belum dikonfigurasi. Aplikasi menolak jalan tanpa autentikasi di produksi.',
      )
    }
    return DEV_IDENTITY
  }

  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    `${userId}@clerk.local`

  return {
    externalId: userId,
    email,
    name: user?.fullName ?? null,
  }
}
