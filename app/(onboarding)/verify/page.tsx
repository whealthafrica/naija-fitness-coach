'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const phone = searchParams.get('phone') || ''
  
  // State for separate 6-digit inputs
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Timer state for resending (30 seconds)
  const [resendTimer, setResendTimer] = useState(30)
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)

  // Refs for focusing inputs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!phone) {
      router.push('/phone')
    }
  }, [phone, router])

  // Count down resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [resendTimer])

  const handleVerify = async (code: string) => {
    setError(null)
    setResendStatus(null)
    setLoading(true)

    try {
      const response = await fetch('/api/verify-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, code }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Verification failed. Please check the code.')
      } else {
        router.push('/verified')
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.')
    } finally {
      setLoading(false)
    }
  }

  // Handle digit input
  const handleChange = (value: string, index: number) => {
    const char = value.replace(/\D/g, '').substring(0, 1) // Only allow digits
    const newOtp = [...otp]
    newOtp[index] = char
    setOtp(newOtp)

    // Focus next input if a digit was entered
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit if all digits are entered
    const fullCode = newOtp.join('')
    if (fullCode.length === 6) {
      handleVerify(fullCode)
    }
  }

  // Handle backspace key navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // Handle copy-pasting a 6-digit code
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, 6)
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('')
      setOtp(newOtp)
      handleVerify(pastedData)
    }
  }

  // Request a resend of the OTP code
  const handleResend = async () => {
    if (resendTimer > 0 || resending) return
    setError(null)
    setResending(true)
    setResendStatus(null)

    try {
      const { error: resendError } = await supabase.auth.updateUser({
        phone: phone,
      })

      if (resendError) {
        if (
          resendError.message.toLowerCase().includes('already registered') ||
          resendError.message.toLowerCase().includes('already exists') ||
          resendError.status === 422
        ) {
          setError(
            'This phone number is already registered to another account. If you believe this is a mistake, contact support.'
          )
        } else {
          setError(resendError.message)
        }
      } else {
        setResendStatus('Another code has been sent.')
        setResendTimer(30) // Reset the 30s timer
      }
    } catch (err: any) {
      setError(err.message || 'Could not resend code.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen px-6 py-8 justify-start bg-background">
      {/* Header / Back navigation */}
      <div className="space-y-4">
        <Link href={`/phone?phone=${encodeURIComponent(phone)}`} className="inline-flex items-center text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="h-5 w-5 mr-1" />
          <span className="text-sm font-medium">Edit Number</span>
        </Link>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Verify your number</h2>
          <p className="text-sm text-text-secondary">
            Enter the 6-digit code sent to <span className="font-semibold text-text-primary">{phone}</span>.
          </p>
        </div>
      </div>

      {/* Centered Phone/Verification Illustration */}
      <div className="w-full flex justify-center py-4">
        <div className="w-40 h-40 relative aspect-square overflow-hidden bg-transparent">
          <Image
            src="/phone-illustration.png"
            alt="Verification Illustration"
            fill
            priority
            sizes="160px"
            className="object-cover"
          />
        </div>
      </div>

      {/* Main Verification Input Section - brought together in a natural stack */}
      <div className="w-full max-w-sm mx-auto mt-6 space-y-6">
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block text-center">
              Verification Code
            </label>
            
            {/* 6 Grid input elements */}
            <div className="grid grid-cols-6 gap-2 justify-center">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(e.target.value, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  ref={(el) => {
                    inputRefs.current[index] = el
                  }}
                  className="w-12 h-14 bg-surface text-text-primary outline-none text-xl font-bold text-center rounded-2xl border border-divider focus:border-primary transition-colors"
                  disabled={loading}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {/* Quiet Resend Option */}
            <div className="text-center pt-3">
              {resendTimer > 0 ? (
                <p className="text-xs font-semibold text-text-secondary">
                  Didn&apos;t get it? Resend in {resendTimer}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-xs font-bold text-primary hover:underline transition-colors disabled:opacity-50"
                >
                  {resending ? 'Sending...' : "Didn't get it? Resend code"}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-xs text-danger font-medium text-center">
              {error}
            </div>
          )}

          {resendStatus && (
            <p className="text-xs text-success font-semibold text-center">
              {resendStatus}
            </p>
          )}

          {/* Loading Spinner during automatic submission */}
          {loading && (
            <div className="flex justify-center items-center gap-2 text-xs text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Confirming code...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
