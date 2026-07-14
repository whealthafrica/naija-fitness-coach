import { createClient } from '@/utils/supabase/client'

// Built against PRD Section 8.6 (Scoring Engine & League System)

/**
 * =========================================================================
 * ARCHITECTURAL STANDING RULE (DO NOT REMOVE OR MERGE):
 * 
 * CP (Consistency Points) AND PROGRAM PROGRESS ARE COMPLETELY SEPARATE.
 * - CP drives League Tier and Community Feed celebration ONLY.
 * - Program Progress drives Iron Wallet payouts ONLY.
 * - They do NOT influence each other. They are never combined into one metric.
 * This boundary is strict to prevent users from gaming real money rewards
 * (e.g. by farming community reactions) instead of completing core clinical tasks.
 * =========================================================================
 */

export const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] as const
export type TierType = typeof TIERS[number]

// Spec-locked absolute thresholds (Note: first pass subject to future rebalancing)
export const TIER_THRESHOLDS: Record<TierType, number> = {
  Bronze: 0,
  Silver: 150,
  Gold: 350,
  Platinum: 650,
  Diamond: 1000
}

// Spec-locked effort-based CP point values
export const CP_SOURCES = {
  daily_checkin: 5,        // Daily check-in participation (streak-independent)
  lesson_completion: 15,   // Lesson watched (includes passing recall check)
  coach_call: 25,          // Virtual group coach call attended
  community_reaction: 2,   // Reacting to posts (hard-capped at 3 per day)
  lesson_checkpoint_mid: 5, // Mid-video scenario check (60-70% watched)
  lesson_checkpoint_end: 10 // End-of-video self-placement (85% watched)
} as const
export type CPSourceType = keyof typeof CP_SOURCES

export interface CPUpdateResult {
  addedPoints: number
  oldCP: number
  newCP: number
  oldTier: TierType
  newTier: TierType
  tierUpOccurred: boolean
  capReached?: boolean
}

// Maps a raw CP score to its corresponding league tier (absolute thresholds)
export function getTierFromCP(cp: number): TierType {
  let activeTier: TierType = 'Bronze'
  for (const tier of TIERS) {
    if (cp >= TIER_THRESHOLDS[tier]) {
      activeTier = tier
    }
  }
  return activeTier
}

