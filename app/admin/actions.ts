'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

// Keyword map for category auto-suggestion.
// Title + description text is matched against these trigger phrases.
// The section with the most keyword hits wins, subject to a minimum of 1 hit.
const SECTION_KEYWORDS: Record<string, string[]> = {
  'Core Food Truths': ['food truth', 'nutrition basics', 'diet myth', 'health myth', 'food science', 'whole food'],
  'Hormones and Fat Loss': ['hormone', 'insulin', 'cortisol', 'fat loss', 'belly fat', 'visceral', 'leptin', 'metabolism'],
  'Cravings and Appetite': ['craving', 'appetite', 'hunger', 'sugar', 'cravings', 'processed food', 'binge', 'urge'],
  'Practical Eating': ['meal', 'diet plan', 'eating', 'plate', 'portion', 'recipe', 'cook', 'food prep'],
  'Mindset': ['mindset', 'rest', 'values', 'belief', 'habit', 'willpower', 'discipline', 'motivation', 'purpose'],
  'Mental Health': ['mental health', 'anxiety', 'depression', 'stress', 'mood', 'emotional', 'therapy', 'wellbeing'],
  'Addiction': ['addiction', 'dopamine', 'satiety', 'reward', 'loop', 'dependency', 'compulsive'],
  'Fertility': ['fertility', 'ovulation', 'conception', 'pregnancy', 'reproductive', 'pcos fertility', 'ivf'],
  'Mission': ['family', 'legacy', 'community', 'children', 'lifestyle', 'generation', 'purpose'],
  'Mood Swings': ['mood swing', 'irritability', 'emotion', 'pms', 'pcos mood', 'hormonal mood', 'emotional regulation'],
}

function suggestSection(title: string, description: string): string | null {
  const haystack = `${title} ${description}`.toLowerCase()
  let topSection: string | null = null
  let topScore = 0

  for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
    const score = keywords.filter(kw => haystack.includes(kw)).length
    if (score > topScore) {
      topScore = score
      topSection = section
    }
  }

  // Require at least 1 keyword hit to return a suggestion
  return topScore >= 1 ? topSection : null
}

async function fetchTranscript(videoId: string): Promise<string> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  const res = await fetch(watchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    next: { revalidate: 3600 }
  })
  if (!res.ok) throw new Error('Failed to load YouTube watch page.')
  const html = await res.text()

  const tracksMatch = html.match(/"captionTracks"\s*:\s*(\[[^\]]+\])/)
  if (!tracksMatch || !tracksMatch[1]) {
    throw new Error('No transcripts or captions available for this video.')
  }

  const tracks = JSON.parse(tracksMatch[1])
  const englishTrack = 
    tracks.find((t: any) => t.languageCode === 'en' && t.kind !== 'asr') ||
    tracks.find((t: any) => t.languageCode === 'en') ||
    tracks[0]

  if (!englishTrack || !englishTrack.baseUrl) {
    throw new Error('No English caption track found.')
  }

  const xmlRes = await fetch(englishTrack.baseUrl)
  if (!xmlRes.ok) throw new Error('Failed to load caption track xml.')
  const xml = await xmlRes.text()

  const textBlocks: string[] = []
  const regex = /<text[^>]*>([^<]*)<\/text>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    if (match[1]) {
      const decoded = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
      textBlocks.push(decoded)
    }
  }
  return textBlocks.join(' ')
}

interface GeneratedQuestions {
  confidence: 'high' | 'low'
  confidenceReason?: string
  midQuestion: string
  midOptions: string[]
  midCorrect: string
  endQuestion: string
}

function generateHeuristicQuestions(title: string, transcript: string): GeneratedQuestions {
  if (transcript.length < 100) {
    return {
      confidence: 'low',
      confidenceReason: 'Transcript text is too short or empty.',
      midQuestion: '',
      midOptions: [],
      midCorrect: '',
      endQuestion: ''
    }
  }

  const lower = transcript.toLowerCase() + ' ' + title.toLowerCase()
  let topic = 'this lesson'
  let scenarioQ = 'Based on the guide to meal preparation, what is the first step you should take to manage insulin levels?'
  let options = ['Cook high-glycemic starches', 'Prepare leafy greens and proteins first', 'Skip breakfast entirely']
  let correct = 'Prepare leafy greens and proteins first'

  if (lower.includes('blood pressure') || lower.includes('hypertension') || lower.includes('sodium') || lower.includes('salt')) {
    topic = 'blood pressure regulation'
    scenarioQ = 'While seasonings add flavor, what did the coach suggest doing to avoid spiking blood pressure?'
    options = ['Replace table salt with local spices like Uziza', 'Use MSG-heavy stock cubes', 'Add double salt for taste']
    correct = 'Replace table salt with local spices like Uziza'
  } else if (lower.includes('glucose') || lower.includes('diabetes') || lower.includes('insulin') || lower.includes('sugar')) {
    topic = 'glucose control'
    scenarioQ = 'To optimize muscle glucose uptake during morning activity, which technique did the coach recommend?'
    options = ['Vigorous high-intensity sprints', 'Quadriceps stretch activation', 'Prolonged sitting right after eating']
    correct = 'Quadriceps stretch activation'
  } else if (lower.includes('pcos') || lower.includes('hormone') || lower.includes('ovulation') || lower.includes('cyst')) {
    topic = 'PCOS hormone management'
    scenarioQ = 'To control early morning insulin spikes, what protein-timing rule did Ngozi recommend?'
    options = ['Wait 4 hours before eating', 'Eat protein within 1 hour of waking', 'Skip carbs for the entire day']
    correct = 'Eat protein within 1 hour of waking'
  }

  return {
    confidence: 'high',
    midQuestion: scenarioQ,
    midOptions: options,
    midCorrect: correct,
    endQuestion: `Now that we reviewed ${topic}, how confident are you in practicing this habit today?`
  }
}

