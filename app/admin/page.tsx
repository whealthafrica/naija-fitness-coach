'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Youtube, UserCheck, Shield, HelpCircle, RefreshCw, CheckCircle, Database } from 'lucide-react'
import { Button } from '@/components/Button'
import { VideoThumbnail } from '@/components/VideoThumbnail'
import { parseYouTubeVideo, addCoachToDb, addLessonToDb, addQuestionToDb } from './actions'
import { coachesConfig } from '@/lib/coaches'
import { conditionPathways, generalLibraryLessons } from '@/lib/learningPaths'
import { createClient } from '@/utils/supabase/client'

interface CoachFormState {
  name: string
  code: string
  intro: string
  rankUpQuote: string
  illustration: string
}

interface LessonFormState {
  youtubeUrl: string
  title: string
  youtubeId: string
  durationText: string
  durationSeconds: number
  condition: string // "General Library", "Hypertension", etc.
  section: string // dropdown or write-in
  newSectionText: string
  positionIndex: string // "General Library", "Step 1", "Step 2", etc.
  // Scraper-populated fields (not stored in DB, admin-facing only)
  thumbnailUrl: string
  channelName: string
  description: string
  suggestedSection: string | null
  // MCQ Generator fields
  midQuestionText: string
  midOptionA: string
  midOptionB: string
  midOptionC: string
  midQuestionCorrect: string
  endQuestionText: string
  transcriptConfidence: 'high' | 'low' | null
  transcriptConfidenceReason: string
}

interface QuestionFormState {
  lessonId: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  correctOption: string // "A", "B", "C"
}