// Client-side helper to award CP, enforce limits, and evaluate rank ups
export async function awardConsistencyPoints(
  source: CPSourceType,
  isPreview: boolean
): Promise<CPUpdateResult> {
  const points = CP_SOURCES[source]
  let oldCP = 0
  let newCP = 0
  let oldTier: TierType = 'Bronze'
  let newTier: TierType = 'Bronze'

  // Enforce Community reaction cap (maximum 3 reactions or 6 CP per day)
  const todayStr = new Date().toISOString().split('T')[0]
  if (source === 'community_reaction') {
    if (isPreview) {
      const reactionCountKey = `reactions_count_${todayStr}`
      const reactionCount = parseInt(localStorage.getItem(reactionCountKey) || '0', 10)
      if (reactionCount >= 3) {
        const storedCP = parseInt(localStorage.getItem('preview_cp') || '0', 10)
        return {
          addedPoints: 0,
          oldCP: storedCP,
          newCP: storedCP,
          oldTier: getTierFromCP(storedCP),
          newTier: getTierFromCP(storedCP),
          tierUpOccurred: false,
          capReached: true
        }
      }
      localStorage.setItem(reactionCountKey, (reactionCount + 1).toString())
    } else {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)

        // Query telemetry events for today's community reactions
        const { count, error } = await supabase
          .from('telemetry_events')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('event_type', 'community_reaction')
          .gte('created_at', todayStart.toISOString())
          .lte('created_at', todayEnd.toISOString())

        if (!error && count !== null && count >= 3) {
          // Get current CP profile
          const { data: profile } = await supabase
            .from('users')
            .select('cp, tier')
            .eq('id', user.id)
            .single()

          const currentCP = profile?.cp || 0
          return {
            addedPoints: 0,
            oldCP: currentCP,
            newCP: currentCP,
            oldTier: (profile?.tier as TierType) || 'Bronze',
            newTier: (profile?.tier as TierType) || 'Bronze',
            tierUpOccurred: false,
            capReached: true
          }
        }
      }
    }
  }

  if (isPreview) {
    const storedCP = parseInt(localStorage.getItem('preview_cp') || '0', 10)
    oldCP = storedCP
    newCP = storedCP + points
    oldTier = getTierFromCP(oldCP)
    newTier = getTierFromCP(newCP)

    localStorage.setItem('preview_cp', newCP.toString())
    localStorage.setItem('preview_tier', newTier)

    // Auto-generate system posts in local storage on tier up
    if (newTier !== oldTier) {
      const customAnnouncements = JSON.parse(localStorage.getItem('custom_announcements') || '[]')
      customAnnouncements.push({
        id: `announcement_${Date.now()}`,
        author: 'System Achievement',
        role: 'System',
        content: `You just achieved the ${newTier} Consistency League!`,
        time: 'Just now',
        reactions: { love: 0, celebrate: 0, inspired: 0 },
        userReaction: null
      })
      localStorage.setItem('custom_announcements', JSON.stringify(customAnnouncements))
    }
  } else {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User session not found')
    }

    // Get current CP
    const { data: profile } = await supabase
      .from('users')
      .select('cp, tier, name')
      .eq('id', user.id)
      .single()

    oldCP = profile?.cp || 0
    oldTier = (profile?.tier as TierType) || 'Bronze'
    newCP = oldCP + points
    newTier = getTierFromCP(newCP)

    // Update CP in database
    await supabase
      .from('users')
      .update({
        cp: newCP,
        tier: newTier
      })
      .eq('id', user.id)

    // Log telemetry activity
    await supabase
      .from('telemetry_events')
      .insert({
        user_id: user.id,
        event_type: 'community_reaction',
        metadata: { added_points: points, cp: newCP }
      })

    // Auto-generate system announcement post in telemetry on tier up
    if (newTier !== oldTier) {
      const userName = profile?.name || 'A patient'
      await supabase
        .from('telemetry_events')
        .insert({
          user_id: user.id,
          event_type: 'system_announcement',
          metadata: {
            type: 'tier_up',
            content: `${userName} just reached ${newTier} Consistency League!`
          }
        })
    }
  }

  return {
    addedPoints: points,
    oldCP,
    newCP,
    oldTier,
    newTier,
    tierUpOccurred: newTier !== oldTier
  }
}

/**
 * =========================================================================
 * IRON WALLET & PROGRAM PROGRESS PAYOUT LOGIC:
 * 
 * Calculated payout based on 12-week Program Progress:
 * - Program Progress >= 80%  => Full stake return (100% of deposit)
 * - 50% <= Progress < 80%    => Pro-rata return (Progress % of deposit)
 * - Program Progress < 50%   => Forfeited stake (₦0 returned, stays with NFC)
 * 
 * Bounded by tier cap:
 * - Standard Tier Cap: ₦10,000.00
 * - Premium Tier Cap:  ₦20,000.00
 * 
 * Formula: final_payout = MIN(calculated_payout, tier_cap)
 * Manual Review Required: If calculated_payout >= PLACEHOLDER_MANUAL_REVIEW_LIMIT
 * =========================================================================
 */
export function calculateIronWalletPayout(
  programProgress: number, // 0 to 100
  depositAmount: number,
  tierCap: number
): { calculatedPayout: number; finalPayout: number; forfeit: boolean } {
  let calculatedPayout = 0

  if (programProgress >= 80) {
    calculatedPayout = depositAmount
  } else if (programProgress >= 50) {
    calculatedPayout = depositAmount * (programProgress / 100)
  } else {
    calculatedPayout = 0
  }

  // Enforce tier cap
  const finalPayout = Math.min(calculatedPayout, tierCap)
  const forfeit = programProgress < 50

  return {
    calculatedPayout,
    finalPayout,
    forfeit
  }
}
