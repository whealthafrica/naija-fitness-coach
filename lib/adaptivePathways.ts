import { createClient } from '@/utils/supabase/client'

export interface TaskDef {
  id: string
  title: string
  desc: string
  type: 'timed' | 'loggable' | 'photo' | 'vitals' | 'TIMER' | 'SLIDER' | 'MCQ'
  duration?: number
  recallQuestion?: string
  recallChoices?: string[]
  recallCorrectIndex?: number
  logQuestion?: string
  logChoices?: string[]
  logFreeTextLabel?: string
  photoCategory?: string
  difficulty?: 'easy' | 'standard'
  durationMinutes?: number
  sliderMin?: number
  sliderMax?: number
  sliderStep?: number
  sliderUnit?: string
  mcqQuestion?: string
  mcqOptions?: string[]
  mcqCorrectOption?: string | null
}


// Database-grade tasks mapping by focus area
export const tasksByCondition: Record<string, { pathway: TaskDef[]; coach: TaskDef[] }> = {
  'Type 2 Diabetes': {
    pathway: [
      {
        id: 'db_vitals_check',
        title: 'Vitals Check-In',
        desc: 'Record your morning blood glucose reading',
        type: 'vitals',
        difficulty: 'standard'
      },
      {
        id: 'db_sugar_log',
        title: 'Blood Sugar Log',
        desc: 'Log your fasting blood glucose levels',
        type: 'loggable',
        logQuestion: 'What was your fasting blood glucose today?',
        logChoices: ['Under 100 mg/dL (Normal)', '100-125 mg/dL (Elevated)', '126+ mg/dL (High)', 'I need to talk to my coach'],
        logFreeTextLabel: 'Any notes on symptoms or meals last night?',
        difficulty: 'standard'
      },
      {
        id: 'db_stretch',
        title: '15-min Stretch',
        desc: 'Follow the glucose-sensitive mobility stretch',
        type: 'timed',
        duration: 15,
        recallQuestion: 'Which stretch did you focus on for muscle glucose uptake?',
        recallChoices: ['Quadriceps Activation Stretch', 'Neck Side Bend', 'Wrist Extension'],
        recallCorrectIndex: 0,
        difficulty: 'standard'
      }
    ],
    coach: [
      {
        id: 'db_meal_photo',
        title: "Tunde's Check: Breakfast Log",
        desc: 'Snap a photo of your glucose-friendly breakfast',
        type: 'photo',
        photoCategory: 'meal',
        difficulty: 'standard'
      }
    ]
  },
  'Hypertension': {
    pathway: [
      {
        id: 'ht_vitals_check',
        title: 'Vitals Check-In',
        desc: 'Record your systolic and diastolic blood pressure',
        type: 'vitals',
        difficulty: 'standard'
      },
      {
        id: 'ht_bp_log',
        title: 'Blood Pressure Log',
        desc: 'Measure and record morning blood pressure',
        type: 'loggable',
        logQuestion: 'What was your blood pressure reading category?',
        logChoices: ['Normal (<120/80)', 'Elevated (120-129/<80)', 'High Stage 1 (130-139/80-89)', 'High Stage 2 (140+/90+)', 'I need to talk to my coach'],
        logFreeTextLabel: 'How did you feel when taking the measurement?',
        difficulty: 'standard'
      },
      {
        id: 'ht_hydration',
        title: 'Morning Hydration',
        desc: 'Drink 500ml of water to support vascular flow',
        type: 'loggable',
        logQuestion: 'What did you drink just now?',
        logChoices: ['Pure Water', 'Zobo (Hibiscus Tea)', 'Unsweetened Coconut Water', 'Other'],
        logFreeTextLabel: 'How hydrated does your body feel?',
        difficulty: 'standard'
      },
      {
        id: 'ht_stretch',
        title: '15-min Stretch',
        desc: 'Follow the vascular relaxation stretch',
        type: 'timed',
        duration: 15,
        recallQuestion: 'Which breathing technique did you use during the stretches?',
        recallChoices: ['4-7-8 Breath Control', 'Rapid Diaphragmatic Breath', 'Mouth Only Panting'],
        recallCorrectIndex: 0,
        difficulty: 'standard'
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
        logFreeTextLabel: 'Any thoughts on the taste without table salt?',
        difficulty: 'standard'
      }
    ]
  },
  'PCOS': {
    pathway: [
      {
        id: 'pc_vitals_check',
        title: 'Vitals Check-In',
        desc: 'Record your current body weight',
        type: 'vitals',
        difficulty: 'standard'
      },
      {
        id: 'pc_meal_log',
        title: 'Hormonal Breakfast Log',
        desc: 'Eat a protein-rich meal within 1 hour of waking',
        type: 'loggable',
        logQuestion: 'What protein source did you include?',
        logChoices: ['Eggs', 'Beans / Akara', 'Fish / Poultry', 'No protein included'],
        logFreeTextLabel: 'Any notes on hunger or energy levels?',
        difficulty: 'standard'
      },
      {
        id: 'pc_stretch',
        title: '15-min Stretch',
        desc: '5-minute pelvic and mobility exercises',
        type: 'timed',
        duration: 15,
        recallQuestion: 'Which posture was held to improve pelvic blood circulation?',
        recallChoices: ['Butterfly Posture (Baddha Konasana)', 'High Plank Hold', 'Seated Forward Fold'],
        recallCorrectIndex: 0,
        difficulty: 'standard'
      }
    ],
    coach: [
      {
        id: 'pc_squat_prep',
        title: "Ngozi's Challenge: Heavy Lift Prep",
        desc: 'Review the kettlebell squat form video and lift prep',
        type: 'loggable',
        logQuestion: "What was Ngozi's safety advice on foot positioning?",
        logChoices: ['Keep feet shoulder-width apart and rooted', 'Stand on tip-toes', 'Keep feet fully together', 'I need to talk to my coach'],
        logFreeTextLabel: 'Any questions for Ngozi about your squat form?',
        difficulty: 'standard'
      }
    ]
  },
  'Pre-Diabetes': {
    pathway: [
      {
        id: 'pd_vitals_check',
        title: 'Vitals Check-In',
        desc: 'Record your morning blood glucose reading',
        type: 'vitals',
        difficulty: 'standard'
      },
      {
        id: 'pd_metabolic_log',
        title: 'Metabolic Log',
        desc: 'Log morning glucose and habit trend',
        type: 'loggable',
        logQuestion: 'Did you get at least 7 hours of rest last night?',
        logChoices: ['Yes, slept well', 'No, disrupted sleep', 'No, slept less than 5 hours', 'I need to talk to my coach'],
        logFreeTextLabel: 'How does your resting energy level feel?',
        difficulty: 'standard'
      },
      {
        id: 'pd_fiber_focus',
        title: 'Fiber & Grain Focus',
        desc: 'Include 10g of soluble fiber in your morning meal',
        type: 'loggable',
        logQuestion: 'What fiber-rich food did you eat?',
        logChoices: ['Oats / Oatmeal', 'Garden Eggs / Vegetables', 'Chia Seeds / Flaxseeds', 'None today'],
        logFreeTextLabel: 'Any digestion notes?',
        difficulty: 'standard'
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
        logFreeTextLabel: 'What starch did you prepare?',
        difficulty: 'standard'
      }
    ]
  },
  'General Fitness': {
    pathway: [
      {
        id: 'gf_vitals_check',
        title: 'Vitals Check-In',
        desc: 'Record your current body weight',
        type: 'vitals',
        difficulty: 'standard'
      },
      {
        id: 'gf_stretches',
        title: 'Morning Stretches',
        desc: 'Follow the 10-minute dynamic mobility routine',
        type: 'timed',
        duration: 15,
        recallQuestion: 'Which joint was warmed up first in the routine?',
        recallChoices: ['Shoulder joints', 'Ankle joints', 'Hip joints'],
        recallCorrectIndex: 0,
        difficulty: 'standard'
      },
      {
        id: 'gf_water',
        title: 'Daily Water Goal',
        desc: 'Drink 1.5L of water throughout the morning',
        type: 'loggable',
        logQuestion: 'How much water have you drunk so far?',
        logChoices: ['500ml (1 bottle)', '1L (2 bottles)', '1.5L+ (Met Goal)', 'Less than 500ml'],
        logFreeTextLabel: 'Any other drinks today?',
        difficulty: 'standard'
      }
    ],
    coach: [
      {
        id: 'gf_step_boost',
        title: "Amara's Challenge: Step Boost",
        desc: 'Add 2,000 steps to your normal daily walk',
        type: 'loggable',
        logQuestion: 'How did you add the extra steps?',
        logChoices: ['Paced during calls', 'Took a longer route home', 'Walked in the morning', 'Did not get the extra steps', 'I need to talk to my coach'],
        logFreeTextLabel: 'How do your legs and joints feel?',
        difficulty: 'standard'
      }
    ]
  }
}

