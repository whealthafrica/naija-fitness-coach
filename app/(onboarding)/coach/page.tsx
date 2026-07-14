import { cookies } from 'next/headers'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { ArrowRight } from 'lucide-react'
import { coachesConfig } from '@/lib/coaches'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ code?: string }>
}

export default async function CoachPage({ searchParams }: PageProps) {
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'
  const params = await searchParams
  const urlCoachCode = params.code

  let coachDetails: { name: string; intro: string; illustration: string; rankUpQuote: string; code: string } | null = null
  let selectedCondition = ''

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. Try to resolve coach directly from URL parameter
  if (urlCoachCode) {
    try {
      const { data: dbCoach } = await supabase
        .from('coaches')
        .select('*')
        .eq('code', urlCoachCode.toLowerCase())
        .single()

      if (dbCoach) {
        coachDetails = {
          name: dbCoach.name,
          intro: dbCoach.intro || '',
          illustration: dbCoach.illustration || '/coach-pcos.png',
          rankUpQuote: dbCoach.rank_up_quote || '',
          code: dbCoach.code
        }
      }
    } catch {
      // Graceful fallback to static list if db table or connection fails
    }

    if (!coachDetails) {
      const staticCoach = Object.values(coachesConfig).find(
        (c) => c.name.toLowerCase() === urlCoachCode.toLowerCase()
      )
      if (staticCoach) {
        coachDetails = {
          name: staticCoach.name,
          intro: staticCoach.intro,
          illustration: staticCoach.illustration,
          rankUpQuote: staticCoach.rankUpQuote,
          code: urlCoachCode.toLowerCase()
        }
      }
    }
  }

  // 2. If no direct URL match, resolve from onboarding selection
  if (!coachDetails) {
    const previewCookie = cookieStore.get('preview_condition')?.value
    if (previewCookie) {
      selectedCondition = decodeURIComponent(previewCookie)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('condition')
          .eq('id', user.id)
          .single()

        if (profile?.condition) {
          selectedCondition = profile.condition
        }
      }
    }

    if (!selectedCondition) {
      console.warn('No condition selected, redirecting to /condition')
      redirect('/condition')
    }

    const staticCoach = coachesConfig[selectedCondition] || coachesConfig['General Fitness']
    coachDetails = {
      name: staticCoach.name,
      intro: staticCoach.intro,
      illustration: staticCoach.illustration,
      rankUpQuote: staticCoach.rankUpQuote,
      code: staticCoach.name.toLowerCase()
    }
  }

  // Server Action to assign coach to profile and redirect to dashboard
  async function assignCoach(formData: FormData) {
    'use server'
    const coachName = formData.get('coach_name') as string
    const coachCode = formData.get('coach_code') as string
    const isPreviewAction = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'

    const cookieStore = await cookies()
    
    // Store assigned coach cookie to align dashboard/feed instantly
    cookieStore.set('preview_assigned_coach', coachName, { path: '/' })

    if (isPreviewAction) {
      revalidatePath('/')
      redirect('/')
    }

    const supabaseClient = createClient(cookieStore)
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      redirect('/sign-in')
    }

    // Resolve or insert coach record in database
    let { data: dbCoaches } = await supabaseClient
      .from('coaches')
      .select('id')
      .eq('name', coachName)
      .limit(1)

    let coachId = dbCoaches?.[0]?.id

    if (!coachId) {
      const matchedConfig = Object.values(coachesConfig).find((c) => c.name === coachName)
      const { data: newCoach } = await supabaseClient
        .from('coaches')
        .insert({
          name: coachName,
          code: coachCode || coachName.toLowerCase(),
          intro: matchedConfig?.intro || '',
          rank_up_quote: matchedConfig?.rankUpQuote || '',
          illustration: matchedConfig?.illustration || '/coach-pcos.png'
        })
        .select('id')
        .single()
      coachId = newCoach?.id
    }

    if (coachId) {
      await supabaseClient
        .from('users')
        .update({ coach_id: coachId })
        .eq('id', user.id)
    }

    revalidatePath('/')
    redirect('/')
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Portion: Text & Call-To-Action */}
      <div className="px-6 pt-8 pb-4 space-y-4 max-w-sm mx-auto w-full shrink-0">
        <div className="space-y-2 text-center">
          <span className="text-xs font-semibold tracking-widest uppercase text-accent font-mono">Your Coach</span>
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary">
            Meet {coachDetails.name}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {coachDetails.intro}
          </p>
        </div>

        {/* Primary CTA Form executing the Server Action */}
        <div>
          <form action={assignCoach}>
            <input type="hidden" name="coach_name" value={coachDetails.name} />
            <input type="hidden" name="coach_code" value={coachDetails.code} />
            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full bg-primary text-background font-semibold px-5 py-4 rounded-2xl hover:opacity-95 transition-opacity text-sm text-center"
            >
              <span>Continue</span>
              <ArrowRight className="h-4 w-4 text-background" />
            </button>
          </form>
        </div>
      </div>

      {/* Lower Portion: Full-bleed Portrait Illustration */}
      <div className="w-full flex-1 relative overflow-hidden bg-transparent mt-auto">
        <Image
          src={coachDetails.illustration}
          alt={`Coach ${coachDetails.name} Portrait`}
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
        {/* Soft fading overlay to blend the top edge of the cover illustration */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background via-background/50 to-transparent pointer-events-none" />
      </div>
    </div>
  )
}
