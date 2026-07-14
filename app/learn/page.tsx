'use client'

// Built against PRD Section 8.5 (Education & Gated Learning Paths)
import React, { useState, useEffect, useRef } from 'react'
import { Check, X, Award, Loader2, HelpCircle } from 'lucide-react'
import { Button } from '@/components/Button'
import { VideoThumbnail } from '@/components/VideoThumbnail'
import { awardConsistencyPoints, TierType } from '@/lib/cpEngine'
import { coachesConfig } from '@/lib/coaches'
import { conditionPathways, generalLibraryLessons, LessonDef } from '@/lib/learningPaths'
import { createClient } from '@/utils/supabase/client'

interface QuestionDef {
  id: string
  lessonId: string
  questionText: string
  options: string[]
  correctOption: string
}

export default function LearnPage() {
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'
  const supabase = createClient()

  // Pathway Focus and Gating states
  const [selectedCondition, setSelectedCondition] = useState('General Fitness')
  const [completedPathwayIndices, setCompletedPathwayIndices] = useState<number[]>([])
  const [completedGenLessonIds, setCompletedGenLessonIds] = useState<string[]>([])
  const [coachName, setCoachName] = useState('Adaeze')

  // Dynamic Lessons & Questions states
  const [pathwayLessons, setPathwayLessons] = useState<LessonDef[]>([])
  const [generalLibraryLessonsList, setGeneralLibraryLessonsList] = useState<LessonDef[]>([])
  const [questionsMap, setQuestionsMap] = useState<Record<string, QuestionDef>>({})

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

  // Load user data, custom configurations, and completions
  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '')
      return ''
    }

    const condition = isPreview 
      ? (getCookie('preview_condition') || 'Hypertension') 
      : 'Hypertension' // Fallback, overwritten below

    setSelectedCondition(condition)

    // Load coach name
    const coachMap: Record<string, string> = {
      'Type 2 Diabetes': 'Tunde',
      'Hypertension': 'Adaeze',
      'PCOS': 'Ngozi',
      'Pre-Diabetes': 'Emeka',
      'General Fitness': 'Amara'
    }
    setCoachName(coachMap[condition] || 'Adaeze')

    // 1. Load Completed states
    if (isPreview) {
      const savedPathway = localStorage.getItem(`completed_pathway_${condition}`)
      if (savedPathway) setCompletedPathwayIndices(JSON.parse(savedPathway))
      
      const savedGen = localStorage.getItem('completed_gen_lessons')
      if (savedGen) setCompletedGenLessonIds(JSON.parse(savedGen))

      // Load dynamic lessons & questions from client cache
      loadDynamicLessons(condition)
    } else {
      const loadProfileAndCompletions = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch user condition
        const { data: profile } = await supabase
          .from('users')
          .select('condition')
          .eq('id', user.id)
          .single()

        const userCondition = profile?.condition || 'Hypertension'
        setSelectedCondition(userCondition)
        setCoachName(coachMap[userCondition] || 'Adaeze')

        // Fetch completions
        const { data: completions } = await supabase
          .from('task_completions')
          .select('task_id')
          .eq('user_id', user.id)

        if (completions) {
          const pathPrefix = `learn_path_${userCondition}_`
          const indices: number[] = []
          const genIds: string[] = []

          completions.forEach(c => {
            if (c.task_id.startsWith(pathPrefix)) {
              const idxStr = c.task_id.replace(pathPrefix, '')
              const idx = parseInt(idxStr, 10)
              if (!isNaN(idx)) indices.push(idx)
            } else if (c.task_id.startsWith('gen_lesson_') || c.task_id.startsWith('custom_lesson_')) {
              genIds.push(c.task_id)
            }
          })

          setCompletedPathwayIndices(indices)
          setCompletedGenLessonIds(genIds)
        }

        // Fetch from dynamic tables
        loadDynamicLessons(userCondition)
      }
      loadProfileAndCompletions()
    }

    // Load YouTube API script
    if (!(window as any).YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    }
  }, [isPreview])

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
    if (isPreview) {
      // Load static defaults
      const defaultPath = (conditionPathways[condition] || conditionPathways['General Fitness']).map(addHeuristicQuestionsToLesson)
      const defaultGen = [...generalLibraryLessons].map(addHeuristicQuestionsToLesson)

      // Load customs
      const customLessons = JSON.parse(localStorage.getItem('custom_lessons') || '[]')
      const customQuestions = JSON.parse(localStorage.getItem('custom_questions') || '[]')

      // Filter and append customs
      const combinedPath = [...defaultPath]
      const combinedGen = [...defaultGen]

      customLessons.forEach((lesson: any) => {
        const formattedLesson: LessonDef = addHeuristicQuestionsToLesson({
          id: lesson.id,
          title: lesson.title,
          section: lesson.section,
          youtubeId: lesson.youtubeId,
          durationText: lesson.durationText,
          durationSeconds: lesson.durationSeconds,
          midQuestionText: lesson.midQuestionText || null,
          midQuestionOptions: lesson.midQuestionOptions || null,
          midQuestionCorrect: lesson.midQuestionCorrect || null,
          endQuestionText: lesson.endQuestionText || null
        })

        if (lesson.condition === condition && lesson.positionIndex !== null) {
          combinedPath.push(formattedLesson)
        } else if (!lesson.condition) {
          combinedGen.push(formattedLesson)
        }
      })

      setPathwayLessons(combinedPath)
      setGeneralLibraryLessonsList(combinedGen)

      // Map questions
      const qMap: Record<string, QuestionDef> = {}
      customQuestions.forEach((q: any) => {
        qMap[q.lessonId] = {
          id: q.id,
          lessonId: q.lessonId,
          questionText: q.questionText,
          options: q.options,
          correctOption: q.correctOption
        }
      })
      setQuestionsMap(qMap)
    } else {
      try {
        const { data: dbLessons } = await supabase
          .from('lessons')
          .select('*')
          .order('created_at', { ascending: true })

        const { data: dbQuestions } = await supabase
          .from('scenario_questions')
          .select('*')

        // Fallback to static if DB has no seed data
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
                  endQuestionText: l.end_question_text
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
                  endQuestionText: l.end_question_text
                })
              })
          : generalLibraryLessons.map(addHeuristicQuestionsToLesson)

        setPathwayLessons(finalPath)
        setGeneralLibraryLessonsList(finalGen)

        // Map questions
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
        setPathwayLessons((conditionPathways[condition] || conditionPathways['General Fitness']).map(addHeuristicQuestionsToLesson))
        setGeneralLibraryLessonsList(generalLibraryLessons.map(addHeuristicQuestionsToLesson))
      }
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
      if (!playerRef.current || !playerRef.current.getCurrentTime || !playerRef.current.getDuration) return

      const currentTime = playerRef.current.getCurrentTime()
      const duration = playerRef.current.getDuration()

      if (duration > 0) {
        const progress = currentTime / duration
        setWatchProgress(progress)

        // Checkpoint 1: Mid-Video Scenario at 60-70% (e.g. >= 65%)
        if (progress >= 0.65 && progress < 0.80 && !midCheckpointMet) {
          if (playerRef.current && playerRef.current.pauseVideo) {
            playerRef.current.pauseVideo()
          }
          stopPollingProgress()
          setCheckpointType('mid')
          setShowRecallCheck(true)
          setSelectedAnswer(null)
          setIsAnswerSubmitted(false)
        }
        // Checkpoint 2: End-of-Video self-placement at 85%
        else if (progress >= 0.85 && midCheckpointMet && !endCheckpointMet) {
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
      const cpResult = await awardConsistencyPoints(source, isPreview)
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
    if (isPreview) {
      const localComps = JSON.parse(localStorage.getItem('preview_completions') || '[]')
      localComps.push({
        id: `comp_${Date.now()}`,
        task_id: `${lessonId}_${checkpointTypeStr}`,
        task_type: checkpointTypeStr,
        completed_at: new Date().toISOString()
      })
      localStorage.setItem('preview_completions', JSON.stringify(localComps))
    } else {
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

    if (isPreview) {
      localStorage.setItem(`completed_pathway_${selectedCondition}`, JSON.stringify(nextIndices))
    } else {
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

    if (isPreview) {
      localStorage.setItem('completed_gen_lessons', JSON.stringify(nextIds))
    } else {
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
  }

  // Helper to trigger CP award
  const awardPoints = async () => {
    try {
      const cpResult = await awardConsistencyPoints('lesson_completion', isPreview)
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

  const coach = coachesConfig[selectedCondition] || coachesConfig['General Fitness']

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-1 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary font-mono">Education</p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Knowledge Hub</h1>
        <p className="text-sm text-text-secondary">Watch short educational classes curated by Coach {coach.name}.</p>
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

            {/* Video Player Frame Container */}
            <div className="aspect-video w-full bg-text-primary relative flex items-center justify-center">
              <div id="inline-youtube-player" className="absolute inset-0 h-full w-full" />
              
              {/* Question Screen Overlay (Locks screen until answered) */}
              {showRecallCheck && (
                <div className="absolute inset-0 bg-surface/95 backdrop-blur-sm p-6 flex flex-col justify-between overflow-y-auto z-10 animate-in fade-in duration-200">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-primary">
                        <HelpCircle className="h-5 w-5 stroke-[1.5]" />
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider font-mono">
                          {checkpointType === 'mid' ? 'Checkpoint 1: Scenario Quiz' : 'Checkpoint 2: Self-Reflection'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-accent font-mono">
                        {checkpointType === 'mid' ? '+5 CP' : '+10 CP'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-text-primary leading-snug">
                      {checkpointType === 'mid' ? selectedVideo.midQuestionText : selectedVideo.endQuestionText}
                    </h3>
                    
                    <div className="space-y-2 mt-4">
                      {(checkpointType === 'mid' 
                        ? (selectedVideo.midQuestionOptions || []) 
                        : ['I will try this tomorrow', 'I already do this', 'I need to talk to my coach', 'I am not sure yet']
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
                            className={`w-full p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
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

                  <div className="pt-4 border-t border-divider flex flex-col space-y-2">
                    {isAnswerSubmitted ? (
                      <p className="text-[10px] font-bold text-center uppercase tracking-wider text-text-secondary animate-pulse">
                        {checkpointType === 'mid'
                          ? selectedAnswer === selectedVideo.midQuestionCorrect
                            ? '🌟 Excellent! Correct answer. Resuming video...'
                            : '⚠️ Incorrect answer. Please try again!'
                          : '👍 Thank you for reflecting! Completing lesson...'}
                      </p>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={handleRecallAnswerSubmit}
                        disabled={!selectedAnswer}
                        className="w-full"
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
                  <span>Watch Milestones</span>
                  <span>Current: {Math.min(100, Math.round(watchProgress * 100))}%</span>
                </div>
                
                <div className="h-1.5 w-full bg-divider/60 rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(100, watchProgress * 100)}%` }}
                  />
                  {/* Mid check dot */}
                  <div 
                    className={`absolute top-0 bottom-0 w-1.5 rounded-full ${midCheckpointMet ? 'bg-success' : 'bg-text-secondary/50'}`}
                    style={{ left: '65%' }}
                    title="Mid-video scenario"
                  />
                  {/* End check dot */}
                  <div 
                    className={`absolute top-0 bottom-0 w-1.5 rounded-full ${endCheckpointMet ? 'bg-success' : 'bg-text-secondary/50'}`}
                    style={{ left: '85%' }}
                    title="End-of-video reflection"
                  />
                </div>

                <div className="flex justify-between text-[9px] font-semibold uppercase text-text-secondary font-mono">
                  <span className={midCheckpointMet ? 'text-success' : ''}>
                    Checkpoint 1 (65%): {midCheckpointMet ? '✅ PASSED (+5 CP)' : '🔒 PENDING'}
                  </span>
                  <span className={endCheckpointMet ? 'text-success' : ''}>
                    Checkpoint 2 (85%): {endCheckpointMet ? '✅ PASSED (+10 CP)' : '🔒 PENDING'}
                  </span>
                </div>

                {(activePathwayIndex !== null ? completedPathwayIndices.includes(activePathwayIndex) : completedGenLessonIds.includes(selectedVideo.id)) ? (
                  <p className="text-[10px] font-semibold text-success flex items-center gap-1 mt-1 justify-center leading-none">
                    <Check className="h-3.5 w-3.5" /> Lesson fully completed! (+15 CP earned)
                  </p>
                ) : (
                  <p className="text-[9px] text-text-secondary leading-normal text-center mt-1">
                    Keep this window open. Watch progress must pass the 65% and 85% milestones to complete the lesson.
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

            <div className="rounded-2xl bg-surface border border-divider p-4 text-left relative overflow-hidden">
              <p className="text-xs font-semibold text-accent uppercase tracking-wider">Coach {coach.name} Notes</p>
              <p className="text-xs text-text-primary italic leading-relaxed mt-1">
                &ldquo;{coach.rankUpQuote}&rdquo;
              </p>
            </div>

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
