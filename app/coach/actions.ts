'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { TaskDef } from '@/lib/adaptivePathways'

// Check if we are running in local Preview Mode
const isPreviewMode = () => {
  return process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'
}

// Helper to make raw HTTP requests to Gemini API (avoids unresolved external package installation errors)
async function callGeminiApi(prompt: string, temperature: number, jsonSchema?: any): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environmental variables.')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  const body: any = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: temperature
    }
  }

  if (jsonSchema) {
    body.generationConfig.responseMimeType = 'application/json'
    body.generationConfig.responseSchema = jsonSchema
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw {
      status: response.status,
      message: `Gemini API returned status ${response.status}: ${errorText}`
    }
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Empty response from Gemini API.')
  }

  return text
}

// Exponential backoff retry helper
async function callGeminiWithRetry<T>(fn: () => Promise<T>, attempts = 3, delay = 1000): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    const isRateLimit = err?.status === 429 || err?.message?.includes('429') || err?.statusCode === 429
    if (attempts > 1 && isRateLimit) {
      console.warn(`Gemini 429 rate limit hit. Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return callGeminiWithRetry(fn, attempts - 1, delay * 2)
    }
    throw err
  }
}

// Simple in-memory cache for AI insight rate limiting (3 minutes)
const lastSummaryTimeCache = new Map<string, number>()

// Separate rate-limit cache for suggested tasks panel (3 minutes per client)
const lastSuggestTimeCache = new Map<string, number>()


export async function coachLoginAction(email: string, password: string) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function getCoachDashboardData(simulatedCoachId?: string) {
  if (isPreviewMode()) {
    return {
      success: true,
      role: 'superadmin',
      clients: [
        {
          id: 'preview_client_1',
          name: 'Emeka (Preview)',
          phone: '+234 801 234 5678',
          condition: 'Type 2 Diabetes',
          cp: 120,
          createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
          programProgress: 45.0,
          tier: 'Bronze',
          hasPendingFlag: true,
          pendingFlagReason: 'Compliance below 40% threshold'
        },
        {
          id: 'preview_client_2',
          name: 'Adaeze (Preview)',
          phone: '+234 802 345 6789',
          condition: 'Hypertension',
          cp: 230,
          createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
          programProgress: 68.0,
          tier: 'Silver',
          hasPendingFlag: false,
          pendingFlagReason: null
        },
        {
          id: 'preview_client_3',
          name: 'Ngozi (Preview)',
          phone: '+234 803 456 7890',
          condition: 'PCOS',
          cp: 50,
          createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
          programProgress: 20.0,
          tier: 'Bronze',
          hasPendingFlag: false,
          pendingFlagReason: null
        }
      ],
      notifications: [
        {
          id: 'preview_notif_1',
          type: 'new_patient',
          unread: true,
          createdAt: new Date().toISOString(),
          patientName: 'Emeka (Preview)',
          patientCondition: 'Type 2 Diabetes'
        }
      ],
      stats: {
        total: 3,
        avgProgress: 44.3,
        avgCP: 133.3,
        pendingFlagsCount: 1
      },
      events: [
        { id: 'evt_1', title: 'Weekly Q&A Session', description: 'Interactive group question and answer session.', event_datetime: new Date(Date.now() + 86400000).toISOString(), status: 'upcoming', coach_id: 'coach_preview_1' },
        { id: 'evt_2', title: 'General Fitness Workshop', description: 'Simple techniques for keeping active at home.', event_datetime: new Date(Date.now() + 172800000).toISOString(), status: 'upcoming', coach_id: 'coach_preview_2' }
      ]
    }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. Get Session Info
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { success: false, error: 'Unauthorized session.' }
  }

  // Get user details
  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('role, coach_id')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    return { success: false, error: 'User profile not found.' }
  }

  const isSuperadmin = profile.role === 'superadmin'
  let targetCoachId = profile.coach_id

  if (isSuperadmin) {
    targetCoachId = simulatedCoachId || null
  }

  // 2. Fetch Clients List
  let query = supabase.from('users').select(`
    id,
    name,
    phone,
    condition,
    cp,
    tier,
    created_at,
    coach_id,
    patient_pathway_state (
      program_progress
    ),
    coach_flags (
      id,
      status,
      trigger_reason,
      triggered_at
    )
  `)

  if (targetCoachId) {
    query = query.eq('coach_id', targetCoachId)
  }

  const { data: users, error: usersErr } = await query.order('created_at', { ascending: false })
  if (usersErr) {
    return { success: false, error: usersErr.message }
  }

  // Parse Clients
  const clients = (users || []).map((u: any) => {
    const state = Array.isArray(u.patient_pathway_state) ? u.patient_pathway_state[0] : u.patient_pathway_state
    const flags = Array.isArray(u.coach_flags) ? u.coach_flags : []
    const pendingFlags = flags.filter((f: any) => f.status === 'pending')

    return {
      id: u.id,
      name: u.name || 'New Patient',
      phone: u.phone,
      condition: u.condition || 'General Fitness',
      cp: u.cp || 0,
      tier: u.tier || 'Bronze',
      createdAt: u.created_at,
      programProgress: state?.program_progress ?? 0,
      hasPendingFlag: pendingFlags.length > 0,
      pendingFlagReason: pendingFlags[0]?.trigger_reason || null
    }
  })

  // 3. Compute Metrics
  const total = clients.length
  const avgProgress = total > 0 ? clients.reduce((acc, c) => acc + c.programProgress, 0) / total : 0
  const avgCP = total > 0 ? clients.reduce((acc, c) => acc + c.cp, 0) / total : 0
  const pendingFlagsCount = clients.filter(c => c.hasPendingFlag).length

  // 4. Fetch notifications scoped to this coach (or all for superadmin)
  let notifQuery = supabase.from('coach_notifications').select(`
    id,
    type,
    unread,
    created_at,
    users:patient_id (name, condition)
  `)

  if (targetCoachId) {
    notifQuery = notifQuery.eq('coach_id', targetCoachId)
  }

  const { data: dbNotifications } = await notifQuery.order('created_at', { ascending: false })

  const notifications = (dbNotifications || []).map((n: any) => ({
    id: n.id,
    type: n.type,
    unread: n.unread,
    createdAt: n.created_at,
    patientName: n.users?.name || 'Unknown Patient',
    patientCondition: n.users?.condition || 'Unknown Condition'
  }))

  // 5. Fetch events scoped to this coach (or all for superadmin)
  let eventsQuery = supabase
    .from('coach_events')
    .select('*')
    .order('event_datetime', { ascending: true })

  if (targetCoachId) {
    eventsQuery = eventsQuery.eq('coach_id', targetCoachId)
  }

  const { data: dbEvents } = await eventsQuery

  return {
    success: true,
    role: profile.role,
    clients,
    notifications,
    events: dbEvents || [],
    stats: {
      total,
      avgProgress,
      avgCP,
      pendingFlagsCount
    }
  }
}

export async function getClientDetail(userId: string, simulatedCoachId?: string) {
  if (isPreviewMode()) {
    // Generate dummy task completions for SVG chart plotting
    const completions = []
    const now = new Date()
    for (let i = 15; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      completions.push({
        id: `prev_comp_${i}`,
        task_id: `Task_${i}`,
        task_type: i % 3 === 0 ? 'lesson_checkpoint_mid' : i % 3 === 1 ? 'lesson_checkpoint_end' : 'custom',
        reflective_choice: 'Yes, fully completed',
        completed_at: d.toISOString()
      })
    }

    return {
      success: true,
      profile: {
        id: userId,
        name: userId === 'preview_client_2' ? 'Adaeze (Preview)' : userId === 'preview_client_3' ? 'Ngozi (Preview)' : 'Emeka (Preview)',
        phone: '+234 801 234 5678',
        condition: userId === 'preview_client_2' ? 'Hypertension' : userId === 'preview_client_3' ? 'PCOS' : 'Type 2 Diabetes',
        cp: userId === 'preview_client_2' ? 230 : userId === 'preview_client_3' ? 50 : 120,
        tier: userId === 'preview_client_2' ? 'Silver' : userId === 'preview_client_3' ? 'Bronze' : 'Bronze',
        createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        programProgress: userId === 'preview_client_2' ? 68.0 : userId === 'preview_client_3' ? 20.0 : 45.0,
        customTaskList: [
          { id: '1', title: '15 Min Morning Walk', desc: 'Light aerobic walk', type: 'TIMER' },
          { id: '2', title: 'Record Blood Sugar', desc: 'Fasting glucose level log', type: 'SLIDER' }
        ]
      },
      vitals: [
        { id: 'v1', recorded_at: new Date(Date.now() - 86400000).toISOString(), weight: 78.5, blood_sugar: 110, systolic: 125, diastolic: 82 },
        { id: 'v2', recorded_at: new Date(Date.now() - 86400000 * 4).toISOString(), weight: 79.1, blood_sugar: 125, systolic: 130, diastolic: 85 }
      ],
      completions,
      outreachLogs: [
        { id: 'o1', channel: 'WhatsApp', summary: 'Checked in on progress, reported feeling good.', created_at: new Date(Date.now() - 86400000 * 2).toISOString() }
      ],
      flags: userId === 'preview_client_1' ? [
        {
          id: 'flag_preview_1',
          status: 'pending',
          trigger_reason: 'Compliance below 40% threshold',
          triggered_at: new Date(Date.now() - 86400000 * 3).toISOString(),
          proposed_pathway: [
            { id: 'prop_1', title: '10 Min Easy Walk', type: 'TIMER' },
            { id: 'prop_2', title: 'Simple Self Reflection Check', type: 'MCQ' }
          ]
        }
      ] : [],
      activePause: userId === 'preview_client_2' ? {
        reason: 'health_flareup',
        pause_ends_at: new Date(Date.now() + 86400000 * 5).toISOString()
      } : null
    }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. Session verification
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { success: false, error: 'Unauthorized session.' }
  }

  const { data: currentUserProfile } = await supabase
    .from('users')
    .select('role, coach_id')
    .eq('id', user.id)
    .single()

  if (!currentUserProfile) {
    return { success: false, error: 'CurrentUser profile not found.' }
  }

  const isSuperadmin = currentUserProfile.role === 'superadmin'

  // Fetch client details
  const { data: client, error: clientErr } = await supabase
    .from('users')
    .select(`
      id,
      name,
      phone,
      condition,
      cp,
      tier,
      created_at,
      coach_id,
      patient_pathway_state (
        program_progress,
        current_level,
        custom_task_list
      )
    `)
    .eq('id', userId)
    .single()

  if (clientErr || !client) {
    return { success: false, error: clientErr?.message || 'Client profile not found.' }
  }

  // Security Check: A coach can only see their own clients
  if (!isSuperadmin) {
    const coachRowId = currentUserProfile.coach_id
    if (client.coach_id !== coachRowId) {
      return { success: false, error: 'Unauthorized access to this client.' }
    }
  }

  // Fetch vitals history
  const { data: vitals } = await supabase
    .from('vitals_log')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })

  // Fetch task completions
  const { data: completions } = await supabase
    .from('task_completions')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })

  // Fetch outreach logs
  const { data: outreach } = await supabase
    .from('outreach_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  // Fetch coach flags
  const { data: flags } = await supabase
    .from('coach_flags')
    .select('*')
    .eq('user_id', userId)
    .order('triggered_at', { ascending: false })

  // Fetch active self-report if exists
  const { data: activePause } = await supabase
    .from('self_reports')
    .select('*')
    .eq('patient_id', userId)
    .gt('pause_ends_at', new Date().toISOString())
    .order('pause_ends_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const state = Array.isArray(client.patient_pathway_state)
    ? client.patient_pathway_state[0]
    : client.patient_pathway_state

  return {
    success: true,
    profile: {
      id: client.id,
      name: client.name || 'New Patient',
      phone: client.phone,
      condition: client.condition || 'General Fitness',
      cp: client.cp || 0,
      tier: client.tier || 'Bronze',
      createdAt: client.created_at,
      programProgress: state?.program_progress ?? 0,
      customTaskList: state?.custom_task_list || []
    },
    vitals: vitals || [],
    completions: completions || [],
    outreachLogs: outreach || [],
    flags: flags || [],
    activePause: activePause || null
  }
}

export async function generateClientAiInsight(userId: string) {
  if (isPreviewMode()) {
    return { success: true, insight: 'This is a mock AI Insight generated inside Preview Mode. The patient is doing exceptionally well with compliance and shows positive trends in both glucose stability and physical activity counts.' }
  }

  // Rate Limiting Check (3 minutes)
  const now = Date.now()
  const lastTime = lastSummaryTimeCache.get(userId)
  if (lastTime && now - lastTime < 180000) {
    const secondsLeft = Math.ceil((180000 - (now - lastTime)) / 1000)
    return { success: false, error: `Rate limited. Please wait another ${secondsLeft}s before regenerating.` }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Fetch client details, vitals, and completions
  const { data: client } = await supabase.from('users').select('name, condition').eq('id', userId).single()
  const { data: vitals } = await supabase.from('vitals_log').select('*').eq('user_id', userId).limit(10)
  const { data: completions } = await supabase.from('task_completions').select('*').eq('user_id', userId).limit(20)

  if (!client) {
    return { success: false, error: 'Client not found.' }
  }

  const noData = (!vitals || vitals.length === 0) && (!completions || completions.length === 0)
  if (noData) {
    return { success: true, insight: 'This client has not logged any vital entries or completed tasks yet. Not enough data to generate progress summary insights.' }
  }

  // Construct Prompt
  const vitalsText = (vitals || []).map(v => {
    let detail = ''
    if (v.systolic && v.diastolic) detail += `BP: ${v.systolic}/${v.diastolic} `
    if (v.blood_sugar) detail += `Sugar: ${v.blood_sugar} `
    if (v.weight) detail += `Weight: ${v.weight}kg `
    return `${new Date(v.recorded_at).toLocaleDateString()}: ${detail}`
  }).join('\n')

  const completionsText = (completions || []).map(c => 
    `${new Date(c.completed_at).toLocaleDateString()}: Task ${c.task_id} (${c.task_type}) - Selected: ${c.reflective_choice || 'N/A'}`
  ).join('\n')

  const prompt = `You are a clinical wellness coach analyzing a patient's progress log. Write a concise, supportive summary of the patient's compliance, vital changes, and suggestions for the coach. Ground your response strictly in the provided data. Do not make up facts. Avoid dramatic expressions. No emojis. Do not use em dashes.

Patient: ${client.name}
Condition Focus: ${client.condition}

Recent Vital Readings:
${vitalsText || 'No vitals logged yet.'}

Recent Task Check-ins:
${completionsText || 'No tasks completed yet.'}`

  // Call Gemini API
  // NOTE: GEMINI FREE TIER NOTICE: Free-tier Gemini traffic may be used by Google to improve their products.
  // Move this to a paid-tier key in production before real client health data flows through it.
  try {
    const responseText = await callGeminiWithRetry(async () => {
      return await callGeminiApi(prompt, 0.5)
    })

    lastSummaryTimeCache.set(userId, now)
    return { success: true, insight: responseText }
  } catch (err: any) {
    console.error('Gemini AI summary generation failed:', err)
    return { success: false, error: 'AI generation failed: ' + (err.message || err) }
  }
}

export async function markNotificationAsRead(notificationId: string) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase
    .from('coach_notifications')
    .update({ unread: false })
    .eq('id', notificationId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function approveProposedPathway(flagId: string, customTaskList: any[]) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: flag, error: flagErr } = await supabase
    .from('coach_flags')
    .select('user_id')
    .eq('id', flagId)
    .single()

  if (flagErr || !flag) {
    return { success: false, error: 'Flag not found.' }
  }

  const userId = flag.user_id

  // 1. Fetch current switch status
  const { data: state, error: stateErr } = await supabase
    .from('patient_pathway_state')
    .select('pathway_switch_count, custom_task_list')
    .eq('user_id', userId)
    .single()

  if (stateErr || !state) {
    return { success: false, error: 'Pathway state not found.' }
  }

  const currentSwitchCount = state.pathway_switch_count ?? 0
  if (currentSwitchCount >= 2) {
    return { success: false, error: 'User has reached the maximum cap of 2 pathway switches.' }
  }

  const { data: currentWeek, error: weekErr } = await supabase
    .rpc('get_user_current_week', { p_user_id: userId })

  if (weekErr) {
    return { success: false, error: 'Could not determine patient current week.' }
  }

  const effectiveWeek = (currentWeek as number) + 1
  if (effectiveWeek > 12) {
    return { success: false, error: 'Cannot switch pathway in week 12. No future weeks remain.' }
  }

  // Log in audit table
  const { error: auditErr } = await supabase
    .from('pathway_switch_audit_log')
    .insert({
      user_id: userId,
      flag_id: flagId,
      old_pathway_type: 'standard',
      new_pathway_type: 'simplified',
      old_task_list: state.custom_task_list || [],
      effective_week: effectiveWeek,
      switch_count_at_time: currentSwitchCount + 1
    })

  if (auditErr) {
    return { success: false, error: 'Audit log write failed: ' + auditErr.message }
  }

  // Update State
  const { error: updateStateErr } = await supabase
    .from('patient_pathway_state')
    .update({
      custom_task_list: customTaskList,
      pathway_switch_count: currentSwitchCount + 1,
      pathway_effective_from_week: effectiveWeek
    })
    .eq('user_id', userId)

  if (updateStateErr) {
    return { success: false, error: 'Failed to update pathway state: ' + updateStateErr.message }
  }

  // Create snapshots
  for (let w = effectiveWeek; w <= 12; w++) {
    await supabase
      .from('weekly_task_snapshots')
      .upsert({
        user_id: userId,
        week_number: w,
        tasks_assigned: customTaskList.length,
        tasks_snapshot: customTaskList,
        pathway_type: 'simplified'
      }, { onConflict: 'user_id, week_number' })
  }

  // Set flag approved
  const { error: updateFlagErr } = await supabase
    .from('coach_flags')
    .update({ status: 'approved' })
    .eq('id', flagId)

  if (updateFlagErr) {
    return { success: false, error: updateFlagErr.message }
  }

  revalidatePath('/coach/dashboard')
  return { success: true }
}

export async function dismissStruggleFlag(flagId: string) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase
    .from('coach_flags')
    .update({ status: 'dismissed' })
    .eq('id', flagId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/coach/dashboard')
  return { success: true }
}

export async function assignTaskToClient(
  userId: string,
  taskTitle: string,
  taskDesc: string,
  taskType: 'TIMER' | 'SLIDER' | 'MCQ',
  extraConfig?: {
    durationMinutes?: number
    sliderMin?: number
    sliderMax?: number
    sliderStep?: number
    sliderUnit?: string
    mcqQuestion?: string
    mcqOptions?: string[]
    mcqCorrectOption?: string
  }
) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Fetch pathway state
  const { data: state, error: stateErr } = await supabase
    .from('patient_pathway_state')
    .select('custom_task_list')
    .eq('user_id', userId)
    .single()

  if (stateErr) {
    return { success: false, error: stateErr.message }
  }

  const currentTasks = (state?.custom_task_list as TaskDef[]) || []

  // Create new task structure
  const newTask: any = {
    id: `custom_${Date.now()}`,
    title: taskTitle,
    desc: taskDesc || 'Custom task assigned by your coach.',
    type: taskType,
    difficulty: 'standard'
  }

  if (taskType === 'TIMER') {
    newTask.durationMinutes = extraConfig?.durationMinutes || 10
  } else if (taskType === 'SLIDER') {
    newTask.sliderMin = extraConfig?.sliderMin ?? 1
    newTask.sliderMax = extraConfig?.sliderMax ?? 10
    newTask.sliderStep = extraConfig?.sliderStep ?? 1
    newTask.sliderUnit = extraConfig?.sliderUnit || ''
  } else if (taskType === 'MCQ') {
    newTask.mcqQuestion = extraConfig?.mcqQuestion || 'Select an option:'
    newTask.mcqOptions = extraConfig?.mcqOptions || ['Option A', 'Option B']
    newTask.mcqCorrectOption = extraConfig?.mcqCorrectOption || null
  }

  const updatedTasks = [...currentTasks, newTask]

  const { error: updateErr } = await supabase
    .from('patient_pathway_state')
    .update({ custom_task_list: updatedTasks })
    .eq('user_id', userId)

  if (updateErr) {
    return { success: false, error: updateErr.message }
  }

  // Custom coach-assigned tasks are excluded from Program Progress by design: coach discretion in adding tasks would otherwise create unequal payout paths between patients under different coaches. Custom tasks award CP only.

  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// Suggested Tasks Retrieval
// Queries the existing tasks table (RAG retrieval layer) for real
// library items matching the client's condition and difficulty tier.
// Never fabricates tasks — only returns content already in the DB
// or the static task library (same rule as the video/MCQ pipeline).
// ─────────────────────────────────────────────────────────────

export interface SuggestedTask {
  id: string
  title: string
  description: string
  taskType: 'TIMER' | 'SLIDER' | 'MCQ'
  durationMinutes?: number
  difficulty: 'easy' | 'standard'
}

export async function getSuggestedTasksForClient(userId: string): Promise<{
  success: boolean
  suggestions?: SuggestedTask[]
  error?: string
  rateLimitSecondsLeft?: number
}> {
  if (isPreviewMode()) {
    // Return representative preview suggestions from the static library
    return {
      success: true,
      suggestions: [
        { id: 'db_stretch', title: '15-min Stretch', description: 'Follow the glucose-sensitive mobility stretch', taskType: 'TIMER', durationMinutes: 15, difficulty: 'easy' },
        { id: 'db_sugar_log', title: 'Blood Sugar Log', description: 'Log your fasting blood glucose levels', taskType: 'SLIDER', difficulty: 'standard' },
        { id: 'ht_hydration', title: 'Morning Hydration', description: 'Drink 500ml of water to support vascular flow', taskType: 'SLIDER', difficulty: 'easy' },
      ]
    }
  }

  // Rate limit: 3 minutes per client
  const now = Date.now()
  const lastTime = lastSuggestTimeCache.get(userId)
  if (lastTime && now - lastTime < 180000) {
    const secondsLeft = Math.ceil((180000 - (now - lastTime)) / 1000)
    return { success: false, error: `Rate limited. Try again in ${secondsLeft}s.`, rateLimitSecondsLeft: secondsLeft }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. Fetch client's condition and recent completion rate
  const { data: client } = await supabase
    .from('users')
    .select('condition')
    .eq('id', userId)
    .single()

  if (!client) {
    return { success: false, error: 'Client not found.' }
  }

  const condition = client.condition || 'General Fitness'

  // 2. Determine difficulty tier from 14-day rolling completion rate
  // Same window used for the struggle-flag compliance check.
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentCompletions } = await supabase
    .from('task_completions')
    .select('task_id')
    .eq('user_id', userId)
    .gte('completed_at', fourteenDaysAgo)
    .not('task_id', 'like', 'custom_%')

  // Check for an active struggle flag as a secondary signal
  const { data: activeFlags } = await supabase
    .from('coach_flags')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .limit(1)

  const recentCount = recentCompletions?.length ?? 0
  const hasActiveFlag = (activeFlags?.length ?? 0) > 0
  // Under 8 standard completions in 14 days (~4/week) or active flag → suggest easier tasks
  const difficulty: 'easy' | 'standard' = (recentCount < 8 || hasActiveFlag) ? 'easy' : 'standard'

  // 3. Query real tasks library filtered by condition and difficulty
  // This is the same retrieval mechanism used by generateSimplerPathwayDraft,
  // now exposed for general on-demand use rather than only firing on struggle flags.
  const { data: dbTasks } = await supabase
    .from('tasks')
    .select('id, title, description, type, difficulty')
    .eq('condition', condition)
    .eq('difficulty', difficulty)
    .limit(4)

  // 4. If tasks table is populated, return from DB. Never fabricate.
  if (dbTasks && dbTasks.length > 0) {
    lastSuggestTimeCache.set(userId, now)

    const suggestions: SuggestedTask[] = dbTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      // Map DB type names to the TIMER/SLIDER/MCQ format assignTaskToClient accepts
      taskType: t.type === 'timed' ? 'TIMER' : t.type === 'loggable' ? 'SLIDER' : 'MCQ',
      durationMinutes: t.type === 'timed' ? 10 : undefined,
      difficulty: t.difficulty
    }))

    return { success: true, suggestions }
  }

  // 5. DB tasks table is empty (dev/staging environment not yet seeded).
  // Fall back to static library — still real content, not fabricated.
  // Import inline to avoid circular server/client boundary issues.
  const { tasksByCondition } = await import('@/lib/adaptivePathways')
  const staticPool = tasksByCondition[condition] || tasksByCondition['General Fitness']
  const allStatic = [...(staticPool?.pathway ?? []), ...(staticPool?.coach ?? [])]
    .filter(t => (difficulty === 'easy' ? t.difficulty === 'easy' : true))
    .slice(0, 4)

  if (allStatic.length === 0) {
    return { success: true, suggestions: [] }
  }

  lastSuggestTimeCache.set(userId, now)

  const staticSuggestions: SuggestedTask[] = allStatic.map(t => ({
    id: t.id,
    title: t.title,
    description: t.desc,
    taskType: t.type === 'timed' ? 'TIMER' : t.type === 'loggable' ? 'SLIDER' : 'MCQ',
    durationMinutes: t.duration,
    difficulty: (t.difficulty ?? 'standard') as 'easy' | 'standard'
  }))

  return { success: true, suggestions: staticSuggestions }
}


export async function logOutreachAction(userId: string, channel: string, summary: string) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized.' }

  const { data: profile } = await supabase.from('users').select('coach_id').eq('id', user.id).single()
  const coachId = profile?.coach_id || null

  const { error } = await supabase
    .from('outreach_logs')
    .insert({
      user_id: userId,
      coach_id: coachId,
      channel,
      summary
    })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function createCoachEventAction(
  title: string,
  description: string,
  eventDatetime: string,
  targetCoachId?: string
) {
  if (isPreviewMode()) {
    return { success: true, event: { id: `evt_${Date.now()}`, title, description, event_datetime: eventDatetime, status: 'upcoming', coach_id: targetCoachId || 'coach_preview_1' } }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized.' }

  const { data: profile } = await supabase.from('users').select('coach_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'coach' && profile.role !== 'superadmin')) {
    return { success: false, error: 'Access denied: requires coach or superadmin privilege.' }
  }

  let finalCoachId = targetCoachId || profile.coach_id
  if (!finalCoachId && profile.role === 'superadmin') {
    const { data: firstCoach } = await supabase.from('coaches').select('id').limit(1).single()
    finalCoachId = firstCoach?.id
  }

  if (!finalCoachId) {
    return { success: false, error: 'No associated coach profile found.' }
  }

  const { data: event, error } = await supabase
    .from('coach_events')
    .insert({
      coach_id: finalCoachId,
      title,
      description,
      event_datetime: eventDatetime,
      status: 'upcoming'
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/coach/dashboard')
  revalidatePath('/community')
  return { success: true, event }
}

export async function cancelCoachEventAction(eventId: string) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized.' }

  const { data: profile } = await supabase.from('users').select('coach_id, role').eq('id', user.id).single()
  if (!profile) return { success: false, error: 'User profile not found.' }

  const query = supabase
    .from('coach_events')
    .update({ status: 'cancelled' })
    .eq('id', eventId)

  if (profile.role !== 'superadmin') {
    query.eq('coach_id', profile.coach_id)
  }

  const { error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/coach/dashboard')
  revalidatePath('/community')
  return { success: true }
}

export async function updateCoachPasswordAction(password: string) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// Admin Actions (Superadmin Only)
// ─────────────────────────────────────────────────────────────

export async function registerCoachAction(
  email: string,
  password: string,
  name: string,
  condition: string,
  photoBase64: string,
  photoName: string,
  intro?: string,
  rankUpQuote?: string
) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  if (!photoBase64 || !photoName) {
    return { success: false, error: 'Registration requires a portrait photo upload.' }
  }

  // 1. Verify caller is superadmin
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) return { success: false, error: 'Unauthorized.' }

  const { data: roleCheck } = await supabase.from('users').select('role').eq('id', currentUser.id).single()
  if (roleCheck?.role !== 'superadmin') {
    return { success: false, error: 'Access denied: requires superadmin privilege.' }
  }

  // 2. Validate condition matching filename
  const cleanName = photoName.toLowerCase()
  let isMatched = false

  if (condition === 'Type 2 Diabetes' || condition === 'Pre-Diabetes') {
    isMatched = cleanName.includes('diabetes') || cleanName.includes('tunde') || cleanName.includes('emeka')
  } else if (condition === 'Hypertension') {
    isMatched = cleanName.includes('hypertension') || cleanName.includes('adaeze')
  } else if (condition === 'PCOS') {
    isMatched = cleanName.includes('pcos') || cleanName.includes('ngozi')
  } else if (condition === 'General Fitness') {
    isMatched = cleanName.includes('fitness') || cleanName.includes('amara')
  }

  if (!isMatched) {
    return { success: false, error: `Invalid portrait image filename "${photoName}" for condition "${condition}". Please upload the matching file.` }
  }

  // 3. Upload photo to Supabase Storage bucket 'coach-photos'
  const fileBuffer = Buffer.from(photoBase64.split(',')[1] || photoBase64, 'base64')
  const ext = photoName.split('.').pop() || 'png'
  const storagePath = `portrait_${Date.now()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('coach-photos')
    .upload(storagePath, fileBuffer, {
      contentType: `image/${ext}`,
      upsert: true
    })

  if (uploadErr) {
    return { success: false, error: 'Photo upload failed: ' + uploadErr.message }
  }

  const { data: publicUrlData } = supabase.storage.from('coach-photos').getPublicUrl(storagePath)
  const photoUrl = publicUrlData.publicUrl

  // 4. Create coach record
  const { data: coachRecord, error: coachInsertErr } = await supabase
    .from('coaches')
    .insert({
      name,
      condition,
      illustration: photoUrl,
      intro: intro || `I'm ${name}, your coach. Let's work together to build healthy daily habits.`,
      rank_up_quote: rankUpQuote || `Outstanding work! Keep showing up, step by step.`
    })
    .select()
    .single()

  if (coachInsertErr || !coachRecord) {
    return { success: false, error: 'Failed to create coach profile: ' + (coachInsertErr?.message || 'Unknown error') }
  }

  // 5. Create Auth user via signup
  const { data: authData, error: signupErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role: 'coach',
        coach_id: coachRecord.id
      }
    }
  })

  if (signupErr || !authData.user) {
    // Clean up coach record
    await supabase.from('coaches').delete().eq('id', coachRecord.id)
    return { success: false, error: 'Auth user creation failed: ' + signupErr?.message }
  }

  revalidatePath('/coach/dashboard')
  return { success: true }
}

