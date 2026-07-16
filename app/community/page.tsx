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
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'
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

  // Load upcoming coach events
  useEffect(() => {
    async function loadEvents() {
      setEventsLoading(true)
      if (isPreview) {
        // Set mock events based on condition
        setUpcomingEvents([
          {
            id: 'evt_mock_1',
            title: `Weekly Q&A Session with Coach ${coachName}`,
            description: 'Ask questions about glucose management and active logs.',
            event_datetime: new Date(Date.now() + 86400000).toISOString(),
            status: 'upcoming'
          }
        ])
        setEventsLoading(false)
        return
      }

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
  }, [coachName, isPreview])

  // Load site-wide product announcements (limit 3)
  useEffect(() => {
    async function loadAnnouncements() {
      setAnnouncementsLoading(true)
      if (isPreview) {
        // Read custom mock announcements if any, else seed
        const localAnn = JSON.parse(localStorage.getItem('custom_announcements') || '[]')
        if (localAnn.length > 0) {
          setAnnouncements(localAnn)
        } else {
          setAnnouncements([
            {
              id: 'ann_mock_1',
              title: 'New Pathway: Advanced Mobility Released',
              body: 'A brand new interactive pathway level has been added to address metabolic mobility adaptation.',
              published_at: new Date(Date.now() - 172800000).toISOString()
            }
          ])
        }
        setAnnouncementsLoading(false)
        return
      }

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
  }, [isPreview])

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
    }
  }, [isPreview])

  // Populate feed posts when coach name is loaded and system announcements are fetched
  useEffect(() => {
    async function loadFeed() {
      if (isPreview) {
        let coach1Name = 'Tunde'
        let coach3Name = 'Adaeze'
        const basePosts: FeedItem[] = [
          {
            id: 'post_1',
            author: `Coach ${coach1Name}`,
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
            author: `Coach ${coach3Name}`,
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
            tier: 'Silver',
            show_tier_badge: true,
            content: `Just completed today's low-sodium check-in. The Uziza pepper tip from Coach Adaeze makes seasoned food taste incredible without table salt!`,
            time: '2 days ago',
            reactions: { love: 5, celebrate: 3, inspired: 11 },
            userReaction: null
          }
        ]
        setFeedItems(basePosts)
        return
      }

      try {
        const supabaseInstance = createClient()
        const { data: { user } } = await supabaseInstance.auth.getUser()
        if (!user) return

        // 1. Fetch real community posts from DB
        const { data: dbPosts } = await supabaseInstance
          .from('community_posts')
          .select('*, coaches(name)')
          .order('created_at', { ascending: false })

        // 2. Fetch system achievements from telemetry_events
        const { data: telemetryEvents } = await supabaseInstance
          .from('telemetry_events')
          .select('*')
          .eq('event_type', 'system_announcement')

        // 3. Fetch all active reactions from DB
        const { data: dbReactions } = await supabaseInstance
          .from('community_reactions')
          .select('*')
          .eq('active', true)

        const reactions = dbReactions || []

        // Parse DB posts
        const parsedDbPosts: FeedItem[] = (dbPosts || []).map((post: any) => {
          const postId = post.id
          const authorName = post.coaches?.name || 'Coach'
          
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
  }, [coachName, isPreview])

  // Handle post reaction increments and award CP with persistence and anti-farming (Section 8.6)
  const handleReact = async (postId: string, type: 'love' | 'celebrate' | 'inspired') => {
    if (isPreview) {
      // Toggle reactions in preview mode locally
      setFeedItems(prevItems => 
        prevItems.map(post => {
          if (post.id !== postId) return post

          const newReactions = { ...post.reactions }
          let newUserReaction = post.userReaction

          if (post.userReaction === type) {
            newReactions[type] = Math.max(0, newReactions[type] - 1)
            newUserReaction = null
          } else {
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
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const targetPost = feedItems.find(p => p.id === postId)
      if (!targetPost) return

      const isTelemetry = targetPost.role === 'System'
      const queryCol = isTelemetry ? 'telemetry_event_id' : 'community_post_id'

      // Check if a reaction row already exists
      const { data: existingReaction } = await supabase
        .from('community_reactions')
        .select('*')
        .eq(queryCol, postId)
        .eq('user_id', user.id)
        .eq('reaction_type', type)
        .maybeSingle()

      if (!existingReaction) {
        // First insert ever: award CP and save cp_awarded = true, active = true
        const cpResult = await awardConsistencyPoints('community_reaction', false)
        if (cpResult.tierUpOccurred) {
          setRankUpData({
            oldTier: cpResult.oldTier,
            newTier: cpResult.newTier
          })
        }

        await supabase
          .from('community_reactions')
          .insert({
            [queryCol]: postId,
            user_id: user.id,
            reaction_type: type,
            cp_awarded: true,
            active: true
          })
      } else {
        // Toggle active status without modifying cp_awarded or re-awarding CP (anti-farming)
        await supabase
          .from('community_reactions')
          .update({ active: !existingReaction.active })
          .eq('id', existingReaction.id)
      }

      // Re-fetch all active reactions from DB to update UI counts
      const { data: dbReactions } = await supabase
        .from('community_reactions')
        .select('*')
        .eq('active', true)

      const reactions = dbReactions || []

      setFeedItems(prevItems =>
        prevItems.map(post => {
          if (post.id !== postId) return post

          const loveCount = reactions.filter(r => r[queryCol] === postId && r.reaction_type === 'love').length
          const celebrateCount = reactions.filter(r => r[queryCol] === postId && r.reaction_type === 'celebrate').length
          const inspiredCount = reactions.filter(r => r[queryCol] === postId && r.reaction_type === 'inspired').length
          
          const userReactionRecord = reactions.find(r => r[queryCol] === postId && r.user_id === user.id)
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
