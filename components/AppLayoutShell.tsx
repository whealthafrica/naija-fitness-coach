'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { BottomNav } from '@/components/BottomNav'

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Admin console and coach login render their own full-screen layout.
  // They must never be wrapped by the patient shell.
  const isAdminSurface =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/coach/') ||
    pathname === '/coach/login'

  // Identify all onboarding routes
  const isOnboarding =
    pathname === '/sign-in' ||
    pathname === '/phone' ||
    pathname === '/email' ||
    pathname === '/verify' ||
    pathname === '/verified' ||
    pathname === '/condition' ||
    pathname === '/coach'

  // Admin surface: full viewport, no nav, no patient wrapper
  if (isAdminSurface) {
    return <>{children}</>
  }

  if (isOnboarding) {
    return <>{children}</>
  }

  // Standard patient shell layout for dashboard views
  return (
    <>
      <main className="mx-auto max-w-md pb-24 p-4">{children}</main>
      <BottomNav />
    </>
  )
}
