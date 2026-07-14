import React from 'react'
import { OnboardingTransitionLayout } from './OnboardingTransitionLayout'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <OnboardingTransitionLayout>{children}</OnboardingTransitionLayout>
    </div>
  )
}
