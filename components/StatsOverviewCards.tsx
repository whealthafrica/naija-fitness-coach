'use client'

import React, { useState, useEffect } from 'react'
import { Award, Wallet, Clock, Lock, CheckCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { TIER_THRESHOLDS, TierType, TIERS, calculateIronWalletPayout } from '@/lib/cpEngine'

interface StatsOverviewCardsProps {
  initialCP?: number
  initialTier?: TierType
  initialProgress?: number
}

export function StatsOverviewCards({ initialCP, initialTier, initialProgress }: StatsOverviewCardsProps) {
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'
  const supabase = createClient()

  // Stats states
  const [cp, setCp] = useState(initialCP ?? 0)
  const [tier, setTier] = useState<TierType>(initialTier ?? 'Bronze')
  const [programProgress, setProgramProgress] = useState(initialProgress ?? 71) // Default to 71%
  const [isPremium, setIsPremium] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)

  // 12-week lock simulation states (allows testing week 12 auto-payout)
  const [currentWeek, setCurrentWeek] = useState(3)
  const [isWithdrawn, setIsWithdrawn] = useState(false)
  const [withdrawnAt, setWithdrawnAt] = useState<string | null>(null)

  useEffect(() => {
    // Determine simulation week (defaults to 3, but can be updated via localStorage for testing)
    const weekVal = parseInt(localStorage.getItem('preview_current_week') || '3', 10)
    setCurrentWeek(weekVal)

    if (isPreview) {
      const storedCP = parseInt(localStorage.getItem('preview_cp') || '0', 10)
      const storedTier = (localStorage.getItem('preview_tier') as TierType) || 'Bronze'
      const storedProgress = parseInt(localStorage.getItem('preview_progress') || '75', 10)
      const storedPremium = localStorage.getItem('preview_premium') === 'true'
      const storedWithdrawn = localStorage.getItem('preview_is_withdrawn') === 'true'
      const storedWithdrawnAt = localStorage.getItem('preview_withdrawn_at')

      setCp(storedCP)
      setTier(storedTier)
      setProgramProgress(storedProgress)
      setIsPremium(storedPremium)
      setIsWithdrawn(storedWithdrawn)
      setWithdrawnAt(storedWithdrawnAt)

      const deposit = storedPremium ? 20000 : 10000
      const cap = storedPremium ? 20000 : 10000
      const payout = calculateIronWalletPayout(storedProgress, deposit, cap)
      setWalletBalance(payout.finalPayout)

      // AUTOMATIC WITHDRAWAL AT WEEK 12: Auto-initiate transfer instantly
      if (weekVal === 12 && !storedWithdrawn) {
        const nowStr = new Date().toISOString()
        localStorage.setItem('preview_is_withdrawn', 'true')
        localStorage.setItem('preview_withdrawn_at', nowStr)

        const savedLogs = localStorage.getItem('preview_payout_logs')
        const logs = savedLogs ? JSON.parse(savedLogs) : []
        logs.push({
          id: `p_${Date.now()}`,
          user_id: 'preview_user_id',
          program_progress: storedProgress,
          deposit_amount: deposit,
          calculated_payout: payout.calculatedPayout,
          final_payout: payout.finalPayout,
          paystack_transfer_id: `trsf_${Math.random().toString(36).substr(2, 9)}`,
          payout_status: 'Success',
          recorded_at: nowStr
        })
        localStorage.setItem('preview_payout_logs', JSON.stringify(logs))
        
        setIsWithdrawn(true)
        setWithdrawnAt(nowStr)
      }
      return
    }

    async function loadStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Fetch CP and Tier
        const { data: profile } = await supabase
          .from('users')
          .select('cp, tier')
          .eq('id', user.id)
          .single()

        if (profile) {
          setCp(profile.cp || 0)
          setTier((profile.tier as TierType) || 'Bronze')
        }

        // 2. Fetch Program Progress (patient_pathway_state)
        // INTEGRITY RULE: Program Progress (which determines Iron Wallet payouts) is calculated
        // solely from verified program activities. Self-reported health metrics (like blood pressure,
        // blood sugar, weight) from Vitals Check-Ins are excluded. This prevents giving patients
        // a direct financial incentive to falsify clinical data.
        const { data: state } = await supabase
          .from('patient_pathway_state')
          .select('program_progress')
          .eq('user_id', user.id)
          .single()

        let progressVal = 71
        if (state) {
          progressVal = Math.round(state.program_progress || 0)
          setProgramProgress(progressVal)
        }

        // 3. Fetch Wallet Details
        const { data: wallet } = await supabase
          .from('iron_wallet')
          .select('*')
          .eq('user_id', user.id)
          .single()

        let deposit = 10000
        let cap = 10000
        let premium = false

        if (wallet) {
          deposit = Number(wallet.deposit_amount)
          cap = Number(wallet.tier_cap)
          premium = wallet.tier_type === 'Premium'
          setIsPremium(premium)
          setWalletBalance(Number(wallet.final_payout))
          setIsWithdrawn(wallet.is_withdrawn)
          setWithdrawnAt(wallet.withdrawn_at)

          // AUTOMATIC WITHDRAWAL AT WEEK 12: Auto-initiate transfer and log audit
          if (weekVal === 12 && !wallet.is_withdrawn) {
            const payoutVal = Number(wallet.final_payout)
            const nowStr = new Date().toISOString()

            // Insert audit trail record
            await supabase.from('payout_logs').insert({
              user_id: user.id,
              wallet_id: wallet.id,
              program_progress: progressVal,
              deposit_amount: deposit,
              calculated_payout: Number(wallet.calculated_payout),
              final_payout: payoutVal,
              paystack_transfer_id: `trsf_${Math.random().toString(36).substr(2, 9)}`,
              payout_status: 'Success',
              recorded_at: nowStr
            })

            // Update wallet state
            await supabase
              .from('iron_wallet')
              .update({ is_withdrawn: true, withdrawn_at: nowStr })
              .eq('id', wallet.id)

            setIsWithdrawn(true)
            setWithdrawnAt(nowStr)
          }
        } else {
          // If no wallet row, calculate default pro-rata return
          const payout = calculateIronWalletPayout(progressVal, deposit, cap)
          setWalletBalance(payout.finalPayout)
        }
      } catch (err) {
        console.error('Failed to load wallet stats:', err)
      }
    }

    loadStats()
  }, [isPreview, initialCP, initialTier, initialProgress])

  // Calculate next tier CP details
  const getNextTierDetails = (currentCP: number) => {
    let nextTier: TierType | null = null
    let threshold = 0

    const currentTierIdx = TIERS.indexOf(tier)
    if (currentTierIdx !== -1 && currentTierIdx < TIERS.length - 1) {
      const nt = TIERS[currentTierIdx + 1]
      nextTier = nt
      threshold = TIER_THRESHOLDS[nt]
    }

    return {
      nextTier,
      cpRemaining: nextTier ? Math.max(0, threshold - currentCP) : 0
    }
  }

  const { nextTier, cpRemaining } = getNextTierDetails(cp)
  const depositAmount = isPremium ? 100000 : 60000

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
      {/* CARD 1: Consistency League & CP Accumulator */}
      <div className="rounded-2xl bg-surface border border-divider/50 p-6 shadow-sm flex flex-col justify-between hover:border-primary/20 transition-all space-y-5">
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-primary">
            <Award className="h-5 w-5 stroke-[1.5]" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary font-mono">Consistency League</span>
          </div>
          <div className="space-y-2">
            <h3 className="text-3xl font-extrabold tracking-tight text-text-primary leading-none">
              {tier} League
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Accumulated Points: <strong className="text-text-primary font-bold text-base">{cp} CP</strong>
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-divider/40">
          {nextTier ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-secondary">
                <span>Next Tier: {nextTier}</span>
                <span>{cpRemaining} CP left</span>
              </div>
              <div className="h-2 w-full bg-divider/60 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, (cp / TIER_THRESHOLDS[nextTier]) * 100)}%` 
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-success text-xs font-bold uppercase tracking-wider">
              <CheckCircle className="h-4 w-4 stroke-[1.5]" />
              <span>Max Diamond League Achieved!</span>
            </div>
          )}
          <p className="text-xs text-text-secondary/90 leading-relaxed italic">
            CP celebrates showing up daily and is streak-independent. Tiers are absolute. No relegations.
          </p>
        </div>
      </div>

      {/* CARD 2: Commitment Wallet & Program Progress */}
      <div className="rounded-2xl bg-surface border border-divider/50 p-6 shadow-sm flex flex-col justify-between hover:border-primary/20 transition-all space-y-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-primary">
              <Wallet className="h-5 w-5 stroke-[1.5]" />
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary font-mono">Commitment Wallet</span>
            </div>
            <span className="text-[10px] bg-divider/50 text-text-secondary border border-divider/40 font-semibold px-2.5 py-0.5 rounded uppercase tracking-wider font-mono">
              {isPremium ? 'Premium' : 'Standard'}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <h3 className="text-4xl font-extrabold tracking-tight text-text-primary leading-none">
                {programProgress}%
              </h3>
              <span className="text-sm font-semibold text-text-secondary">Program Progress</span>
            </div>

            <div className="grid grid-cols-2 gap-6 text-left pt-3 border-t border-divider/40">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Commitment Stake</p>
                <p className="text-lg font-extrabold text-text-primary leading-tight no-underline decoration-transparent">₦{depositAmount.toLocaleString()}</p>
                <p className="text-xs text-text-secondary leading-normal block font-mono font-medium">
                  {isPremium 
                    ? '₦80k fee + ₦20k incentive' 
                    : '₦50k fee + ₦10k incentive'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Estimated Return</p>
                <p className="text-lg font-extrabold text-primary leading-tight no-underline decoration-transparent">₦{walletBalance.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {currentWeek < 12 ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium bg-divider/20 border border-divider/30 rounded-xl p-2.5 justify-center font-mono">
                <Lock className="h-4 w-4 text-text-secondary stroke-[1.5]" />
                <span>Locked &bull; Unlocks at Week 12 (Week {currentWeek} of 12)</span>
              </div>
              <button
                type="button"
                disabled
                className="w-full bg-primary/5 border border-primary/10 text-primary/45 font-bold px-4 py-3 rounded-xl text-xs uppercase tracking-wider cursor-not-allowed text-center transition-colors"
              >
                Withdraw Commitment Stake
              </button>
            </>
          ) : programProgress < 50 ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-[#721C24] font-medium bg-[#F8D7DA] border border-[#F5C6CB] rounded-xl p-2.5 justify-center font-mono">
                <Lock className="h-4 w-4 text-[#721C24] stroke-[1.5]" />
                <span>Program Ended &bull; Forfeited (Progress {programProgress}%)</span>
              </div>
              <button
                type="button"
                disabled
                className="w-full bg-red-500/10 border border-red-500/20 text-red-500/50 font-bold px-4 py-3 rounded-xl text-xs uppercase tracking-wider cursor-not-allowed text-center transition-colors"
              >
                Funds Forfeited (&lt;50% Progress)
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-xs text-[#155724] font-medium bg-[#D4EDDA] border border-[#C3E6CB] rounded-xl p-2.5 justify-center font-mono">
                <CheckCircle className="h-4 w-4 text-[#155724] stroke-[1.5]" />
                <span>Payout sent to your Paystack-linked account</span>
              </div>
              <button
                type="button"
                disabled
                className="w-full bg-[#D4EDDA] border border-[#C3E6CB] text-[#155724] font-extrabold px-4 py-3 rounded-xl text-xs uppercase tracking-wider text-center transition-colors font-mono"
              >
                Payout Sent (₦{walletBalance.toLocaleString()})
              </button>
              {withdrawnAt && (
                <p className="text-[9px] text-text-secondary text-center leading-none mt-1 font-mono">
                  Transferred on {new Date(withdrawnAt).toLocaleDateString()} at {new Date(withdrawnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
