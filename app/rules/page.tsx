import Link from 'next/link'
import SettingsForm from './SettingsForm'
import { getCurrentUser } from '@/lib/server/user'

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

  return (
    <main>
      <h1>Aturan</h1>
      <p>
        Dua kelompok angka yang sengaja dipisah: yang menentukan rasa aman, dan yang menentukan
        jatah belanja.
      </p>
      <SettingsForm settings={user.settings} timezone={user.timezone} />
    </main>
  )
}
