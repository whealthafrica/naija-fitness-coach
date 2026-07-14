'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/Button'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import Link from 'next/link'

export default function EmailPage() {
  const supabase = createClient()
  
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentSuccess, setSentSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const targetEmail = email.trim()
    if (!targetEmail) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/verified`,
        },
      })

      if (otpError) {
        setError(otpError.message)
      } else {
        setSentSuccess(true)
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sentSuccess) {
    return (
      <div className="flex flex-col flex-grow justify-between min-h-screen px-6 py-8">
        <div className="flex-grow flex flex-col items-center justify-center max-w-sm w-full mx-auto space-y-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 border border-success">
            <MailCheck className="h-8 w-8 text-success" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Check your email</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              We sent a login link to <span className="font-semibold text-text-primary">{email}</span>. Click the link in the email to log in and continue your onboarding.
            </p>
          </div>
        </div>
        <div className="text-center">
          <Link href="/sign-in" className="text-xs font-bold text-primary hover:opacity-80 transition-opacity">
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen px-6 py-8 justify-start bg-background">
      {/* Header section with back navigation */}
      <div className="space-y-4">
        <Link href="/sign-in" className="inline-flex items-center text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="h-5 w-5 mr-1" />
          <span className="text-sm font-medium">Back</span>
        </Link>
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-widest uppercase text-accent">Email Sign In</span>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">What is your email?</h2>
          <p className="text-sm text-text-secondary">
            We will email you a magic link to sign in instantly.
          </p>
        </div>
      </div>

      {/* Top Third Illustration - Noticeably Larger, Borderless */}
      <div className="w-full flex justify-center py-4">
        <div className="w-40 h-40 relative aspect-square overflow-hidden bg-transparent">
          <Image
            src="/phone-illustration.png"
            alt="Email Illustration"
            fill
            priority
            sizes="160px"
            className="object-cover"
          />
        </div>
      </div>

      {/* Input Form follows illustration naturally with a closer action button */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto mt-6 space-y-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Email Address
            </label>
            <div className="flex rounded-2xl border border-divider bg-surface overflow-hidden focus-within:border-primary transition-colors">
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-4 bg-transparent text-text-primary placeholder:text-text-secondary/50 outline-none text-base font-medium"
                disabled={loading}
                autoFocus
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-xs text-danger font-medium leading-relaxed">
              {error}
            </div>
          )}
        </div>

        {/* Action Button stack - brought closer */}
        <div className="space-y-4 pt-2">
          <Button type="submit" variant="primary" disabled={loading}>
            <span className="w-full flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-on-primary" />
                  <span>Sending link...</span>
                </>
              ) : (
                <span>Send magic link</span>
              )}
            </span>
          </Button>

          <div className="text-center text-xs font-semibold text-text-secondary">
            A magic link will log you in without requiring a password.
          </div>
        </div>
      </form>
    </div>
  )
}