export async function deactivateOrDeleteCoachAction(coachId: string, reassignToCoachId?: string) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. Verify superadmin
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) return { success: false, error: 'Unauthorized.' }

  const { data: roleCheck } = await supabase.from('users').select('role').eq('id', currentUser.id).single()
  if (roleCheck?.role !== 'superadmin') {
    return { success: false, error: 'Access denied.' }
  }

  // 2. Check active clients
  const { data: activeClients } = await supabase
    .from('users')
    .select('id, name')
    .eq('coach_id', coachId)

  if (activeClients && activeClients.length > 0) {
    if (!reassignToCoachId) {
      const names = activeClients.map(c => c.name).join(', ')
      return {
        success: false,
        error: `Cannot deactivate/delete. Coach has active client assignments: [${names}]. Reassign them first.`
      }
    }

    // Reassign clients
    const { error: reassignErr } = await supabase
      .from('users')
      .update({ coach_id: reassignToCoachId })
      .eq('coach_id', coachId)

    if (reassignErr) {
      return { success: false, error: 'Client reassignment failed: ' + reassignErr.message }
    }
  }

  // 3. Delete or deactivate
  const { error: deleteErr } = await supabase
    .from('coaches')
    .delete()
    .eq('id', coachId)

  if (deleteErr) {
    return { success: false, error: deleteErr.message }
  }

  revalidatePath('/coach/dashboard')
  return { success: true }
}

