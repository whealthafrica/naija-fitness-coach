// NOTE: This learning path structure, video sequencing, and assignment order is a DRAFT.
// It requires clinical review and explicit sign-off from Dr. Olaoluwa (or a qualified clinical reviewer) before production release.

export interface LessonDef {
  id: string
  title: string
  section: string
  youtubeId: string
  durationText: string
  durationSeconds: number
  midQuestionText?: string | null
  midQuestionOptions?: string[] | null
  midQuestionCorrect?: string | null
  endQuestionText?: string | null
}

// 6-Video sequences keyed by focus condition
export const conditionPathways: Record<string, LessonDef[]> = {
  'Hypertension': [
    {
      id: 'ht_path_1',
      section: 'Core Food Truths',
      title: 'The Truth About Food',
      youtubeId: 'qq8lyJ64N5k',
      durationText: '11m 45s',
      durationSeconds: 705
    },
    {
      id: 'ht_path_2',
      section: 'Practical Eating',
      title: 'How to Create a Diet Plan for Yourself',
      youtubeId: 'pOxkKKW0Lg0',
      durationText: '14m 20s',
      durationSeconds: 860
    },
    {
      id: 'ht_path_3',
      section: 'Mental Health',
      title: 'When Stress is Good / Bad',
      youtubeId: '1ATHbnioXa8',
      durationText: '10m 15s',
      durationSeconds: 615
    },
    {
      id: 'ht_path_4',
      section: 'Mental Health',
      title: 'Get Rid of Anxiety Forever',
      youtubeId: 'TiyQJFz4G_M',
      durationText: '15m 30s',
      durationSeconds: 930
    },
    {
      id: 'ht_path_5',
      section: 'Movement',
      title: 'Movement Video 1: Cardiovascular Walk',
      youtubeId: 'GNe336Jj56g',
      durationText: '12m 10s',
      durationSeconds: 730
    },
    {
      id: 'ht_path_6',
      section: 'Mindset',
      title: 'How to Have Permanent Values',
      youtubeId: 'pMusjixdf10',
      durationText: '09m 40s',
      durationSeconds: 580
    }
  ],
  'Type 2 Diabetes': [
    {
      id: 'db_path_1',
      section: 'Core Food Truths',
      title: 'The Truth About Red Meat 1',
      youtubeId: 'ccEsXDsyhHg',
      durationText: '13m 15s',
      durationSeconds: 795
    },
    {
      id: 'db_path_2',
      section: 'Hormones and Fat Loss',
      title: 'Reversing Hormonal Imbalance',
      youtubeId: 'q4HTZ1dQhMA',
      durationText: '16m 05s',
      durationSeconds: 965
    },
    {
      id: 'db_path_3',
      section: 'Cravings and Appetite',
      title: 'Reduce Food Cravings',
      youtubeId: '3aHds9Ncnus',
      durationText: '11m 50s',
      durationSeconds: 710
    },
    {
      id: 'db_path_4',
      section: 'Practical Eating',
      title: 'To Snack or Not to Snack',
      youtubeId: 'D3YyXL1403M',
      durationText: '08m 30s',
      durationSeconds: 510
    },
    {
      id: 'db_path_5',
      section: 'Movement',
      title: 'Movement Video 2: Resistance Training',
      youtubeId: 'H_wJmAt5ul4',
      durationText: '14m 10s',
      durationSeconds: 850
    },
    {
      id: 'db_path_6',
      section: 'Mindset',
      title: 'How to Be Truly Happy',
      youtubeId: 'wdx2ByzVjNY',
      durationText: '10m 00s',
      durationSeconds: 600
    }
  ],
  'PCOS': [
    {
      id: 'pc_path_1',
      section: 'Hormones and Fat Loss',
      title: 'Reversing Hormonal Imbalance',
      youtubeId: 'q4HTZ1dQhMA',
      durationText: '16m 05s',
      durationSeconds: 965
    },
    {
      id: 'pc_path_2',
      section: 'Hormones and Fat Loss',
      title: 'Getting Rid of Belly Fat Permanently',
      youtubeId: 'n6eFeUwodu8',
      durationText: '12m 50s',
      durationSeconds: 770
    },
    {
      id: 'pc_path_3',
      section: 'Fertility',
      title: 'Fertility and Food',
      youtubeId: 'TmYVLuBvTzg',
      durationText: '14m 45s',
      durationSeconds: 885
    },
    {
      id: 'pc_path_4',
      section: 'Fertility',
      title: 'What Causes Infertility',
      youtubeId: 'DvA_W7vKKA8',
      durationText: '15m 20s',
      durationSeconds: 920
    },
    {
      id: 'pc_path_5',
      section: 'Mood Swings',
      title: 'PCOS & Emotional Wellbeing: Managing Anxiety and Low Mood',
      youtubeId: 'M6SoTQibbM4', // Clinically-framed PCOS emotional health — replaces spiritual content removed from this pathway
      durationText: '14m 05s',
      durationSeconds: 845
    },
    {
      id: 'pc_path_6',
      section: 'Mindset',
      title: 'How to Know Yourself',
      youtubeId: 'uvXdMPNhp9M',
      durationText: '11m 10s',
      durationSeconds: 670
    }
  ],
  'Pre-Diabetes': [
    {
      id: 'pd_path_1',
      section: 'Food Discernment',
      title: 'How to Detect Health Myths Online',
      youtubeId: '829E4O3rKKs',
      durationText: '09m 50s',
      durationSeconds: 590
    },
    {
      id: 'pd_path_2',
      section: 'Core Food Truths',
      title: 'The Truth About Food',
      youtubeId: 'qq8lyJ64N5k',
      durationText: '11m 45s',
      durationSeconds: 705
    },
    {
      id: 'pd_path_3',
      section: 'Hormones and Fat Loss',
      title: 'What Nobody Told You About Fat',
      youtubeId: '4DJG_FOQF5M',
      durationText: '13m 30s',
      durationSeconds: 810
    },
    {
      id: 'pd_path_4',
      section: 'Cravings and Appetite',
      title: 'How to Hijack Your Appetite',
      youtubeId: 'CRBD4WKFPdA',
      durationText: '12m 15s',
      durationSeconds: 735
    },
    {
      id: 'pd_path_5',
      section: 'Movement',
      title: 'Movement Video 1: Cardiovascular Walk',
      youtubeId: 'GNe336Jj56g',
      durationText: '12m 10s',
      durationSeconds: 730
    },
    {
      id: 'pd_path_6',
      section: 'Mindset',
      title: 'How to Stop Being Dissatisfied',
      youtubeId: 'pDdsLnJ6Z9k',
      durationText: '10m 40s',
      durationSeconds: 640
    }
  ],
  'General Fitness': [
    {
      id: 'gf_path_1',
      section: 'Movement',
      title: 'Movement Video 1: Cardiovascular Walk',
      youtubeId: 'GNe336Jj56g',
      durationText: '12m 10s',
      durationSeconds: 730
    },
    {
      id: 'gf_path_2',
      section: 'Practical Eating',
      title: 'How to Create a Diet Plan for Yourself',
      youtubeId: 'pOxkKKW0Lg0',
      durationText: '14m 20s',
      durationSeconds: 860
    },
    {
      id: 'gf_path_3',
      section: 'Social Media',
      title: 'Taking Charge of Social Media',
      youtubeId: 'fkIygLMFcI8',
      durationText: '11m 15s',
      durationSeconds: 675
    },
    {
      id: 'gf_path_4',
      section: 'Addiction',
      title: 'Why People Get Addicted to Food',
      youtubeId: 'QKEmTZRShII',
      durationText: '13m 40s',
      durationSeconds: 820
    },
    {
      id: 'gf_path_5',
      section: 'Mindset',
      title: 'How Work Starts with Rest',
      youtubeId: 'ssBn1Tivmvw',
      durationText: '08m 55s',
      durationSeconds: 535
    },
    {
      id: 'gf_path_6',
      section: 'Mindset',
      title: 'How to Have Permanent Values',
      youtubeId: 'pMusjixdf10',
      durationText: '09m 40s',
      durationSeconds: 580
    }
  ]
}

