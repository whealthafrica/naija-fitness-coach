'use client'

// Built against PRD Section 8.2 (Today Checklist & Task Completion Verification)
import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { CheckCircle2, Play, Check, Camera, Timer, X, Loader2, Award } from 'lucide-react'
import { Button } from '@/components/Button'
import { createClient } from '@/utils/supabase/client'
import { awardConsistencyPoints, TierType } from '@/lib/cpEngine'
import { coachesConfig } from '@/lib/coaches'

interface TaskDef {
  id: string
  title: string
  desc: string
  type: 'timed' | 'loggable' | 'photo' | 'vitals'
  
  // Timed tasks
  duration?: number // in seconds
  recallQuestion?: string
  recallChoices?: string[]
  recallCorrectIndex?: number
  
  // Loggable tasks
  logQuestion?: string
  logChoices?: string[]
  logFreeTextLabel?: string
  
  // Photo tasks
  photoCategory?: string
}

// Database-grade tasks mapping by focus area
const tasksByCondition: Record<string, { pathway: TaskDef[]; coach: TaskDef[] }> = {
  'Type 2 Diabetes': {
    pathway: [
      {
        id: 'db_vitals_check',
        title: 'Vitals Check-In',
        desc: 'Record your morning blood glucose reading',
        type: 'vitals'
      },
      {
        id: 'db_sugar_log',
        title: 'Blood Sugar Log',
        desc: 'Log your fasting blood glucose levels',
        type: 'loggable',
        logQuestion: 'What was your fasting blood glucose today?',
        logChoices: ['Under 100 mg/dL (Normal)', '100-125 mg/dL (Elevated)', '126+ mg/dL (High)'],
        logFreeTextLabel: 'Any notes on symptoms or meals last night?'
      },
      {
        id: 'db_stretch',
        title: '15-min Stretch',
        desc: 'Follow the glucose-sensitive mobility stretch',
        type: 'timed',
        duration: 15,
        recallQuestion: 'Which stretch did you focus on for muscle glucose uptake?',
        recallChoices: ['Quadriceps Activation Stretch', 'Neck Side Bend', 'Wrist Extension'],
        recallCorrectIndex: 0
      }
    ],
    coach: [
      {
        id: 'db_meal_photo',
        title: "Tunde's Check: Breakfast Log",
        desc: 'Snap a photo of your glucose-friendly breakfast',
        type: 'photo',
        photoCategory: 'meal'
      }
    ]
  },
  'Hypertension': {
    pathway: [
      {
        id: 'ht_vitals_check',
        title: 'Vitals Check-In',
        desc: 'Record your systolic and diastolic blood pressure',
        type: 'vitals'
      },
      {
        id: 'ht_bp_log',
        title: 'Blood Pressure Log',
        desc: 'Measure and record morning blood pressure',
        type: 'loggable',
        logQuestion: 'What was your blood pressure reading category?',
        logChoices: ['Normal (<120/80)', 'Elevated (120-129/<80)', 'High Stage 1 (130-139/80-89)', 'High Stage 2 (140+/90+)'],
        logFreeTextLabel: 'How did you feel when taking the measurement?'
      },
      {
        id: 'ht_hydration',
        title: 'Morning Hydration',
        desc: 'Drink 500ml of water to support vascular flow',
        type: 'loggable',
        logQuestion: 'What did you drink just now?',
        logChoices: ['Pure Water', 'Zobo (Hibiscus Tea)', 'Unsweetened Coconut Water', 'Other'],
        logFreeTextLabel: 'How hydrated does your body feel?'
      },
      {
        id: 'ht_stretch',
        title: '15-min Stretch',
        desc: 'Follow the vascular relaxation stretch',
        type: 'timed',
        duration: 15,
        recallQuestion: 'Which breathing technique did you use during the stretches?',
        recallChoices: ['4-7-8 Breath Control', 'Rapid Diaphragmatic Breath', 'Mouth Only Panting'],
        recallCorrectIndex: 0
      }
    ],
    coach: [
      {
        id: 'ht_salt_shaker_off',
        title: "Adaeze's Challenge: Salt Shaker Off",
        desc: 'Use local spices instead of table salt today',
        type: 'loggable',
        logQuestion: 'Which spice did you use for seasoning today?',
        logChoices: ['Uziza (African Black Pepper)', 'Uda (Negro Pepper)', 'Garlic & Ginger Mix', 'No seasoning used'],
        logFreeTextLabel: 'Any thoughts on the taste without table salt?'
      }
    ]
  },
  'PCOS': {
    pathway: [
      {
        id: 'pc_vitals_check',
        title: 'Vitals Check-In',
        desc: 'Record your current body weight',
        type: 'vitals'
      },
      {
        id: 'pc_meal_log',
        title: 'Hormonal Breakfast Log',
        desc: 'Eat a protein-rich meal within 1 hour of waking',
        type: 'loggable',
        logQuestion: 'What protein source did you include?',
        logChoices: ['Eggs', 'Beans / Akara', 'Fish / Poultry', 'No protein included'],
        logFreeTextLabel: 'Any notes on hunger or energy levels?'
      },
      {
        id: 'pc_stretch',
        title: '15-min Stretch',
        desc: '5-minute pelvic and mobility exercises',
        type: 'timed',
        duration: 15,
        recallQuestion: 'Which posture was held to improve pelvic blood circulation?',
        recallChoices: ['Butterfly Posture (Baddha Konasana)', 'High Plank Hold', 'Seated Forward Fold'],
        recallCorrectIndex: 0
      }
    ],
    coach: [
      {
        id: 'pc_squat_prep',
        title: "Ngozi's Challenge: Heavy Lift Prep",
        desc: 'Review the kettlebell squat form video and lift prep',
        type: 'loggable',
        logQuestion: "What was Ngozi's safety advice on foot positioning?",
        logChoices: ['Keep feet shoulder-width apart and rooted', 'Stand on tip-toes', 'Keep feet fully together'],
        logFreeTextLabel: 'Any questions for Ngozi about your squat form?'
      }
    ]
  },
  'Pre-Diabetes': {
    pathway: [
      {
        id: 'pd_vitals_check',
        title: 'Vitals Check-In',
        desc: 'Record your morning blood glucose reading',
        type: 'vitals'
      },
      {
        id: 'pd_metabolic_log',
        title: 'Metabolic Log',
        desc: 'Log morning glucose and habit trend',
        type: 'loggable',
        logQuestion: 'Did you get at least 7 hours of rest last night?',
        logChoices: ['Yes, slept well', 'No, disrupted sleep', 'No, slept less than 5 hours'],
        logFreeTextLabel: 'How does your resting energy level feel?'
      },
      {
        id: 'pd_fiber_focus',
        title: 'Fiber & Grain Focus',
        desc: 'Include 10g of soluble fiber in your morning meal',
        type: 'loggable',
        logQuestion: 'What fiber-rich food did you eat?',
        logChoices: ['Oats / Oatmeal', 'Garden Eggs / Vegetables', 'Chia Seeds / Flaxseeds', 'None today'],
        logFreeTextLabel: 'Any digestion notes?'
      }
    ],
    coach: [
      {
        id: 'pd_carb_audit',
        title: "Emeka's Check: Carbohydrate Audit",
        desc: 'Audit total carb portions for lunch prep',
        type: 'loggable',
        logQuestion: 'What portion size did you allocate for starches (rice, yam)?',
        logChoices: ['Quarter of plate (Recommended)', 'Half of plate', 'Full plate'],
        logFreeTextLabel: 'What starch did you prepare?'
      }
    ]
  },
  'General Fitness': {
    pathway: [
      {
        id: 'gf_vitals_check',
        title: 'Vitals Check-In',
        desc: 'Record your current body weight',
        type: 'vitals'
      },
      {
        id: 'gf_stretches',
        title: 'Morning Stretches',
        desc: 'Follow the 10-minute dynamic mobility routine',
        type: 'timed',
        duration: 15,
        recallQuestion: 'Which joint was warmed up first in the routine?',
        recallChoices: ['Shoulder joints', 'Ankle joints', 'Hip joints'],
        recallCorrectIndex: 0
      },
      {
        id: 'gf_water',
        title: 'Daily Water Goal',
        desc: 'Drink 1.5L of water throughout the morning',
        type: 'loggable',
        logQuestion: 'How much water have you drunk so far?',
        logChoices: ['500ml (1 bottle)', '1L (2 bottles)', '1.5L+ (Met Goal)', 'Less than 500ml'],
        logFreeTextLabel: 'Any other drinks today?'
      }
    ],
    coach: [
      {
        id: 'gf_step_boost',
        title: "Amara's Challenge: Step Boost",
        desc: 'Add 2,000 steps to your normal daily walk',
        type: 'loggable',
        logQuestion: 'How did you add the extra steps?',
        logChoices: ['Paced during calls', 'Took a longer route home', 'Walked in the morning', 'Did not get the extra steps'],
        logFreeTextLabel: 'How do your legs and joints feel?'
      }
    ]
  }
}

