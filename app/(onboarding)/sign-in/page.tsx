'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useState } from 'react'

export default function SignInPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (signInError) {
        setError(signInError.message)
      }
    } catch (err: any) {
      setError(err.message || 'OAuth initialization failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background justify-between">
      {/* 1. Full-bleed Illustration Container (takes top 70-75% via aspect-ratio wrapper) */}
      {/* This aspect ratio (3/4.2) reserves space before loading to prevent layout shifts */}
      <div className="w-full relative aspect-[3/4.2] bg-transparent overflow-hidden">
        <Image
          src="/illustration.png"
          alt="Naija Fitness Coach"
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
        {/* Soft fading overlay to blend the bottom edge of the cover illustration */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background via-background/50 to-transparent pointer-events-none" />
      </div>

      {/* 2. Lower Portion - Over Cream Space */}
      <div className="flex-grow flex flex-col justify-between px-6 pb-8 pt-4 space-y-6 max-w-sm mx-auto w-full">
        {/* App Wordmark */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Naija Fitness Coach
          </h1>
          <p className="text-xs text-text-secondary max-w-xs mx-auto">
            Daily health accountability and coach guidance.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-danger/10 border border-danger/20 p-3 text-center text-xs text-danger font-medium">
            {error}
          </div>
        )}

        {/* Buttons Stack */}
        <div className="space-y-3 w-full">
          {/* Continue with Google (burgundy fill, cream text) */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex items-center justify-center w-full bg-primary text-background font-bold px-5 py-4 rounded-2xl hover:opacity-95 transition-opacity disabled:opacity-50 text-sm"
          >
            {loading ? 'Connecting...' : 'Continue with Google'}
          </button>

          {/* Continue with Email (outline burgundy, burgundy text, cream fill) */}
          <button
            onClick={() => {
              router.push('/email')
            }}
            className="flex items-center justify-center w-full bg-background border border-primary text-primary font-bold px-5 py-4 rounded-2xl hover:bg-surface transition-colors text-sm"
          >
            Continue with email
          </button>
        </div>

        <p className="text-xs font-semibold text-text-secondary text-center max-w-xs mx-auto pt-2">
          Secure authentication powered by Supabase.
        </p>
      </div>
    </div>
  )
}
