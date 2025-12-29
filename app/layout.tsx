import './globals.css'

export const metadata = {
  title: 'PNEUMA',
  description: 'Personal finance tracker',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