export default function AdminPage() {
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<'coaches' | 'lessons' | 'questions' | 'seeding'>('coaches')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showDescription, setShowDescription] = useState(false)

  // Dropdown options
  const defaultSections = [
    'Core Food Truths',
    'Hormones and Fat Loss',
    'Cravings and Appetite',
    'Practical Eating',
    'Mindset',
    'Mental Health',
    'Addiction',
    'Fertility',
    'Mission',
    'Mood Swings',
    'Create New Section...'
  ]

  // Form States
  const [coachForm, setCoachForm] = useState<CoachFormState>({
    name: '',
    code: '',
    intro: '',
    rankUpQuote: '',
    illustration: '/coach-pcos.png'
  })

  const [lessonForm, setLessonForm] = useState<LessonFormState>({
    youtubeUrl: '',
    title: '',
    youtubeId: '',
    durationText: '',
    durationSeconds: 0,
    condition: 'General Library',
    section: 'Core Food Truths',
    newSectionText: '',
    positionIndex: 'General Library',
    thumbnailUrl: '',
    channelName: '',
    description: '',
    suggestedSection: null,
    midQuestionText: '',
    midOptionA: '',
    midOptionB: '',
    midOptionC: '',
    midQuestionCorrect: '',
    endQuestionText: '',
    transcriptConfidence: null,
    transcriptConfidenceReason: '',
  })

  const [questionForm, setQuestionForm] = useState<QuestionFormState>({
    lessonId: '',
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    correctOption: 'A'
  })

  // List of all lessons for question attachment
  const [lessonsList, setLessonsList] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    loadLessons()
  }, [])

  const loadLessons = async () => {
    if (isPreview) {
      const customLessons = JSON.parse(localStorage.getItem('custom_lessons') || '[]')
      // Map defaults + custom
      const staticList: { id: string; title: string }[] = []
      Object.values(conditionPathways).flat().forEach(l => staticList.push({ id: l.id, title: l.title }))
      generalLibraryLessons.forEach(l => staticList.push({ id: l.id, title: l.title }))
      customLessons.forEach((l: any) => staticList.push({ id: l.id, title: l.title }))
      setLessonsList(staticList)
      if (staticList.length > 0) {
        setQuestionForm(prev => ({ ...prev, lessonId: staticList[0].id }))
      }
    } else {
      try {
        const { data: dbLessons } = await supabase
          .from('lessons')
          .select('id, title')
        
        if (dbLessons && dbLessons.length > 0) {
          setLessonsList(dbLessons)
          setQuestionForm(prev => ({ ...prev, lessonId: dbLessons[0].id }))
        }
      } catch (err) {
        console.error('Failed to load lessons for questions:', err)
      }
    }
  }

  // Auto-scrapes YouTube watch page details
  const handleFetchYoutubeInfo = async () => {
    if (!lessonForm.youtubeUrl) return
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    setShowDescription(false)

    const result = await parseYouTubeVideo(lessonForm.youtubeUrl)
    setLoading(false)

    if (result.success && result.title) {
      const q = result.questions
      const hasQs = !!q && q.confidence === 'high'

      setLessonForm(prev => ({
        ...prev,
        title: result.title || '',
        youtubeId: result.youtubeId || '',
        durationText: result.durationText || '',
        durationSeconds: result.durationSeconds || 0,
        channelName: result.channelName || '',
        description: result.description || '',
        thumbnailUrl: result.thumbnailUrl || '',
        suggestedSection: result.suggestedSection ?? null,
        section: result.suggestedSection ?? prev.section,
        // Populate generated questions
        midQuestionText: q?.midQuestion || '',
        midOptionA: q?.midOptions?.[0] || '',
        midOptionB: q?.midOptions?.[1] || '',
        midOptionC: q?.midOptions?.[2] || '',
        midQuestionCorrect: q?.midCorrect || '',
        endQuestionText: q?.endQuestion || '',
        transcriptConfidence: q?.confidence ?? (result.transcriptAvailable ? 'high' : 'low'),
        transcriptConfidenceReason: q?.confidenceReason ?? (result.transcriptError || ''),
      }))

      if (result.transcriptAvailable && hasQs) {
        setSuccessMsg(`Video parsed successfully. AI has generated two checkpoint questions from the video transcript for your review below.`)
      } else {
        setSuccessMsg(`Video parsed successfully. Warning: Captions/transcript is short or unavailable. Pre-filled with fallback questions. Please review or manually enter questions below.`)
      }
    } else {
      setErrorMsg(result.error || 'Failed to fetch video details.')
    }
  }

  // Coaches Submission
  const handleCoachSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!coachForm.name || !coachForm.code || !coachForm.intro || !coachForm.rankUpQuote) {
      setErrorMsg('Please fill in all fields.')
      setLoading(false)
      return
    }

    if (isPreview) {
      const customCoaches = JSON.parse(localStorage.getItem('custom_coaches') || '{}')
      customCoaches[coachForm.code] = {
        name: coachForm.name,
        illustration: coachForm.illustration,
        intro: coachForm.intro,
        rankUpQuote: coachForm.rankUpQuote
      }
      localStorage.setItem('custom_coaches', JSON.stringify(customCoaches))
      setSuccessMsg(`Coach ${coachForm.name} added to client-side Preview Mode configuration!`)
      setCoachForm({
        name: '',
        code: '',
        intro: '',
        rankUpQuote: '',
        illustration: '/coach-pcos.png'
      })
    } else {
      const res = await addCoachToDb(coachForm)
      if (res.success) {
        setSuccessMsg(`Coach ${coachForm.name} successfully inserted into the public database!`)
        setCoachForm({
          name: '',
          code: '',
          intro: '',
          rankUpQuote: '',
          illustration: '/coach-pcos.png'
        })
      } else {
        setErrorMsg(res.error || 'Database error occurred.')
      }
    }
    setLoading(false)
  }

  // Lessons Submission
  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    const sectionName = lessonForm.section === 'Create New Section...' 
      ? lessonForm.newSectionText 
      : lessonForm.section

    if (!lessonForm.title || !lessonForm.youtubeId || !sectionName) {
      setErrorMsg('Please verify the video details and section fields are filled.')
      setLoading(false)
      return
    }

    const lessonData = {
      condition: lessonForm.condition === 'General Library' ? null : lessonForm.condition,
      section: sectionName,
      title: lessonForm.title,
      youtubeId: lessonForm.youtubeId,
      durationText: lessonForm.durationText,
      durationSeconds: lessonForm.durationSeconds,
      positionIndex: lessonForm.positionIndex === 'General Library' 
        ? null 
        : parseInt(lessonForm.positionIndex.replace('Step ', '')) - 1,
      midQuestionText: lessonForm.midQuestionText || null,
      midQuestionOptions: [lessonForm.midOptionA, lessonForm.midOptionB, lessonForm.midOptionC].filter(Boolean),
      midQuestionCorrect: lessonForm.midQuestionCorrect || null,
      endQuestionText: lessonForm.endQuestionText || null
    }

    if (isPreview) {
      const customLessons = JSON.parse(localStorage.getItem('custom_lessons') || '[]')
      const lessonId = `custom_lesson_${Date.now()}`
      const newLesson = {
        id: lessonId,
        ...lessonData
      }
      customLessons.push(newLesson)
      localStorage.setItem('custom_lessons', JSON.stringify(customLessons))

      // Also register custom questions in local storage to make client active recall load them
      if (lessonData.midQuestionText) {
        const customQuestions = JSON.parse(localStorage.getItem('custom_questions') || '[]')
        customQuestions.push({
          id: `q_mid_${Date.now()}`,
          lessonId: lessonId,
          questionText: lessonData.midQuestionText,
          options: lessonData.midQuestionOptions,
          correctOption: lessonData.midQuestionCorrect
        })
        localStorage.setItem('custom_questions', JSON.stringify(customQuestions))
      }

      setSuccessMsg(`Lesson "${lessonForm.title}" and generated checkpoint MCQs successfully published in Preview Mode catalog!`)
      
      setLessonForm({
        youtubeUrl: '',
        title: '',
        youtubeId: '',
        durationText: '',
        durationSeconds: 0,
        condition: 'General Library',
        section: 'Core Food Truths',
        newSectionText: '',
        positionIndex: 'General Library',
        thumbnailUrl: '',
        channelName: '',
        description: '',
        suggestedSection: null,
        midQuestionText: '',
        midOptionA: '',
        midOptionB: '',
        midOptionC: '',
        midQuestionCorrect: '',
        endQuestionText: '',
        transcriptConfidence: null,
        transcriptConfidenceReason: '',
      })
      loadLessons()
    } else {
      const res = await addLessonToDb(lessonData)
      if (res.success) {
        setSuccessMsg(`Lesson "${lessonForm.title}" and reviewed checkpoint MCQs successfully published to the database!`)
        setLessonForm({
          youtubeUrl: '',
          title: '',
          youtubeId: '',
          durationText: '',
          durationSeconds: 0,
          condition: 'General Library',
          section: 'Core Food Truths',
          newSectionText: '',
          positionIndex: 'General Library',
          thumbnailUrl: '',
          channelName: '',
          description: '',
          suggestedSection: null,
          midQuestionText: '',
          midOptionA: '',
          midOptionB: '',
          midOptionC: '',
          midQuestionCorrect: '',
          endQuestionText: '',
          transcriptConfidence: null,
          transcriptConfidenceReason: '',
        })
        loadLessons()
      } else {
        setErrorMsg(res.error || 'Database error occurred.')
      }
    }
    setLoading(false)
  }

  // Questions Submission
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!questionForm.lessonId || !questionForm.questionText || !questionForm.optionA || !questionForm.optionB) {
      setErrorMsg('Please select a video and write at least options A and B.')
      setLoading(false)
      return
    }

    const options = [questionForm.optionA, questionForm.optionB]
    if (questionForm.optionC) options.push(questionForm.optionC)

    const correctText = questionForm.correctOption === 'A' 
      ? questionForm.optionA 
      : questionForm.correctOption === 'B' 
      ? questionForm.optionB 
      : questionForm.optionC

    const questionData = {
      lessonId: questionForm.lessonId,
      questionText: questionForm.questionText,
      options,
      correctOption: correctText
    }

    if (isPreview) {
      const customQuestions = JSON.parse(localStorage.getItem('custom_questions') || '[]')
      customQuestions.push({
        id: `custom_q_${Date.now()}`,
        ...questionData
      })
      localStorage.setItem('custom_questions', JSON.stringify(customQuestions))
      setSuccessMsg('Recall question configured successfully for preview mode!')
      
      setQuestionForm({
        lessonId: lessonsList[0]?.id || '',
        questionText: '',
        optionA: '',
        optionB: '',
        optionC: '',
        correctOption: 'A'
      })
    } else {
      const res = await addQuestionToDb(questionData)
      if (res.success) {
        setSuccessMsg('Recall question successfully linked and saved in the database!')
        setQuestionForm({
          lessonId: lessonsList[0]?.id || '',
          questionText: '',
          optionA: '',
          optionB: '',
          optionC: '',
          correctOption: 'A'
        })
      } else {
        setErrorMsg(res.error || 'Database error occurred.')
      }
    }
    setLoading(false)
  }

  // Database Seed Execution
  const handleSeedDatabase = async () => {
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      // 1. Seed coaches
      for (const [condition, coach] of Object.entries(coachesConfig)) {
        // Find or create coach record
        let { data: existing } = await supabase
          .from('coaches')
          .select('id')
          .eq('name', coach.name)
          .limit(1)

        if (!existing || existing.length === 0) {
          const coachCode = coach.name.toLowerCase()
          await supabase.from('coaches').insert({
            name: coach.name,
            code: coachCode,
            illustration: coach.illustration,
            intro: coach.intro,
            rank_up_quote: coach.rankUpQuote
          })
        } else {
          // Update details
          await supabase.from('coaches').update({
            code: coach.name.toLowerCase(),
            illustration: coach.illustration,
            intro: coach.intro,
            rank_up_quote: coach.rankUpQuote
          }).eq('name', coach.name)
        }
      }

      // 2. Seed sequenced lessons
      for (const [condition, lessons] of Object.entries(conditionPathways)) {
        for (let i = 0; i < lessons.length; i++) {
          const l = lessons[i]
          let { data: existing } = await supabase
            .from('lessons')
            .select('id')
            .eq('youtube_id', l.youtubeId)
            .eq('condition', condition)
            .limit(1)

          if (!existing || existing.length === 0) {
            await supabase.from('lessons').insert({
              condition: condition,
              section: l.section,
              title: l.title,
              youtube_id: l.youtubeId,
              duration_text: l.durationText,
              duration_seconds: l.durationSeconds,
              position_index: i
            })
          }
        }
      }

      // 3. Seed general library lessons
      for (const l of generalLibraryLessons) {
        let { data: existing } = await supabase
          .from('lessons')
          .select('id')
          .eq('youtube_id', l.youtubeId)
          .is('condition', null)
          .limit(1)

        if (!existing || existing.length === 0) {
          await supabase.from('lessons').insert({
            condition: null,
            section: l.section,
            title: l.title,
            youtube_id: l.youtubeId,
            duration_text: l.durationText,
            duration_seconds: l.durationSeconds,
            position_index: null
          })
        }
      }

      setSuccessMsg('Successfully seeded default coaches and all pathway lessons into the Supabase database!')
      loadLessons()
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during database seeding.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="space-y-1 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Developer Console</p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Admin Control Center</h1>
        <p className="text-sm text-text-secondary">
          Configure dynamic coaches, seed pathway lessons, and configure recall questions.
          {isPreview && <strong className="text-accent ml-1">(Running in local Preview Mode Client-Cache)</strong>}
        </p>
      </header>

      {/* Tabs Switcher */}
      <div className="flex border-b border-divider overflow-x-auto space-x-4">
        <button
          onClick={() => { setActiveTab('coaches'); setErrorMsg(null); setSuccessMsg(null) }}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'coaches' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <UserCheck className="h-4 w-4 inline mr-1" /> Coaches
        </button>
        <button
          onClick={() => { setActiveTab('lessons'); setErrorMsg(null); setSuccessMsg(null) }}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'lessons' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Youtube className="h-4 w-4 inline mr-1" /> Videos & Lessons
        </button>
        <button
          onClick={() => { setActiveTab('questions'); setErrorMsg(null); setSuccessMsg(null) }}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'questions' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <HelpCircle className="h-4 w-4 inline mr-1" /> Recall Questions
        </button>
        <button
          onClick={() => { setActiveTab('seeding'); setErrorMsg(null); setSuccessMsg(null) }}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'seeding' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Database className="h-4 w-4 inline mr-1" /> Seed Utilities
        </button>
      </div>

      {/* Message Notifications */}
      {successMsg && (
        <div className="rounded-2xl bg-success/15 border border-success/20 p-4 text-xs font-semibold text-success flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl bg-danger/15 border border-danger/20 p-4 text-xs font-semibold text-danger animate-in fade-in duration-200">
          {errorMsg}
        </div>
      )}

      {/* 1. Tab: Manage Coaches */}
      {activeTab === 'coaches' && (
        <form onSubmit={handleCoachSubmit} className="space-y-4 max-w-lg bg-surface border border-divider p-6 rounded-3xl shadow-sm">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Create New Coach Profile</h3>
          
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Coach Name</label>
            <input
              type="text"
              className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
              placeholder="e.g. Coach Ola"
              value={coachForm.name}
              onChange={(e) => setCoachForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Coach URL Code / Slug</label>
            <input
              type="text"
              className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
              placeholder="e.g. ola (yields /coach?code=ola)"
              value={coachForm.code}
              onChange={(e) => setCoachForm(prev => ({ ...prev, code: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Introductory Text</label>
            <textarea
              className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors h-24 resize-none"
              placeholder="Introductory speech to show the user on boarding..."
              value={coachForm.intro}
              onChange={(e) => setCoachForm(prev => ({ ...prev, intro: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Rank-Up Celebration Notes</label>
            <textarea
              className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors h-20 resize-none"
              placeholder="Notes note displayed on tier milestone upgrades..."
              value={coachForm.rankUpQuote}
              onChange={(e) => setCoachForm(prev => ({ ...prev, rankUpQuote: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Illustration Image File Path</label>
            <select
              className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
              value={coachForm.illustration}
              onChange={(e) => setCoachForm(prev => ({ ...prev, illustration: e.target.value }))}
            >
              <option value="/coach-pcos.png">Tunde / Diabetes Portrait (/coach-pcos.png)</option>
              <option value="/coach-adaeze.png">Adaeze / Hypertension Portrait (/coach-adaeze.png)</option>
              <option value="/coach-fitness.png">Ngozi / PCOS Portrait (/coach-fitness.png)</option>
              <option value="/coach-pre-diabetes.png">Emeka / Pre-Diabetes Portrait (/coach-pre-diabetes.png)</option>
              <option value="/coach-diabetes.png">Amara / General Fitness Portrait (/coach-diabetes.png)</option>
            </select>
          </div>

          <Button variant="primary" type="submit" disabled={loading} className="w-full">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin inline mr-1" /> : <Plus className="h-4 w-4 inline mr-1" />}
            Save Coach Profile
          </Button>
        </form>
      )}

      {/* 2. Tab: Manage Lessons */}
      {activeTab === 'lessons' && (
        <form onSubmit={handleLessonSubmit} className="space-y-4 max-w-lg bg-surface border border-divider p-6 rounded-3xl shadow-sm">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Publish New Video Lesson</h3>

          {/* Scraper field */}
          <div className="space-y-1 bg-background/50 border border-divider/60 rounded-2xl p-4 space-y-2">
            <label className="text-[10px] font-bold text-accent uppercase tracking-wide block">Automatic YouTube Info Parser</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-background border border-divider rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-accent transition-colors"
                placeholder="Paste video watch URL or raw ID..."
                value={lessonForm.youtubeUrl}
                onChange={(e) => setLessonForm(prev => ({ ...prev, youtubeUrl: e.target.value }))}
              />
              <button
                type="button"
                onClick={handleFetchYoutubeInfo}
                disabled={loading || !lessonForm.youtubeUrl}
                className="bg-primary text-background text-xs font-semibold px-4 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Fetch Details
              </button>
            </div>
            <p className="text-[9px] text-text-secondary leading-normal">
              Entering a link automatically fetches the video ID, title, duration, channel name, and suggests a category.
            </p>
          </div>

          {/* Thumbnail Preview Card — shown after a successful scrape */}
          {lessonForm.thumbnailUrl && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <label className="text-[10px] font-bold text-text-secondary uppercase">Thumbnail Preview</label>
              <div className="rounded-2xl overflow-hidden border border-divider/60 max-w-xs">
                <VideoThumbnail
                  youtubeId={lessonForm.youtubeId}
                  title={lessonForm.title}
                  durationText={lessonForm.durationText}
                />
              </div>
              {lessonForm.channelName && (
                <p className="text-[10px] text-text-secondary font-mono">
                  Channel: <span className="text-text-primary font-semibold">{lessonForm.channelName}</span>
                </p>
              )}
              {lessonForm.description && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setShowDescription(v => !v)}
                    className="text-[10px] text-accent font-semibold hover:underline"
                  >
                    {showDescription ? 'Hide description' : 'Show description'}
                  </button>
                  {showDescription && (
                    <p className="text-[10px] text-text-secondary leading-relaxed bg-background/50 border border-divider/50 rounded-xl p-3">
                      {lessonForm.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Suggested Category Chip — confirm-only, never auto-publishes */}
          {lessonForm.suggestedSection && (
            <div className="rounded-xl bg-accent/8 border border-accent/25 p-3 space-y-1.5 animate-in fade-in duration-200">
              <p className="text-[10px] font-bold text-accent uppercase tracking-wider">Category Suggestion</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-text-primary">
                  &ldquo;{lessonForm.suggestedSection}&rdquo;
                </span>
                <button
                  type="button"
                  onClick={() => setLessonForm(prev => ({ ...prev, section: prev.suggestedSection ?? prev.section }))}
                  className="text-[10px] bg-accent text-background font-bold px-2.5 py-1 rounded-full hover:opacity-90 transition-opacity"
                >
                  Apply
                </button>
                <span className="text-[9px] text-text-secondary">or select a different section below</span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Video Title</label>
            <input
              type="text"
              className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
              placeholder="e.g. Core Food Truths: Navigating Fats"
              value={lessonForm.title}
              onChange={(e) => setLessonForm(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase">YouTube Video ID</label>
              <input
                type="text"
                className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
                placeholder="e.g. ykcMGi4vM-w"
                value={lessonForm.youtubeId}
                onChange={(e) => setLessonForm(prev => ({ ...prev, youtubeId: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase">Duration Text</label>
              <input
                type="text"
                className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
                placeholder="e.g. 10m 00s"
                value={lessonForm.durationText}
                onChange={(e) => setLessonForm(prev => ({ ...prev, durationText: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase">Focus Pathway / Condition</label>
              <select
                className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
                value={lessonForm.condition}
                onChange={(e) => setLessonForm(prev => ({ ...prev, condition: e.target.value }))}
              >
                <option value="General Library">General Library (Unlocked)</option>
                <option value="Hypertension">Hypertension Pathway</option>
                <option value="Type 2 Diabetes">Type 2 Diabetes Pathway</option>
                <option value="PCOS">PCOS Pathway</option>
                <option value="Pre-Diabetes">Pre-Diabetes Pathway</option>
                <option value="General Fitness">General Fitness Pathway</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase">Sequence Index</label>
              <select
                className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
                value={lessonForm.positionIndex}
                disabled={lessonForm.condition === 'General Library'}
                onChange={(e) => setLessonForm(prev => ({ ...prev, positionIndex: e.target.value }))}
              >
                <option value="General Library">General Library (None)</option>
                <option value="Step 1">Step 1 (First)</option>
                <option value="Step 2">Step 2</option>
                <option value="Step 3">Step 3</option>
                <option value="Step 4">Step 4</option>
                <option value="Step 5">Step 5</option>
                <option value="Step 6">Step 6 (Last)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Category Section</label>
            <select
              className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
              value={lessonForm.section}
              onChange={(e) => setLessonForm(prev => ({ ...prev, section: e.target.value }))}
            >
              {defaultSections.map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          {lessonForm.section === 'Create New Section...' && (
            <div className="space-y-1 animate-in fade-in duration-200">
              <label className="text-[10px] font-bold text-accent uppercase">Custom Section Name</label>
              <input
                type="text"
                className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
                placeholder="e.g. Physical Therapy"
                value={lessonForm.newSectionText}
                onChange={(e) => setLessonForm(prev => ({ ...prev, newSectionText: e.target.value }))}
              />
            </div>
          )}

          {/* AI-Assisted MCQ Question Review Section */}
          {lessonForm.youtubeId && (
            <div className="space-y-4 pt-4 border-t border-divider/60 animate-in fade-in duration-200">
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">AI Checkpoint Generator</h4>
              
              {lessonForm.transcriptConfidence === 'low' ? (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider">⚠️ Scraper Warning: Low Confidence</p>
                  <p className="text-[10px] leading-normal font-medium">
                    {lessonForm.transcriptConfidenceReason || 'No English transcript could be parsed, or the transcript text is too short.'} Pre-filled with generic template prompts. Review and edit before publishing.
                  </p>
                </div>
              ) : lessonForm.transcriptConfidence === 'high' ? (
                <div className="p-3 bg-[#D4EDDA] border border-[#C3E6CB] text-[#155724] rounded-xl space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider">✅ Scraper Success: Grounded in Transcript</p>
                  <p className="text-[10px] leading-normal font-medium">
                    Successfully loaded English transcript. Questions below have been generated from video caption keywords.
                  </p>
                </div>
              ) : null}

              {/* Checkpoint 1: Mid-Video Scenario */}
              <div className="bg-background/40 border border-divider/50 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded uppercase font-mono">
                    Checkpoint 1: Mid-Video Scenario (60-70% watched)
                  </span>
                  <span className="text-[9px] text-text-secondary font-bold font-mono">+5 CP</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-secondary uppercase">Scenario Question Text</label>
                  <input
                    type="text"
                    className="w-full bg-background border border-divider rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-accent"
                    value={lessonForm.midQuestionText}
                    onChange={(e) => setLessonForm(prev => ({ ...prev, midQuestionText: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-text-secondary uppercase">Option A</label>
                    <input
                      type="text"
                      className="w-full bg-background border border-divider rounded-lg p-2 text-xs text-text-primary outline-none focus:border-accent"
                      value={lessonForm.midOptionA}
                      onChange={(e) => setLessonForm(prev => ({ ...prev, midOptionA: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-text-secondary uppercase">Option B</label>
                    <input
                      type="text"
                      className="w-full bg-background border border-divider rounded-lg p-2 text-xs text-text-primary outline-none focus:border-accent"
                      value={lessonForm.midOptionB}
                      onChange={(e) => setLessonForm(prev => ({ ...prev, midOptionB: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-text-secondary uppercase">Option C</label>
                    <input
                      type="text"
                      className="w-full bg-background border border-divider rounded-lg p-2 text-xs text-text-primary outline-none focus:border-accent"
                      value={lessonForm.midOptionC}
                      onChange={(e) => setLessonForm(prev => ({ ...prev, midOptionC: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-secondary uppercase">Correct Option Text</label>
                  <select
                    className="w-full bg-background border border-divider rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-accent"
                    value={lessonForm.midQuestionCorrect}
                    onChange={(e) => setLessonForm(prev => ({ ...prev, midQuestionCorrect: e.target.value }))}
                  >
                    <option value="">-- Select Correct Option --</option>
                    {lessonForm.midOptionA && <option value={lessonForm.midOptionA}>Option A: {lessonForm.midOptionA}</option>}
                    {lessonForm.midOptionB && <option value={lessonForm.midOptionB}>Option B: {lessonForm.midOptionB}</option>}
                    {lessonForm.midOptionC && <option value={lessonForm.midOptionC}>Option C: {lessonForm.midOptionC}</option>}
                  </select>
                </div>
              </div>

              {/* Checkpoint 2: End-of-Video Self-Reflection */}
              <div className="bg-background/40 border border-divider/50 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded uppercase font-mono">
                    Checkpoint 2: Self-Reflection (85% watched)
                  </span>
                  <span className="text-[9px] text-text-secondary font-bold font-mono">+10 CP</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-secondary uppercase">Self-Reflection Question Text</label>
                  <input
                    type="text"
                    className="w-full bg-background border border-divider rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-accent"
                    value={lessonForm.endQuestionText}
                    onChange={(e) => setLessonForm(prev => ({ ...prev, endQuestionText: e.target.value }))}
                  />
                </div>

                <div className="space-y-1 bg-divider/10 rounded-xl p-3 border border-divider/20">
                  <label className="text-[8px] font-bold text-text-secondary uppercase block mb-1">Standard Feedback Options (End User)</label>
                  <ul className="list-disc pl-4 text-[10px] text-text-secondary space-y-0.5">
                    <li>&ldquo;I will try this tomorrow&rdquo; (micro-action seed)</li>
                    <li>&ldquo;I already do this&rdquo; (advanced pathway signal)</li>
                    <li>&ldquo;I need to talk to my coach&rdquo; (coach dashboard warning flag)</li>
                    <li>&ldquo;I am not sure yet&rdquo; (coach flag + uncertainty alert)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          <Button variant="primary" type="submit" disabled={loading} className="w-full">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin inline mr-1" /> : <Plus className="h-4 w-4 inline mr-1" />}
            Publish Video Lesson
          </Button>
        </form>
      )}

      {/* 3. Tab: Manage Scenario Recall Questions */}
      {activeTab === 'questions' && (
        <form onSubmit={handleQuestionSubmit} className="space-y-4 max-w-lg bg-surface border border-divider p-6 rounded-3xl shadow-sm">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Configure Scenario Question</h3>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Select Video Lesson</label>
            <select
              className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
              value={questionForm.lessonId}
              onChange={(e) => setQuestionForm(prev => ({ ...prev, lessonId: e.target.value }))}
            >
              {lessonsList.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Recall Question Text</label>
            <input
              type="text"
              className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
              placeholder="e.g. Which stretch option did Tunde demonstrate?"
              value={questionForm.questionText}
              onChange={(e) => setQuestionForm(prev => ({ ...prev, questionText: e.target.value }))}
            />
          </div>

          <div className="space-y-3 p-4 bg-background/50 border border-divider/60 rounded-2xl">
            <p className="text-[10px] font-bold text-text-secondary uppercase">Answer Option Selections</p>
            
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-text-secondary uppercase block">Option A</label>
              <input
                type="text"
                className="w-full bg-background border border-divider rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-accent transition-colors"
                placeholder="e.g. The Hamstring stretch"
                value={questionForm.optionA}
                onChange={(e) => setQuestionForm(prev => ({ ...prev, optionA: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-text-secondary uppercase block">Option B</label>
              <input
                type="text"
                className="w-full bg-background border border-divider rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-accent transition-colors"
                placeholder="e.g. The Shoulder stretch"
                value={questionForm.optionB}
                onChange={(e) => setQuestionForm(prev => ({ ...prev, optionB: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-text-secondary uppercase block">Option C (Optional)</label>
              <input
                type="text"
                className="w-full bg-background border border-divider rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-accent transition-colors"
                placeholder="e.g. The Calf stretch"
                value={questionForm.optionC}
                onChange={(e) => setQuestionForm(prev => ({ ...prev, optionC: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase block">Correct Option Answer</label>
            <select
              className="w-full bg-background border border-divider rounded-xl p-3 text-xs text-text-primary outline-none focus:border-accent transition-colors"
              value={questionForm.correctOption}
              onChange={(e) => setQuestionForm(prev => ({ ...prev, correctOption: e.target.value }))}
            >
              <option value="A">Option A</option>
              <option value="B">Option B</option>
              {questionForm.optionC && <option value="C">Option C</option>}
            </select>
          </div>

          <Button variant="primary" type="submit" disabled={loading} className="w-full">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin inline mr-1" /> : <Plus className="h-4 w-4 inline mr-1" />}
            Save Scenario Question
          </Button>
        </form>
      )}

      {/* 4. Tab: Seeding Utilities */}
      {activeTab === 'seeding' && (
        <div className="space-y-4 max-w-lg bg-surface border border-divider p-6 rounded-3xl shadow-sm space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Database Seed Wizard</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              If your remote Supabase database tables are completely empty, you can seed all 5 coaches (Adaeze, Tunde, Ngozi, Emeka, Amara) 
              and their 30+ default lesson pathways in a single click.
            </p>
          </div>

          <div className="rounded-2xl bg-accent/5 border border-accent/20 p-4 text-[10px] text-text-secondary space-y-1">
            <strong className="text-accent uppercase block">Operations performed:</strong>
            <ul className="list-disc pl-4 space-y-0.5 mt-1">
              <li>Seed/Update 5 dynamic coach profile metadata.</li>
              <li>Seed 30 Sequenced Pathway lessons across 5 conditions.</li>
              <li>Seed 11 General Library lessons.</li>
            </ul>
          </div>

          <Button
            variant="primary"
            onClick={handleSeedDatabase}
            disabled={loading}
            className="w-full"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin inline mr-1" /> : <Shield className="h-4 w-4 inline mr-1" />}
            Run Seed Database Script
          </Button>
        </div>
      )}
    </div>
  )
}
