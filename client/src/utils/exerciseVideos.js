// Maps exercise names to YouTube video IDs for form/tutorial videos.
// Videos sourced from Muscle & Strength exercise guides.
// For exercises without a curated ID, falls back to YouTube search.

const VIDEO_MAP = {
  'Barbell Bench Press':              'tuwHzzPdaGc',
  'Incline Dumbbell Press':           '8nNi8jbbUPE',
  'Seated Shoulder Press (DB)':       'FRxZ6wr5bpA',
  'Cable Tricep Pushdown':            'LzwgB15UdO8',
  'Overhead Tricep Extension (rope)': 'NRENeEgaIgA',
  'Lat Pulldown':                     'iKrKgWR9wbY',
  'Barbell Row':                      'paCfxhgW6bI',
  'Face Pulls':                       '7ZvpXA_mFpQ',
  'Back Squat':                       'R2dMsNhN3DE',
  'Romanian Deadlift':                'CkrqLaDGvOA',
  'Leg Press':                        'sEM_zo9w2ss',
  'Leg Extension':                    '0fl1RRgJ83I',
  'Standing Calf Raise':              'RBslMmWqzzE',
};

export function getExerciseVideoId(exerciseName) {
  return VIDEO_MAP[exerciseName] || null;
}

export function getExerciseSearchUrl(exerciseName) {
  const query = encodeURIComponent(exerciseName + ' proper form');
  return `https://www.youtube.com/results?search_query=${query}`;
}
