import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
      <SignUp />
    </main>
  )
}
