export interface CoachData {
  name: string
  illustration: string
  intro: string
  rankUpQuote: string // Dynamic rank-up celebration greeting matching coach tone
}

// Canonical coaches mapping per product specifications (Adaeze, Tunde, Ngozi, Emeka, Amara)
export const coachesConfig: Record<string, CoachData> = {
  'Type 2 Diabetes': {
    name: 'Tunde',
    illustration: '/coach-pcos.png',
    intro: "I'm Tunde, your diabetes coach. Together, we'll keep your blood sugar stable and build sustainable daily meal logs.",
    rankUpQuote: "You are building real resilience and adaptation here. Keep showing up, step by step. Tunde is proud."
  },
  'Hypertension': {
    name: 'Adaeze',
    illustration: '/coach-adaeze.png',
    intro: "I'm Adaeze, your hypertension coach. We'll focus on sodium tracking, blood pressure logs, and cardiovascular fitness.",
    rankUpQuote: "Every single check-in is vascular healing in action. You are rooting your routine. Outstanding consistency."
  },
  'PCOS': {
    name: 'Ngozi',
    illustration: '/coach-fitness.png',
    intro: "I'm Ngozi, your PCOS coach. We'll balance hormones and use resistance training to manage insulin sensitivity.",
    rankUpQuote: "You are giving your body the consistency it deserves to thrive. A proud moment. Keep moving forward!"
  },
  'Pre-Diabetes': {
    name: 'Emeka',
    illustration: '/coach-pre-diabetes.png',
    intro: "I'm Emeka, your pre-diabetes coach. Let's build healthy metabolic habits to reverse insulin resistance.",
    rankUpQuote: "Metabolic change happens through small, steady habits. This tier reflects your focus. Excellent job."
  },
  'General Fitness': {
    name: 'Amara',
    illustration: '/coach-diabetes.png',
    intro: "I'm Amara, your fitness coach. Together, we'll build strength, improve endurance, and boost your daily energy.",
    rankUpQuote: "A beautiful step forward, friend. Sticking to these steps is showing its strength. I am proud of your daily rhythm."
  }
}
