'use client'

// Built against PRD Section 8.7 (Community Feed & Interactions)
import React, { useState, useEffect } from 'react'
import { Bell, Heart, Sparkles, Lightbulb, Award, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { awardConsistencyPoints, TierType } from '@/lib/cpEngine'
import { coachesConfig } from '@/lib/coaches'
import { Button } from '@/components/Button'

interface FeedItem {
  id: string
  author: string
  role: 'Coach' | 'System' | 'Patient'
  tier?: string
  show_tier_badge?: boolean
  content: string
  time: string
  reactions: {
    love: number
    celebrate: number
    inspired: number
  }
  userReaction?: 'love' | 'celebrate' | 'inspired' | null
}

export default function CommunityPage() {
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'
  const [coachName, setCoachName] = useState('Adaeze')
  const [selectedCondition, setSelectedCondition] = useState('General Fitness')
  const [rankUpData, setRankUpData] = useState<{ oldTier: TierType; newTier: TierType } | null>(null)
  
  const coach = coachesConfig[selectedCondition] || coachesConfig['General Fitness']
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])

  // Announcements list (specced as Events and new releases, no comment features)
  const updates = [
    {
      title: 'Weekly Q&A Session with Coach Adaeze',
      time: 'Starts Saturday, 10:00 AM',
      type: 'event',
    },
    {
      title: 'New Pathway: Advanced Mobility Released',
      time: '2 days ago',
      type: 'announcement',
    },
  ]

  // Fetch coach identity dynamically from user's selection
  useEffect(() => {
    let activeCoachName = 'Adaeze'

    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '')
      return ''
    }

    const assignedCoach = getCookie('preview_assigned_coach')
    const condition = getCookie('preview_condition') || 'Hypertension'
    setSelectedCondition(condition)

    if (isPreview) {
      if (assignedCoach) {
        setCoachName(assignedCoach)
      } else {
        const matchedCoach = coachesConfig[condition] || coachesConfig['General Fitness']
        setCoachName(matchedCoach.name)
      }
    } else {
      const loadCoach = async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('users')
          .select('condition, coach_id')
          .eq('id', user.id)
          .single()
        
        const activeCondition = profile?.condition || 'Hypertension'
        setSelectedCondition(activeCondition)

        let coachNameResolved = ''
        if (profile?.coach_id) {
          const { data: dbCoach } = await supabase
            .from('coaches')
            .select('name')
            .eq('id', profile.coach_id)
            .single()
          if (dbCoach) {
            coachNameResolved = dbCoach.name
          }
        }

        if (!coachNameResolved) {
          const matchedCoach = coachesConfig[activeCondition] || coachesConfig['General Fitness']
          coachNameResolved = matchedCoach.name
        }
        setCoachName(coachNameResolved)
      }
      loadCoach()
    }
  }, [isPreview])

  // Populate feed posts when coach name is loaded and system announcements are fetched
  useEffect(() => {
    async function loadFeed() {
      const basePosts = [
        {
          id: 'post_1',
          author: `Coach ${coachName}`,
          role: 'Coach',
          content: `Just posted a new mobility tip on the Today screen. Remember, focusing on today's steps for even 5 minutes builds long-term metabolic health. Consistency always beats intensity!`,
          time: '3 hours ago',
          reactions: { love: 14, celebrate: 8, inspired: 21 },
          userReaction: null
        },
        {
          id: 'post_2',
          author: 'System Achievement',
          role: 'System',
          content: 'Chidi O. just unlocked Level 2 Pathway milestones by completing 15 active consistency check-ins!',
          time: '5 hours ago',
          reactions: { love: 9, celebrate: 18, inspired: 4 },
          userReaction: null
        },
        {
          id: 'post_3',
          author: `Coach ${coachName}`,
          role: 'Coach',
          content: `A quick tip for today's hydration: try replacing a sugary drink with a glass of unsweetened water or native zobo tea. Small choices make health adaptation feel effortless.`,
          time: 'Yesterday',
          reactions: { love: 31, celebrate: 12, inspired: 45 },
          userReaction: null
        },
        {
          id: 'post_4',
          author: 'Bunmi K.',
          role: 'Patient',
          tier: 'Silver' as const,
          show_tier_badge: true,
          content: `Just completed today's low-sodium check-in. The Uziza pepper tip from Coach Adaeze makes seasoned food taste incredible without table salt!`,
          time: '2 days ago',
          reactions: { love: 5, celebrate: 3, inspired: 11 },
          userReaction: null
        }
      ]

      let customAnnouncements: any[] = []
      if (isPreview) {
        customAnnouncements = JSON.parse(localStorage.getItem('custom_announcements') || '[]')
      } else {
        const supabaseInstance = createClient()
        const { data: events } = await supabaseInstance
          .from('telemetry_events')
          .select('*')
          .eq('event_type', 'system_announcement')

        if (events) {
          customAnnouncements = events.map((e: any) => ({
            id: `announcement_${e.id}`,
            author: 'System Achievement',
            role: 'System',
            content: e.metadata.content || '',
            time: 'Recently',
            reactions: { love: 0, celebrate: 0, inspired: 0 },
            userReaction: null
          }))
        }
      }

      setFeedItems([...basePosts, ...customAnnouncements])
    }

    if (coachName) {
      loadFeed()
    }
  }, [coachName, isPreview])

  // Handle post reaction increments and award CP (Section 8.6)
  const handleReact = async (postId: string, type: 'love' | 'celebrate' | 'inspired') => {
    const targetPost = feedItems.find(p => p.id === postId)
    const isAddingReaction = targetPost?.userReaction !== type

    setFeedItems(prevItems => 
      prevItems.map(post => {
        if (post.id !== postId) return post

        const newReactions = { ...post.reactions }
        let newUserReaction = post.userReaction

        if (post.userReaction === type) {
          // Toggle off
          newReactions[type] = Math.max(0, newReactions[type] - 1)
          newUserReaction = null
        } else {
          // Reset previous reaction if any
          if (post.userReaction) {
            newReactions[post.userReaction] = Math.max(0, newReactions[post.userReaction] - 1)
          }
          newReactions[type] += 1
          newUserReaction = type
        }

        return {
          ...post,
          reactions: newReactions,
          userReaction: newUserReaction
        }
      })
    )

    // Award CP only when adding reaction (encouragement given, Section 8.6)
    if (isAddingReaction) {
      try {
        const cpResult = await awardConsistencyPoints('community_reaction', isPreview)
        if (cpResult.tierUpOccurred) {
          setRankUpData({
            oldTier: cpResult.oldTier,
            newTier: cpResult.newTier
          })
        }
      } catch (err) {
        console.error('Failed to update CP:', err)
      }
    }
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Page Header */}
      <header className="space-y-1 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Social</p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Community Hub</h1>
        <p className="text-sm text-text-secondary">Reflecting collective milestones and coach feeds.</p>
      </header>

      {/* Announcements (Spec events and releases) */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">
          Announcements & Events
        </h2>
        <div className="space-y-2">
          {updates.map((update, i) => (
            <div key={i} className="rounded-2xl bg-surface p-4 border border-divider/50 space-y-1">
              <span className="text-xs font-bold uppercase text-text-secondary tracking-wider block mb-0.5">{update.type}</span>
              <h4 className="text-sm font-semibold text-text-primary leading-snug">{update.title}</h4>
              <p className="text-xs text-text-secondary">{update.time}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coach-Curated & System Feed (Spec-compliant feed, no DM, reaction only) */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">
          Curated Activity Feed
        </h2>
        <div className="space-y-3">
          {feedItems.map((post) => (
            <div key={post.id} className="rounded-2xl bg-surface p-5 border border-divider/50 shadow-sm space-y-3">
              
              {/* Post Header */}
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-primary/5 text-primary flex items-center justify-center font-bold text-xs shrink-0 select-none">
                  {post.role === 'System'
                    ? 'S'
                    : post.author.replace(/^Coach\s+/i, '').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary leading-tight flex items-center gap-1.5">
                    <span>{post.author}</span>
                    {post.role === 'Patient' && post.show_tier_badge && (
                      <span className="text-[8px] bg-divider/50 text-text-secondary border border-divider/40 font-medium px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {post.tier}
                      </span>
                    )}
                  </h4>
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mt-0.5">{post.role}</span>
                </div>
                <span className="text-xs text-text-secondary ml-auto">{post.time}</span>
              </div>

              {/* Post Content */}
              <p className="text-sm text-text-primary leading-relaxed">
                {post.content}
              </p>

              {/* Reaction Pill Container (Love, Celebrate, Inspired) */}
              <div className="flex items-center gap-2 pt-2 border-t border-divider/40">
                
                {/* Love Reaction */}
                <button
                  onClick={() => handleReact(post.id, 'love')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    post.userReaction === 'love'
                      ? 'border-[#E6A8A8] bg-[#FAF0F0] text-[#B83D3D]'
                      : 'border-divider/50 bg-transparent text-text-secondary hover:bg-divider/10'
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 stroke-[1.5] ${post.userReaction === 'love' ? 'fill-current' : ''}`} />
                  <span>{post.reactions.love}</span>
                </button>

                {/* Celebrate Reaction */}
                <button
                  onClick={() => handleReact(post.id, 'celebrate')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    post.userReaction === 'celebrate'
                      ? 'border-[#E6A8A8] bg-[#FAF0F0] text-primary'
                      : 'border-divider/50 bg-transparent text-text-secondary hover:bg-divider/10'
                  }`}
                >
                  <Sparkles className={`h-3.5 w-3.5 stroke-[1.5] ${post.userReaction === 'celebrate' ? 'fill-current' : ''}`} />
                  <span>{post.reactions.celebrate}</span>
                </button>

                {/* Inspired Reaction */}
                <button
                  onClick={() => handleReact(post.id, 'inspired')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    post.userReaction === 'inspired'
                      ? 'border-[#9CAF88]/50 bg-[#9CAF88]/5 text-[#5E6E4D]'
                      : 'border-divider/50 bg-transparent text-text-secondary hover:bg-divider/10'
                  }`}
                >
                  <Lightbulb className={`h-3.5 w-3.5 stroke-[1.5] ${post.userReaction === 'inspired' ? 'fill-current' : ''}`} />
                  <span>{post.reactions.inspired}</span>
                </button>

              </div>

            </div>
          ))}
        </div>
      </section>
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
              <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Consistency Milestone</span>
              <h3 className="text-xl font-bold text-text-primary">Tier Up: {rankUpData.newTier}!</h3>
              <p className="text-xs text-text-secondary mt-2">
                You have progressed from {rankUpData.oldTier} to the <strong className="text-primary">{rankUpData.newTier}</strong> consistency league!
              </p>
            </div>

            {/* Coach quote card */}
            <div className="rounded-xl bg-surface border border-divider/50 p-4 text-left relative overflow-hidden space-y-1">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Coach {coach.name} Notes</p>
              <p className="text-xs text-text-primary italic leading-relaxed">
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