export async function createPathwayAction(condition: string, youtubeLink: string, checkpointMinutes: number) {
  if (isPreviewMode()) {
    return {
      success: true,
      videoId: 'dQw4w9WgXcQ',
      data: {
        isAmbiguous: false,
        warningReason: 'Video is relevant to the nutritional guidelines for PCOS patients.',
        midPointQuestion: {
          questionText: 'What key mineral was recommended to consume with whole grains?',
          options: ['Zinc', 'Magnesium', 'Iron'],
          correctOption: 'Magnesium'
        },
        endQuestionText: 'Reflect on how you can incorporate more whole grains into your breakfast.'
      }
    }
  }

  // Extract Video ID
  const videoIdMatch = youtubeLink.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
  const videoId = videoIdMatch ? videoIdMatch[1] : null
  if (!videoId) {
    return { success: false, error: 'Invalid YouTube URL link format.' }
  }

  // 1. Fetch transcript
  let transcript = ''
  try {
    transcript = await fetchTranscript(videoId)
  } catch (err: any) {
    console.error('Transcript fetch failed:', err)
    return { success: false, error: 'Could not extract YouTube transcript: ' + err.message }
  }

  // 2. Classify / Ambiguity Check Prompt
  const prompt = `You are a medical syllabus assistant. Analyze the transcript for a video intended to be added to the "${condition}" patient curriculum.

Perform three tasks:
1. Category Ambiguity Check: Determine if this video content is relevant or ambiguous for ${condition}.
2. Mid-point Checkpoint: Create a grounded multiple-choice question from the first half of the video.
3. End-of-lesson Checkpoint: Create a self-reflection question.

Analyze carefully. Do not invent any clinical facts.

Transcript:
${transcript.slice(0, 10000)}`

  // Define structured JSON Schema for Gemini
  const responseSchema = {
    type: 'object',
    properties: {
      isAmbiguous: {
        type: 'boolean',
        description: 'True if the video content is not relevant to the clinical focus of the condition.'
      },
      warningReason: {
        type: 'string',
        description: 'Describe why the video matches or mismatches the condition.'
      },
      midPointQuestion: {
        type: 'object',
        properties: {
          questionText: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' }
          },
          correctOption: { type: 'string', description: 'The exact string from options that is the correct answer.' }
        },
        required: ['questionText', 'options', 'correctOption']
      },
      endQuestionText: {
        type: 'string',
        description: 'A self-reflection check-in question at the end.'
      }
    },
    required: ['isAmbiguous', 'warningReason', 'midPointQuestion', 'endQuestionText']
  }

  try {
    const resultText = await callGeminiWithRetry(async () => {
      return await callGeminiApi(prompt, 0.3, responseSchema)
    })

    const parsed = JSON.parse(resultText)

    return {
      success: true,
      videoId,
      data: parsed
    }
  } catch (err: any) {
    console.error('Gemini Pathway drafting failed:', err)
    return { success: false, error: 'Gemini drafting failed: ' + (err.message || err) }
  }
}

