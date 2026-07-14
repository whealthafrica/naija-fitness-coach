import './globals.css'
import type { Metadata, Viewport } from 'next'
import { PWARegister } from '@/components/PWARegister'
import { AppLayoutShell } from '@/components/AppLayoutShell'

export const metadata: Metadata = {
  title: 'Naija Fitness Coach',
  description: 'Your personal fitness and health coach, tailored for you.',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#8B1A1A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-text-primary antialiased">
        <PWARegister />
        <AppLayoutShell>{children}</AppLayoutShell>
      </body>
    </html>
  )
}
