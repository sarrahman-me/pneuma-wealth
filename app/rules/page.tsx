import Link from 'next/link'
import SettingsForm from './SettingsForm'
import { getCurrentUser } from '@/lib/server/user'
import { getDailyState } from '@/lib/server/state'

export const dynamic = 'force-dynamic'

export default async function RulesPage() {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <main>
        <h1>Aturan</h1>
        <p>
          <Link href="/sign-in">Masuk</Link> untuk mengatur.
        </p>
      </main>
    )
  }

  const { cadence } = await getDailyState(user)

  return (
    <main>
      <h1>Aturan</h1>
      <p>
        Dua kelompok angka yang sengaja dipisah: yang bikin kamu merasa aman, dan yang
        menentukan jatah belanja harian.
      </p>
      <SettingsForm
        settings={user.settings}
        timezone={user.timezone}
        suggestedBufferDays={cadence.suggestedBufferDays}
      />
    </main>
  )
}