// Helper to convert standard tasks into easier-tier versions programmatically
export function simplifyTask(task: TaskDef): TaskDef {
  const simplified: TaskDef = {
    ...task,
    id: `${task.id}_easy`,
    difficulty: 'easy',
  }

  // Simpler timed tasks: shorter minimum timers (longer user response window / faster completion)
  if (task.type === 'timed' && task.duration) {
    simplified.duration = Math.max(5, Math.round(task.duration / 3))
  }

  // Simpler loggable tasks: fewer choices or simplified prompt questions
  if (task.type === 'loggable' && task.logChoices) {
    simplified.logChoices = task.logChoices.slice(0, 2) // limit options to reduce cognitive load
  }

  return simplified
}

// 1. STRUGGLE DETECTION LAYER (Signal Layer)
export async function detectStruggle(userId: string, isPreview: boolean = false): Promise<{ triggered: boolean; reason: string | null }> {
  // Check active pause first
  if (isPreview) {
    const previewPauseStr = localStorage.getItem('preview_active_pause')
    if (previewPauseStr) {
      const previewPause = JSON.parse(previewPauseStr)
      if (new Date(previewPause.pause_ends_at) > new Date()) {
        // CODE COMMENT: This exists specifically so a patient going through a temporary
        // rough patch isn't auto-flagged to their coach as "non-compliant" during a
        // period they've voluntarily disclosed. This suppression must never be expanded
        // to affect Program Progress/CP/Wallet, which are separate concerns.
        return { triggered: false, reason: null }
      }
    }
  } else {
    const supabase = createClient()
    const { data: activePause } = await supabase
      .from('self_reports')
      .select('pause_ends_at')
      .eq('patient_id', userId)
      .gt('pause_ends_at', new Date().toISOString())
      .order('pause_ends_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activePause) {
      // CODE COMMENT: This exists specifically so a patient going through a temporary
      // rough patch isn't auto-flagged to their coach as "non-compliant" during a
      // period they've voluntarily disclosed. This suppression must never be expanded
      // to affect Program Progress/CP/Wallet, which are separate concerns.
      return { triggered: false, reason: null }
    }
  }
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  let completionRate = 1.0
  let talkToCoachCount = 0

  if (isPreview) {
    const completions = JSON.parse(localStorage.getItem('preview_completions') || '[]')
    const recentCompletions = completions.filter((c: any) => {
      const date = new Date(c.completed_at || c.timestamp)
      return date >= fourteenDaysAgo && c.task_type !== 'vitals'
    })
    completionRate = recentCompletions.length / 10

    const recentCoachRequests = completions.filter((c: any) => {
      const date = new Date(c.completed_at || c.timestamp)
      return date >= sevenDaysAgo && c.reflective_choice === 'I need to talk to my coach'
    })
    talkToCoachCount = recentCoachRequests.length
  } else {
    const supabase = createClient()
    const { data: completions } = await supabase
      .from('task_completions')
      .select('completed_at, reflective_choice, task_type')
      .eq('user_id', userId)
      .gte('completed_at', fourteenDaysAgo.toISOString())

    if (completions) {
      const nonVitals = completions.filter(c => c.task_type !== 'vitals')
      completionRate = nonVitals.length / 10

      const recentCoachRequests = completions.filter(c => {
        const date = new Date(c.completed_at)
        return date >= sevenDaysAgo && c.reflective_choice === 'I need to talk to my coach'
      })
      talkToCoachCount = recentCoachRequests.length
    }
  }

  let triggered = false
  let reason: string | null = null

  if (completionRate < 0.4) {
    triggered = true
    reason = `Rolling 14-day completion rate of non-vitals tasks was ${(completionRate * 100).toFixed(0)}% (below 40% threshold). Completed ${Math.round(completionRate * 10)} of 10 tasks.`
  } else if (talkToCoachCount >= 3) {
    triggered = true
    reason = `Repeated uncertainty signal: requested to talk to coach ${talkToCoachCount} times in the last 7 days.`
  }

  if (triggered && reason) {
    await logStruggleFlag(userId, reason, isPreview)
  }

  return { triggered, reason }
}