async function generateAiQuestions(title: string, transcript: string): Promise<GeneratedQuestions> {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    return generateHeuristicQuestions(title, transcript)
  }

  const prompt = `You are a medical curriculum expert. Analyze this video transcript and generate two checkpoint questions.
Do NOT invent facts outside the transcript.

Format the output strictly as a JSON object matching this exact schema:
{
  "scenario_question": {
    "question": "A scenario-style multiple-choice question grounded in the first 60-70% of the transcript content.",
    "options": ["Option A", "Option B", "Option C"],
    "correct_or_expected": "The correct option text (must exactly match one of the three options)"
  },
  "self_placement_question": {
    "question": "A self-reflection question asking the user how they will practice or apply this lesson.",
    "options": [
      "I will try this tomorrow",
      "I already do this",
      "I need to talk to my coach",
      "I am not sure yet"
    ]
  }
}

The self_placement_question options must be exactly: ["I will try this tomorrow", "I already do this", "I need to talk to my coach", "I am not sure yet"]. Do NOT change the options list wording.

Transcript:
"""
${transcript}
"""`

  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        top_p: 0.7,
        max_tokens: 1024,
        stream: false
      })
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`NVIDIA API error: ${res.statusText}. ${errBody}`)
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new Error('Empty response from NVIDIA Gemma-4 model.')

    // Parse JSON
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleanJson)

    // Validate structure
    if (!parsed.scenario_question || !parsed.self_placement_question) {
      throw new Error('Invalid JSON structure: missing scenario_question or self_placement_question.')
    }
    const sq = parsed.scenario_question
    const spq = parsed.self_placement_question

    if (!sq.question || !Array.isArray(sq.options) || sq.options.length !== 3) {
      throw new Error('Invalid scenario question: options must be an array of exactly 3 strings.')
    }
    if (!sq.correct_or_expected || !sq.options.includes(sq.correct_or_expected)) {
      throw new Error('Invalid scenario question: correct_or_expected must match one of the options.')
    }
    if (!spq.question || !Array.isArray(spq.options) || spq.options.length !== 4) {
      throw new Error('Invalid self-placement question: options array structure error.')
    }

    const expectedOptions = [
      'I will try this tomorrow',
      'I already do this',
      'I need to talk to my coach',
      'I am not sure yet'
    ]
    const matchesExpected = spq.options.every((opt: string, i: number) => opt === expectedOptions[i])
    if (!matchesExpected) {
      throw new Error('Invalid self-placement options: options do not match the required fixed set.')
    }

    return {
      confidence: 'high',
      midQuestion: sq.question,
      midOptions: sq.options,
      midCorrect: sq.correct_or_expected,
      endQuestion: spq.question
    }
  } catch (err: any) {
    console.error('NVIDIA Gemma generation failed, throwing to caller:', err)
    throw new Error(`AI generation failed: ${err.message || err}`)
  }
}

