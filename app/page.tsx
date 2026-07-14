// Built against PRD Section 8.2 (Today / Dashboard Screen)
import { cookies } from 'next/headers'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/server'
import { coachesConfig } from '@/lib/coaches'
import { TodayChecklist } from '@/components/TodayChecklist'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'
  let selectedCondition = 'General Fitness'

  const cookieStore = await cookies()
  const assignedCoachName = cookieStore.get('preview_assigned_coach')?.value
  const previewCookie = cookieStore.get('preview_condition')?.value
  if (previewCookie) {
    selectedCondition = decodeURIComponent(previewCookie)
  }

  let coach: { name: string; intro: string; illustration: string; rankUpQuote: string } | null = null

  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  // A. Check for cookie-based assigned coach
  if (assignedCoachName) {
    const staticCoach = Object.values(coachesConfig).find(c => c.name === assignedCoachName)
    if (staticCoach) {
      coach = {
        name: staticCoach.name,
        intro: staticCoach.intro,
        illustration: staticCoach.illustration,
        rankUpQuote: staticCoach.rankUpQuote
      }
    }
  }

  // B. Check for database profile coach relation
  if (!coach && user) {
    const { data: profile } = await supabase
      .from('users')
      .select('condition, coach_id')
      .eq('id', user.id)
      .single()
    
    if (profile?.coach_id) {
      try {
        const { data: dbCoach } = await supabase
          .from('coaches')
          .select('*')
          .eq('id', profile.coach_id)
          .single()
        
        if (dbCoach) {
          coach = {
            name: dbCoach.name,
            intro: dbCoach.intro || '',
            illustration: dbCoach.illustration || '/coach-pcos.png',
            rankUpQuote: dbCoach.rank_up_quote || ''
          }
        }
      } catch {
        // Fallback gracefully on query error
      }
    }

    if (profile?.condition) {
      selectedCondition = profile.condition
    }
  }

  // C. Fallback to condition mapping if no specific coach is assigned
  if (!coach) {
    const staticCoach = coachesConfig[selectedCondition] || coachesConfig['General Fitness']
    coach = {
      name: staticCoach.name,
      intro: staticCoach.intro,
      illustration: staticCoach.illustration,
      rankUpQuote: staticCoach.rankUpQuote
    }
  }

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
          <div className="h-10 w-10 relative rounded-full overflow-hidden shrink-0 bg-transparent">
            <Image
              src={coach.illustration}
              alt={`Coach ${coach.name} Avatar`}
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">Coach {coach.name}</h3>
            <p className="text-xs text-text-secondary">Your Personal Coach</p>
          </div>
        </div>
        <p className="text-sm text-text-primary italic leading-relaxed">
          &ldquo;Focus on today&apos;s action steps. Consistency over intensity is how we heal and adapt.&rdquo;
        </p>
      </section>

      {/* Task List and Completion flow */}
      <TodayChecklist selectedCondition={selectedCondition} assignedCoachName={coach.name} />
    </div>
  )
}
