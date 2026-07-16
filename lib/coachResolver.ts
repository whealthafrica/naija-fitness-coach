import { SupabaseClient } from '@supabase/supabase-js'

export interface ResolvedCoach {
  name: string
  intro: string
  illustration?: string
  rankUpQuote: string
}

/**
 * Isomorphic utility to resolve the active coach from the database.
 * Both Server Components (Today screen) and Client Components (Learn screen)
 * consume this shared resolver to prevent logic drift.
 */
export async function getAssignedCoach(
  supabase: SupabaseClient,
  userId: string | undefined,
  selectedCondition: string
): Promise<ResolvedCoach | null> {
  try {
    // 1. If user is logged in, try to resolve via their profile's coach_id
    if (userId) {
      const { data: profile } = await supabase
        .from('users')
        .select('coach_id, condition')
        .eq('id', userId)
        .single()

      const condition = profile?.condition || selectedCondition

      if (profile?.coach_id) {
        const { data: dbCoach } = await supabase
          .from('coaches')
          .select('*')
          .eq('id', profile.coach_id)
          .maybeSingle()

        if (dbCoach) {
          return {
            name: dbCoach.name,
            intro: dbCoach.intro || '',
            illustration: dbCoach.illustration || undefined,
            rankUpQuote: dbCoach.rank_up_quote || ''
          }
        }
      }

      // 2. If coach_id is not set, resolve by the profile's condition
      if (condition) {
        const { data: dbCoach } = await supabase
          .from('coaches')
          .select('*')
          .eq('condition', condition)
          .maybeSingle()

        if (dbCoach) {
          return {
            name: dbCoach.name,
            intro: dbCoach.intro || '',
            illustration: dbCoach.illustration || undefined,
            rankUpQuote: dbCoach.rank_up_quote || ''
          }
        }
      }
    }

    // 3. Guest/unauthenticated path or fallback: resolve by the selected condition
    if (selectedCondition) {
      const { data: dbCoach } = await supabase
        .from('coaches')
        .select('*')
        .eq('condition', selectedCondition)
        .maybeSingle()

      if (dbCoach) {
        return {
          name: dbCoach.name,
          intro: dbCoach.intro || '',
          illustration: dbCoach.illustration || undefined,
          rankUpQuote: dbCoach.rank_up_quote || ''
        }
      }
    }
  } catch (err) {
    console.error('[coachResolver] Error resolving coach from DB:', err)
  }

  return null
}