// Log a private flag to coach_flags table (un-shown to users)
async function logStruggleFlag(userId: string, reason: string, isPreview: boolean) {
  let condition = 'General Fitness'
  let currentLevel = 1

  if (isPreview) {
    condition = localStorage.getItem('preview_condition') || 'General Fitness'
    currentLevel = parseInt(localStorage.getItem('preview_level') || '1', 10)
  } else {
    const supabase = createClient()
    const { data: profile } = await supabase.from('users').select('condition').eq('id', userId).single()
    const { data: state } = await supabase.from('patient_pathway_state').select('current_level').eq('user_id', userId).single()
    if (profile?.condition) condition = profile.condition
    if (state?.current_level) currentLevel = state.current_level
  }

  const proposedPathway = await generateSimplerPathwayDraft(condition, currentLevel, isPreview)

  if (isPreview) {
    const flags = JSON.parse(localStorage.getItem('preview_coach_flags') || '[]')
    const exists = flags.some((f: any) => f.user_id === userId && f.status === 'pending' && f.trigger_reason === reason)
    if (!exists) {
      flags.push({
        id: `flag_${Date.now()}`,
        user_id: userId,
        trigger_reason: reason,
        triggered_at: new Date().toISOString(),
        status: 'pending',
        proposed_pathway: proposedPathway
      })
      localStorage.setItem('preview_coach_flags', JSON.stringify(flags))
    }
  } else {
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('coach_flags')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .eq('trigger_reason', reason)
      .limit(1)

    if (!existing || existing.length === 0) {
      await supabase.from('coach_flags').insert({
        user_id: userId,
        trigger_reason: reason,
        proposed_pathway: proposedPathway,
        status: 'pending'
      })
    }
  }
}