// Parse YouTube URL to extract Video ID, Title, Duration, Channel, Description, and Category Suggestion
export async function parseYouTubeVideo(videoUrl: string) {
  try {
    // 1. Extract YouTube Video ID
    let videoId = ''
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
    const match = videoUrl.match(regExp)
    if (match && match[2].length === 11) {
      videoId = match[2]
    } else if (videoUrl.length === 11) {
      videoId = videoUrl // Raw ID pasted
    }

    if (!videoId) {
      throw new Error('Invalid YouTube video link or ID format.')
    }

    // 2. Fetch the YouTube watch page
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      next: { revalidate: 3600 } // Cache results for an hour
    })

    if (!res.ok) {
      throw new Error('Failed to retrieve video from YouTube.')
    }

    const html = await res.text()

    // 3. Extract Video Title
    let title = 'Untitled YouTube Video'
    const titleMatch = html.match(/<meta itemprop="name" content="([^"]+)"/) || html.match(/<title>([^<]+)<\/title>/)
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(' - YouTube', '').trim()
    }

    // 4. Extract Video Duration in Seconds
    let durationSeconds = 0
    
    const lengthSecondsMatch = html.match(/"lengthSeconds"\s*:\s*"?(\d+)"?/)
    const approxDurationMatch = html.match(/"approxDurationMs"\s*:\s*"?(\d+)"?/)
    const itempropMatch = html.match(/itemprop="duration"\s+content="([^"]+)"/) || html.match(/content="([^"]+)"\s+itemprop="duration"/)

    if (lengthSecondsMatch && parseInt(lengthSecondsMatch[1], 10) > 0) {
      durationSeconds = parseInt(lengthSecondsMatch[1], 10)
    } else if (approxDurationMatch && parseInt(approxDurationMatch[1], 10) > 0) {
      durationSeconds = Math.round(parseInt(approxDurationMatch[1], 10) / 1000)
    } else if (itempropMatch && itempropMatch[1]) {
      const iso = itempropMatch[1]
      if (iso.startsWith('PT')) {
        let hours = 0, minutes = 0, seconds = 0
        const hoursMatch = iso.match(/(\d+)H/)
        const minsMatch = iso.match(/(\d+)M/)
        const secsMatch = iso.match(/(\d+)S/)
        if (hoursMatch) hours = parseInt(hoursMatch[1], 10)
        if (minsMatch) minutes = parseInt(minsMatch[1], 10)
        if (secsMatch) seconds = parseInt(secsMatch[1], 10)
        durationSeconds = (hours * 3600) + (minutes * 60) + seconds
      } else {
        durationSeconds = parseInt(iso, 10) || 0
      }
    }

    if (durationSeconds <= 0) {
      durationSeconds = 600 // Fallback only if all parse attempts fail
    }

    // 5. Generate duration text: e.g. "11m 45s"
    const m = Math.floor(durationSeconds / 60)
    const s = durationSeconds % 60
    const durationText = `${m}m ${s.toString().padStart(2, '0')}s`

    // 6. Extract Channel Name
    let channelName = ''
    const channelMatch =
      html.match(/"ownerChannelName":"([^"]+)"/) ||
      html.match(/"author":"([^"]+)"/) ||
      html.match(/<link itemprop="name" content="([^"]+)"/)
    if (channelMatch && channelMatch[1]) {
      channelName = channelMatch[1].trim()
    }

    // 7. Extract Description
    let description = ''
    const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)
    if (descMatch && descMatch[1]) {
      description = descMatch[1]
        .replace(/\\n/g, ' ')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .slice(0, 500)
    }

    // 8. Thumbnail URL
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`

    // 9. Auto-suggest category section
    const suggestedSection = suggestSection(title, description)

    // 10. Fetch transcript & generate questions (grounded in transcript text)
    let transcriptAvailable = false
    let questions: GeneratedQuestions | null = null
    let transcriptError = null

    try {
      const transcript = await fetchTranscript(videoId)
      if (transcript && transcript.trim().length > 100) {
        transcriptAvailable = true
        questions = await generateAiQuestions(title, transcript)
      } else {
        throw new Error('Transcript is too short or unavailable to auto-generate questions.')
      }
    } catch (e: any) {
      transcriptError = e.message || 'No transcripts/captions available.'
    }

    return {
      success: true,
      youtubeId: videoId,
      title,
      durationText,
      durationSeconds,
      channelName,
      description,
      thumbnailUrl,
      suggestedSection,
      transcriptAvailable,
      transcriptError,
      questions,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'An unexpected error occurred parsing YouTube.'
    }
  }
}

// Database helper Server Actions
export async function addCoachToDb(coach: {
  name: string
  code: string
  intro: string
  rankUpQuote: string
  illustration: string
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('coaches')
    .insert({
      name: coach.name,
      code: coach.code,
      intro: coach.intro,
      rank_up_quote: coach.rankUpQuote,
      illustration: coach.illustration
    })
    .select()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/coach')
  revalidatePath('/')
  return { success: true, data }
}

export async function addLessonToDb(lesson: {
  condition: string | null
  section: string
  title: string
  youtubeId: string
  durationText: string
  durationSeconds: number
  positionIndex: number | null
  midQuestionText?: string | null
  midQuestionOptions?: string[] | null
  midQuestionCorrect?: string | null
  endQuestionText?: string | null
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      condition: lesson.condition || null,
      section: lesson.section,
      title: lesson.title,
      youtube_id: lesson.youtubeId,
      duration_text: lesson.durationText,
      duration_seconds: lesson.durationSeconds,
      position_index: lesson.positionIndex !== null ? lesson.positionIndex : null,
      mid_question_text: lesson.midQuestionText || null,
      mid_question_options: lesson.midQuestionOptions ? JSON.stringify(lesson.midQuestionOptions) : '[]',
      mid_question_correct: lesson.midQuestionCorrect || null,
      end_question_text: lesson.endQuestionText || null,
    })
    .select()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/learn')
  return { success: true, data }
}

export async function addQuestionToDb(question: {
  lessonId: string
  questionText: string
  options: string[]
  correctOption: string
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from('scenario_questions')
    .insert({
      lesson_id: question.lessonId,
      question_text: question.questionText,
      options: question.options,
      correct_option: question.correctOption
    })
    .select()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}