// Master pool of all remaining lessons for the General Library
export const generalLibraryLessons: LessonDef[] = [
  {
    id: 'gen_lesson_1',
    section: 'Core Food Truths',
    title: 'Core Food Truths: Nutrition Science',
    youtubeId: 'ykcMGi4vM-w',
    durationText: '10m 00s',
    durationSeconds: 600
  },
  {
    id: 'gen_lesson_2',
    section: 'Core Food Truths',
    title: 'Core Food Truths: Real Meal Power',
    youtubeId: 'Y07muCnPKQA',
    durationText: '12m 30s',
    durationSeconds: 750
  },
  {
    id: 'gen_lesson_3',
    section: 'Hormones and Fat Loss',
    title: 'Hormones: Fat Storage Regulations',
    youtubeId: 'NUNUD0kxyTM',
    durationText: '14m 15s',
    durationSeconds: 855
  },
  {
    id: 'gen_lesson_4',
    section: 'Cravings and Appetite',
    title: 'Cravings: Managing Insulin Spikes',
    youtubeId: 'JkcF3q6S6CI',
    durationText: '9m 10s',
    durationSeconds: 550
  },
  {
    id: 'gen_lesson_5',
    section: 'Cravings and Appetite',
    title: 'Cravings: Stopping Snack Additions',
    youtubeId: 'Et5Hf8cQaME',
    durationText: '11m 40s',
    durationSeconds: 700
  },
  {
    id: 'gen_lesson_6',
    section: 'Cravings and Appetite',
    title: 'Cravings: Dynamic Hunger Hormones',
    youtubeId: 'v8R0vInlGgk',
    durationText: '8m 20s',
    durationSeconds: 500
  },
  {
    id: 'gen_lesson_7',
    section: 'Cravings and Appetite',
    title: 'Cravings: Appetite Controls Exposed',
    youtubeId: 'RuOvn4UqznU',
    durationText: '13m 05s',
    durationSeconds: 785
  },
  {
    id: 'gen_lesson_8',
    section: 'Practical Eating',
    title: 'Practical Eating: Nigerian Meal Patterns',
    youtubeId: 'jEBHrF1PNt4',
    durationText: '10m 50s',
    durationSeconds: 650
  },
  {
    id: 'gen_lesson_9',
    section: 'Practical Eating',
    title: 'Practical Eating: Home Cooking Tips',
    youtubeId: 'pgvnC65XWwU',
    durationText: '12m 00s',
    durationSeconds: 720
  },
  {
    id: 'gen_lesson_10',
    section: 'Mindset',
    title: 'Mindset: The Power of Tiny Steps',
    youtubeId: '2A_qlqlB1Vc',
    durationText: '7m 45s',
    durationSeconds: 465
  },
  {
    id: 'gen_lesson_11',
    section: 'Mindset',
    title: 'Mindset: Long-Term Metabolic Adaptations',
    youtubeId: 'E4iluDPQPU8',
    durationText: '9m 20s',
    durationSeconds: 560
  },
  {
    id: 'gen_lesson_12',
    section: 'Mental Health',
    title: 'Mental Health: Coping with Chronic Stresses',
    youtubeId: 'TYFmewGDaBQ',
    durationText: '14m 30s',
    durationSeconds: 870
  },
  {
    id: 'gen_lesson_13',
    section: 'Mental Health',
    title: 'Mental Health: Cognitive Reframe of Anxiety',
    youtubeId: 'XAtTkMpACFc',
    durationText: '15m 10s',
    durationSeconds: 910
  },
  {
    id: 'gen_lesson_14',
    section: 'Mental Health',
    title: 'Mental Health: Sleep Quality Indicators',
    youtubeId: 'agjhcL9nFQ0',
    durationText: '11m 00s',
    durationSeconds: 660
  },
  {
    id: 'gen_lesson_15',
    section: 'Mental Health',
    title: 'Mental Health: Emotional Satiety Guidelines',
    youtubeId: 'O1zs-x1szPE',
    durationText: '12m 40s',
    durationSeconds: 760
  },
  {
    id: 'gen_lesson_16',
    section: 'Addiction',
    title: 'Addiction: Reclaiming Satiety Loops',
    youtubeId: '3i2ibkbVYYQ',
    durationText: '16m 15s',
    durationSeconds: 975
  },
  {
    id: 'gen_lesson_17',
    section: 'Addiction',
    title: 'Addiction: Escaping Processed Food Traps',
    youtubeId: 'qhnkdgiv9hM',
    durationText: '15m 00s',
    durationSeconds: 900
  },
  {
    id: 'gen_lesson_18',
    section: 'Fertility',
    title: 'Fertility: Ovulation and Metabolic Health',
    youtubeId: 'Jjug6T2sx9k',
    durationText: '18m 00s',
    durationSeconds: 1080
  },
  {
    id: 'gen_lesson_19',
    section: 'Fertility',
    title: 'Fertility: Conception Dietary Support',
    youtubeId: '1vgVpwENF4A',
    durationText: '17m 15s',
    durationSeconds: 1035
  },
  {
    id: 'gen_lesson_20',
    section: 'Mission',
    title: 'Mission: Active Family Habits',
    youtubeId: '4bxoGV1x380',
    durationText: '08m 10s',
    durationSeconds: 490
  },
  {
    id: 'gen_lesson_21',
    section: 'Mission',
    title: 'Mission: Sharing Healthy Legacy',
    youtubeId: 'tl8DFs5NkvU',
    durationText: '07m 30s',
    durationSeconds: 450
  },
  {
    id: 'gen_lesson_22',
    section: 'Mood Swings',
    title: 'Cindy Trimm: 40 Day Soul Fast - Day 2 (Identity)',
    youtubeId: 'K_Yq9mZ0QkQ', // TODO: replace with real Day 2 video ID from playlist PLUVsocFi610HfmF2_RHT_gUzmRUD0aAyU
    durationText: '13m 00s',
    durationSeconds: 780
  },
  {
    id: 'gen_lesson_23',
    section: 'Mood Swings',
    title: 'Cindy Trimm: 40 Day Soul Fast - Day 3 (Mindset)',
    youtubeId: 'K_Yq9mZ0QkQ', // TODO: replace with real Day 3 video ID from playlist PLUVsocFi610HfmF2_RHT_gUzmRUD0aAyU
    durationText: '14m 00s',
    durationSeconds: 840
  }
]
