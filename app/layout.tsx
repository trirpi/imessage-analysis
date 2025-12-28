import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'iMessage Analysis',
  description: 'Analyze your iMessage conversations',
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