export async function addLessonToDb(
  condition: string,
  title: string,
  youtubeId: string,
  section: string,
  durationText: string,
  durationSeconds: number,
  midQuestionText: string,
  midOptions: string[],
  midCorrectOption: string,
  endQuestionText: string,
  midCheckpointPct = 65,
  endCheckpointPct = 85
) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. Insert Lesson
  const { data: lesson, error: lessonErr } = await supabase
    .from('lessons')
    .insert({
      condition,
      section,
      title,
      youtube_id: youtubeId,
      duration_text: durationText,
      duration_seconds: durationSeconds,
      mid_checkpoint_pct: midCheckpointPct,
      end_checkpoint_pct: endCheckpointPct
    })
    .select()
    .single()

  if (lessonErr || !lesson) {
    return { success: false, error: 'Lesson insert failed: ' + lessonErr?.message }
  }

  // 2. Insert Scenario Question
  const { error: questionErr } = await supabase
    .from('scenario_questions')
    .insert({
      lesson_id: lesson.id,
      question_text: midQuestionText,
      options: midOptions,
      correct_option: midCorrectOption
    })

  if (questionErr) {
    // Cleanup
    await supabase.from('lessons').delete().eq('id', lesson.id)
    return { success: false, error: 'Scenario question insert failed: ' + questionErr.message }
  }

  // 3. Fetch all current lessons of this condition to update pathways config
  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('condition', condition)
    .order('created_at', { ascending: true })

  if (lessons) {
    const formatted = lessons.map(l => ({
      id: l.id,
      title: l.title,
      section: l.section,
      youtubeId: l.youtube_id,
      durationSeconds: l.duration_seconds,
      durationText: l.duration_text,
      midCheckpointPct: l.mid_checkpoint_pct,
      endCheckpointPct: l.end_checkpoint_pct
    }))

    // Upsert into pathways level 1
    await supabase
      .from('pathways')
      .upsert({
        condition,
        level: 1,
        task_list: formatted
      }, { onConflict: 'condition, level' })
  }

  return { success: true }
}

