'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { coachLoginAction } from '../actions'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/Button'

export default function CoachLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please enter both email and password.')
      return
    }

    setLoading(true)
    const res = await coachLoginAction(email, password)
    if (res.success) {
      router.push('/coach/dashboard')
      router.refresh()
    } else {
      setError(res.error || 'Authentication failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto w-full max-w-md">
        {/* Brand Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-[#781818] flex items-center justify-center text-background font-bold text-base">
            N
          </div>
          <span className="text-[#100808] font-bold text-sm tracking-wider uppercase">NFC Portal</span>
        </div>

        <h2 className="text-center text-3xl font-extrabold text-[#100808]">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-[#100808]/60">
          Coach & Administrator access console.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto w-full max-w-md">
        <div className="bg-white py-8 px-4 border border-[#100808]/8 shadow-sm rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                <p className="text-sm font-semibold text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">
                Work Email Address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="coach@whealthafrica.com"
                  className="w-full rounded-xl border border-[#100808]/15 px-3 py-2.5 text-sm text-[#100808] placeholder-[#100808]/30 focus:outline-none focus:border-[#781818]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#100808]/15 pl-3 pr-10 py-2.5 text-sm text-[#100808] placeholder-[#100808]/30 focus:outline-none focus:border-[#781818]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#100808]/40 hover:text-[#100808]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Button
                type="submit"
                disabled={loading}
                variant="primary"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
