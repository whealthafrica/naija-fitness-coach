'use client'

// Built against PRD Section 8.7 (Community Feed & Interactions)
import React, { useState, useEffect } from 'react'
import { Bell, Heart, Sparkles, Lightbulb, Award, X, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { awardConsistencyPoints, TierType } from '@/lib/cpEngine'
import { Button } from '@/components/Button'
import { coachesConfig } from '@/lib/coaches'

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
  const [coachName, setCoachName] = useState('Adaeze')
  const [selectedCondition, setSelectedCondition] = useState('General Fitness')
  const [rankUpData, setRankUpData] = useState<{ oldTier: TierType; newTier: TierType } | null>(null)
  // DB-sourced: coach.rank_up_quote collected at registration, never from static config
  const [coachRankUpQuote, setCoachRankUpQuote] = useState<string>('')

  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  const [announcements, setAnnouncements] = useState<any[]>([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(false)
  const [reactingPostIds, setReactingPostIds] = useState<Set<string>>(new Set())

  // Load upcoming coach events
  useEffect(() => {
    async function loadEvents() {
      setEventsLoading(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('users')
          .select('coach_id')
          .eq('id', user.id)
          .single()

        if (profile?.coach_id) {
          const { data: dbEvents } = await supabase
            .from('coach_events')
            .select('*')
            .eq('coach_id', profile.coach_id)
            .eq('status', 'upcoming')
            .gt('event_datetime', new Date().toISOString())
            .order('event_datetime', { ascending: true })

          setUpcomingEvents(dbEvents || [])
        }
      } catch (err) {
        console.error('Failed to load coach events:', err)
      }
      setEventsLoading(false)
    }

    if (coachName) {
      loadEvents()
    }
  }, [coachName])

  // Load site-wide product announcements (limit 3)
  useEffect(() => {
    async function loadAnnouncements() {
      setAnnouncementsLoading(true)
      try {
        const supabase = createClient()
        const { data: dbAnnouncements } = await supabase
          .from('product_announcements')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(3)

        setAnnouncements(dbAnnouncements || [])
      } catch (err) {
        console.error('Failed to load announcements:', err)
      }
      setAnnouncementsLoading(false)
    }

    loadAnnouncements()
  }, [])

  // Fetch coach identity dynamically from user's selection
  useEffect(() => {
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
          .select('name, rank_up_quote')
          .eq('id', profile.coach_id)
          .single()
        if (dbCoach) {
          coachNameResolved = dbCoach.name
          if (dbCoach.rank_up_quote) setCoachRankUpQuote(dbCoach.rank_up_quote)
        }
      }

      if (!coachNameResolved) {
        const matchedCoach = coachesConfig[activeCondition] || coachesConfig['General Fitness']
        coachNameResolved = matchedCoach.name
      }
      setCoachName(coachNameResolved)
    }
    loadCoach()
  }, [])

  // Populate feed posts when coach name is loaded and system announcements are fetched
  useEffect(() => {
    async function loadFeed() {
      try {
        const supabaseInstance = createClient()
        const { data: { user } } = await supabaseInstance.auth.getUser()
        if (!user) return

        // Fetch posts, coaches, announcements, and reactions concurrently
        const [postsRes, coachesRes, telemetryRes, reactionsRes] = await Promise.all([
          supabaseInstance
            .from('community_posts')
            .select('*')
            .order('created_at', { ascending: false }),
          supabaseInstance
            .from('coaches')
            .select('id, name'),
          supabaseInstance
            .from('telemetry_events')
            .select('*')
            .eq('event_type', 'system_announcement'),
          supabaseInstance
            .from('community_reactions')
            .select('*')
            .eq('active', true)
        ])

        const dbPosts = postsRes.data
        const dbPostsError = postsRes.error
        const dbCoaches = coachesRes.data
        const telemetryEvents = telemetryRes.data
        const dbReactions = reactionsRes.data

        if (dbPostsError) {
          console.error('Error fetching community posts:', dbPostsError)
        }

        const coachesMap = new Map<string, string>()
        if (dbCoaches) {
          dbCoaches.forEach((c: any) => {
            coachesMap.set(c.id, c.name)
          })
        }

        const reactions = dbReactions || []

        // Parse DB posts
        const parsedDbPosts: FeedItem[] = (dbPosts || []).map((post: any) => {
          const postId = post.id
          const authorName = post.author_type === 'coach' ? (coachesMap.get(post.author_id) || 'Coach') : 'Coach'
          
          const loveCount = reactions.filter(r => r.community_post_id === postId && r.reaction_type === 'love').length
          const celebrateCount = reactions.filter(r => r.community_post_id === postId && r.reaction_type === 'celebrate').length
          const inspiredCount = reactions.filter(r => r.community_post_id === postId && r.reaction_type === 'inspired').length
          
          const userReactionRecord = reactions.find(r => r.community_post_id === postId && r.user_id === user.id)
          const userReaction = userReactionRecord ? (userReactionRecord.reaction_type as 'love' | 'celebrate' | 'inspired') : null

          const timeText = new Date(post.created_at).toLocaleDateString()

          return {
            id: postId,
            author: `Coach ${authorName}`,
            role: 'Coach',
            content: post.content,
            time: timeText,
            reactions: { love: loveCount, celebrate: celebrateCount, inspired: inspiredCount },
            userReaction
          }
        })

        // Parse telemetry announcements
        const parsedAnnouncements: FeedItem[] = (telemetryEvents || []).map((e: any) => {
          const eventId = e.id

          const loveCount = reactions.filter(r => r.telemetry_event_id === eventId && r.reaction_type === 'love').length
          const celebrateCount = reactions.filter(r => r.telemetry_event_id === eventId && r.reaction_type === 'celebrate').length
          const inspiredCount = reactions.filter(r => r.telemetry_event_id === eventId && r.reaction_type === 'inspired').length
          
          const userReactionRecord = reactions.find(r => r.telemetry_event_id === eventId && r.user_id === user.id)
          const userReaction = userReactionRecord ? (userReactionRecord.reaction_type as 'love' | 'celebrate' | 'inspired') : null

          return {
            id: eventId,
            author: 'System Achievement',
            role: 'System',
            content: e.metadata?.content || '',
            time: new Date(e.created_at).toLocaleDateString(),
            reactions: { love: loveCount, celebrate: celebrateCount, inspired: inspiredCount },
            userReaction
          }
        })

        // Mock patient post (Bunmi K.) stays as placeholder for now
        const bunmiPost: FeedItem = {
          id: 'post_4_mock',
          author: 'Bunmi K.',
          role: 'Patient',
          tier: 'Silver',
          show_tier_badge: true,
          content: `Just completed today's low-sodium check-in. The Uziza pepper tip from Coach Adaeze makes seasoned food taste incredible without table salt!`,
          time: '2 days ago',
          reactions: { love: 5, celebrate: 3, inspired: 11 },
          userReaction: null
        }

        setFeedItems([...parsedDbPosts, ...parsedAnnouncements, bunmiPost])
      } catch (err) {
        console.error('Failed to load community feed:', err)
      }
    }

    if (coachName) {
      loadFeed()
    }
  }, [coachName])

  // Handle post reaction increments and award CP with persistence and anti-farming (Section 8.6)
  const handleReact = async (postId: string, type: 'love' | 'celebrate' | 'inspired') => {
    // Disable reaction queries on mock posts entirely
    if (postId.includes('mock')) return

    // Debounce: prevent rapid multi-taps for the same post in-flight
    if (reactingPostIds.has(postId)) return

    setReactingPostIds(prev => {
      const next = new Set(prev)
      next.add(postId)
      return next
    })

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const targetPost = feedItems.find(p => p.id === postId)
      if (!targetPost) return

      const isTelemetry = targetPost.role === 'System'
      const queryCol = isTelemetry ? 'telemetry_event_id' : 'community_post_id'

      // Check if any reaction already exists for this post/user (select * to avoid maybeSingle multi-row crash)
      const { data: userReactions, error: fetchError } = await supabase
        .from('community_reactions')
        .select('*')
        .eq(queryCol, postId)
        .eq('user_id', user.id)

      if (fetchError) {
        console.error('Failed to fetch reactions:', fetchError.message)
        alert('Failed to check reactions. Please try again.')
        return
      }

      const reactionsList = userReactions || []
      const activeReaction = reactionsList.find(r => r.active)
      const targetReaction = reactionsList.find(r => r.reaction_type === type)

      if (activeReaction) {
        if (activeReaction.reaction_type === type) {
          // Tapping the same type: toggle active to false (un-react)
          const { error: updateError } = await supabase
            .from('community_reactions')
            .update({ active: false })
            .eq('id', activeReaction.id)

          if (updateError) {
            console.error('Failed to deactivate reaction:', updateError.message)
            alert('Failed to update reaction. Please try again.')
            return
          }
        } else {
          // Tapping a different type: update the type directly on the active row in a single write!
          const { error: updateError } = await supabase
            .from('community_reactions')
            .update({ reaction_type: type })
            .eq('id', activeReaction.id)

          if (updateError) {
            console.error('Failed to switch reaction:', updateError.message)
            alert('Failed to update reaction. Please try again.')
            return
          }
        }
      } else {
        // No active reaction: either reactivate an inactive row or insert a new one
        if (targetReaction) {
          // Reactivate the existing row for this type
          const { error: activateError } = await supabase
            .from('community_reactions')
            .update({ active: true })
            .eq('id', targetReaction.id)

          if (activateError) {
            console.error('Failed to activate target reaction:', activateError.message)
            alert('Failed to update reaction. Please try again.')
            return
          }
        } else {
          // Insert a new row for this type
          const cpResult = await awardConsistencyPoints('community_reaction', false)
          if (cpResult.tierUpOccurred) {
            setRankUpData({
              oldTier: cpResult.oldTier,
              newTier: cpResult.newTier
            })
          }

          const { error: insertError } = await supabase
            .from('community_reactions')
            .insert({
              [queryCol]: postId,
              user_id: user.id,
              reaction_type: type,
              cp_awarded: true,
              active: true
            })

          if (insertError) {
            console.error('Failed to insert new reaction:', insertError.message)
            alert('Failed to save reaction. Please try again.')
            return
          }
        }
      }

      // Re-fetch active reactions from DB for this specific post/event only (targeted query)
      const { data: dbReactions } = await supabase
        .from('community_reactions')
        .select('*')
        .eq(queryCol, postId)
        .eq('active', true)

      const reactions = dbReactions || []

      setFeedItems(prevItems =>
        prevItems.map(post => {
          if (post.id !== postId) return post

          const loveCount = reactions.filter(r => r.reaction_type === 'love').length
          const celebrateCount = reactions.filter(r => r.reaction_type === 'celebrate').length
          const inspiredCount = reactions.filter(r => r.reaction_type === 'inspired').length
          
          const userReactionRecord = reactions.find(r => r.user_id === user.id)
          const userReaction = userReactionRecord ? (userReactionRecord.reaction_type as 'love' | 'celebrate' | 'inspired') : null

          return {
            ...post,
            reactions: { love: loveCount, celebrate: celebrateCount, inspired: inspiredCount },
            userReaction
          }
        })
      )

    } catch (err) {
      console.error('Failed to handle reaction persistence:', err)
    } finally {
      setReactingPostIds(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
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

      {/* Announcements & Events Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coach Events */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">
            Upcoming Events (Coach {coachName})
          </h2>
          {eventsLoading ? (
            <div className="flex items-center gap-2 text-xs text-text-secondary py-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Loading events...</span>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="rounded-2xl bg-surface/50 border border-divider/40 p-4 text-center py-6">
              <p className="text-xs text-text-secondary italic">No upcoming coach events scheduled.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((evt) => (
                <div key={evt.id} className="rounded-2xl bg-surface p-4 border border-divider/50 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-primary tracking-wider">Coach Event</span>
                    <span className="text-[10px] text-text-secondary/70 font-mono">
                      {new Date(evt.event_datetime).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-text-primary leading-snug">{evt.title}</h4>
                  {evt.description && (
                    <p className="text-xs text-text-secondary leading-relaxed">{evt.description}</p>
                  )}
                  <span className="text-[10px] text-text-secondary/70 font-semibold block">
                    Starts: {new Date(evt.event_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Product Announcements */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">
            Product Announcements
          </h2>
          {announcementsLoading ? (
            <div className="flex items-center gap-2 text-xs text-text-secondary py-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Loading announcements...</span>
            </div>
          ) : announcements.length === 0 ? (
            <div className="rounded-2xl bg-surface/50 border border-divider/40 p-4 text-center py-6">
              <p className="text-xs text-text-secondary italic">No recent product announcements.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {announcements.map((ann) => (
                <div key={ann.id} className="rounded-2xl bg-surface p-4 border border-divider/50 space-y-1.5 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-[#C8923C] tracking-wider block">announcement</span>
                  <h4 className="text-sm font-semibold text-text-primary leading-snug">{ann.title}</h4>
                  {ann.body && (
                    <p className="text-xs text-text-secondary leading-relaxed">{ann.body}</p>
                  )}
                  <p className="text-[10px] text-text-secondary/70 font-mono">
                    {new Date(ann.published_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

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
                  onClick={() => !post.id.includes('mock') && handleReact(post.id, 'love')}
                  disabled={post.id.includes('mock')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    post.id.includes('mock')
                      ? 'border-divider/30 bg-transparent text-text-secondary/50 opacity-60 cursor-not-allowed'
                      : post.userReaction === 'love'
                        ? 'border-[#E6A8A8] bg-[#FAF0F0] text-[#B83D3D]'
                        : 'border-divider/50 bg-transparent text-text-secondary hover:bg-divider/10'
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 stroke-[1.5] ${post.userReaction === 'love' && !post.id.includes('mock') ? 'fill-current' : ''}`} />
                  <span>{post.reactions.love}</span>
                </button>

                {/* Celebrate Reaction */}
                <button
                  onClick={() => !post.id.includes('mock') && handleReact(post.id, 'celebrate')}
                  disabled={post.id.includes('mock')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    post.id.includes('mock')
                      ? 'border-divider/30 bg-transparent text-text-secondary/50 opacity-60 cursor-not-allowed'
                      : post.userReaction === 'celebrate'
                        ? 'border-[#E6A8A8] bg-[#FAF0F0] text-primary'
                        : 'border-divider/50 bg-transparent text-text-secondary hover:bg-divider/10'
                  }`}
                >
                  <Sparkles className={`h-3.5 w-3.5 stroke-[1.5] ${post.userReaction === 'celebrate' && !post.id.includes('mock') ? 'fill-current' : ''}`} />
                  <span>{post.reactions.celebrate}</span>
                </button>

                {/* Inspired Reaction */}
                <button
                  onClick={() => !post.id.includes('mock') && handleReact(post.id, 'inspired')}
                  disabled={post.id.includes('mock')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    post.id.includes('mock')
                      ? 'border-divider/30 bg-transparent text-text-secondary/50 opacity-60 cursor-not-allowed'
                      : post.userReaction === 'inspired'
                        ? 'border-[#9CAF88]/50 bg-[#9CAF88]/5 text-[#5E6E4D]'
                        : 'border-divider/50 bg-transparent text-text-secondary hover:bg-divider/10'
                  }`}
                >
                  <Lightbulb className={`h-3.5 w-3.5 stroke-[1.5] ${post.userReaction === 'inspired' && !post.id.includes('mock') ? 'fill-current' : ''}`} />
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
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Coach {coachName} Notes</p>
              <p className="text-xs text-text-primary italic leading-relaxed">
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
