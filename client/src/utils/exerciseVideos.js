// Maps exercise names to YouTube video IDs for form/tutorial videos.
// Hardcoded fallback — database video_id takes priority when available.

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

// videoIdFromDb is an optional override from the exercises API
export function getExerciseVideoId(exerciseName, videoIdFromDb) {
  return videoIdFromDb || VIDEO_MAP[exerciseName] || null;
}

export function getExerciseSearchUrl(exerciseName) {
  const query = encodeURIComponent(exerciseName + ' proper form');
  return `https://www.youtube.com/results?search_query=${query}`;
}