export async function classifyTaskType(title: string, description: string) {
  if (isPreviewMode()) {
    return { success: true, classification: title.toLowerCase().includes('walk') ? 'TIMER' : 'SLIDER' }
  }

  const prompt = `You are a classifier for physical and clinical wellness exercises.
Classify the task below into exactly one of these three task types:
- MCQ: Multiple choice questioning checks.
- TIMER: Countdown exercise duration trackers.
- SLIDER: Scale ranges (weight, blood glucose level logs).

Provide the output strictly as a JSON object matching this schema:
{
  "taskType": "one of MCQ, TIMER, SLIDER",
  "reasoning": "brief explanation"
}

Task Title: ${title}
Task Description: ${description}`

  const responseSchema = {
    type: 'object',
    properties: {
      taskType: {
        type: 'string',
        enum: ['TIMER', 'SLIDER', 'MCQ']
      },
      reasoning: { type: 'string' }
    },
    required: ['taskType', 'reasoning']
  }

  try {
    const resultText = await callGeminiWithRetry(async () => {
      return await callGeminiApi(prompt, 0.3, responseSchema)
    })

    const parsed = JSON.parse(resultText)
    return { success: true, classification: parsed.taskType }
  } catch (err: any) {
    console.error('Gemini classification failed:', err)
    return { success: false, error: err.message || err }
  }
}

