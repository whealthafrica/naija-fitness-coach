'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  getClientDetail,
  generateClientAiInsight,
  approveProposedPathway,
  dismissStruggleFlag,
  assignTaskToClient,
  getSuggestedTasksForClient,
  logOutreachAction
} from '../actions'
import type { SuggestedTask } from '../actions'
import {
  Loader2,
  ChevronLeft,
  Sparkles,
  RefreshCw,
  Flag,
  CheckCircle,
  X,
  Plus,
  Heart,
  Activity,
  Phone,
  MessageSquare,
  History,
  TrendingUp,
  Clock,
  Sliders,
  HelpCircle
} from 'lucide-react'

export default function ClientDetailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams.get('id')

  // States
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // AI Insight
  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState<string | null>(null)

  // Flag action loading state
  const [flagActionLoading, setFlagActionLoading] = useState<Record<string, boolean>>({})

  // Task assignment form
  const [assignOpen, setAssignOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskType, setTaskType] = useState<'TIMER' | 'SLIDER' | 'MCQ'>('TIMER')
  const [durationMinutes, setDurationMinutes] = useState(10)
  const [sliderMin, setSliderMin] = useState(1)
  const [sliderMax, setSliderMax] = useState(10)
  const [sliderStep, setSliderStep] = useState(1)
  const [sliderUnit, setSliderUnit] = useState('')
  const [mcqQuestion, setMcqQuestion] = useState('')
  const [mcqOptionsStr, setMcqOptionsStr] = useState('Option A, Option B')
  const [mcqCorrectOption, setMcqCorrectOption] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)

  // Outreach log
  const [outreachChannel, setOutreachChannel] = useState('WhatsApp')
  const [outreachSummary, setOutreachSummary] = useState('')
  const [outreachLoading, setOutreachLoading] = useState(false)

  // AI-suggested tasks panel
  // Suggestions come from the existing tasks table via retrieval (condition + difficulty tier).
  // Never fabricated — same grounding rule as the video/MCQ pipeline.
  const [suggestions, setSuggestions] = useState<SuggestedTask[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const [suggestionsGenerated, setSuggestionsGenerated] = useState(false)
  const [addingSuggestionId, setAddingSuggestionId] = useState<string | null>(null)

  // Progression Chart Period Filters
  const [chartPeriod, setChartPeriod] = useState<'weekly' | 'monthly'>('weekly')

  // Load Client Data
  const loadClient = async () => {
    if (!clientId) {
      setError('Client ID is missing in URL.')
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await getClientDetail(clientId)
    if (res.success) {
      setDetail(res)
    } else {
      setError(res.error || 'Failed to load client detail.')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadClient()
  }, [clientId])

  // AI generation
  const handleGenerateInsight = async () => {
    if (!clientId) return
    setInsightLoading(true)
    setInsightError(null)
    const res = await generateClientAiInsight(clientId)
    if (res.success) {
      setInsight(res.insight || null)
    } else {
      setInsightError(res.error || 'AI generation failed.')
    }
    setInsightLoading(false)
  }

  // Approve struggle flag pathway
  const handleApproveFlag = async (flagId: string, pathway: any[]) => {
    setFlagActionLoading(prev => ({ ...prev, [flagId]: true }))
    const res = await approveProposedPathway(flagId, pathway)
    if (res.success) {
      loadClient()
    } else {
      alert(res.error || 'Failed to approve pathway.')
    }
    setFlagActionLoading(prev => ({ ...prev, [flagId]: false }))
  }

  // Dismiss struggle flag
  const handleDismissFlag = async (flagId: string) => {
    setFlagActionLoading(prev => ({ ...prev, [flagId]: true }))
    const res = await dismissStruggleFlag(flagId)
    if (res.success) {
      loadClient()
    } else {
      alert(res.error || 'Failed to dismiss flag.')
    }
    setFlagActionLoading(prev => ({ ...prev, [flagId]: false }))
  }

  // Submit task assignment
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return

    if (!taskTitle.trim()) {
      alert('Task title is required.')
      return
    }

    setAssignLoading(true)

    const extraConfig = {
      durationMinutes,
      sliderMin,
      sliderMax,
      sliderStep,
      sliderUnit,
      mcqQuestion: mcqQuestion || undefined,
      mcqOptions: mcqOptionsStr.split(',').map(o => o.trim()).filter(Boolean),
      mcqCorrectOption: mcqCorrectOption || undefined
    }

    const res = await assignTaskToClient(clientId, taskTitle, taskDesc, taskType, extraConfig)
    if (res.success) {
      alert('Task successfully assigned.')
      setAssignOpen(false)
      setTaskTitle('')
      setTaskDesc('')
      setMcqQuestion('')
      loadClient()
    } else {
      alert(res.error || 'Task assignment failed.')
    }
    setAssignLoading(false)
  }

  // Submit outreach log
  const handleLogOutreach = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !outreachSummary.trim()) return

    setOutreachLoading(true)
    const res = await logOutreachAction(clientId, outreachChannel, outreachSummary)
    if (res.success) {
      setOutreachSummary('')
      loadClient()
    } else {
      alert(res.error || 'Outreach log failed.')
    }
    setOutreachLoading(false)
  }

  // Generate AI-suggested tasks from the existing task library
  const handleGenerateSuggestions = async () => {
    if (!clientId) return
    setSuggestionsLoading(true)
    setSuggestionsError(null)
    setSuggestionsGenerated(false)
    const res = await getSuggestedTasksForClient(clientId)
    if (res.success) {
      setSuggestions(res.suggestions || [])
      setSuggestionsGenerated(true)
    } else {
      setSuggestionsError(res.error || 'Failed to generate suggestions.')
    }
    setSuggestionsLoading(false)
  }

  // Add a suggested task via the same assignTaskToClient path as manual entry.
  // CP-only, no Program Progress impact — same rule enforced by assignTaskToClient.
  const handleAddSuggestion = async (s: SuggestedTask) => {
    if (!clientId) return
    setAddingSuggestionId(s.id)
    const extraConfig = s.taskType === 'TIMER'
      ? { durationMinutes: s.durationMinutes ?? 10 }
      : s.taskType === 'SLIDER'
      ? { sliderMin: 1, sliderMax: 10, sliderStep: 1, sliderUnit: '' }
      : { mcqOptions: ['Yes', 'No', 'Partially'] }
    const res = await assignTaskToClient(clientId, s.title, s.description, s.taskType, extraConfig)
    if (res.success) {
      // Remove it from the suggestions list to signal it's been queued
      setSuggestions(prev => prev.filter(t => t.id !== s.id))
      loadClient()
    } else {
      alert(res.error || 'Task assignment failed.')
    }
    setAddingSuggestionId(null)
  }

  // Helper to compile SVG Line Points for Progression
  const getSvgCoordinates = (completions: any[], type: 'progress' | 'cp', daysLimit: number) => {
    const width = 450
    const height = 150
    const padding = 20

    const now = new Date()
    const points: { x: number; y: number; val: number; label: string }[] = []

    // Compile values for each day
    for (let i = daysLimit - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const dayEndTimestamp = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime()

      let val = 0
      if (type === 'progress') {
        // Approximate program progress (percentage of completions vs estimated target)
        const done = completions.filter(c => new Date(c.completed_at).getTime() <= dayEndTimestamp).length
        val = Math.min(100, (done / 24) * 100)
      } else {
        // CP Accumulation: 5 for check-ins, 10 for checkpoints, 15 for vital logs
        val = completions
          .filter(c => new Date(c.completed_at).getTime() <= dayEndTimestamp)
          .reduce((sum, c) => {
            if (c.task_type === 'lesson_checkpoint_mid') return sum + 5
            if (c.task_type === 'lesson_checkpoint_end') return sum + 10
            return sum + 15
          }, 0)
      }

      points.push({ x: 0, y: 0, val, label: dateStr })
    }

    // Map to SVG coordinates
    const maxVal = Math.max(...points.map(p => p.val), type === 'progress' ? 100 : 50)
    const minVal = 0

    points.forEach((p, idx) => {
      p.x = padding + (idx / (points.length - 1)) * (width - padding * 2)
      const ratio = maxVal === minVal ? 0.5 : (p.val - minVal) / (maxVal - minVal)
      p.y = height - padding - ratio * (height - padding * 2)
    })

    return points
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F8F0] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#781818]" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-[#F8F8F0] p-8 text-center text-[#100808]/60">
        <p className="font-semibold text-lg">{error || 'Could not load client detail.'}</p>
        <button onClick={() => router.push('/coach/dashboard')} className="mt-4 text-[#781818] font-bold text-sm">
          Return to Dashboard
        </button>
      </div>
    )
  }

  const { profile, vitals, completions, flags, outreachLogs } = detail
  const pendingFlags = flags.filter((f: any) => f.status === 'pending')

  // SVG Chart points
  const daysLimit = chartPeriod === 'weekly' ? 7 : 30
  const progressPoints = getSvgCoordinates(completions, 'progress', daysLimit)
  const cpPoints = getSvgCoordinates(completions, 'cp', daysLimit)

  return (
    <div className="min-h-screen bg-[#F8F8F0] text-[#100808] font-sans pb-16">
      {/* Top Navbar */}
      <header className="bg-white border-b border-[#100808]/8 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/coach/dashboard')}
            className="flex items-center gap-2 text-xs font-bold text-[#100808]/60 hover:text-[#100808] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <span className="font-bold text-sm uppercase text-[#781818]">Patient Profile</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        {/* Profile Header Card */}
        <div className="bg-white border border-[#100808]/8 rounded-2xl p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{profile.name}</h1>
              <p className="text-sm text-[#100808]/60 mt-1">{profile.condition}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold bg-[#F8F8F0] border border-[#100808]/15 px-3 py-1.5 rounded-full uppercase tracking-wider text-[#781818]">
                {profile.tier} Tier
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#100808]/8">
            <div>
              <span className="text-[10px] font-bold text-[#100808]/40 uppercase tracking-wider block">Program Progress</span>
              <span className="text-xl font-bold block text-[#781818] mt-1">{profile.programProgress.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#100808]/40 uppercase tracking-wider block">Consistency Points</span>
              <span className="text-xl font-bold block mt-1">{profile.cp}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] font-bold text-[#100808]/40 uppercase tracking-wider block">Patient Since</span>
              <span className="text-sm font-semibold block mt-1">
                {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Grid Layout for Desktop screens */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT 2 COLUMNS: Charts & History Logs */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Progression Charts */}
            <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-[#781818]" />
                  Patient Progression Graphs
                </h3>

                <div className="flex gap-2">
                  <button
                    onClick={() => setChartPeriod('weekly')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                      chartPeriod === 'weekly' ? 'bg-[#781818] text-white border-transparent' : 'bg-white text-[#100808]/60 border-[#100808]/15 hover:bg-[#F8F8F0]'
                    }`}
                  >
                    Weekly View
                  </button>
                  <button
                    onClick={() => setChartPeriod('monthly')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                      chartPeriod === 'monthly' ? 'bg-[#781818] text-white border-transparent' : 'bg-white text-[#100808]/60 border-[#100808]/15 hover:bg-[#F8F8F0]'
                    }`}
                  >
                    Monthly View
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chart 1: Program Progress */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#100808]/50 uppercase tracking-wider block">Program Pathway Progress (%)</span>
                  <div className="border border-[#100808]/8 rounded-xl p-3 bg-[#F8F8F0]/30 flex items-center justify-center">
                    <svg viewBox="0 0 450 150" className="w-full h-auto">
                      <line x1="20" y1="20" x2="430" y2="20" stroke="#100808" strokeOpacity="0.05" />
                      <line x1="20" y1="75" x2="430" y2="75" stroke="#100808" strokeOpacity="0.05" />
                      <line x1="20" y1="130" x2="430" y2="130" stroke="#100808" strokeOpacity="0.05" />

                      <path
                        d={progressPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                        fill="none"
                        stroke="#C8923C"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />

                      {progressPoints.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#C8923C" />
                      ))}

                      <text x="20" y="145" fontSize="8" fontWeight="bold" fill="#100808" fillOpacity="0.4">
                        {progressPoints[0]?.label}
                      </text>
                      <text x="410" y="145" fontSize="8" fontWeight="bold" fill="#100808" fillOpacity="0.4" textAnchor="end">
                        {progressPoints[progressPoints.length - 1]?.label}
                      </text>
                    </svg>
                  </div>
                </div>

                {/* Chart 2: Consistency Points */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#100808]/50 uppercase tracking-wider block">Consistency Points (CP) Accumulation</span>
                  <div className="border border-[#100808]/8 rounded-xl p-3 bg-[#F8F8F0]/30 flex items-center justify-center">
                    <svg viewBox="0 0 450 150" className="w-full h-auto">
                      <line x1="20" y1="20" x2="430" y2="20" stroke="#100808" strokeOpacity="0.05" />
                      <line x1="20" y1="75" x2="430" y2="75" stroke="#100808" strokeOpacity="0.05" />
                      <line x1="20" y1="130" x2="430" y2="130" stroke="#100808" strokeOpacity="0.05" />

                      <path
                        d={cpPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                        fill="none"
                        stroke="#781818"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />

                      {cpPoints.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#781818" />
                      ))}

                      <text x="20" y="145" fontSize="8" fontWeight="bold" fill="#100808" fillOpacity="0.4">
                        {cpPoints[0]?.label}
                      </text>
                      <text x="410" y="145" fontSize="8" fontWeight="bold" fill="#100808" fillOpacity="0.4" textAnchor="end">
                        {cpPoints[cpPoints.length - 1]?.label}
                      </text>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Side-by-side Vitals and completions logs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Vitals Log */}
              <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-[#781818]" />
                  Vitals History Logs
                </h3>

                {vitals.length === 0 ? (
                  <p className="text-xs text-[#100808]/40 italic">No vitals readings logged by patient.</p>
                ) : (
                  <div className="overflow-y-auto max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#100808]/8 text-[#100808]/40 font-bold uppercase tracking-wider text-[10px] pb-2">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Weight</th>
                          <th className="pb-2">Blood Sugar</th>
                          <th className="pb-2">Blood Pressure</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#100808]/5">
                        {vitals.map((v: any) => (
                          <tr key={v.id}>
                            <td className="py-2.5 text-[#100808]/60 font-sans">
                              {new Date(v.recorded_at).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 font-semibold">{v.weight ? `${v.weight} kg` : '—'}</td>
                            <td className="py-2.5 font-semibold">{v.blood_sugar ? `${v.blood_sugar} mg/dL` : '—'}</td>
                            <td className="py-2.5 font-semibold">
                              {v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic} mmHg` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Completions Log */}
              <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  Task Completions History
                </h3>

                {completions.length === 0 ? (
                  <p className="text-xs text-[#100808]/40 italic">No task completions recorded yet.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {completions.map((c: any) => (
                      <div key={c.id} className="flex justify-between items-start py-2.5 border-b border-[#100808]/5 last:border-0 text-xs">
                        <div>
                          <p className="font-semibold">{c.task_id}</p>
                          <p className="text-[10px] text-[#100808]/40 mt-0.5">
                            Type: {c.task_type} · Choice: {c.reflective_choice || 'N/A'}
                          </p>
                        </div>
                        <span className="text-[10px] text-[#100808]/40 font-sans">
                          {new Date(c.completed_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Outreach Interaction History (Full Desktop block) */}
            <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold flex items-center gap-1.5">
                <History className="h-4 w-4 text-[#100808]/60" />
                Detailed Outreach Logs
              </h3>

              {outreachLogs.length === 0 ? (
                <p className="text-xs text-[#100808]/40 italic">No outreach logs recorded.</p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {outreachLogs.map((log: any) => (
                    <div key={log.id} className="p-4 border border-[#100808]/5 bg-[#F8F8F0]/30 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[#781818] uppercase tracking-wider">{log.channel}</span>
                        <span className="text-[#100808]/40">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-[#100808]/80 leading-relaxed font-sans">{log.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Sidebar Controls */}
          <div className="space-y-6">
            
            {/* Active Self Report Pause (Section 5) */}
            {detail.activePause && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-neutral-800 font-bold">
                  <Clock className="h-4 w-4 text-neutral-500" />
                  <span>Self-reported Pause</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-800">
                    Reason: {
                      detail.activePause.reason === 'health_flareup' ? 'Health flare-up' :
                      detail.activePause.reason === 'overwhelmed' ? 'Feeling overwhelmed' :
                      detail.activePause.reason === 'busy_life' ? 'Busy with life/family' : 'Just need a short break'
                    }
                  </p>
                  {detail.activePause.note && (
                    <p className="text-xs text-neutral-600 italic mt-2 bg-neutral-100 p-2.5 rounded-xl border border-neutral-200/50">
                      &ldquo;{detail.activePause.note}&rdquo;
                    </p>
                  )}
                  <span className="text-[10px] text-neutral-500 block mt-2.5">
                    Active until {new Date(detail.activePause.pause_ends_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}

            {/* Pending flags Resolve Center */}
            {pendingFlags.length > 0 && (
              <div className="space-y-4">
                {pendingFlags.map((flag: any) => (
                  <div key={flag.id} className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-red-900 font-bold">
                      <Flag className="h-4 w-4 text-red-600" />
                      <span>Struggle Alert</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-red-900 leading-relaxed">{flag.trigger_reason}</p>
                      <p className="text-[10px] text-red-700/80 mt-1 leading-relaxed">
                        Note: Calculated on a 14-day rolling window, distinct from the all-time Program Progress.
                      </p>
                      <span className="text-[9px] text-red-500 block mt-1.5">
                        Triggered {new Date(flag.triggered_at).toLocaleDateString()}
                      </span>
                    </div>

                    {flag.proposed_pathway && flag.proposed_pathway.length > 0 && (
                      <div className="bg-white border border-red-200/50 rounded-xl p-3 space-y-2">
                        <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider block">AI-Proposed simplified Tasks:</span>
                        <div className="space-y-1">
                          {flag.proposed_pathway.map((task: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-[10px] text-red-800 bg-red-50/50 px-2 py-1.5 rounded-lg">
                              <span className="truncate max-w-[130px]">{task.title || task.id}</span>
                              <span className="font-bold uppercase text-[8px] tracking-wider text-red-600">{task.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleApproveFlag(flag.id, flag.proposed_pathway || [])}
                        disabled={flagActionLoading[flag.id]}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#781818] text-white text-[10px] font-bold hover:opacity-90 disabled:opacity-50"
                      >
                        {flagActionLoading[flag.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleDismissFlag(flag.id)}
                        disabled={flagActionLoading[flag.id]}
                        className="flex-1 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-white text-[10px] font-bold hover:bg-red-100/50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* AI Insight Summary Generator */}
            <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#C8923C]" />
                  AI Summary
                </h3>
                <button
                  onClick={handleGenerateInsight}
                  disabled={insightLoading}
                  className="text-xs font-bold text-[#781818] hover:opacity-75 flex items-center gap-1"
                >
                  {insightLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {insight ? 'Regenerate' : 'Generate'}
                </button>
              </div>

              {insightError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold">
                  {insightError}
                </div>
              )}

              {insight ? (
                <div className="text-xs text-[#100808]/80 leading-relaxed font-sans bg-[#F8F8F0] p-4 border border-[#100808]/5 rounded-xl whitespace-pre-wrap">
                  {insight}
                </div>
              ) : (
                <p className="text-xs text-[#100808]/40 italic">
                  Generate progress insights and clinical recommendations using Gemini API.
                </p>
              )}
            </div>

            {/* Task Generator & Custom Assignment */}
            <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-[#100808]/60" />
                  Assign Tasks
                </h3>
                <button
                  onClick={() => setAssignOpen(!assignOpen)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#781818] text-white text-xs font-bold hover:opacity-90"
                >
                  {assignOpen ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {assignOpen ? 'Cancel' : 'New Task'}
                </button>
              </div>

              <div className="text-[10px] text-[#100808]/60 leading-relaxed bg-[#F8F8F0] border border-divider/40 p-3 rounded-xl mt-2">
                <strong>Note:</strong> Custom coach-assigned tasks earn Consistency Points (CP) but are excluded from the client&apos;s Program Progress and payout calculations by design.
              </div>

              {/* ── Suggested Tasks for Tomorrow ────────────────────────── */}
              <div className="border border-[#C8923C]/30 rounded-2xl p-4 bg-[#FBF7F0] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#C8923C] uppercase tracking-widest block">AI Retrieval</span>
                    <h4 className="font-bold text-sm text-[#100808]">Suggested Tasks for Tomorrow</h4>
                  </div>
                  <button
                    id="generate-suggestions-btn"
                    onClick={handleGenerateSuggestions}
                    disabled={suggestionsLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C8923C] text-white text-[11px] font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {suggestionsLoading
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Sparkles className="h-3 w-3" />}
                    {suggestionsLoading ? 'Retrieving...' : suggestionsGenerated ? 'Regenerate' : 'Generate Suggestions'}
                  </button>
                </div>

                {suggestionsError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-[11px] font-semibold">
                    {suggestionsError}
                  </div>
                )}

                {suggestionsGenerated && !suggestionsLoading && (
                  <>
                    {suggestions.length === 0 ? (
                      <p className="text-[11px] text-[#100808]/50 italic py-2">
                        No suggestions available right now. The task library may not yet have entries for this condition.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {suggestions.map(s => (
                          <div
                            key={s.id}
                            className="flex items-start justify-between gap-3 p-3 bg-white border border-[#100808]/8 rounded-xl"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-[12px] text-[#100808]">{s.title}</p>
                                <span className="text-[9px] font-bold bg-[#781818]/10 text-[#781818] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  {s.taskType}
                                </span>
                                {s.difficulty === 'easy' && (
                                  <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Easier
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#100808]/55 mt-0.5 leading-relaxed line-clamp-2">{s.description}</p>
                            </div>
                            <button
                              id={`add-suggestion-${s.id}`}
                              onClick={() => handleAddSuggestion(s)}
                              disabled={addingSuggestionId === s.id}
                              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#781818] text-white text-[11px] font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                            >
                              {addingSuggestionId === s.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Plus className="h-3 w-3" />}
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {!suggestionsGenerated && !suggestionsLoading && (
                  <p className="text-[11px] text-[#100808]/40 italic">
                    Pulls 2-4 tasks from the library matched to this client&apos;s condition and recent pace.
                  </p>
                )}
              </div>

              {assignOpen && (
                <form onSubmit={handleAssignTask} className="space-y-4 p-4 border border-[#100808]/10 rounded-xl bg-[#F8F8F0]/30 text-xs">
                  <div>
                    <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Task Title</label>
                    <input
                      type="text"
                      required
                      value={taskTitle}
                      onChange={e => setTaskTitle(e.target.value)}
                      placeholder="e.g. 10-Min Walk"
                      className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-xs text-[#100808] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Instructions</label>
                    <textarea
                      value={taskDesc}
                      onChange={e => setTaskDesc(e.target.value)}
                      placeholder="Details..."
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-xs text-[#100808] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Verification Type</label>
                    <select
                      value={taskType}
                      onChange={e => setTaskType(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-xs text-[#100808] bg-white focus:outline-none"
                    >
                      <option value="TIMER">TIMER (Countdown)</option>
                      <option value="SLIDER">SLIDER (Log scale)</option>
                      <option value="MCQ">MCQ (Multiple choice)</option>
                    </select>
                  </div>

                  {taskType === 'TIMER' && (
                    <div>
                      <label className="block font-bold text-[#100808]/50 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[#100808]/60" />
                        Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        value={durationMinutes}
                        onChange={e => setDurationMinutes(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                  )}

                  {taskType === 'SLIDER' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Min</label>
                        <input
                          type="number"
                          value={sliderMin}
                          onChange={e => setSliderMin(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-2 py-1.5 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Max</label>
                        <input
                          type="number"
                          value={sliderMax}
                          onChange={e => setSliderMax(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-2 py-1.5 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Step</label>
                        <input
                          type="number"
                          value={sliderStep}
                          onChange={e => setSliderStep(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-2 py-1.5 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Unit</label>
                        <input
                          type="text"
                          value={sliderUnit}
                          onChange={e => setSliderUnit(e.target.value)}
                          placeholder="mg/dL"
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-2 py-1.5 text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {taskType === 'MCQ' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Question</label>
                        <input
                          type="text"
                          value={mcqQuestion}
                          onChange={e => setMcqQuestion(e.target.value)}
                          placeholder="e.g. Choose one:"
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Options (commas)</label>
                        <input
                          type="text"
                          value={mcqOptionsStr}
                          onChange={e => setMcqOptionsStr(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={assignLoading}
                    className="w-full py-2.5 rounded-xl bg-[#781818] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {assignLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Assign Task'}
                  </button>
                </form>
              )}

              {/* Custom assigned tasks */}
              {profile.customTaskList && profile.customTaskList.length > 0 ? (
                <div className="space-y-2 mt-4 text-xs">
                  <span className="font-bold text-[#100808]/40 uppercase tracking-wider block">Assigned Tasks ({profile.customTaskList.length})</span>
                  <div className="space-y-2">
                    {profile.customTaskList.map((t: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 border border-[#100808]/8 rounded-xl bg-white">
                        <div className="max-w-[70%]">
                          <p className="font-semibold">{t.title}</p>
                          <p className="text-[10px] text-[#100808]/50 truncate">{t.desc}</p>
                        </div>
                        <span className="text-[9px] font-bold bg-[#F8F8F0] px-2 py-1 rounded-full uppercase tracking-wider text-[#781818]">
                          {t.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#100808]/40 italic">No custom tasks assigned.</p>
              )}
            </div>

            {/* Outreach Resolution Center */}
            <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-[#781818]" />
                Outreach Center
              </h3>

              <div className="flex gap-2">
                <a
                  href={`tel:${profile.phone}`}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-[#100808]/15 rounded-xl text-xs font-bold text-[#100808] hover:bg-[#F8F8F0] transition-colors"
                >
                  <Phone className="h-3.5 w-3.5 text-[#C8923C]" />
                  Call
                </a>
                <a
                  href={`https://wa.me/${profile.phone?.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-[#100808]/15 rounded-xl text-xs font-bold text-[#100808] hover:bg-[#F8F8F0] transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                  WhatsApp
                </a>
              </div>

              <form onSubmit={handleLogOutreach} className="space-y-3 pt-3 border-t border-[#100808]/8 text-xs">
                <div>
                  <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Channel</label>
                  <select
                    value={outreachChannel}
                    onChange={e => setOutreachChannel(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-1.5 text-xs text-[#100808] bg-white focus:outline-none"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Voice Call">Voice Call</option>
                    <option value="SMS">SMS Message</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Summary</label>
                  <textarea
                    required
                    value={outreachSummary}
                    onChange={e => setOutreachSummary(e.target.value)}
                    placeholder="Outreach details..."
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-xs text-[#100808] bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={outreachLoading || !outreachSummary.trim()}
                  className="w-full py-2 rounded-xl bg-[#100808] text-white text-xs font-bold hover:bg-[#100808]/80 disabled:opacity-50 transition-all"
                >
                  {outreachLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Log Outreach'}
                </button>
              </form>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  )
}
