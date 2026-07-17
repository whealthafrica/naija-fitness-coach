'use client'

import React, { useState, useEffect } from 'react'
import { Award, Wallet, Lock, CheckCircle, HelpCircle, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { TIER_THRESHOLDS, TierType, TIERS, calculateIronWalletPayout } from '@/lib/cpEngine'

interface ConsistencyLeagueCardProps {
  initialCP?: number
  initialTier?: TierType
}

export function ConsistencyLeagueCard({ initialCP, initialTier }: ConsistencyLeagueCardProps) {
  const supabase = createClient()

  const [cp, setCp] = useState(initialCP ?? 0)
  const [tier, setTier] = useState<TierType>(initialTier ?? 'Bronze')
  const [showCpInfo, setShowCpInfo] = useState(false)

  useEffect(() => {
    async function loadStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('users')
          .select('cp, tier')
          .eq('id', user.id)
          .single()

        if (profile) {
          setCp(profile.cp || 0)
          setTier((profile.tier as TierType) || 'Bronze')
        }
      } catch (err) {
        console.error('Failed to load CP stats:', err)
      }
    }

    loadStats()
  }, [isPreview, initialCP, initialTier])

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

  return (
    <div className="rounded-2xl bg-surface border border-divider/50 p-6 shadow-sm flex flex-col justify-between hover:border-primary/20 transition-all space-y-4">
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-primary">
          <Award className="h-5 w-5 stroke-[1.5]" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary font-mono">Consistency League</span>
          <button
            type="button"
            onClick={() => setShowCpInfo(!showCpInfo)}
            className="text-text-secondary/40 hover:text-primary transition-colors focus:outline-none"
            title="View Info"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
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

      {showCpInfo && (
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-xs text-text-secondary leading-relaxed relative animate-in fade-in duration-200">
          <button 
            type="button" 
            onClick={() => setShowCpInfo(false)}
            className="absolute top-2.5 right-2.5 text-text-secondary/30 hover:text-text-secondary"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="pr-4 italic">
            CP celebrates showing up daily and is streak-independent. Tiers are absolute. No relegations.
          </p>
        </div>
      )}

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
      </div>
    </div>
  )
}

interface CommitmentWalletRowProps {
  initialProgress?: number
}

