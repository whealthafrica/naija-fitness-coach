// Built against PRD Section 8.2 (Today / Dashboard Screen)
import { cookies } from 'next/headers'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/server'
import { coachesConfig } from '@/lib/coaches'
import { TodayChecklist } from '@/components/TodayChecklist'
import { getAssignedCoach } from '@/lib/coachResolver'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  let selectedCondition = 'General Fitness'

  const cookieStore = await cookies()
  let coach: { name: string; intro: string; illustration?: string; rankUpQuote: string } | null = null

  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  let customTaskList: any[] | null = null

  // B. Check for database profile
  if (user) {
    const [profileRes, pathwayStateRes] = await Promise.all([
      supabase
        .from('users')
        .select('condition, coach_id')
        .eq('id', user.id)
        .single(),
      supabase
        .from('patient_pathway_state')
        .select('custom_task_list')
        .eq('user_id', user.id)
        .single()
    ])

    const profile = profileRes.data
    const pathwayState = pathwayStateRes.data
    
    if (profile?.condition) {
      selectedCondition = profile.condition
    }

    if (pathwayState?.custom_task_list) {
      customTaskList = pathwayState.custom_task_list as any[]
    }
  }

  // B2. Resolve coach details from database via shared helper
  const dbCoachResolved = await getAssignedCoach(supabase, user?.id, selectedCondition)
  if (dbCoachResolved) {
    coach = dbCoachResolved
  }

  // C. Fallback to condition mapping if no specific coach is resolved from DB.
  if (!coach) {
    const staticCoach = coachesConfig[selectedCondition] || coachesConfig['General Fitness']
    console.warn(
      `[TodayPage] No DB coach resolved for condition "${selectedCondition}". ` +
      'Rendering name-only fallback. Coach intro will show the generic placeholder — check coaches table data.'
    )
    coach = {
      name: staticCoach.name,
      intro: '', // Never pull from static config — intro must come from DB
      illustration: undefined,
      rankUpQuote: '' // Never pull from static config — rank_up_quote must come from DB
    }
  }

  const activeCoach = coach!

  return (
    <div className="space-y-8 pb-8">
      {/* Header section with generous breathing room */}
      <header className="space-y-1 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Our Belief</p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Ekaabo, Friend</h1>
        <p className="text-sm text-text-secondary">Let&apos;s build strength and longevity today.</p>
      </header>

      {/* Coach Greeting Card - Sourced from coaches lookup */}
      <section className="rounded-2xl bg-surface p-5 border border-divider/50 shadow-sm space-y-3">
        <div className="flex items-center space-x-3">
          {activeCoach.illustration ? (
            <div className="h-10 w-10 relative rounded-full overflow-hidden shrink-0">
              <Image
                src={activeCoach.illustration}
                alt={`Coach ${activeCoach.name} Avatar`}
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-[#781818] flex items-center justify-center text-background font-bold text-base select-none shrink-0">
              {activeCoach.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-text-primary">Coach {activeCoach.name}</h3>
            <p className="text-xs text-text-secondary">Your Personal Coach</p>
          </div>
        </div>
        {activeCoach.intro && (
          <p className="text-sm text-text-primary italic leading-relaxed">
            &ldquo;{activeCoach.intro}&rdquo;
          </p>
        )}
      </section>

      {/* Task List and Completion flow */}
      <TodayChecklist selectedCondition={selectedCondition} assignedCoachName={activeCoach.name} customTaskList={customTaskList} />
    </div>
  )
}
