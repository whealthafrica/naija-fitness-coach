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

  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'

  // Admin surface: full viewport, no nav, no patient wrapper
  if (isAdminSurface) {
    return (
      <>
        {children}
        {isPreview && (
          <div className="fixed bottom-4 right-4 bg-[#2B211D] text-[#F5EDE1] text-[9px] font-bold px-2 py-1 rounded shadow-md z-[9999] uppercase tracking-wider select-none pointer-events-none border border-[#FAF4EC]/10">
            Preview Active
          </div>
        )}
      </>
    )
  }

  if (isOnboarding) {
    return (
      <>
        {children}
        {isPreview && (
          <div className="fixed bottom-4 right-4 bg-[#2B211D] text-[#F5EDE1] text-[9px] font-bold px-2 py-1 rounded shadow-md z-[9999] uppercase tracking-wider select-none pointer-events-none border border-[#FAF4EC]/10">
            Preview Active
          </div>
        )}
      </>
    )
  }

  // Standard patient shell layout for dashboard views
  return (
    <>
      <main className="mx-auto max-w-md pb-24 p-4">{children}</main>
      <BottomNav />
      {isPreview && (
        <div className="fixed bottom-20 right-4 bg-[#2B211D] text-[#F5EDE1] text-[9px] font-bold px-2 py-1 rounded shadow-md z-[9999] uppercase tracking-wider select-none pointer-events-none border border-[#FAF4EC]/10">
          Preview Active
        </div>
      )}
    </>
  )
}