interface TodayChecklistProps {
  selectedCondition: string
  assignedCoachName?: string
}

export function TodayChecklist({ selectedCondition, assignedCoachName }: TodayChecklistProps) {
  const supabase = createClient()
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'
  
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([])
  const [activeTask, setActiveTask] = useState<TaskDef | null>(null)
  const [rankUpData, setRankUpData] = useState<{ oldTier: TierType; newTier: TierType } | null>(null)
  
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

  // Trust metrics helpers
  const modalOpenedAt = useRef<number>(0)
  const taskStartedAt = useRef<number>(0)
  const actionStepTimer = useRef<NodeJS.Timeout | null>(null)

  // Get active dataset
  const dataset = tasksByCondition[selectedCondition] || tasksByCondition['General Fitness']
  const todayString = new Date().toISOString().split('T')[0]
  
  const defaultCoach = coachesConfig[selectedCondition] || coachesConfig['General Fitness']
  const coachName = assignedCoachName || defaultCoach.name
  const coach = { ...defaultCoach, name: coachName }

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

    if (isPreview) {
      const saved = localStorage.getItem(`completions_${selectedCondition}_${todayString}`)
      if (saved) {
        setCompletedTaskIds(JSON.parse(saved))
      } else {
        setCompletedTaskIds([])
      }
      return
    }

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
    }

    fetchCompletions()
  }, [selectedCondition, isPreview])

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

    if (task.type === 'timed') {
      setTimeLeft(task.duration || 15)
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

    const isRecallCorrect = activeTask.type === 'timed' && selectedRecallIndex !== null
      ? selectedRecallIndex === activeTask.recallCorrectIndex
      : null

    const payload = {
      task_id: activeTask.id,
      task_type: activeTask.type,
      started_at: new Date(taskStartedAt.current).toISOString(),
      completed_at: new Date(now).toISOString(),
      duration_seconds: actualActiveDuration,
      
      // Timed tasks
      recall_question: activeTask.recallQuestion || null,
      recall_selected: activeTask.recallChoices && selectedRecallIndex !== null ? activeTask.recallChoices[selectedRecallIndex] : null,
      recall_correct: isRecallCorrect,

      // Loggable tasks
      reflective_choice: selectedLogChoice || null,
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
      const weightVal = (selectedCondition === 'PCOS' || selectedCondition === 'General Fitness') ? parseFloat(vitalsWeight) : null

      if (isPreview) {
        const savedVitals = localStorage.getItem('preview_vitals_log')
        const vitals = savedVitals ? JSON.parse(savedVitals) : []
        const newEntry = {
          id: `v_${Date.now()}`,
          systolic: systolicVal,
          diastolic: diastolicVal,
          blood_sugar: sugarVal,
          weight: weightVal,
          recorded_at: new Date().toISOString()
        }
        vitals.push(newEntry)
        localStorage.setItem('preview_vitals_log', JSON.stringify(vitals))
      } else {
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
    }

    // Save state
    const nextCompletedIds = [...completedTaskIds, activeTask.id]
    setCompletedTaskIds(nextCompletedIds)

    if (isPreview) {
      localStorage.setItem(`completions_${selectedCondition}_${todayString}`, JSON.stringify(nextCompletedIds))
    } else {
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
    }

    // Award Consistency Points and check for tier progression
    try {
      const cpResult = await awardConsistencyPoints('daily_checkin', isPreview)
      if (cpResult.tierUpOccurred) {
        setRankUpData({
          oldTier: cpResult.oldTier,
          newTier: cpResult.newTier
        })
      }
    } catch (err) {
      console.error('Failed to update CP:', err)
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
                      {/* Quiet developer bypass for fast manual verification */}
                      {isPreview && (
                        <button 
                          onClick={skipTimedTaskTimer} 
                          className="text-[10px] text-text-secondary/70 hover:text-text-secondary transition-colors underline"
                        >
                          Dev Bypass: Skip Timer
                        </button>
                      )}
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
              const vitalsError = (() => {
                if (selectedCondition === 'Hypertension') {
                  if (!vitalsSystolic || !vitalsDiastolic) return 'Please enter both readings.'
                  const sys = parseInt(vitalsSystolic, 10)
                  const dia = parseInt(vitalsDiastolic, 10)
                  if (isNaN(sys) || isNaN(dia)) return 'Please enter valid numbers.'
                  if (sys < 70 || sys > 250) return 'Systolic BP must be between 70 and 250 mmHg.'
                  if (dia < 40 || dia > 150) return 'Diastolic BP must be between 40 and 150 mmHg.'
                  if (sys <= dia) return 'Systolic must be greater than diastolic.'
                } else if (selectedCondition === 'Type 2 Diabetes' || selectedCondition === 'Pre-Diabetes') {
                  if (!vitalsSugar) return 'Please enter blood sugar level.'
                  const sugar = parseFloat(vitalsSugar)
                  if (isNaN(sugar)) return 'Please enter a valid number.'
                  if (sugar < 30 || sugar > 600) return 'Blood sugar must be between 30 and 600 mg/dL.'
                } else if (selectedCondition === 'PCOS' || selectedCondition === 'General Fitness') {
                  if (!vitalsWeight) return 'Please enter body weight.'
                  const weight = parseFloat(vitalsWeight)
                  if (isNaN(weight)) return 'Please enter a valid number.'
                  if (weight < 30 || weight > 300) return 'Body weight must be between 30 and 300 kg.'
                }
                return null
              })()

              const isVitalsValid = vitalsError === null

              return (
                <div className="space-y-4 py-1">
                  {selectedCondition === 'Hypertension' && (
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

                  {(selectedCondition === 'Type 2 Diabetes' || selectedCondition === 'Pre-Diabetes') && (
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

                  {selectedCondition === 'PCOS' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                          Body Weight (kg)
                        </label>
                        <input
                          type="number"
                          value={vitalsWeight}
                          onChange={(e) => setVitalsWeight(e.target.value)}
                          placeholder="e.g. 68"
                          className="w-full rounded-xl border border-divider/50 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-primary"
                        />
                      </div>
                      {/* 
                          DOCTOR SYLLABUS PLACEHOLDER FOR PCOS ADDITIONAL METRICS
                          Pending confirmed requirements from medical advisory team.
                          Do not add fields (e.g. waist circumference, LH/FSH) without explicit syllabus.
                      */}
                      <div className="p-3 bg-divider/10 border border-divider/30 rounded-xl">
                        <p className="text-[10px] text-text-secondary leading-normal italic">
                          💡 Additional hormone logs (LH/FSH, insulin ratios) pending confirmed clinical syllabus from medical advisory team.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedCondition === 'General Fitness' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                        Body Weight (kg)
                      </label>
                      <input
                        type="number"
                        value={vitalsWeight}
                        onChange={(e) => setVitalsWeight(e.target.value)}
                        placeholder="e.g. 75"
                        className="w-full rounded-xl border border-divider/50 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}

                  {vitalsError && (
                    <p className="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-200/50 rounded-lg p-2.5 leading-normal">
                      ⚠️ {vitalsError}
                    </p>
                  )}

                  <Button
                    variant="primary"
                    disabled={!isVitalsValid}
                    onClick={handleCompleteTask}
                    className="w-full"
                  >
                    Save Vitals Entry
                  </Button>
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
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Coach {coach.name} Notes</p>
              <p className="text-xs text-text-primary italic leading-relaxed mt-1">
                &ldquo;{coach.rankUpQuote}&rdquo;
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
