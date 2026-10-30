/** English mirrors for seeded API Bangla payloads (demo-perfect toggle). */

export const climateEn: Record<string, { title: string; action: string }> = {
  heavy_rain: {
    title: 'Heavy rain risk',
    action: 'Keep bunds and drainage channels open so water does not stand in the field',
  },
  flood_proxy: {
    title: 'Waterlogging / flood-like risk',
    action: 'Move seedlings to higher ground and consider flood-tolerant varieties',
  },
  heat: {
    title: 'Heat stress',
    action: 'Irrigate in morning/evening; avoid midday watering',
  },
}

export const treatmentEn: Record<
  string,
  { name: string; steps: string[]; chemical_note: string }
> = {
  rice_blast: {
    name: 'Rice blast',
    steps: [
      'Remove and burn infected leaves and plants',
      'Control field water — avoid prolonged waterlogging',
      'If needed, use an approved fungicide (e.g. tricyclazole) per local advice',
    ],
    chemical_note: 'Confirm with a local agriculture officer before using chemicals',
  },
  bacterial_leaf_blight: {
    name: 'Bacterial leaf blight',
    steps: [
      'Remove infected seedlings or leaves',
      'Do not over-apply nitrogen fertilizer',
      'Keep drainage good and treat seed before sowing',
    ],
    chemical_note: 'Confirm with a local agriculture officer before using chemicals',
  },
  brown_spot: {
    name: 'Brown spot',
    steps: [
      'Use balanced fertilizer including potash',
      'Use disease-free seed',
      'If needed, spray an approved fungicide as advised',
    ],
    chemical_note: 'Confirm with a local agriculture officer before using chemicals',
  },
  sheath_blight: {
    name: 'Sheath blight',
    steps: [
      'Avoid overly dense planting',
      'Improve air flow and drainage in the field',
      'Follow local BRRI/DAE guidance for approved fungicides',
    ],
    chemical_note: 'Confirm with a local agriculture officer before using chemicals',
  },
  healthy: {
    name: 'Healthy',
    steps: ['No disease treatment needed', 'Keep regular field scouting', 'Maintain balanced fertilizer and water'],
    chemical_note: 'No chemical needed',
  },
}

export const phraseEn: Record<string, string> = {
  'সেচ এড়িয়ে চলুন—আগামী ৪৮ ঘণ্টায় প্রায় 28 মিমি বৃষ্টির সম্ভাবনা. বৃষ্টির পর সার দিন—আজ নয়.':
    'Skip irrigation — about 28 mm rain likely in the next 48 hours. Fertilize after rain — not today.',
  'আজকের দাম (1422 টাকা) একটু কম—২–৩ দিন অপেক্ষা করলে ভালো হতে পারে':
    'Today’s price (BDT 1422) is a bit low — waiting 2–3 days may be better',
  'ভারী বৃষ্টির ঝুঁকি': 'Heavy rain risk',
  'আইল ও নিকাশ নালা খোলা রাখুন যাতে ক্ষেতে পানি জমে না থাকে':
    'Keep bunds and drainage channels open so water does not stand in the field',
  'পরামর্শকৃত জাত: বিআরআরআই ধান৫১ (বন্যা সহনশীল)':
    'Suggested variety: BRRI dhan51 (flood tolerant)',
  'ধানের ব্লাস্ট রোগ': 'Rice blast',
}

export const stageEn: Record<string, string> = {
  seedling: 'Seedling',
  tillering: 'Tillering',
  booting: 'Booting',
  flowering: 'Flowering',
  ripening: 'Ripening',
  vegetative: 'Vegetative',
  'চারা': 'Seedling',
  'কুশি': 'Tillering',
  'থোড়': 'Booting',
  'ফুল': 'Flowering',
  'পাকা': 'Ripening',
}
