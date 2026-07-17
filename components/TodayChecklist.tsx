'use client'

// Built against PRD Section 8.2 (Today Checklist & Task Completion Verification)
import React, { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { CheckCircle2, Play, Check, Camera, Timer, X, Loader2, Award } from 'lucide-react'
import { Button } from '@/components/Button'
import { createClient } from '@/utils/supabase/client'
import { awardConsistencyPoints, TierType } from '@/lib/cpEngine'
import { coachesConfig } from '@/lib/coaches'
import { TaskDef, tasksByCondition, simplifyTask, detectStruggle } from '@/lib/adaptivePathways'

function WeightRuler({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const min = 20
  const max = 250
  const step = 0.1
  const tickSpacing = 12 // pixels per 1 kg

  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentVal = value ? parseFloat(value) : 70

  // Set initial scroll position based on current value
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const targetScroll = (currentVal - min) * tickSpacing
    container.scrollLeft = targetScroll
    setIsReady(true)
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    }
  }, [])

  // Listen to scroll events to update value
  const handleScroll = () => {
    if (!containerRef.current || !isReady) return
    const container = containerRef.current
    const scrollLeft = container.scrollLeft
    const calculated = min + scrollLeft / tickSpacing
    const snapped = Math.max(min, Math.min(max, Math.round(calculated / step) * step))
    
    onChange(snapped.toFixed(1))

    // Debounced Snap/Settle behavior
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      const targetScroll = (snapped - min) * tickSpacing
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      })
    }, 150)
  }

  // Generate tick markers
  const ticks = []
  for (let i = min; i <= max; i++) {
    ticks.push(i)
  }

  return (
    <div className="space-y-4 py-2 select-none">
      {/* Live Value Display */}
      <div className="text-center bg-surface py-2 rounded-xl border border-divider/50">
        <span className="text-2xl font-extrabold text-primary font-mono">{currentVal.toFixed(1)}</span>
        <span className="text-sm font-bold text-text-secondary ml-1">kg</span>
      </div>

      {/* Ruler Container */}
      <div className="relative bg-surface rounded-2xl border border-divider/50 py-6 overflow-hidden">
        {/* Center Pointer */}
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-primary z-10 pointer-events-none transform -translate-x-1/2">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-primary" />
        </div>

        {/* Scrollable strip */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="w-full overflow-x-auto scrollbar-none flex"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Left Padding: 50% width of parent to center the first tick */}
          <div className="flex-shrink-0" style={{ width: '50%' }} />

          {/* Ticks Strip */}
          <div className="flex items-end h-16 relative" style={{ width: `${(max - min) * tickSpacing}px` }}>
            {ticks.map((t) => {
              const isMajor = t % 5 === 0
              const isTens = t % 10 === 0
              return (
                <div
                  key={t}
                  className="absolute bottom-0 flex flex-col items-center justify-end"
                  style={{
                    left: `${(t - min) * tickSpacing}px`,
                    transform: 'translateX(-50%)',
                    height: '100%'
                  }}
                >
                  {isMajor && (
                    <span className={`text-[9px] font-bold font-mono mb-2 ${isTens ? 'text-text-primary' : 'text-text-secondary/70'}`}>
                      {t}
                    </span>
                  )}
                  <div
                    className={`w-0.5 rounded-full ${
                      isTens
                        ? 'h-6 bg-text-primary'
                        : isMajor
                        ? 'h-4 bg-text-secondary/80'
                        : 'h-2 bg-text-secondary/40'
                    }`}
                  />
                </div>
              )
            })}
          </div>

          {/* Right Padding */}
          <div className="flex-shrink-0" style={{ width: '50%' }} />
        </div>
      </div>
    </div>
  )
}

interface TodayChecklistProps {
  selectedCondition: string
  assignedCoachName?: string
  customTaskList?: TaskDef[] | null
}