// Scraper helper for transcripts
async function fetchTranscript(videoId: string): Promise<string> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  const response = await fetch(watchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, yq=0.9)'
    }
  })
  if (!response.ok) {
    throw new Error(`Failed to load video page. Status: ${response.status}`)
  }
  const html = await response.text()

  // Find playerResponse
  const regex = /"playerResponse":\s*({[\s\S]+?})\s*,\s*"assets"/
  const match = html.match(regex)
  if (!match) {
    throw new Error("Could not extract player response. Video might be unavailable or private.")
  }

  const playerResponse = JSON.parse(match[1])
  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!captionTracks || captionTracks.length === 0) {
    throw new Error("No captions/subtitles found for this video. Please choose a video with English captions.")
  }

  const track = captionTracks.find((t: any) => t.languageCode === 'en') || captionTracks[0]
  const captionsUrl = track.baseUrl
  if (!captionsUrl) {
    throw new Error("Caption tracks found but baseUrl is missing.")
  }

  const captionsRes = await fetch(captionsUrl)
  if (!captionsRes.ok) {
    throw new Error("Failed to load caption XML data.")
  }
  const xml = await captionsRes.text()

  const textRegex = /<text[^>]*>([^<]*)<\/text>/g
  let textMatch
  const sentences: string[] = []
  while ((textMatch = textRegex.exec(xml)) !== null) {
    const sentence = textMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    sentences.push(sentence)
  }

  if (sentences.length === 0) {
    throw new Error("Parsed transcript had 0 characters.")
  }

  return sentences.join(' ')
}

export async function createAnnouncementAction(title: string, body: string) {
  if (isPreviewMode()) {
    return { success: true }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized.' }
  }

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileErr || profile?.role !== 'superadmin') {
    return { success: false, error: 'Unauthorized: Superadmin access required.' }
  }

  const { error } = await supabase
    .from('product_announcements')
    .insert({
      title,
      body,
      created_by: user.id
    })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
