import { LessonDef } from './learningPaths'

/**
 * Calculates the percentage of tasks completed in the last 14 days relative to the expected amount.
 */
export function calculateRolling14DayCompletion(completedDates: Date[], totalExpected: number): number {
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  
  const completedInPeriod = completedDates.filter(date => {
    const d = new Date(date)
    return d >= fourteenDaysAgo
  }).length

  if (totalExpected <= 0) return 0
  const rate = (completedInPeriod / totalExpected) * 100
  return Math.min(100, Math.max(0, Math.round(rate)))
}

/**
 * Determines if a patient is eligible for progression based on their 14-day compliance rate.
 * Typically requires >= 70% compliance.
 */
export function isEligibleForProgression(rolling14Day: number): boolean {
  return rolling14Day >= 70
}

/**
 * Scores and sorts lessons for the general library based on the user's eligibility status.
 * Advanced lessons are promoted if eligible; otherwise, foundational lessons are prioritized.
 */
export function scoreAndSortLessonsForProgression(
  lessons: LessonDef[],
  isEligibleForAdvanced: boolean
): { lesson: LessonDef; score: number }[] {
  return lessons.map(lesson => {
    const titleLower = lesson.title.toLowerCase()
    const sectionLower = (lesson.section || '').toLowerCase()
    const isAdvanced = titleLower.includes('advanced') || 
                       titleLower.includes('complex') || 
                       sectionLower.includes('advanced')
    
    let score = 0
    if (isAdvanced) {
      score = isEligibleForAdvanced ? 10 : -10
    } else {
      score = 5 // Foundational/basic lessons
    }

    return { lesson, score }
  }).sort((a, b) => b.score - a.score)
}