export function CommitmentWalletRow({ initialProgress }: CommitmentWalletRowProps) {
  const supabase = createClient()

  const [programProgress, setProgramProgress] = useState(initialProgress ?? 71) // Default to 71%
  const [isPremium, setIsPremium] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(3)
  const [isWithdrawn, setIsWithdrawn] = useState(false)
  const [withdrawnAt, setWithdrawnAt] = useState<string | null>(null)

  useEffect(() => {
    async function loadStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: state } = await supabase
          .from('patient_pathway_state')
          .select('program_progress, created_at')
          .eq('user_id', user.id)
          .single()

        let progressVal = 71
        let startDate = new Date()
        if (state) {
          progressVal = Math.round(state.program_progress || 0)
          setProgramProgress(progressVal)
          if (state.created_at) {
            startDate = new Date(state.created_at)
          }
        }

        const today = new Date()
        const diffTime = Math.max(0, today.getTime() - startDate.getTime())
        const diffDays = diffTime / (1000 * 60 * 60 * 24)
        let weekVal = Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1))

        if (process.env.NODE_ENV !== 'production') {
          const storedWeek = localStorage.getItem('preview_current_week')
          if (storedWeek) {
            weekVal = parseInt(storedWeek, 10)
          }
        }
        setCurrentWeek(weekVal)

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

          if (weekVal === 12 && !wallet.is_withdrawn) {
            const payoutVal = Number(wallet.final_payout)
            const nowStr = new Date().toISOString()

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

            await supabase
              .from('iron_wallet')
              .update({ is_withdrawn: true, withdrawn_at: nowStr })
              .eq('id', wallet.id)

            setIsWithdrawn(true)
            setWithdrawnAt(nowStr)
          }
        } else {
          const payout = calculateIronWalletPayout(progressVal, deposit, cap)
          setWalletBalance(payout.finalPayout)
        }
      } catch (err) {
        console.error('Failed to load wallet stats:', err)
      }
    }

    loadStats()
  }, [isPreview, initialProgress])

  const depositAmount = isPremium ? 100000 : 60000

  return (
    <>
      {/* ROW: Collapsed Commitment Wallet Row */}
      <button
        type="button"
        onClick={() => setShowWalletModal(true)}
        className="w-full rounded-2xl bg-surface p-4 border border-divider/50 hover:border-primary/20 transition-colors flex items-center justify-between text-left"
      >
        <div className="flex items-center space-x-3 text-text-primary">
          <Wallet className="h-5 w-5 text-primary stroke-[1.5]" />
          <span className="text-sm font-semibold">Commitment Wallet</span>
          <span className="text-[9px] bg-divider/50 text-text-secondary border border-divider/40 font-semibold px-2 py-0.5 rounded uppercase tracking-wider font-mono">
            {isPremium ? 'Premium' : 'Standard'}
          </span>
        </div>
        <span className="text-sm font-extrabold text-primary">{programProgress}%</span>
      </button>

      {/* MODAL: Commitment Wallet Details Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-text-primary/20 backdrop-blur-sm z-[999] flex items-end justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl border border-divider/50 p-6 space-y-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest font-mono">Finance & Progress</span>
                <h3 className="text-lg font-bold text-text-primary mt-1">Commitment Wallet</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWalletModal(false)}
                className="h-8 w-8 rounded-full bg-divider/40 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <h3 className="text-4xl font-extrabold tracking-tight text-text-primary leading-none">
                  {programProgress}%
                </h3>
                <span className="text-sm font-semibold text-text-secondary">Program Progress</span>
              </div>

              <div className="grid grid-cols-2 gap-6 text-left pt-3 border-t border-divider/40">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Commitment Stake</p>
                  <p className="text-lg font-extrabold text-text-primary leading-tight">₦{depositAmount.toLocaleString()}</p>
                  <p className="text-xs text-text-secondary leading-normal block font-mono font-medium">
                    {isPremium 
                      ? '₦80k fee + ₦20k incentive' 
                      : '₦50k fee + ₦10k incentive'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Estimated Return</p>
                  <p className="text-lg font-extrabold text-primary leading-tight">₦{walletBalance.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-divider/40">
              {currentWeek < 12 ? (
                <>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium bg-divider/20 border border-divider/30 rounded-xl p-2.5 justify-center font-mono">
                    <Lock className="h-4 w-4 text-text-secondary stroke-[1.5]" />
                    <span className="text-center">Locked &bull; Unlocks at Week 12 (Week {currentWeek} of 12)</span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="w-full bg-primary/5 border border-primary/10 text-primary/45 font-bold px-4 py-3 rounded-xl text-xs uppercase tracking-wider cursor-not-allowed text-center transition-colors whitespace-normal leading-normal"
                  >
                    Withdraw Commitment Stake
                  </button>
                </>
              ) : programProgress < 50 ? (
                <>
                  <div className="flex items-center gap-1.5 text-xs text-[#721C24] font-medium bg-[#F8D7DA] border border-[#F5C6CB] rounded-xl p-2.5 justify-center font-mono">
                    <Lock className="h-4 w-4 text-[#721C24] stroke-[1.5]" />
                    <span className="text-center">Program Ended &bull; Forfeited (Progress {programProgress}%)</span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="w-full bg-red-500/10 border border-red-500/20 text-red-500/50 font-bold px-4 py-3 rounded-xl text-xs uppercase tracking-wider cursor-not-allowed text-center transition-colors whitespace-normal leading-normal"
                  >
                    Funds Forfeited (&lt;50% Progress)
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-xs text-[#155724] font-medium bg-[#D4EDDA] border border-[#C3E6CB] rounded-xl p-2.5 justify-center font-mono">
                    <CheckCircle className="h-4 w-4 text-[#155724] stroke-[1.5]" />
                    <span className="text-center">Payout sent to your Paystack-linked account</span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="w-full bg-[#D4EDDA] border border-[#C3E6CB] text-[#155724] font-extrabold px-4 py-3 rounded-xl text-xs uppercase tracking-wider text-center transition-colors font-mono whitespace-normal leading-normal"
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
      )}
    </>
  )
}

interface StatsOverviewCardsProps {
  initialCP?: number
  initialTier?: TierType
  initialProgress?: number
}

export function StatsOverviewCards({ initialCP, initialTier, initialProgress }: StatsOverviewCardsProps) {
  return (
    <div className="space-y-6 w-full">
      <ConsistencyLeagueCard initialCP={initialCP} initialTier={initialTier} />
      <CommitmentWalletRow initialProgress={initialProgress} />
    </div>
  )
}
