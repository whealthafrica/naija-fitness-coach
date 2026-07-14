// Mock data for Naija Fitness Coach Preview/Review Mode

export const mockCondition = 'Hypertension' // Can be easily changed for testing copy variants

export const mockUserSession = {
  id: 'preview-user-id-12345',
  phone: '+2347062459256',
  email: 'review@naijafitcoach.com',
  name: 'Reviewer Mode',
  role: 'authenticated'
}

export const mockCoaches = [
  { id: '1', name: 'Coach Adaeze (Mock)' },
  { id: '2', name: 'Coach Chinedu (Mock)' }
]

export const mockTasks = [
  { id: '1', title: 'Morning Hydration', desc: 'Drink 500ml of warm water', done: true },
  { id: '2', title: '15-min Stretch', desc: 'Follow the mobility pathway', done: false },
  { id: '3', title: 'Check-in Log', desc: 'Submit your daily symptoms & food log', done: false },
]

export const mockProgressData = {
  programProgress: '75%',
  streakDays: 4,
  bloodPressureTrend: [
    { date: 'Mon', systolic: 128, diastolic: 82 },
    { date: 'Tue', systolic: 125, diastolic: 80 },
    { date: 'Wed', systolic: 120, diastolic: 78 },
    { date: 'Thu', systolic: 122, diastolic: 80 },
    { date: 'Fri', systolic: 119, diastolic: 76 }
  ],
  waterIntake: '1.5L / 2.0L'
}

export const mockPathwayData = [
  { id: 'path-1', title: 'Managing Sodium Intake', category: 'Hypertension', duration: '5 mins' },
  { id: 'path-2', title: 'Cardiovascular Fitness Basics', category: 'Exercise', duration: '8 mins' },
  { id: 'path-3', title: 'Mindful Breathing', category: 'Longevity', duration: '3 mins' }
]

export const mockCommunityPosts = [
  {
    id: 'post-1',
    author: 'Adaeze (Coach)',
    content: 'Great work to everyone who completed their morning stretches today! Keep the accountability high.',
    timestamp: '2 hours ago'
  },
  {
    id: 'post-2',
    author: 'Tunde O.',
    content: 'Completed my 15-minute mobility exercise! Feeling energized.',
    timestamp: '4 hours ago'
  }
]
