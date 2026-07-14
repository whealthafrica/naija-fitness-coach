'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function VerifiedPage() {
  const router = useRouter()

  useEffect(() => {
    // Hold for 1.8 seconds, then auto-advance to condition focus selection
    const timer = setTimeout(() => {
      router.push('/condition')
    }, 1800)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="flex flex-col flex-grow items-center justify-center min-h-screen px-6 bg-background">
      <div className="space-y-6 text-center w-full max-w-sm">
        {/* Centered Success Portrait Illustration */}
        <div className="w-64 h-80 relative aspect-[3/4] mx-auto overflow-hidden bg-transparent">
          <Image
            src="/verified-illustration.png"
            alt="Success Illustration"
            fill
            priority
            sizes="256px"
            className="object-cover"
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary">
            Verification Successful
          </h2>
          <p className="text-xs text-text-secondary">
            Preparing your personalized coach path...
          </p>
        </div>
      </div>
    </div>
  )
}
