export interface CoachData {
  name: string
  illustration?: string
  // Note: intro and rank_up_quote are stored in the `coaches` DB table only.
  // They are collected at registration and must be read live from Supabase everywhere
  // they are displayed. Do not add them here — this file only holds values that are
  // genuinely static and not admin-editable (e.g. condition-to-coach routing defaults).
}

// Canonical condition-to-coach routing defaults.
// Used only when no database profile is resolved (e.g. unauthenticated preview path).
// Do NOT add coach-authored content (intros, quotes) to this map — those live in the DB.
export const coachesConfig: Record<string, CoachData> = {
  'Type 2 Diabetes': { name: 'Tunde' },
  'Hypertension': { name: 'Adaeze' },
  'PCOS': { name: 'Ngozi' },
  'Pre-Diabetes': { name: 'Emeka' },
  'General Fitness': { name: 'Amara' }
}