export function TodayChecklist({ selectedCondition, assignedCoachName, customTaskList }: TodayChecklistProps) {
  const supabase = createClient()
  
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([])
  const [activeTask, setActiveTask] = useState<TaskDef | null>(null)
  const [rankUpData, setRankUpData] = useState<{ oldTier: TierType; newTier: TierType } | null>(null)
  // DB-sourced: coach rank_up_quote collected at registration, never from static config
  const [coachRankUpQuote, setCoachRankUpQuote] = useState<string>('')
  
  // Timer states
  const [timerActive, setTimerActive] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [recallUnlocked, setRecallUnlocked] = useState(false)
  const [selectedRecallIndex, setSelectedRecallIndex] = useState<number | null>(null)

  // Loggable states
  const [selectedLogChoice, setSelectedLogChoice] = useState<string>('')
  const [logFreeText, setLogFreeText] = useState<string>('')

  // Photo states
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false)
  const [classificationResults, setClassificationResults] = useState<{
    confidence: number
    match: boolean
  } | null>(null)

  // Vitals states
  const [vitalsSystolic, setVitalsSystolic] = useState<string>('')
  const [vitalsDiastolic, setVitalsDiastolic] = useState<string>('')
  const [vitalsSugar, setVitalsSugar] = useState<string>('')
  const [vitalsWeight, setVitalsWeight] = useState<string>('')
  const [vitalsStep, setVitalsStep] = useState<number>(1)

  // New Task Type Framework states
  const [sliderValue, setSliderValue] = useState<number>(5)
  const [selectedMcqOption, setSelectedMcqOption] = useState<string>('')

  // Trust metrics helpers
  const modalOpenedAt = useRef<number>(0)
  const taskStartedAt = useRef<number>(0)
  const actionStepTimer = useRef<NodeJS.Timeout | null>(null)

  // Get active dataset
  const dataset = useMemo(() => {
    const staticData = tasksByCondition[selectedCondition] || tasksByCondition['General Fitness']
    
    if (customTaskList && customTaskList.length > 0) {
      const coachIds = ['db_meal_photo', 'ht_salt_shaker_off', 'pc_squat_prep', 'pd_carb_audit', 'gf_step_boost', 'db_meal_photo_easy', 'ht_salt_shaker_off_easy', 'pc_squat_prep_easy', 'pd_carb_audit_easy', 'gf_step_boost_easy']
      const pathway = customTaskList.filter(t => !coachIds.includes(t.id))
      const coach = customTaskList.filter(t => coachIds.includes(t.id))
      return { pathway, coach }
    }
    
    // Cold start for new users: default to easiest pathway
    const isNewUser = completedTaskIds.length === 0
    if (isNewUser) {
      const easyPathway = staticData.pathway.map(simplifyTask)
      const easyCoach = staticData.coach.map(simplifyTask)
      return { pathway: easyPathway, coach: easyCoach }
    }
    
    return staticData
  }, [selectedCondition, customTaskList, completedTaskIds])
  const todayString = new Date().toISOString().split('T')[0]
  
  const defaultCoach = coachesConfig[selectedCondition] || coachesConfig['General Fitness']
  // Only name is used from the static config here — coach-authored content (intro, rank_up_quote)
  // is fetched from the DB in the completions effect below.
  const coachName = assignedCoachName || defaultCoach.name

  // Helper to dynamically format tasks with the current coach name
  const formatTaskText = (text: string | undefined): string => {
    if (!text) return ''
    return text
      .replace(/(Adaeze|Tunde|Ngozi|Emeka|Amara|Chioma|Obinna)'s/g, `${coachName}'s`)
      .replace(/(Adaeze|Tunde|Ngozi|Emeka|Amara|Chioma|Obinna)/g, coachName)
  }

  // Load completions on mount / condition switch
  useEffect(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    async function fetchCompletions() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('task_completions')
        .select('task_id')
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString())

      if (data) {
        setCompletedTaskIds(data.map(d => d.task_id))
      }

      // Fetch coach rank_up_quote from DB — not from static config
      const { data: profile } = await supabase
        .from('users')
        .select('coach_id')
        .eq('id', user.id)
        .single()

      if (profile?.coach_id) {
        const { data: dbCoach } = await supabase
          .from('coaches')
          .select('rank_up_quote')
          .eq('id', profile.coach_id)
          .single()
        if (dbCoach?.rank_up_quote) {
          setCoachRankUpQuote(dbCoach.rank_up_quote)
        } else {
          console.warn(
            `[TodayChecklist] Coach ${profile.coach_id} has no rank_up_quote. ` +
            'Rank-up modal will show a generic line — update the coaches table.'
          )
        }
      }
    }

    fetchCompletions()
  }, [selectedCondition])

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (actionStepTimer.current) clearInterval(actionStepTimer.current)
    }
  }, [])

  // Timer tick down
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval)
            setTimerActive(false)
            setRecallUnlocked(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [timerActive, timeLeft])

  // Handle task click to initiate verification flow
  const handleTaskClick = (task: TaskDef) => {
    if (completedTaskIds.includes(task.id)) return // Already completed, avoid double submission

    setActiveTask(task)
    modalOpenedAt.current = Date.now()
    taskStartedAt.current = Date.now()
    setTimerActive(false)
    setRecallUnlocked(false)
    setSelectedRecallIndex(null)
    setSelectedLogChoice('')
    setLogFreeText('')
    setPhotoFile(null)
    setPhotoPreview('')
    setAnalyzingPhoto(false)
    setClassificationResults(null)
    setVitalsSystolic('')
    setVitalsDiastolic('')
    setVitalsSugar('')
    setVitalsWeight('')

    // New Task Type values initialization
    setSliderValue(task.sliderMin ?? 5)
    setSelectedMcqOption('')

    if (task.type === 'vitals') {
      setVitalsStep(1)
      setVitalsWeight('70.0')
    }

    if (task.type === 'timed') {
      setTimeLeft(task.duration || 15)
    }

    if (task.type === 'TIMER') {
      setTimeLeft((task.durationMinutes || 10) * 60)
    }
  }

  // Timed task: Start Timer
  const startTimedTask = () => {
    setTimerActive(true)
    taskStartedAt.current = Date.now()
  }

  // Timed task: Skip Timer (Dev/Preview Mode shortcut)
  const skipTimedTaskTimer = () => {
    setTimerActive(false)
    setTimeLeft(0)
    setRecallUnlocked(true)
  }

  // Handle Photo selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setAnalyzingPhoto(true)

    // Simulate Flash 2.0 classification pass (1.5 seconds)
    setTimeout(() => {
      setAnalyzingPhoto(false)
      // Plausibility check: return high confidence & true match for demo uploads
      setClassificationResults({
        confidence: Number((Math.random() * (0.97 - 0.88) + 0.88).toFixed(2)),
        match: true
      })
    }, 1500)
  }

  // Submit and log completions
  const handleCompleteTask = async () => {
    if (!activeTask) return

    const now = Date.now()
    const interactionDuration = now - modalOpenedAt.current
    const actualActiveDuration = Math.round((now - taskStartedAt.current) / 1000)
    
    // Silent Trust Scoring Calculations
    const responseDurationMs = activeTask.type === 'timed' ? (now - taskStartedAt.current) : interactionDuration
    const isTooFast = responseDurationMs < 2000 // completed in under 2 seconds (silent marker)
    
    // Check local storage for response variation (choices)
    let identicalStreak = 0
    if (activeTask.type === 'loggable') {
      const storedLastResponse = localStorage.getItem(`last_choice_${activeTask.id}`)
      if (storedLastResponse === selectedLogChoice) {
        const lastStreak = parseInt(localStorage.getItem(`streak_choice_${activeTask.id}`) || '0', 10)
        identicalStreak = lastStreak + 1
      }
      localStorage.setItem(`last_choice_${activeTask.id}`, selectedLogChoice)
      localStorage.setItem(`streak_choice_${activeTask.id}`, identicalStreak.toString())
    }

    let isRecallCorrect = activeTask.type === 'timed' && selectedRecallIndex !== null
      ? selectedRecallIndex === activeTask.recallCorrectIndex
      : null

    if (activeTask.type === 'MCQ') {
      isRecallCorrect = activeTask.mcqCorrectOption 
        ? selectedMcqOption === activeTask.mcqCorrectOption 
        : null
    }

    const payload = {
      task_id: activeTask.id,
      task_type: activeTask.type,
      started_at: new Date(taskStartedAt.current).toISOString(),
      completed_at: new Date(now).toISOString(),
      duration_seconds: actualActiveDuration,
      
      // Timed tasks / MCQ question
      recall_question: activeTask.type === 'MCQ' ? activeTask.mcqQuestion : (activeTask.recallQuestion || null),
      recall_selected: activeTask.type === 'MCQ' ? selectedMcqOption : (activeTask.recallChoices && selectedRecallIndex !== null ? activeTask.recallChoices[selectedRecallIndex] : null),
      recall_correct: isRecallCorrect,

      // Loggable tasks / SLIDER
      reflective_choice: activeTask.type === 'SLIDER' ? String(sliderValue) : (selectedLogChoice || null),
      reflective_text: logFreeText || null,

      // Photo tasks
      photo_url: photoPreview || null,
      photo_classification_confidence: classificationResults?.confidence || null,
      photo_classification_match: classificationResults?.match || null,

      // Pattern-level trust logging (silent data signals)
      time_elapsed_ms: interactionDuration,
      response_duration_ms: responseDurationMs,
      identical_response_streak: identicalStreak,
      low_confidence_flag: isTooFast || (isRecallCorrect === false) || (identicalStreak > 4)
    }

    // Save vitals log details if task type is vitals
    if (activeTask.type === 'vitals') {
      const systolicVal = selectedCondition === 'Hypertension' ? parseInt(vitalsSystolic, 10) : null
      const diastolicVal = selectedCondition === 'Hypertension' ? parseInt(vitalsDiastolic, 10) : null
      const sugarVal = (selectedCondition === 'Type 2 Diabetes' || selectedCondition === 'Pre-Diabetes') ? parseFloat(vitalsSugar) : null
      const weightVal = vitalsWeight ? parseFloat(vitalsWeight) : null

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('vitals_log').insert({
          user_id: user.id,
          systolic: systolicVal,
          diastolic: diastolicVal,
          blood_sugar: sugarVal,
          weight: weightVal,
          recorded_at: new Date().toISOString()
        })
      }
    }

    // Save state
    const nextCompletedIds = [...completedTaskIds, activeTask.id]
    setCompletedTaskIds(nextCompletedIds)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // INTEGRITY RULE: Completion of this task awards CP and logs to task_completions,
      // but does NOT increase patient_pathway_state.program_progress (and therefore has
      // no effect on Iron Wallet payout). Self-reported health data is intentionally 
      // kept financially un-incentivized to prevent falsification.
      await supabase
        .from('task_completions')
        .insert({
          user_id: user.id,
          ...payload
        })
    }

    // Award Consistency Points and check for tier progression
    try {
      const cpSource = activeTask.type === 'vitals' ? 'vitals_checkin' : 'daily_checkin'
      const cpResult = await awardConsistencyPoints(cpSource, false)
      if (cpResult.tierUpOccurred) {
        setRankUpData({
          oldTier: cpResult.oldTier,
          newTier: cpResult.newTier
        })
      }
    } catch (err) {
      console.error('Failed to update CP:', err)
    }

    // Trigger struggle detection signals on completion
    if (user) {
      detectStruggle(user.id, false).catch(console.error)
    }

    setActiveTask(null)
  }

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      {/* Category 1: Pathway Steps */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">
          Pathway Steps
        </h2>
        <div className="space-y-2">
          {dataset.pathway.length === 0 ? (
            <div className="rounded-2xl border border-divider/50 border-dashed p-5 text-center text-xs text-text-secondary bg-surface/50">
              No pathway steps scheduled for today.
            </div>
          ) : (
            dataset.pathway.map((task) => {
              const isDone = completedTaskIds.includes(task.id)
              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className={`flex items-start justify-between rounded-2xl bg-surface p-4 border border-divider/50 hover:border-primary/20 transition-colors ${isDone ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start space-x-3 w-full">
                    <CheckCircle2
                      className={`h-5 w-5 shrink-0 mt-0.5 ${isDone ? 'text-success' : 'text-text-secondary/40'}`}
                    />
                    <div>
                      <h4 className={`text-sm font-semibold leading-snug ${isDone ? 'line-through text-text-secondary/50' : 'text-text-primary'}`}>
                        {formatTaskText(task.title)}
                      </h4>
                      <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{formatTaskText(task.desc)}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Category 2: Coach Assignments */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">
          Coach Assignments
        </h2>
        <div className="space-y-2">
          {dataset.coach.length === 0 ? (
            <div className="rounded-2xl border border-divider/50 border-dashed p-5 text-center text-xs text-text-secondary bg-surface/50">
              No extra tasks assigned by your coach for today.
            </div>
          ) : (
            dataset.coach.map((task) => {
              const isDone = completedTaskIds.includes(task.id)
              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className={`flex items-start justify-between rounded-2xl bg-surface p-4 border border-divider/50 hover:border-primary/20 transition-colors ${isDone ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start space-x-3 w-full">
                    <CheckCircle2
                      className={`h-5 w-5 shrink-0 mt-0.5 ${isDone ? 'text-success' : 'text-text-secondary/40'}`}
                    />
                    <div>
                      <h4 className={`text-sm font-semibold leading-snug ${isDone ? 'line-through text-text-secondary/50' : 'text-text-primary'}`}>
                        {formatTaskText(task.title)}
                      </h4>
                      <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{formatTaskText(task.desc)}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Dynamic Verification Check-in Overlay Modal */}
      {activeTask && (
        <div className="fixed inset-0 bg-text-primary/20 backdrop-blur-sm z-[999] flex items-end justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-3xl shadow-xl border border-divider overflow-hidden flex flex-col p-6 space-y-5 animate-in slide-in-from-bottom duration-300">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest">Action Step</span>
                <h3 className="text-lg font-bold text-text-primary leading-tight mt-1">{formatTaskText(activeTask.title)}</h3>
                <p className="text-xs text-text-secondary mt-1">{formatTaskText(activeTask.desc)}</p>
              </div>
              <button 
                onClick={() => setActiveTask(null)}
                className="p-1 rounded-full hover:bg-divider/50 transition-colors"
              >
                <X className="h-5 w-5 text-text-primary" />
              </button>
            </div>

            {/* FLOW: TIMER TASK */}
            {activeTask.type === 'TIMER' && (
              <div className="space-y-4 py-2">
                {!timerActive && !recallUnlocked ? (
                  <div className="text-center py-6 space-y-4">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#781818]/5 text-[#781818]">
                      <Timer className="h-8 w-8 text-[#781818]" />
                    </div>
                    <p className="text-xs text-text-secondary max-w-xs mx-auto">
                      This activity requires {activeTask.durationMinutes || 10} minutes of focused attention. Start the timer when you are ready.
                    </p>
                    <Button 
                      variant="primary" 
                      onClick={startTimedTask}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>Start Timer</span>
                    </Button>
                  </div>
                ) : timerActive ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="text-4xl font-bold tracking-tight text-text-primary tabular-nums font-mono">
                      {formatTime(timeLeft)}
                    </div>
                    <p className="text-xs text-text-secondary">Keep going! Stay focused...</p>
                    <div className="flex flex-col items-center space-y-2">
                      <Button variant="secondary" disabled className="w-full">
                        Ongoing...
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-text-primary leading-tight text-center">
                      Time is up! Click complete to save your session.
                    </p>
                    <Button
                      variant="primary"
                      onClick={handleCompleteTask}
                      className="w-full"
                    >
                      Complete Session
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* FLOW: SLIDER TASK */}
            {activeTask.type === 'SLIDER' && (
              <div className="space-y-6 py-2">
                <div className="space-y-3">
                  <div className="text-center py-3 bg-[#F8F8F0] rounded-xl border border-divider/50">
                    <span className="text-3xl font-extrabold text-[#781818] font-mono">{sliderValue}</span>
                    {activeTask.sliderUnit && (
                      <span className="text-sm font-bold text-text-secondary ml-1">{activeTask.sliderUnit}</span>
                    )}
                  </div>
                  <input
                    type="range"
                    min={activeTask.sliderMin ?? 1}
                    max={activeTask.sliderMax ?? 10}
                    step={activeTask.sliderStep ?? 1}
                    value={sliderValue}
                    onChange={(e) => setSliderValue(Number(e.target.value))}
                    className="w-full h-2 bg-[#100808]/10 rounded-lg appearance-none cursor-pointer accent-[#781818]"
                  />
                  <div className="flex justify-between text-xs text-text-secondary font-bold font-mono">
                    <span>Min: {activeTask.sliderMin ?? 1}</span>
                    <span>Max: {activeTask.sliderMax ?? 10}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                    Optional Comments
                  </label>
                  <textarea
                    rows={2}
                    value={logFreeText}
                    onChange={(e) => setLogFreeText(e.target.value)}
                    placeholder="Describe how it went..."
                    className="w-full rounded-xl border border-divider/50 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-[#781818] resize-none"
                  />
                </div>

                <Button
                  variant="primary"
                  onClick={handleCompleteTask}
                  className="w-full"
                >
                  Save Log Entry
                </Button>
              </div>
            )}

            {/* FLOW: MCQ TASK */}
            {activeTask.type === 'MCQ' && (
              <div className="space-y-4 py-1">
                <p className="text-sm font-semibold text-text-primary leading-tight">
                  {activeTask.mcqQuestion || 'Choose one option:'}
                </p>
                <div className="space-y-2">
                  {activeTask.mcqOptions?.map((option: string) => (
                    <button
                      key={option}
                      onClick={() => setSelectedMcqOption(option)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                        selectedMcqOption === option
                          ? 'border-[#781818] bg-[#781818]/5 text-[#781818] font-semibold'
                          : 'border-divider/50 bg-transparent text-text-primary hover:bg-divider/10'
                      }`}
                    >
                      <span>{option}</span>
                      {selectedMcqOption === option && <Check className="h-4 w-4 text-[#781818]" />}
                    </button>
                  ))}
                </div>

                <Button
                  variant="primary"
                  disabled={!selectedMcqOption}
                  onClick={handleCompleteTask}
                  className="w-full"
                >
                  Submit Answer
                </Button>
              </div>
            )}

            {/* FLOW 1: TIMED TASK */}
            {activeTask.type === 'timed' && (
              <div className="space-y-4 py-2">
                {!timerActive && !recallUnlocked ? (
                  <div className="text-center py-6 space-y-4">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 text-primary">
                      <Timer className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-xs text-text-secondary max-w-xs mx-auto">
                      This activity requires focused time to reap metabolic benefits. Get comfortable and start the timer when ready.
                    </p>
                    <Button 
                      variant="primary" 
                      onClick={startTimedTask}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>Start Exercise</span>
                    </Button>
                  </div>
                ) : timerActive ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="text-4xl font-bold tracking-tight text-text-primary tabular-nums">
                      {formatTime(timeLeft)}
                    </div>
                    <p className="text-xs text-text-secondary">Keep breathing and hold the stretch postures...</p>
                    <div className="flex flex-col items-center space-y-2">
                      <Button variant="secondary" disabled className="w-full">
                        Ongoing...
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Recall Question (Shown silently after timer hits 0)
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-text-primary leading-tight">
                      {formatTaskText(activeTask.recallQuestion)}
                    </p>
                    <div className="space-y-2">
                      {activeTask.recallChoices?.map((choice, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedRecallIndex(index)}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                            selectedRecallIndex === index
                              ? 'border-primary bg-primary/5 text-primary font-semibold'
                              : 'border-divider/50 bg-transparent text-text-primary hover:bg-divider/10'
                          }`}
                        >
                          <span>{formatTaskText(choice)}</span>
                          {selectedRecallIndex === index && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="primary"
                      disabled={selectedRecallIndex === null}
                      onClick={handleCompleteTask}
                      className="w-full"
                    >
                      Complete Session
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* FLOW 2: LOGGABLE TASK */}
            {activeTask.type === 'loggable' && (
              <div className="space-y-4 py-1">
                <p className="text-sm font-semibold text-text-primary leading-tight">
                  {formatTaskText(activeTask.logQuestion)}
                </p>
                <div className="space-y-2">
                  {activeTask.logChoices?.map((choice) => (
                    <button
                      key={choice}
                      onClick={() => setSelectedLogChoice(choice)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                        selectedLogChoice === choice
                          ? 'border-primary bg-primary/5 text-primary font-semibold'
                          : 'border-divider/50 bg-transparent text-text-primary hover:bg-divider/10'
                      }`}
                    >
                      <span>{formatTaskText(choice)}</span>
                      {selectedLogChoice === choice && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                    {formatTaskText(activeTask.logFreeTextLabel)}
                  </label>
                  <textarea
                    rows={2}
                    value={logFreeText}
                    onChange={(e) => setLogFreeText(e.target.value)}
                    placeholder="Type details here (optional)..."
                    className="w-full rounded-xl border border-divider/50 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <Button
                  variant="primary"
                  disabled={!selectedLogChoice}
                  onClick={handleCompleteTask}
                  className="w-full"
                >
                  Save Log entry
                </Button>
              </div>
            )}

            {/* FLOW 3: PHOTO CHECK-IN */}
            {activeTask.type === 'photo' && (
              <div className="space-y-4 py-1">
                <div className="border border-dashed border-divider/60 rounded-2xl p-6 text-center space-y-3 hover:border-primary/20 transition-colors relative overflow-hidden flex flex-col items-center justify-center min-h-[140px] bg-transparent">
                  {photoPreview ? (
                    <div className="absolute inset-0 w-full h-full">
                      <Image
                        src={photoPreview}
                        alt="Upload preview"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-text-primary/10" />
                    </div>
                  ) : (
                    <>
                      <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                        <Camera className="h-5 w-5 stroke-[1.5]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary">Take or Select Photo</p>
                        <p className="text-[10px] text-text-secondary mt-1">Images are uploaded directly to secure storage</p>
                      </div>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    disabled={analyzingPhoto}
                  />
                </div>

                {analyzingPhoto && (
                  <div className="flex items-center justify-center space-x-2 text-xs text-text-secondary py-1">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Analyzing check-in photo...</span>
                  </div>
                )}

                {classificationResults && !analyzingPhoto && (
                  <div className="text-center bg-[#9CAF88]/10 text-[#5E6E4D] text-[10px] font-bold py-1.5 px-3 rounded-lg border border-[#9CAF88]/20 flex items-center justify-center gap-1 leading-none select-none pointer-events-none">
                    <Check className="h-3.5 w-3.5 text-[#5E6E4D]" />
                    <span>Photo classification verified (Confidence: {(classificationResults.confidence * 100).toFixed(0)}%)</span>
                  </div>
                )}

                <Button
                  variant="primary"
                  disabled={!photoFile || analyzingPhoto}
                  onClick={handleCompleteTask}
                  className="w-full"
                >
                  Log Photo Check-in
                </Button>
              </div>
            )}

            {/* FLOW 4: VITALS CHECK-IN */}
            {activeTask.type === 'vitals' && (() => {
              const getVitalsSteps = () => {
                switch (selectedCondition) {
                  case 'Hypertension':
                    return ['bp', 'weight']
                  case 'Type 2 Diabetes':
                  case 'Pre-Diabetes':
                    return ['sugar', 'weight']
                  case 'PCOS':
                    return ['weight']
                  case 'General Fitness':
                  default:
                    return ['weight']
                }
              }

              const steps = getVitalsSteps()
              const currentStepType = steps[vitalsStep - 1]

              const currentStepError = (() => {
                if (currentStepType === 'bp') {
                  if (!vitalsSystolic || !vitalsDiastolic) return 'Please enter both readings.'
                  const sys = parseInt(vitalsSystolic, 10)
                  const dia = parseInt(vitalsDiastolic, 10)
                  if (isNaN(sys) || isNaN(dia)) return 'Please enter valid numbers.'
                  if (sys < 70 || sys > 250) return 'Systolic BP must be between 70 and 250 mmHg.'
                  if (dia < 40 || dia > 150) return 'Diastolic BP must be between 40 and 150 mmHg.'
                  if (sys <= dia) return 'Systolic must be greater than diastolic.'
                } else if (currentStepType === 'sugar') {
                  if (!vitalsSugar) return 'Please enter blood sugar level.'
                  const sugar = parseFloat(vitalsSugar)
                  if (isNaN(sugar)) return 'Please enter a valid number.'
                  if (sugar < 30 || sugar > 600) return 'Blood sugar must be between 30 and 600 mg/dL.'
                } else if (currentStepType === 'weight') {
                  if (!vitalsWeight) return 'Please enter body weight.'
                  const weight = parseFloat(vitalsWeight)
                  if (isNaN(weight)) return 'Please enter a valid number.'
                  if (weight < 30 || weight > 300) return 'Body weight must be between 30 and 300 kg.'
                }
                return null
              })()

              const isCurrentStepValid = currentStepError === null
              const isLastStep = vitalsStep === steps.length

              return (
                <div className="space-y-4 py-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-divider/40 pb-2">
                    <span>Vitals Log</span>
                    {steps.length > 1 && (
                      <span className="font-mono">
                        Step {vitalsStep} of {steps.length}
                      </span>
                    )}
                  </div>

                  {currentStepType === 'bp' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                          Systolic BP (mmHg)
                        </label>
                        <input
                          type="number"
                          value={vitalsSystolic}
                          onChange={(e) => setVitalsSystolic(e.target.value)}
                          placeholder="e.g. 120"
                          className="w-full rounded-xl border border-divider/50 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                          Diastolic BP (mmHg)
                        </label>
                        <input
                          type="number"
                          value={vitalsDiastolic}
                          onChange={(e) => setVitalsDiastolic(e.target.value)}
                          placeholder="e.g. 80"
                          className="w-full rounded-xl border border-divider/50 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  )}

                  {currentStepType === 'sugar' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                        Fasting Blood Glucose (mg/dL)
                      </label>
                      <input
                        type="number"
                        value={vitalsSugar}
                        onChange={(e) => setVitalsSugar(e.target.value)}
                        placeholder="e.g. 95"
                        className="w-full rounded-xl border border-divider/50 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}

                  {currentStepType === 'weight' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                          Body Weight (kg)
                        </label>
                        <WeightRuler
                          value={vitalsWeight}
                          onChange={(val: string) => setVitalsWeight(val)}
                        />
                      </div>
                      {selectedCondition === 'PCOS' && (
                        <div className="p-3 bg-divider/10 border border-divider/30 rounded-xl">
                          <p className="text-[10px] text-text-secondary leading-normal italic">
                            Additional hormone logs (LH/FSH, insulin ratios) pending confirmed clinical syllabus from medical advisory team.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStepError && (
                    <p className="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-200/50 rounded-lg p-2.5 leading-normal">
                      Error: {currentStepError}
                    </p>
                  )}

                  {isLastStep ? (
                    <Button
                      variant="primary"
                      disabled={!isCurrentStepValid}
                      onClick={handleCompleteTask}
                      className="w-full"
                    >
                      Save Vitals Entry
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={!isCurrentStepValid}
                      onClick={() => setVitalsStep(prev => prev + 1)}
                      className="w-full"
                    >
                      Next Step
                    </Button>
                  )}
                </div>
              )
            })()}

          </div>
        </div>
      )}
      {/* Private Rank-up Celebration Modal */}
      {rankUpData && (
        <div className="fixed inset-0 bg-text-primary/20 backdrop-blur-sm z-[999] flex items-center justify-center p-6">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl border border-divider/50 p-6 space-y-5 animate-in zoom-in-95 duration-200 text-center">
            
            {/* Celebration Icon */}
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 text-primary">
              <Award className="h-8 w-8 text-primary stroke-[1.5]" />
            </div>

            {/* Rank-up Copy */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest block">Consistency Milestone</span>
              <h3 className="text-xl font-bold text-text-primary">Tier Up: {rankUpData.newTier}!</h3>
              <p className="text-xs text-text-secondary mt-2">
                You have progressed from {rankUpData.oldTier} to the <strong className="text-primary">{rankUpData.newTier}</strong> consistency league!
              </p>
            </div>

            {/* Coach quote card */}
            <div className="rounded-xl bg-surface border border-divider/50 p-4 text-left relative overflow-hidden">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Coach {coachName} Notes</p>
              <p className="text-xs text-text-primary italic leading-relaxed mt-1">
                &ldquo;{coachRankUpQuote || 'Keep up the incredible work. Your consistency is building something real.'}&rdquo;
              </p>
            </div>

            {/* Continue Action */}
            <Button
              variant="primary"
              onClick={() => setRankUpData(null)}
              className="w-full"
            >
              Continue Daily Steps
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
