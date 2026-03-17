/**
 * Exercise data for Barbell Incline Bench Press.
 *
 * To add a new exercise, copy this file, rename it, and update every field.
 * Then register it in the exercises index (./index.js).
 *
 * @typedef {Object} MuscleHighlight
 * @property {string} name       - Display name
 * @property {'primary'|'secondary'|'tertiary'} role
 * @property {number} percentage - Relative activation 0-100
 * @property {string} color      - Tailwind-friendly hex for the SVG highlight
 *
 * @typedef {Object} ExerciseData
 * @property {string}   slug             - URL-safe identifier
 * @property {string}   name             - Display name
 * @property {string}   category         - Muscle group category
 * @property {string}   type             - Compound | Isolation
 * @property {string}   difficulty       - Beginner | Intermediate | Advanced
 * @property {string}   equipment        - Equipment needed
 * @property {string}   description      - Short overview paragraph
 * @property {string[]} primaryMuscles   - Primary muscle names
 * @property {string[]} secondaryMuscles - Secondary muscle names
 * @property {MuscleHighlight[]} musclesWorked - For the activation chart
 * @property {string[]} instructions     - Step-by-step how-to
 * @property {string[]} formTips         - Do/don't coaching cues
 * @property {{mistake:string, fix:string}[]} commonMistakes
 * @property {string|null} videoId       - YouTube video ID (null = search fallback)
 * @property {Object}   figure           - Data driving the SVG anatomy diagram
 */

const inclineBenchPress = {
  slug: 'incline-bench-press',
  name: 'Barbell Incline Bench Press',
  category: 'Chest',
  type: 'Compound',
  difficulty: 'Intermediate',
  equipment: 'Barbell, Incline Bench',

  description:
    'The incline bench press targets the upper portion of the pectoralis major (clavicular head) by setting the bench at a 30-45 degree angle. This shifts emphasis from the mid-chest to the upper chest and front deltoids, building a fuller, more balanced chest.',

  primaryMuscles: ['Upper Chest (Clavicular Head)'],
  secondaryMuscles: ['Anterior Deltoids', 'Triceps'],

  musclesWorked: [
    { name: 'Upper Chest',       role: 'primary',   percentage: 65, color: '#ef4444' },
    { name: 'Front Deltoids',    role: 'secondary',  percentage: 20, color: '#f59e0b' },
    { name: 'Triceps',           role: 'tertiary',  percentage: 15, color: '#6b7280' },
  ],

  instructions: [
    'Set the bench to a 30-45 degree incline.',
    'Grip the bar slightly wider than shoulder-width.',
    'Unrack and hold the bar above your upper chest with arms extended.',
    'Lower the bar slowly to your upper chest, just below the collarbone.',
    'Press the bar upward until arms are fully extended.',
    'Keep feet planted and maintain control throughout.',
  ],

  formTips: [
    'Do not flare elbows too wide — aim for 45-75 degrees.',
    'Keep wrists stacked directly over forearms.',
    'Lower with control — 2-3 second eccentric.',
    'Avoid bouncing the bar off your chest.',
    'Keep shoulder blades retracted and pinched together.',
  ],

  commonMistakes: [
    { mistake: 'Incline too steep',         fix: 'Keep the bench at 30-45 degrees. Steeper angles shift load to shoulders.' },
    { mistake: 'Lifting hips off bench',    fix: 'Keep glutes planted. A slight lower back arch is fine.' },
    { mistake: 'Bar touches mid-chest',     fix: 'Aim for the upper chest / clavicle area.' },
    { mistake: 'No shoulder blade retraction', fix: 'Squeeze shoulder blades together before unracking.' },
  ],

  videoId: 'DbFgADa2PL8',

  // SVG figure configuration — drives the anatomy diagram
  figure: {
    benchAngle: 40,       // degrees
    // Muscle highlight zones (SVG coordinates, relative to a 400x500 viewBox)
    muscles: [
      {
        id: 'upper-chest',
        label: 'Upper Chest',
        role: 'primary',
        // Polygon points for the highlighted region
        points: '168,175 192,165 218,165 232,175 228,200 210,210 190,210 172,200',
        labelPos: { x: 108, y: 175 },
        anchorPos: { x: 168, y: 185 },
      },
      {
        id: 'front-delt-l',
        label: 'Front Delt',
        role: 'secondary',
        points: '155,160 168,155 172,175 168,190 155,185 148,172',
        labelPos: { x: 80, y: 155 },
        anchorPos: { x: 155, y: 170 },
      },
      {
        id: 'front-delt-r',
        label: 'Front Delt',
        role: 'secondary',
        points: '232,155 245,160 252,172 245,185 232,190 228,175',
        labelPos: null, // Don't double-label — left side only
        anchorPos: null,
      },
      {
        id: 'tricep-l',
        label: 'Triceps',
        role: 'tertiary',
        points: '135,190 148,185 152,210 148,235 135,230 130,210',
        labelPos: { x: 65, y: 220 },
        anchorPos: { x: 135, y: 210 },
      },
      {
        id: 'tricep-r',
        label: 'Triceps',
        role: 'tertiary',
        points: '252,185 265,190 270,210 265,230 252,235 248,210',
        labelPos: null,
        anchorPos: null,
      },
    ],
    // Bar path — start (down) and end (up) positions
    barPath: {
      start: { x1: 130, y1: 195, x2: 270, y2: 195 },
      end:   { x1: 140, y1: 130, x2: 260, y2: 130 },
    },
  },
};

export default inclineBenchPress;
