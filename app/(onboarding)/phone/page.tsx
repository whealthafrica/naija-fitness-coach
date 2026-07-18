'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/Button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function PhonePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle phone number input changes and gracefully normalize different formats
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.trim()

    // 1. Handle full pasted international numbers
    if (input.startsWith('+234')) {
      input = input.substring(4)
    } else if (input.startsWith('234')) {
      input = input.substring(3)
    }

    // 2. Keep only digits
    let cleaned = input.replace(/\D/g, '')

    // 3. Strip leading zero (Nigerian 11-digit mobile format: 070... -> 70...)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1)
    }

    // 4. Limit to 10 digits max
    if (cleaned.length > 10) {
      cleaned = cleaned.substring(0, 10)
    }

    setPhoneNumber(cleaned)
  }

  // A valid Nigerian subscriber number after prefix stripping is exactly 10 digits
  const isValid = phoneNumber.length === 10

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setError(null)
    setLoading(true)

    const fullNumber = `+234${phoneNumber}`

    try {
      const response = await fetch('/api/request-phone-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: fullNumber }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Could not send verification code right now. Please try again.')
      } else {
        router.push(`/verify?phone=${encodeURIComponent(fullNumber)}`)
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
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
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">What is your phone number?</h2>
          <p className="text-sm text-text-secondary">
            Enter your mobile number to receive your login code.
          </p>
        </div>
      </div>

      {/* Top Third Illustration - Noticeably Larger, Borderless, let it breathe */}
      <div className="w-full flex justify-center py-4">
        <div className="w-40 h-40 relative aspect-square overflow-hidden bg-transparent">
          <Image
            src="/phone-illustration.png"
            alt="Phone Illustration"
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
            <label htmlFor="phone" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Mobile Number
            </label>
            <div className="flex rounded-2xl border border-divider bg-surface overflow-hidden focus-within:border-primary transition-colors">
              {/* Locked +234 prefix */}
              <span className="flex items-center justify-center px-4 bg-background border-r border-divider text-text-primary text-base font-semibold">
                +234
              </span>
              <input
                id="phone"
                type="tel"
                placeholder="706 245 9256"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className="w-full px-4 py-4 bg-transparent text-text-primary placeholder:text-text-secondary/40 outline-none text-base font-medium"
                disabled={loading}
                autoFocus
                required
              />
            </div>
            {/* Reassurance Copy */}
            <p className="text-xs text-text-secondary leading-normal">
              We only use this to send your secure login code. No spam, ever.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-xs text-danger font-medium leading-relaxed">
              {error}
            </div>
          )}
        </div>

        {/* Action Button stack - brought closer */}
        <div className="space-y-4 pt-2">
          <Button type="submit" variant="primary" disabled={!isValid || loading}>
            <span className="w-full flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-on-primary" />
                  <span>Sending Code...</span>
                </>
              ) : (
                <span>Send code</span>
              )}
            </span>
          </Button>

          <div className="text-center text-xs font-semibold text-text-secondary">
            Supports all Nigerian telecommunications networks.
          </div>
        </div>
      </form>
    </div>
  )
}
