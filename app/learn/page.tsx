'use client'

// Built against PRD Section 8.5 (Education & Gated Learning Paths)
import React, { useState, useEffect, useRef } from 'react'
import { Check, X, Award, Loader2, HelpCircle } from 'lucide-react'
import { Button } from '@/components/Button'
import { VideoThumbnail } from '@/components/VideoThumbnail'
import { awardConsistencyPoints, TierType } from '../../lib/cpEngine'
import { conditionPathways, generalLibraryLessons, LessonDef } from '../../lib/learningPaths'
import { 
  calculateRolling14DayCompletion, 
  isEligibleForProgression, 
  scoreAndSortLessonsForProgression 
} from '../../lib/progressiveEscalation'
import { createClient } from '@/utils/supabase/client'
import { getAssignedCoach } from '../../lib/coachResolver'

interface QuestionDef {
  id: string
  lessonId: string
  questionText: string
  options: string[]
  correctOption: string
}

export default function LearnPage() {
  const supabase = createClient()

  // Pathway Focus and Gating states
  const [selectedCondition, setSelectedCondition] = useState('General Fitness')
  const [completedPathwayIndices, setCompletedPathwayIndices] = useState<number[]>([])
  const [completedGenLessonIds, setCompletedGenLessonIds] = useState<string[]>([])
  const [coachName, setCoachName] = useState('Adaeze')
  const [assignedCoachId, setAssignedCoachId] = useState<string | null>(null)
  // DB-sourced: coach.rank_up_quote collected at registration, not from static config
  const [coachRankUpQuote, setCoachRankUpQuote] = useState<string>('')

  // Dynamic Lessons & Questions states
  const [pathwayLessons, setPathwayLessons] = useState<LessonDef[]>([])
  const [generalLibraryLessonsList, setGeneralLibraryLessonsList] = useState<LessonDef[]>([])
  const [questionsMap, setQuestionsMap] = useState<Record<string, QuestionDef>>({})

  // Progressive Escalation state
  const [rolling14DayCompletion, setRolling14DayCompletion] = useState(0)
  const [isEligibleForAdvanced, setIsEligibleForAdvanced] = useState(false)

  // Playback/Modal states
  const [selectedVideo, setSelectedVideo] = useState<LessonDef | null>(null)
  const [activePathwayIndex, setActivePathwayIndex] = useState<number | null>(null)
  const [watchProgress, setWatchProgress] = useState(0)
  const [rankUpData, setRankUpData] = useState<{ oldTier: TierType; newTier: TierType } | null>(null)

  // Recall checking / MCQ Checkpoint states
  const [showRecallCheck, setShowRecallCheck] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false)
  const [midCheckpointMet, setMidCheckpointMet] = useState(false)
  const [endCheckpointMet, setEndCheckpointMet] = useState(false)
  const [checkpointType, setCheckpointType] = useState<'mid' | 'end' | null>(null)

  // YouTube references
  const playerRef = useRef<any>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const maxWatchedTimeRef = useRef<number>(0)
  const midCheckpointMetRef = useRef<boolean>(false)
  const endCheckpointMetRef = useRef<boolean>(false)

  // Load user data, custom configurations, and completions
  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '')
      return ''
    }

    const condition = 'Hypertension' // Fallback, overwritten below

    setSelectedCondition(condition)

    // Load coach name
    const coachMap: Record<string, string> = {
      'Type 2 Diabetes': 'Tunde',
      'Hypertension': 'Adaeze',
      'PCOS': 'Ngozi',
      'Pre-Diabetes': 'Emeka',
      'General Fitness': 'Amara'
    }

    const resolveCoach = async (userId: string | undefined, cond: string) => {
      const dbCoach = await getAssignedCoach(supabase, userId, cond)
      if (dbCoach) {
        setCoachName(dbCoach.name)
        setCoachRankUpQuote(dbCoach.rankUpQuote)
      } else {
        setCoachName(coachMap[cond] || 'Adaeze')
        setCoachRankUpQuote('')
      }
    }

    const loadProfileAndCompletions = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch user condition and coach_id
      const { data: profile } = await supabase
        .from('users')
        .select('condition, coach_id')
        .eq('id', user.id)
        .single()

      const userCondition = profile?.condition || 'Hypertension'
      setSelectedCondition(userCondition)
      if (profile?.coach_id) {
        setAssignedCoachId(profile.coach_id)
      }
      await resolveCoach(user.id, userCondition)

      // Fetch completions (with timestamps for rolling 14-day calculation)
      const { data: completions } = await supabase
        .from('task_completions')
        .select('task_id, completed_at')
        .eq('user_id', user.id)

      if (completions) {
        const pathPrefix = `learn_path_${userCondition}_`
        const indices: number[] = []
        const genIds: string[] = []
        const completedDates: Date[] = []

        completions.forEach(c => {
          if (c.task_id.startsWith(pathPrefix)) {
            const idxStr = c.task_id.replace(pathPrefix, '')
            const idx = parseInt(idxStr, 10)
            if (!isNaN(idx)) indices.push(idx)
          } else if (c.task_id.startsWith('gen_lesson_') || c.task_id.startsWith('custom_lesson_')) {
            genIds.push(c.task_id)
          }
          
          // Collect all completion dates for rolling 14-day calculation
          if (c.completed_at) {
            completedDates.push(new Date(c.completed_at))
          }
        })

        // Calculate rolling 14-day completion rate
        // Assume tasks assigned follows standard daily rhythm; adjust divisor if needed
        const tasksPerDay = 1.5 // Conservative estimate based on typical task load
        const totalExpectedInPeriod = tasksPerDay * 14
        const rolling14Day = calculateRolling14DayCompletion(completedDates, Math.ceil(totalExpectedInPeriod))
        const isAdvancedEligible = isEligibleForProgression(rolling14Day)

        setCompletedPathwayIndices(indices)
        setCompletedGenLessonIds(genIds)
        setRolling14DayCompletion(rolling14Day)
        setIsEligibleForAdvanced(isAdvancedEligible)
      }

      // Fetch from dynamic tables
      loadDynamicLessons(userCondition)
    }
    loadProfileAndCompletions()

    // Load YouTube API script
    if (!(window as any).YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    }
  }, [])

  const addHeuristicQuestionsToLesson = (l: LessonDef): LessonDef => {
    if (l.midQuestionText) return l
    const titleLower = l.title.toLowerCase()
    let topic = 'this lesson'
    let scenarioQ = 'Based on the guide to meal preparation, what is the first step you should take to manage insulin levels?'
    let options = ['Cook high-glycemic starches', 'Prepare leafy greens and proteins first', 'Skip breakfast entirely']
    let correct = 'Prepare leafy greens and proteins first'

    if (titleLower.includes('food') || titleLower.includes('eat') || titleLower.includes('diet') || titleLower.includes('hormon')) {
      topic = 'practical nutrition'
      scenarioQ = 'To support metabolic rate and avoid spikes, which protein strategy did the coach mention?'
      options = ['Eat high-carb snacks first', 'Combine protein with soluble fibers in meals', 'Eat sugar before workouts']
      correct = 'Combine protein with soluble fibers in meals'
    } else if (titleLower.includes('stress') || titleLower.includes('mindset') || titleLower.includes('habit') || titleLower.includes('stretch')) {
      topic = 'mindset control'
      scenarioQ = 'How does chronic stress physically impact glucose release according to the lesson?'
      options = ['Increases muscle sensitivity', 'Triggers cortisol to dump stored liver glucose', 'Has no impact on hormone levels']
      correct = 'Triggers cortisol to dump stored liver glucose'
    }

    return {
      ...l,
      midQuestionText: scenarioQ,
      midQuestionOptions: options,
      midQuestionCorrect: correct,
      endQuestionText: `Now that we reviewed ${topic}, how confident are you in practicing this habit today?`
    }
  }

  // Load Lessons & Questions dynamically
  const loadDynamicLessons = async (condition: string) => {
    try {
      const { data: dbLessons } = await supabase
        .from('lessons')
        .select('*')
        .order('created_at', { ascending: true })

      const { data: dbQuestions } = await supabase
        .from('scenario_questions')
        .select('*')

      const useDbLessons = dbLessons && dbLessons.length > 0
      const finalPath = useDbLessons
        ? dbLessons
            .filter(l => l.condition === condition && l.position_index !== null)
            .sort((a, b) => (a.position_index || 0) - (b.position_index || 0))
            .map(l => {
              let parsedOptions: string[] | null = null
              if (l.mid_question_options) {
                try {
                  parsedOptions = typeof l.mid_question_options === 'string'
                    ? JSON.parse(l.mid_question_options)
                    : l.mid_question_options
                } catch (e) {
                  parsedOptions = l.mid_question_options
                }
              }
              return addHeuristicQuestionsToLesson({
                id: l.id,
                title: l.title,
                section: l.section,
                youtubeId: l.youtube_id,
                durationText: l.duration_text,
                durationSeconds: l.duration_seconds,
                midQuestionText: l.mid_question_text,
                midQuestionOptions: parsedOptions,
                midQuestionCorrect: l.mid_question_correct,
                endQuestionText: l.end_question_text,
                midCheckpointPct: l.mid_checkpoint_pct,
                endCheckpointPct: l.end_checkpoint_pct,
                notifyCoachOpt1: l.notify_coach_opt_1,
                notifyCoachOpt2: l.notify_coach_opt_2,
                notifyCoachOpt3: l.notify_coach_opt_3
              })
            })
        : (conditionPathways[condition] || conditionPathways['General Fitness']).map(addHeuristicQuestionsToLesson)

      const finalGen = useDbLessons
        ? dbLessons
            .filter(l => l.condition !== condition || l.position_index === null)
            .map(l => {
              let parsedOptions: string[] | null = null
              if (l.mid_question_options) {
                try {
                  parsedOptions = typeof l.mid_question_options === 'string'
                    ? JSON.parse(l.mid_question_options)
                    : l.mid_question_options
                } catch (e) {
                  parsedOptions = l.mid_question_options
                }
              }
              return addHeuristicQuestionsToLesson({
                id: l.id,
                title: l.title,
                section: l.section,
                youtubeId: l.youtube_id,
                durationText: l.duration_text,
                durationSeconds: l.duration_seconds,
                midQuestionText: l.mid_question_text,
                midQuestionOptions: parsedOptions,
                midQuestionCorrect: l.mid_question_correct,
                endQuestionText: l.end_question_text,
                midCheckpointPct: l.mid_checkpoint_pct,
                endCheckpointPct: l.end_checkpoint_pct,
                notifyCoachOpt1: l.notify_coach_opt_1,
                notifyCoachOpt2: l.notify_coach_opt_2,
                notifyCoachOpt3: l.notify_coach_opt_3
              })
            })
        : generalLibraryLessons.map(addHeuristicQuestionsToLesson)

      setPathwayLessons(finalPath)
      
      const escalatedFinalGen = scoreAndSortLessonsForProgression(finalGen, isEligibleForAdvanced)
        .map((item: { lesson: LessonDef; score: number }) => item.lesson)
      setGeneralLibraryLessonsList(escalatedFinalGen)

      const qMap: Record<string, QuestionDef> = {}
      if (dbQuestions) {
        dbQuestions.forEach(q => {
          qMap[q.lesson_id] = {
            id: q.id,
            lessonId: q.lesson_id,
            questionText: q.question_text,
            options: q.options,
            correctOption: q.correct_option
          }
        })
      }
      setQuestionsMap(qMap)
    } catch (err) {
      console.error('Failed to load lessons from DB, falling back to static lists:', err)
      const staticPath = (conditionPathways[condition] || conditionPathways['General Fitness']).map(addHeuristicQuestionsToLesson)
      const staticGen = generalLibraryLessons.map(addHeuristicQuestionsToLesson)
      
      setPathwayLessons(staticPath)
      
      const escalatedStaticGen = scoreAndSortLessonsForProgression(staticGen, isEligibleForAdvanced)
        .map((item: { lesson: LessonDef; score: number }) => item.lesson)
      setGeneralLibraryLessonsList(escalatedStaticGen)
    }
  }

  // Initialize YouTube Player
  useEffect(() => {
    if (!selectedVideo) return

    const createPlayer = () => {
      playerRef.current = new (window as any).YT.Player('inline-youtube-player', {
        videoId: selectedVideo.youtubeId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onStateChange: (event: any) => {
            if (event.data === 1) {
              startPollingProgress()
            } else {
              stopPollingProgress()
            }
          }
        }
      })
    }

    if ((window as any).YT && (window as any).YT.Player) {
      createPlayer()
    } else {
      (window as any).onYouTubeIframeAPIReady = createPlayer
    }

    return () => {
      stopPollingProgress()
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy()
      }
      playerRef.current = null
    }
  }, [selectedVideo])

  const startPollingProgress = () => {
    stopPollingProgress()
    pollIntervalRef.current = setInterval(() => {
      if (!selectedVideo || !playerRef.current || !playerRef.current.getCurrentTime || !playerRef.current.getDuration) return

      const currentTime = playerRef.current.getCurrentTime()
      const duration = playerRef.current.getDuration()

      if (duration > 0) {
        // CODE COMMENT: Seek-forward restriction to prevent bypassing 65%/85% checkpoints.
        // If the user attempts to seek forward past the maximum watched point, snap them back.
        // Bypassed in dev/preview environments for testing convenience.
        const isProduction = process.env.NODE_ENV === 'production'
        if (isProduction && currentTime > maxWatchedTimeRef.current + 3) {
          playerRef.current.seekTo(maxWatchedTimeRef.current, true)
          return
        } else {
          maxWatchedTimeRef.current = Math.max(maxWatchedTimeRef.current, currentTime)
        }

        const progress = currentTime / duration
        setWatchProgress(progress)

        const midPct = selectedVideo.midCheckpointPct ?? 65
        const endPct = selectedVideo.endCheckpointPct ?? 85
        const midFraction = midPct / 100
        const endFraction = endPct / 100

        // Checkpoint 1: Configurable Scenario checkpoint
        if (progress >= midFraction && progress < (endFraction - 0.05) && !midCheckpointMetRef.current) {
          if (playerRef.current && playerRef.current.pauseVideo) {
            playerRef.current.pauseVideo()
          }
          stopPollingProgress()
          setCheckpointType('mid')
          setShowRecallCheck(true)
          setSelectedAnswer(null)
          setIsAnswerSubmitted(false)
        }
        // Checkpoint 2: Configurable End-of-Video self-placement checkpoint
        else if (progress >= endFraction && midCheckpointMetRef.current && !endCheckpointMetRef.current) {
          if (playerRef.current && playerRef.current.pauseVideo) {
            playerRef.current.pauseVideo()
          }
          stopPollingProgress()
          setCheckpointType('end')
          setShowRecallCheck(true)
          setSelectedAnswer(null)
          setIsAnswerSubmitted(false)
        }
      }
    }, 1000)
  }

  const stopPollingProgress = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  // Completes task directly (no question scenario)
  const triggerCompletionDirect = () => {
    if (activePathwayIndex !== null) {
      if (!completedPathwayIndices.includes(activePathwayIndex)) {
        handlePathwayCompleted(activePathwayIndex, null, null, null)
      }
    } else if (selectedVideo && !completedGenLessonIds.includes(selectedVideo.id)) {
      handleGenLessonCompleted(selectedVideo.id, null, null, null)
    }
  }

  // Helpers to award checkpoint points
  const awardPointsForCheckpoint = async (source: 'lesson_checkpoint_mid' | 'lesson_checkpoint_end') => {
    try {
      const cpResult = await awardConsistencyPoints(source, false)
      if (cpResult.tierUpOccurred) {
        setRankUpData({
          oldTier: cpResult.oldTier,
          newTier: cpResult.newTier
        })
      }
    } catch (err) {
      console.error('Failed to update CP for checkpoint:', err)
    }
  }

  // Logs checkpoint details into task completions
  const logCheckpointCompletion = async (
    lessonId: string,
    checkpointTypeStr: 'lesson_checkpoint_mid' | 'lesson_checkpoint_end',
    questionText: string,
    answerText: string,
    isCorrect: boolean
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('task_completions').insert({
          user_id: user.id,
          task_id: `${lessonId}_${checkpointTypeStr}`,
          task_type: checkpointTypeStr,
          duration_seconds: 0,
          recall_question: questionText,
          recall_selected: answerText,
          recall_correct: isCorrect,
          completed_at: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('Failed to log checkpoint completion:', err)
    }
  }

  // Handle Recall Checkpoint Question Submission
  const handleRecallAnswerSubmit = () => {
    if (!selectedAnswer || !selectedVideo) return
    setIsAnswerSubmitted(true)

    if (checkpointType === 'mid') {
      const isCorrect = selectedAnswer === selectedVideo.midQuestionCorrect
      if (isCorrect) {
        logCheckpointCompletion(selectedVideo.id, 'lesson_checkpoint_mid', selectedVideo.midQuestionText || '', selectedAnswer, true)
        awardPointsForCheckpoint('lesson_checkpoint_mid')
        setMidCheckpointMet(true)
        midCheckpointMetRef.current = true

        setTimeout(() => {
          setShowRecallCheck(false)
          if (playerRef.current && playerRef.current.playVideo) {
            playerRef.current.playVideo()
            startPollingProgress()
          }
        }, 2000)
      } else {
        // Let them try again (admin rule: AI suggests, human confirms, user gets feedback to retry)
        setTimeout(() => {
          setIsAnswerSubmitted(false)
          setSelectedAnswer(null)
        }, 2000)
      }
    } else if (checkpointType === 'end') {
      logCheckpointCompletion(selectedVideo.id, 'lesson_checkpoint_end', selectedVideo.endQuestionText || '', selectedAnswer, true)
      awardPointsForCheckpoint('lesson_checkpoint_end')
      setEndCheckpointMet(true)
      endCheckpointMetRef.current = true

      // Check and trigger coach notification if option is configured
      const optionIndex = [
        "I already do this",
        "I will not do this / I can't do this",
        "I will do this starting tomorrow"
      ].indexOf(selectedAnswer)

      let shouldNotify = false
      if (optionIndex === 0 && selectedVideo.notifyCoachOpt1) shouldNotify = true
      if (optionIndex === 1 && (selectedVideo.notifyCoachOpt2 !== false)) shouldNotify = true
      if (optionIndex === 2 && (selectedVideo.notifyCoachOpt3 !== false)) shouldNotify = true

      if (shouldNotify) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user && assignedCoachId) {
            supabase.from('coach_notifications').insert({
              coach_id: assignedCoachId,
              type: 'task_choice_alert',
              patient_id: user.id,
              unread: true
            }).then(({ error }) => {
              if (error) console.error('Error creating coach notification:', error)
            })
          }
        })
      }

      if (activePathwayIndex !== null) {
        if (!completedPathwayIndices.includes(activePathwayIndex)) {
          handlePathwayCompleted(activePathwayIndex, selectedVideo.endQuestionText || '', selectedAnswer, true)
        }
      } else {
        if (!completedGenLessonIds.includes(selectedVideo.id)) {
          handleGenLessonCompleted(selectedVideo.id, selectedVideo.endQuestionText || '', selectedAnswer, true)
        }
      }

      setTimeout(() => {
        setShowRecallCheck(false)
        setSelectedVideo(null)
      }, 2000)
    }
  }

  // Handle Pathway video completion
  const handlePathwayCompleted = async (
    index: number,
    recallQuestion: string | null,
    recallSelected: string | null,
    recallCorrect: boolean | null
  ) => {
    const nextIndices = [...completedPathwayIndices, index]
    setCompletedPathwayIndices(nextIndices)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('task_completions').insert({
          user_id: user.id,
          task_id: `learn_path_${selectedCondition}_${index}`,
          task_type: 'lesson_completion',
          duration_seconds: selectedVideo?.durationSeconds || 0,
          recall_question: recallQuestion,
          recall_selected: recallSelected,
          recall_correct: recallCorrect,
          completed_at: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('Failed to log pathway completion:', err)
    }
  }

  // Handle General Library video completion
  const handleGenLessonCompleted = async (
    videoId: string,
    recallQuestion: string | null,
    recallSelected: string | null,
    recallCorrect: boolean | null
  ) => {
    const nextIds = [...completedGenLessonIds, videoId]
    setCompletedGenLessonIds(nextIds)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('task_completions').insert({
          user_id: user.id,
          task_id: videoId,
          task_type: 'lesson_completion',
          duration_seconds: selectedVideo?.durationSeconds || 0,
          recall_question: recallQuestion,
          recall_selected: recallSelected,
          recall_correct: recallCorrect,
          completed_at: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('Failed to log general lesson completion:', err)
    }
  }

  // Helper to trigger CP award
  const awardPoints = async () => {
    try {
      const cpResult = await awardConsistencyPoints('lesson_completion', false)
      if (cpResult.tierUpOccurred) {
        setRankUpData({
          oldTier: cpResult.oldTier,
          newTier: cpResult.newTier
        })
      }
    } catch (err) {
      console.error('Failed to update CP for lesson:', err)
    }
  }

  // coachesConfig is only referenced here for the condition-routing name in the preview path.
  // Coach-authored content (intro, rank_up_quote) must come from the DB (see fetchCoachFromDB above).
  const coachDisplayName = coachName

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-1 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary font-mono">Education</p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Knowledge Hub</h1>
        <p className="text-sm text-text-secondary">Watch short educational classes curated by Coach {coachDisplayName}.</p>
      </header>

      {/* 1. Condition-Specific Pathway Section */}
      <section className="space-y-4">
        <div className="space-y-0.5">
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
            Your {selectedCondition} Pathway
          </h2>
          <p className="text-xs text-text-secondary leading-relaxed mt-1">
            Complete each class in sequence to unlock the next metabolic lesson.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pathwayLessons.map((lesson, index) => {
            const isCompleted = completedPathwayIndices.includes(index)
            const isUnlocked = index === 0 || completedPathwayIndices.includes(index - 1)

            return (
              <div
                key={lesson.id}
                onClick={
                  isUnlocked 
                    ? () => {
                        setSelectedVideo(lesson)
                        setActivePathwayIndex(index)
                        setWatchProgress(0)
                        maxWatchedTimeRef.current = 0
                        midCheckpointMetRef.current = false
                        endCheckpointMetRef.current = false
                        setShowRecallCheck(false)
                        setSelectedAnswer(null)
                        setIsAnswerSubmitted(false)
                        setMidCheckpointMet(false)
                        setEndCheckpointMet(false)
                        setCheckpointType(null)
                      }
                    : undefined
                }
                className={`group rounded-2xl bg-surface border overflow-hidden shadow-sm transition-all flex flex-col relative ${
                  isUnlocked 
                    ? 'border-divider/50 hover:border-primary/20 cursor-pointer' 
                    : 'border-divider/40 opacity-45 cursor-not-allowed select-none'
                }`}
              >
                {/* Thumbnail */}
                <VideoThumbnail
                  youtubeId={lesson.youtubeId}
                  title={lesson.title}
                  durationText={isUnlocked ? lesson.durationText : undefined}
                  isLocked={!isUnlocked}
                  isCompleted={isCompleted}
                />

                {/* Lesson Description */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">
                      Step {index + 1} &bull; {lesson.section}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-text-primary leading-tight">
                      {lesson.title}
                    </h4>
                  </div>
                  
                  {isCompleted && (
                    <div className="flex items-center space-x-1 text-success text-xs font-semibold uppercase tracking-wider pt-2 border-t border-divider/40">
                      <Check className="h-3.5 w-3.5" />
                      <span>Completed (+15 CP)</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 2. Open General Library Section */}
      <section className="space-y-4 pt-4 border-t border-divider/40">
        <div className="space-y-0.5">
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
            General Library
          </h2>
          <p className="text-xs text-text-secondary leading-relaxed mt-1">
            Browse and watch additional educational guides in any order. Always unlocked.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {generalLibraryLessonsList.map((lesson) => {
            const isCompleted = completedGenLessonIds.includes(lesson.id)

            return (
              <div
                key={lesson.id}
                onClick={() => {
                  setSelectedVideo(lesson)
                  setActivePathwayIndex(null)
                  setWatchProgress(0)
                  maxWatchedTimeRef.current = 0
                  midCheckpointMetRef.current = false
                  endCheckpointMetRef.current = false
                  setShowRecallCheck(false)
                  setSelectedAnswer(null)
                  setIsAnswerSubmitted(false)
                  setMidCheckpointMet(false)
                  setEndCheckpointMet(false)
                  setCheckpointType(null)
                }}
                className="group rounded-2xl bg-surface border border-divider/50 hover:border-primary/20 overflow-hidden shadow-sm transition-all cursor-pointer flex flex-col"
              >
                {/* Thumbnail */}
                <VideoThumbnail
                  youtubeId={lesson.youtubeId}
                  title={lesson.title}
                  durationText={lesson.durationText}
                  isCompleted={isCompleted}
                />

                {/* Lesson Description */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">
                      {lesson.section}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-text-primary leading-tight">
                      {lesson.title}
                    </h4>
                  </div>
                  
                  {isCompleted && (
                    <div className="flex items-center space-x-1 text-success text-xs font-semibold uppercase tracking-wider pt-2 border-t border-divider/40">
                      <Check className="h-3.5 w-3.5" />
                      <span>Completed (+15 CP)</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Embedded YouTube Modal Player */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-text-primary/40 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-divider/50 flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Modal Title Bar */}
            {!showRecallCheck && (
              <div className="p-4 border-b border-divider/40 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-semibold text-text-secondary uppercase tracking-widest block font-mono">
                    {selectedVideo.section}
                  </span>
                  <h3 className="text-sm font-bold text-text-primary mt-0.5 leading-snug">
                    {selectedVideo.title}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    stopPollingProgress()
                    setSelectedVideo(null)
                  }}
                  className="p-1 rounded-full hover:bg-divider/50 transition-colors"
                >
                  <X className="h-5 w-5 text-text-primary" />
                </button>
              </div>
            )}

            {/* Video Player Frame Container */}
            <div className={`w-full bg-text-primary relative flex flex-col items-center justify-center transition-all duration-200 ${
              showRecallCheck ? 'min-h-[290px] sm:min-h-[320px]' : 'aspect-video'
            }`}>
              <div id="inline-youtube-player" className="absolute inset-0 h-full w-full" />
              
              {/* Question Screen Overlay (Locks screen until answered) */}
              {showRecallCheck && (
                <div className="absolute inset-0 bg-surface/95 backdrop-blur-sm p-4 sm:p-5 flex flex-col justify-between overflow-y-auto z-10 animate-in fade-in duration-200">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-primary">
                        <HelpCircle className="h-4 w-4 stroke-[1.5]" />
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider font-mono">
                          {checkpointType === 'mid' ? 'Checkpoint 1: Scenario Quiz' : 'Checkpoint 2: Self-Reflection'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-accent font-mono">
                          {checkpointType === 'mid' ? '+5 CP' : '+10 CP'}
                        </span>
                        <button
                          onClick={() => {
                            stopPollingProgress()
                            setSelectedVideo(null)
                          }}
                          className="p-1 rounded-full hover:bg-divider/20 transition-colors"
                        >
                          <X className="h-4 w-4 text-text-primary" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-text-primary leading-snug">
                      {checkpointType === 'mid' ? selectedVideo.midQuestionText : selectedVideo.endQuestionText}
                    </h3>
                    
                    <div className="space-y-1.5 mt-2">
                      {(checkpointType === 'mid' 
                        ? (selectedVideo.midQuestionOptions || []) 
                        : ['I already do this', 'I will not do this / I can\'t do this', 'I will do this starting tomorrow']
                      ).map((option) => {
                        const isSelected = selectedAnswer === option
                        const isCorrect = checkpointType === 'mid' 
                          ? option === selectedVideo.midQuestionCorrect
                          : true

                        return (
                          <button
                            key={option}
                            type="button"
                            disabled={isAnswerSubmitted}
                            onClick={() => setSelectedAnswer(option)}
                            className={`w-full p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                              isAnswerSubmitted 
                                ? isCorrect
                                  ? 'bg-success/15 border-success text-success'
                                  : isSelected
                                    ? 'bg-danger/15 border-danger text-danger'
                                    : 'bg-divider/5 opacity-50 border-divider/40'
                                : isSelected
                                  ? 'bg-primary/5 border-primary text-primary'
                                  : 'bg-background border-divider/50 text-text-primary hover:border-primary/20'
                            }`}
                          >
                            {option}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-divider flex flex-col space-y-2">
                    {isAnswerSubmitted ? (
                      <p className="text-[10px] font-bold text-center uppercase tracking-wider text-text-secondary animate-pulse">
                        {checkpointType === 'mid'
                          ? selectedAnswer === selectedVideo.midQuestionCorrect
                            ? 'Excellent! Correct answer. Resuming video...'
                            : 'Incorrect answer. Please try again!'
                          : 'Thank you for reflecting! Completing lesson...'}
                      </p>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={handleRecallAnswerSubmit}
                        disabled={!selectedAnswer}
                        className="w-full py-2 text-xs"
                      >
                        Submit Answer
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Progress indicator */}
            {!showRecallCheck && (
              <div className="p-4 bg-background/50 border-t border-divider/40 flex flex-col space-y-3">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  <span>Watch Progress</span>
                </div>
                
                <div className="h-1.5 w-full bg-divider/60 rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(100, watchProgress * 100)}%` }}
                  />
                  {/* Mid check dot */}
                  <div 
                    className={`absolute top-0 bottom-0 w-1.5 rounded-full ${midCheckpointMet ? 'bg-success' : 'bg-text-secondary/50'}`}
                    style={{ left: `${selectedVideo.midCheckpointPct ?? 65}%` }}
                    title="Mid-video scenario"
                  />
                  {/* End check dot */}
                  <div 
                    className={`absolute top-0 bottom-0 w-1.5 rounded-full ${endCheckpointMet ? 'bg-success' : 'bg-text-secondary/50'}`}
                    style={{ left: `${selectedVideo.endCheckpointPct ?? 85}%` }}
                    title="End-of-video reflection"
                  />
                </div>

                {(activePathwayIndex !== null ? completedPathwayIndices.includes(activePathwayIndex) : completedGenLessonIds.includes(selectedVideo.id)) ? (
                  <p className="text-[10px] font-semibold text-success flex items-center gap-1 mt-1 justify-center leading-none">
                    <Check className="h-3.5 w-3.5" /> Lesson fully completed! (+15 CP earned)
                  </p>
                ) : (
                  <p className="text-[9px] text-text-secondary leading-normal text-center mt-1">
                    Keep this window open and watch to the end to complete the lesson.
                  </p>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Private Rank-up Celebration Modal */}
      {rankUpData && (
        <div className="fixed inset-0 bg-text-primary/20 backdrop-blur-sm z-[999] flex items-center justify-center p-6">
          <div className="bg-surface w-full max-w-sm rounded-3xl shadow-xl border-2 border-primary/20 p-6 space-y-5 animate-in zoom-in-95 duration-200 text-center">
            
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 text-primary">
              <Award className="h-8 w-8 text-primary" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-accent uppercase tracking-widest block">Consistency Milestone</span>
              <h3 className="text-xl font-bold text-text-primary">Tier Up: {rankUpData.newTier}!</h3>
              <p className="text-xs text-text-secondary mt-2">
                You have progressed from {rankUpData.oldTier} to the <strong className="text-primary">{rankUpData.newTier}</strong> consistency league!
              </p>
            </div>

            {coachRankUpQuote && (
              <div className="rounded-2xl bg-surface border border-divider p-4 text-left relative overflow-hidden">
                <p className="text-xs font-semibold text-accent uppercase tracking-wider">Coach {coachDisplayName} Notes</p>
                <p className="text-xs text-text-primary italic leading-relaxed mt-1">
                  &ldquo;{coachRankUpQuote}&rdquo;
                </p>
              </div>
            )}

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
