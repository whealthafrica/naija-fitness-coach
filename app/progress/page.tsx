'use client'

// Built against PRD Section 8.3 (Progress View & Consistency Metrics)
import React, { useState, useEffect } from 'react'
import { Calendar, Award, FileText, X, Check, Heart, ShieldAlert } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/Button'
import { ConsistencyLeagueCard, CommitmentWalletRow } from '@/components/StatsOverviewCards'

export default function ProgressPage() {
  interface VitalsLog {
    id: string
    systolic: number | null
    diastolic: number | null
    blood_sugar: number | null
    weight: number | null
    recorded_at: string
  }

  const [completedDays, setCompletedDays] = useState<boolean[]>([])
  const [showPercentage, setShowPercentage] = useState(false)
  const [showClinicalModal, setShowClinicalModal] = useState(false)
  const [vitalsHistory, setVitalsHistory] = useState<VitalsLog[]>([])

  // Specced comparative parameters
  const showUpThisWeek = 5
  const showUpLastWeek = 4
  const thisWeekPercentage = Math.round((showUpThisWeek / 7) * 100)
  const lastWeekPercentage = Math.round((showUpLastWeek / 7) * 100)

  // Generate rolling 28-day history & load vitals
  useEffect(() => {
    async function loadHistoryAndVitals() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 27)
      startDate.setHours(0, 0, 0, 0)

      // 1. Fetch Task Completions
      const { data: completions } = await supabase
        .from('task_completions')
        .select('completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', startDate.toISOString())

      const completedDatesSet = new Set<string>()
      if (completions) {
        completions.forEach(item => {
          const dateStr = new Date(item.completed_at).toISOString().split('T')[0]
          completedDatesSet.add(dateStr)
        })
      }

      const history: boolean[] = []
      for (let i = 27; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        history.push(completedDatesSet.has(dateStr))
      }
      setCompletedDays(history)

      // 2. Fetch Vitals Log
      const { data: vitals } = await supabase
        .from('vitals_log')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })

      if (vitals) {
        setVitalsHistory(vitals)
      }
    }

    loadHistoryAndVitals()
  }, [])

  const getLatestBp = () => {
    const entry = vitalsHistory.find(v => v.systolic !== null && v.diastolic !== null)
    return entry ? { value: `${entry.systolic}/${entry.diastolic} mmHg`, date: new Date(entry.recorded_at) } : null
  }

  const getLatestSugar = () => {
    const entry = vitalsHistory.find(v => v.blood_sugar !== null)
    return entry ? { value: `${entry.blood_sugar} mg/dL`, date: new Date(entry.recorded_at) } : null
  }

  const getLatestWeight = () => {
    const entry = vitalsHistory.find(v => v.weight !== null)
    return entry ? { value: `${entry.weight} kg`, date: new Date(entry.recorded_at) } : null
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    return `${diffDays} days ago`
  }

  const latestBp = getLatestBp()
  const latestSugar = getLatestSugar()
  const latestWeight = getLatestWeight()
  const hasVitals = latestBp || latestSugar || latestWeight

  return (
    <div className="space-y-6">
      {/* Header section with spec citation */}
      <header className="space-y-1 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Analytics</p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Your Journey</h1>
        <p className="text-sm text-text-secondary">Reflecting consistency and daily check-ins.</p>
      </header>

      {/* Consistency League Card */}
      <ConsistencyLeagueCard />

      {/* 28-day Rolling Calendar Dot History Grid */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-accent uppercase tracking-widest">
          28-Day Consistency Log
        </h2>
        <div className="rounded-2xl bg-surface p-5 border border-divider shadow-sm space-y-4">
          <div className="grid grid-cols-7 gap-y-4 gap-x-2 justify-items-center">
            {completedDays.map((isDone, idx) => (
              <div 
                key={idx}
                className={`h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                  isDone 
                    ? 'bg-primary border border-primary' 
                    : 'bg-transparent border-2 border-divider'
                }`}
                title={`Day ${idx + 1}: ${isDone ? 'Completed' : 'Missed'}`}
              >
                {isDone && <Check className="h-3 w-3 text-background stroke-[3px]" />}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] text-text-secondary font-semibold uppercase tracking-wider pt-2 border-t border-divider/50">
            <span>28 Days Ago</span>
            <span>Today</span>
          </div>
        </div>
      </section>

      {/* Commitment Wallet Row */}
      <CommitmentWalletRow />

      {/* Clinical Data Section (Tucked behind tap) */}
      <section className="space-y-2">
        <button
          onClick={() => setShowClinicalModal(true)}
          className="w-full rounded-2xl bg-surface p-4 border border-divider/50 hover:border-primary/20 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center space-x-3 text-text-primary">
            <FileText className="h-5 w-5 text-primary stroke-[1.5]" />
            <span className="text-sm font-semibold">View Clinical Records</span>
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Access</span>
        </button>
      </section>

      {/* Clinical Records Modal Overlay */}
      {showClinicalModal && (
        <div className="fixed inset-0 bg-text-primary/20 backdrop-blur-sm z-[999] flex items-end justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl border border-divider/50 p-6 space-y-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest font-mono">Medical Logs</span>
                <h3 className="text-lg font-bold text-text-primary mt-1">Clinical Records</h3>
              </div>
              <div className="flex items-center gap-2">
                {isPreview && (
                  <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                    Preview Data
                  </span>
                )}
                <button 
                  onClick={() => setShowClinicalModal(false)}
                  className="p-1 rounded-full hover:bg-divider/30 transition-colors"
                >
                  <X className="h-5 w-5 text-text-primary" />
                </button>
              </div>
            </div>

            <div className="space-y-3 py-2">
              {!hasVitals ? (
                <div className="text-center py-6 px-4 bg-transparent border border-dashed border-divider/60 rounded-xl space-y-1">
                  <Heart className="h-8 w-8 text-primary/50 mx-auto stroke-[1.2] mb-1" />
                  <p className="text-xs font-bold text-text-primary">No vitals logged yet</p>
                  <p className="text-[10px] text-text-secondary leading-relaxed">
                    Complete your daily vitals check-in on the Today dashboard to record your first entry.
                  </p>
                </div>
              ) : (
                <>
                  {latestBp && (
                    <div className="rounded-xl border border-divider/50 p-4 bg-transparent flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Blood Pressure</p>
                        <p className="text-base font-extrabold text-text-primary mt-1">{latestBp.value}</p>
                      </div>
                      <span className="text-xs font-medium text-text-secondary font-mono">{formatTimeAgo(latestBp.date)}</span>
                    </div>
                  )}

                  {latestSugar && (
                    <div className="rounded-xl border border-divider/50 p-4 bg-transparent flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Blood Sugar</p>
                        <p className="text-base font-extrabold text-text-primary mt-1">{latestSugar.value}</p>
                      </div>
                      <span className="text-xs font-medium text-text-secondary font-mono">{formatTimeAgo(latestSugar.date)}</span>
                    </div>
                  )}

                  {latestWeight && (
                    <div className="rounded-xl border border-divider/50 p-4 bg-transparent flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Weight</p>
                        <p className="text-base font-extrabold text-text-primary mt-1">{latestWeight.value}</p>
                      </div>
                      <span className="text-xs font-medium text-text-secondary font-mono">{formatTimeAgo(latestWeight.date)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <Button 
              variant="secondary"
              onClick={() => setShowClinicalModal(false)}
              className="w-full"
            >
              Close Records
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