// 2. SIMPLER PATH GENERATION (RAG / Retrieval Layer)
export async function generateSimplerPathwayDraft(condition: string, level: number, isPreview: boolean = false): Promise<TaskDef[]> {
  if (isPreview) {
    // In Preview Mode, get standard tasks and simplify them
    const list = tasksByCondition[condition] || tasksByCondition['General Fitness']
    return [...list.pathway, ...list.coach].map(simplifyTask)
  }

  const supabase = createClient()

  try {
    const { data: easyTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('condition', condition)
      .eq('difficulty', 'easy')
      .limit(3)

    if (easyTasks && easyTasks.length > 0) {
      return easyTasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        desc: t.description,
        type: t.type as any,
        difficulty: 'easy'
      }))
    }
  } catch (err) {
    console.error('RAG Retrieval failed, falling back to transformed defaults:', err)
  }

  // Fallback defaults
  const list = tasksByCondition[condition] || tasksByCondition['General Fitness']
  return [...list.pathway, ...list.coach].map(simplifyTask)
}

// Generates a mock normalized embedding vector based on text hashing
export function generateMockEmbedding(text: string): number[] {
  const embedding = new Array(1536).fill(0)
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash)
  }
  for (let i = 0; i < 1536; i++) {
    embedding[i] = Math.sin(hash + i) * 0.1
  }
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return embedding.map(val => val / magnitude)
}
