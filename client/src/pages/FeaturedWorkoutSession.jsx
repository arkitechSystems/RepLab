import { useState, useRef, useEffect, Fragment } from 'react';
import { api } from '../api';
import { generateSummaryImage, composeShareText, dataURLtoBlob } from '../utils/workoutSummaryShare';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import StickyHeader from '../components/StickyHeader';

// RepLab exercise video CDN (Render static site, source: replab-videos/)
const VIDEO_CDN = 'https://replab-videos.onrender.com';

// Daily workout templates
const WORKOUTS = {
  'chest': {
    name: 'Chest',
    subtitle: 'Chest',
    description: "This chest workout starts with a barbell bench warm-up progressing to working sets, followed by a 10×10 German Volume Training block on incline DB press, then isolation flyes and a max push-up burnout to finish.",
    exercises: [
      {
        name: 'Barbell Bench (Warm Up)',
        isSectionHeader: true,
        sectionNotes: 'Warm up with progressive sets. Pause reps on sets 2 and 3 — hold the bar 1 inch off the chest for 2 seconds before pressing.',
        setType: 'warm_up',
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
        warmupNotes: "Perform your preferred chest warm-up if you feel like you need to before doing the three warm-up sets of barbell bench, whether that be cardio, push-ups, etc. Performing pull-ups or pull-up isometric holds at the top reinforces proper scapular control by encouraging you to keep your shoulders pulled down and back, protecting the shoulder during the press.",
        description: "1. First set is 40% of one rep max, 10 reps.\n2. Second set is 60% for 6 reps.\n3. The third set is 70% for 2 reps.",
        hideGoals: true,
        sets: [
          { setNumber: 1, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 6, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 2, suggestedWeight: 0 },
        ],
      },
      {
        name: 'Barbell Bench',
        setType: 'straight',
        description: "Working sets. Controlled reps with a full range of motion — touch the chest, press to full lockout. Aim for 8-10 reps per set. If you hit 10 on all 3 sets, increase weight next session.",
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
        sets: [
          { setNumber: 1, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 10, suggestedWeight: 0 },
        ],
      },
      {
        name: 'DB Incline Bench Press',
        setType: 'straight',
        description: "10×10 German Volume Training — 10 sets of 10 reps with only 60 seconds rest between sets. Use a weight you could do 20 reps with. This is about volume and time under tension, not max weight. The burn will be intense by set 6.",
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
        sets: [
          { setNumber: 1, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 2, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 3, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 4, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 5, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 6, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 7, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 8, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 9, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 10, plannedReps: 10, suggestedWeight: 0 },
        ],
      },
      {
        name: 'Single-Arm Kneeling Upper Chest Cable Flyes',
        setType: 'straight',
        description: "Kneel in front of a low cable with arms straight. Bring the handles up and together in front of your upper chest, squeezing at the top. This targets the upper chest fibers that are hard to hit with pressing alone. Keep the arms nearly straight throughout.",
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
        sets: [
          { setNumber: 1, plannedReps: 15, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 15, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 15, suggestedWeight: 0 },
        ],
      },
      {
        name: 'One-Arm Hammer Strength Angled Press',
        setType: 'straight',
        description: "Unilateral pressing on the angled Hammer Strength machine. Drive through one arm at a time with full range of motion, squeezing the chest at lockout and controlling the negative. Go to near-failure on each set.",
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
        sets: [
          { setNumber: 1, plannedReps: 15, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 15, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 15, suggestedWeight: 0 },
        ],
      },
      {
        name: 'Max Push-Ups',
        setType: 'straight',
        description: "Final burnout. Perform as many push-ups as you can in two minutes.",
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
        hideWeight: true,
        scoreboardTimer: 120,
        sets: [
          { setNumber: 1, plannedReps: 0, suggestedWeight: 0 },
        ],
      },
    ],
  },
  'bis-rds': { name: 'Bis/RDs', subtitle: 'Biceps, Rear Delts', description: 'Bicep and rear delt focused session with supersets and isolation work.', exercises: [] },
  'quads': {
    name: 'Quads',
    subtitle: 'Quads',
    description: 'Quad-focused leg day — leg press warm-up into working sets, a 10×10 hack squat block, DB split squats, and a leg extension drop-set burnout.',
    exercises: [
      {
        name: 'Leg Press (Warm Up)',
        isSectionHeader: true,
        setType: 'warm_up',
        hideGoals: true,
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
        description: "Three progressive warm-up sets to prime the legs.\n1. 2×45s for 15 reps\n2. 4×45s for 8 reps\n3. 6×45s for 4 reps",
        sets: [
          { setNumber: 1, plannedReps: 15, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 8, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 4, suggestedWeight: 0 },
        ],
      },
      {
        name: 'Leg Press',
        setType: 'straight',
        description: "Working sets. Controlled eccentric, full depth without losing lower-back contact with the pad. Target 8 reps per set.",
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
        sets: [
          { setNumber: 1, plannedReps: 8, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 8, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 8, suggestedWeight: 0 },
        ],
      },
      {
        name: 'Hack Squat',
        setType: 'straight',
        description: "10×10 — 10 sets of 10 reps with only 60 seconds rest between sets. Pick a weight you could rep 15-20 times fresh; the short rest makes the later sets brutal.",
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
        sets: [
          { setNumber: 1, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 2, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 3, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 4, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 5, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 6, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 7, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 8, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 9, plannedReps: 10, suggestedWeight: 0, restAfter: 60 },
          { setNumber: 10, plannedReps: 10, suggestedWeight: 0 },
        ],
      },
      {
        name: 'DB Split Squats',
        setType: 'straight',
        description: "DBs held at your sides (on the outside of the body, not goblet). Keep the torso upright and drive through the front heel.",
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
        sets: [
          { setNumber: 1, plannedReps: 8, suggestedWeight: 25 },
          { setNumber: 2, plannedReps: 8, suggestedWeight: 25 },
        ],
      },
      {
        name: 'Leg Extension Burnout',
        setType: 'straight',
        description: "Constant-tension drop set — move through only the top 3/4 of the range to keep the quads under load. Drop the weight each set and rep to failure.",
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
        sets: [
          { setNumber: 1, plannedReps: 0, suggestedWeight: 260 },
          { setNumber: 2, plannedReps: 0, suggestedWeight: 220 },
          { setNumber: 3, plannedReps: 0, suggestedWeight: 180 },
          { setNumber: 4, plannedReps: 0, suggestedWeight: 140 },
          { setNumber: 5, plannedReps: 0, suggestedWeight: 100 },
        ],
      },
    ],
  },
  'tris-shoulders': { name: 'Tris/Shoulders', subtitle: 'Triceps, Shoulders', description: 'Tricep and shoulder session with pressing movements and isolation burnouts.', exercises: [] },
  'back-traps': { name: 'Back/Traps', subtitle: 'Back, Traps', description: 'Pulling session — rows, pulldowns, shrugs, and rear delt work.', exercises: [] },
  'glutes-hams': { name: 'Glutes/Hams', subtitle: 'Glutes, Hamstrings', description: 'Posterior chain focused — RDLs, hip thrusts, leg curls, and walking lunges.', exercises: [] },
};

// Per-week overrides. Keyed by week number, then day key. Falls back to WORKOUTS[dayKey] when no override exists.
const WEEK_OVERRIDES = {
  1: {
    'back-traps': {
      name: 'Back/Traps',
      subtitle: 'Back, Traps',
      description: 'Pull-focused session — progressive weighted chins into cluster work, a five-movement horizontal-pull sandwich, heavy shrugs with holds, overhead squats, and finisher isolation work.',
      exercises: [
        {
          name: 'Weighted Chins (Warm Up)',
          isSectionHeader: true,
          setType: 'warm_up',
          hideGoals: true,
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          description: "Progressive warm-up to prime the lats and grip.\n1. Bodyweight × 8\n2. +45 lb × 3\n3. +90 lb × 1",
          sets: [
            { setNumber: 1, plannedReps: 8, suggestedWeight: 0 },
            { setNumber: 2, plannedReps: 3, suggestedWeight: 45 },
            { setNumber: 3, plannedReps: 1, suggestedWeight: 90 },
          ],
        },
        {
          name: 'Weighted Chins',
          setType: 'straight',
          description: "Cluster sets at +35 lb — inside each working set, do 4, 3, 3, 2, 1 reps with 30 seconds rest between each mini-set. All 13 reps count as one set. 3 working sets total.",
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 13, suggestedWeight: 35 },
            { setNumber: 2, plannedReps: 13, suggestedWeight: 35 },
            { setNumber: 3, plannedReps: 13, suggestedWeight: 35 },
          ],
        },
        {
          name: 'DB Rear Delt Raises / W\'s',
          setType: 'straight',
          description: "Horizontal Pull Sandwich — position 1 of 5. Rotate through the full five-movement sandwich in order: RD Raises/W's → Overhand Rows → Underhand Cable Rows → Overhand Rows → RD Raises/W's.",
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 2, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 3, plannedReps: 0, suggestedWeight: 0 },
          ],
        },
        {
          name: 'Overhand Rows',
          setType: 'straight',
          description: "Sandwich position 2 of 5.",
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 2, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 3, plannedReps: 0, suggestedWeight: 0 },
          ],
        },
        {
          name: 'Underhand Cable Rows',
          setType: 'straight',
          description: "Sandwich position 3 of 5.",
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 2, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 3, plannedReps: 0, suggestedWeight: 0 },
          ],
        },
        {
          name: 'Overhand Rows',
          setType: 'straight',
          description: "Sandwich position 4 of 5.",
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 2, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 3, plannedReps: 0, suggestedWeight: 0 },
          ],
        },
        {
          name: 'DB Rear Delt Raises / W\'s',
          setType: 'straight',
          description: "Sandwich position 5 of 5.",
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 2, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 3, plannedReps: 0, suggestedWeight: 0 },
          ],
        },
        {
          name: 'BB Shrugs',
          setType: 'straight',
          description: "1-second holds at the top of each rep. Set 1: underhand grip. Set 2: overhand grip.",
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 9, suggestedWeight: 225 },
            { setNumber: 2, plannedReps: 10, suggestedWeight: 225 },
          ],
        },
        {
          name: 'Overhead Squats',
          setType: 'straight',
          description: "Thoracic mobility and overhead stability work. Keep the bar tracking over the mid-foot with arms locked out.",
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 7, suggestedWeight: 95 },
            { setNumber: 2, plannedReps: 7, suggestedWeight: 95 },
            { setNumber: 3, plannedReps: 6, suggestedWeight: 95 },
          ],
        },
        {
          name: 'Straight Arm Pull Downs',
          setType: 'straight',
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 2, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 3, plannedReps: 0, suggestedWeight: 0 },
          ],
        },
        {
          name: 'DB Hammer Curls',
          setType: 'straight',
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 0, suggestedWeight: 35 },
            { setNumber: 2, plannedReps: 0, suggestedWeight: 35 },
            { setNumber: 3, plannedReps: 0, suggestedWeight: 35 },
          ],
        },
      ],
    },
    'glutes-hams': {
      name: 'Glutes/Hams',
      subtitle: 'Glutes, Hamstrings',
      description: 'Posterior chain session — progressive RDL warm-up into working sets, 10×10 lying leg curls, GHD glute-ham raises, hip abductor/adductor isolation, and a DB hip flexor / side plank finisher.',
      exercises: [
        {
          name: 'Barbell Romanian Deadlift (Warm Up)',
          isSectionHeader: true,
          setType: 'warm_up',
          hideGoals: true,
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          description: "Four progressive warm-up sets with just the bar to prime the hinge.\n1. BW × 6\n2. BW × 3\n3. BW × 1\n4. BW × 1",
          sets: [
            { setNumber: 1, plannedReps: 6, suggestedWeight: 0 },
            { setNumber: 2, plannedReps: 3, suggestedWeight: 0 },
            { setNumber: 3, plannedReps: 1, suggestedWeight: 0 },
            { setNumber: 4, plannedReps: 1, suggestedWeight: 0 },
          ],
        },
        {
          name: 'Barbell Romanian Deadlift',
          setType: 'straight',
          description: "Working sets. Hinge at the hips with a neutral spine; keep the bar tracking over the mid-foot and feel the stretch in the hamstrings at the bottom.",
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 10, suggestedWeight: 0 },
            { setNumber: 2, plannedReps: 0, suggestedWeight: 0 },
            { setNumber: 3, plannedReps: 0, suggestedWeight: 0 },
          ],
        },
        {
          name: 'Lying Leg Curls',
          setType: 'straight',
          description: "10×10 — 10 sets of 10 reps at 100 lb with only 60 seconds rest between sets.",
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 10, suggestedWeight: 100, restAfter: 60 },
            { setNumber: 2, plannedReps: 10, suggestedWeight: 100, restAfter: 60 },
            { setNumber: 3, plannedReps: 10, suggestedWeight: 100, restAfter: 60 },
            { setNumber: 4, plannedReps: 10, suggestedWeight: 100, restAfter: 60 },
            { setNumber: 5, plannedReps: 10, suggestedWeight: 100, restAfter: 60 },
            { setNumber: 6, plannedReps: 10, suggestedWeight: 100, restAfter: 60 },
            { setNumber: 7, plannedReps: 10, suggestedWeight: 100, restAfter: 60 },
            { setNumber: 8, plannedReps: 10, suggestedWeight: 100, restAfter: 60 },
            { setNumber: 9, plannedReps: 10, suggestedWeight: 100, restAfter: 60 },
            { setNumber: 10, plannedReps: 10, suggestedWeight: 100 },
          ],
        },
        {
          name: 'GHD Glute Ham Raise',
          setType: 'straight',
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 10, suggestedWeight: 17.5 },
            { setNumber: 2, plannedReps: 10, suggestedWeight: 20 },
            { setNumber: 3, plannedReps: 0, suggestedWeight: 0 },
          ],
        },
        {
          name: 'Machine Hip Adduction',
          setType: 'straight',
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 8, suggestedWeight: 80 },
            { setNumber: 2, plannedReps: 6, suggestedWeight: 80 },
            { setNumber: 3, plannedReps: 6, suggestedWeight: 80 },
          ],
        },
        {
          name: 'Machine Hip Abduction',
          setType: 'straight',
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 8, suggestedWeight: 200 },
            { setNumber: 2, plannedReps: 8, suggestedWeight: 200 },
            { setNumber: 3, plannedReps: 8, suggestedWeight: 200 },
          ],
        },
        {
          name: 'DB Hip Flexors / Side Plank Holds',
          setType: 'straight',
          description: "Paired movement — DB hip flexor raises alternated with side plank holds.",
          videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4`,
          sets: [
            { setNumber: 1, plannedReps: 10, suggestedWeight: 30 },
            { setNumber: 2, plannedReps: 10, suggestedWeight: 30 },
            { setNumber: 3, plannedReps: 10, suggestedWeight: 30 },
          ],
        },
      ],
    },
  },
};

function resolveWorkout(week, dayKey) {
  return WEEK_OVERRIDES[week]?.[dayKey] || WORKOUTS[dayKey];
}

// Program structure: 12 weeks, 6 workouts per week
const WEEKLY_SCHEDULE = ['chest', 'bis-rds', 'quads', 'tris-shoulders', 'back-traps', 'glutes-hams'];

const PROGRAM = {
  name: "Will's Hypertrophy Program",
  description: '12 Week Resistance Training Program focused on muscle hypertrophy',
  totalWeeks: 12,
  daysPerWeek: WEEKLY_SCHEDULE,
};

function ScoreboardTimer({ duration }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const rafRef = useRef(null);
  const startedAtRef = useRef(null);
  const baseElapsedRef = useRef(0);

  // Track container size so the SVG perimeter path matches it pixel-for-pixel
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Continuous elapsed time via rAF — keeps the perimeter sweep smooth, not 1-sec jumps
  useEffect(() => {
    if (!running) return;
    startedAtRef.current = performance.now();
    const tick = (now) => {
      const next = baseElapsedRef.current + (now - startedAtRef.current);
      const totalMs = duration * 1000;
      if (next >= totalMs) {
        setElapsedMs(totalMs);
        setRunning(false);
        return;
      }
      setElapsedMs(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      // Capture progress so resuming continues from where we paused
      baseElapsedRef.current = elapsedMs;
    };
  }, [running, duration]);

  const handleStart = () => {
    if (elapsedMs >= duration * 1000) {
      baseElapsedRef.current = 0;
      setElapsedMs(0);
    }
    setRunning(true);
  };
  const handleReset = () => {
    cancelAnimationFrame(rafRef.current);
    setRunning(false);
    baseElapsedRef.current = 0;
    setElapsedMs(0);
  };

  const remaining = Math.max(0, Math.ceil((duration * 1000 - elapsedMs) / 1000));
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');

  // Perimeter progress geometry
  const radius = 14;
  const stroke = 2;
  const inset = stroke / 2;
  const { w, h } = size;
  const ready = w > 2 * radius && h > 2 * radius;
  const perimeter = ready
    ? 2 * (w - 2 * inset - 2 * radius) + 2 * (h - 2 * inset - 2 * radius) + 2 * Math.PI * radius
    : 0;
  const progress = duration > 0 ? Math.min(1, elapsedMs / (duration * 1000)) : 0;
  const filled = perimeter * progress;

  // Path begins at top-middle and traces the rounded rect clockwise.
  const pathD = ready ? [
    `M ${w / 2} ${inset}`,
    `H ${w - inset - radius}`,
    `A ${radius} ${radius} 0 0 1 ${w - inset} ${inset + radius}`,
    `V ${h - inset - radius}`,
    `A ${radius} ${radius} 0 0 1 ${w - inset - radius} ${h - inset}`,
    `H ${inset + radius}`,
    `A ${radius} ${radius} 0 0 1 ${inset} ${h - inset - radius}`,
    `V ${inset + radius}`,
    `A ${radius} ${radius} 0 0 1 ${inset + radius} ${inset}`,
    `H ${w / 2}`,
  ].join(' ') : '';

  return (
    <div style={{ marginBottom: '16px' }}>
      <div ref={containerRef} style={{
        position: 'relative',
        background: '#000',
        borderRadius: '14px',
        padding: '24px 16px',
        textAlign: 'center',
        boxShadow: '0 0 20px rgba(239,68,68,0.2), inset 0 0 30px rgba(239,68,68,0.05)',
      }}>
        {ready && (
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
          >
            <path d={pathD} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={stroke} />
            <path
              d={pathD}
              fill="none"
              stroke="#ef4444"
              strokeWidth={stroke}
              strokeDasharray={`${filled} ${Math.max(0, perimeter - filled)}`}
              strokeLinecap="butt"
              style={{ filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.7))' }}
            />
          </svg>
        )}
        <div style={{
          position: 'relative',
          fontSize: '64px',
          fontWeight: 700,
          color: '#ef4444',
          fontFamily: 'monospace',
          letterSpacing: '6px',
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 0 16px rgba(239,68,68,0.7)',
          lineHeight: 1,
        }}>
          {mm}:{ss}
        </div>
      </div>
      <div className="flex gap-3 justify-center mt-3">
        <button
          onClick={handleStart}
          disabled={running}
          className="active:bg-white/10 transition-colors"
          style={{
            padding: '10px 30px',
            borderRadius: '100px',
            border: '1px solid rgba(255,255,255,0.7)',
            background: 'transparent',
            color: 'white',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            cursor: running ? 'not-allowed' : 'pointer',
            opacity: running ? 0.4 : 1,
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}
        >
          Start
        </button>
        <button
          onClick={handleReset}
          className="active:bg-white/10 transition-colors"
          style={{
            padding: '10px 30px',
            borderRadius: '100px',
            border: '1px solid rgba(255,255,255,0.7)',
            background: 'transparent',
            color: 'white',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function RestTimer({ duration, isActive }) {
  const [remaining, setRemaining] = useState(duration);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isActive) {
      setRemaining(duration);
      return;
    }
    setRemaining(duration);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isActive, duration]);

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');
  const finished = isActive && remaining === 0;

  return (
    <div
      className="px-4 py-1 flex items-center justify-center gap-3 border-t"
      style={{
        borderColor: 'rgba(0,0,0,0.08)',
        background: finished ? 'rgba(34,197,94,0.12)' : isActive ? 'rgba(239,68,68,0.06)' : 'transparent',
      }}
    >
      <span className="text-[9px] uppercase font-bold" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.2em' }}>
        Rest Timer
      </span>
      <span style={{ color: '#111', fontSize: '13px', fontWeight: 700, fontFamily: 'system-ui', letterSpacing: '1px', fontVariantNumeric: 'tabular-nums' }}>
        {mm}:{ss}
      </span>
    </div>
  );
}

function VideoLoop({ src }) {
  const videoARef = useRef(null);
  const videoBRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;

    a.style.opacity = '1';
    b.style.opacity = '0';
    a.play().catch(() => {});

    const check = () => {
      const active = a.style.opacity === '1' ? a : b;
      const standby = active === a ? b : a;
      if (active.duration && active.currentTime >= active.duration - 0.15) {
        standby.currentTime = 0;
        standby.play().catch(() => {});
        standby.style.opacity = '1';
        active.style.opacity = '0';
        setTimeout(() => { active.currentTime = 0; active.pause(); }, 100);
      }
      rafRef.current = requestAnimationFrame(check);
    };
    rafRef.current = requestAnimationFrame(check);

    return () => {
      cancelAnimationFrame(rafRef.current);
      a.pause();
      b.pause();
    };
  }, [src]);

  const style = { transition: 'opacity 0.05s linear' };
  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', marginBottom: '16px', position: 'relative' }}>
      <video ref={videoARef} src={src} className="w-full aspect-video object-cover" style={{ ...style, position: 'relative' }} muted playsInline preload="auto" />
      <video ref={videoBRef} src={src} className="w-full aspect-video object-cover" style={{ ...style, position: 'absolute', top: 0, left: 0 }} muted playsInline preload="auto" />
    </div>
  );
}

export default function FeaturedWorkoutSession() {
  const navigate = useNavigate();
  const { workoutId } = useParams();
  const location = useLocation();

  // If navigated from calendar/home with specific week+day, start there
  const navState = location.state || {};
  const [selectedWeek, setSelectedWeek] = useState(navState.week || null);
  const [selectedDay, setSelectedDay] = useState(navState.day || null);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [entries, setEntries] = useState({});
  const [completedSets, setCompletedSets] = useState(new Set());
  const [highlightNext, setHighlightNext] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);
  const containerRef = useRef(null);
  const nextBtnRef = useRef(null);
  // Track the deepest view the user was sent to via navigation state
  const arrivedWithWeek = useRef(!!(navState.week));
  const arrivedWithDay = useRef(!!(navState.day));

  // Sync state when navigation changes (component may be reused by React Router)
  useEffect(() => {
    const s = location.state || {};
    if (s.week) {
      setSelectedWeek(s.week);
      arrivedWithWeek.current = true;
    }
    if (s.day) {
      setSelectedDay(s.day);
      setCurrentIdx(-1);
      arrivedWithDay.current = true;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.key]);

  // Restore or reset workout data when switching days
  useEffect(() => {
    if (!selectedDay) return;
    const storageKey = `featured-workout-${selectedDay}`;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && saved.day === selectedDay) {
        setEntries(saved.entries || {});
        setCompletedSets(new Set(saved.completedSets || []));
        return;
      }
    } catch {}
    setEntries({});
    setCompletedSets(new Set());
    setHighlightNext(false);
  }, [selectedDay]);

  // Persist entries and completedSets to localStorage
  useEffect(() => {
    if (!selectedDay) return;
    const storageKey = `featured-workout-${selectedDay}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        day: selectedDay,
        entries,
        completedSets: [...completedSets],
      }));
    } catch {}
  }, [entries, completedSets, selectedDay]);

  // Workout timer
  const [timerStarted, setTimerStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const [pinTimer, setPinTimer] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareImage, setShareImage] = useState(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [savedAsTemplate, setSavedAsTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const confettiRef = useRef(null);

  // Confetti when the summary appears
  useEffect(() => {
    if (!showSummary) return;
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -1,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 3 + 2,
      vx: (Math.random() - 0.5) * 2,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    }));

    let frame;
    let fadeStart = null;
    const duration = 3500;
    function animate(ts) {
      if (!fadeStart) fadeStart = ts;
      const progress = ts - fadeStart;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const globalFade = progress > duration ? Math.max(0, 1 - (progress - duration) / 1000) : 1;
      for (const p of pieces) {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotSpeed;
        p.vy += 0.04;
        p.opacity = globalFade;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (globalFade > 0) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [showSummary]);
  const [timerFloating, setTimerFloating] = useState(false);
  const [floatPos, setFloatPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('featured-timer-pos'));
      if (saved?.x != null && saved?.y != null) return saved;
    } catch {}
    return { x: 16, y: 100 };
  });
  const floatStartRef = useRef(null);

  // Timer tick
  useEffect(() => {
    if (!timerStarted) return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [timerStarted]);

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function startTimer() {
    if (!timerStarted) setTimerStarted(true);
  }

  // Floating timer drag handlers
  function handleFloatTouchStart(e) {
    const t = e.touches[0];
    floatStartRef.current = { x: t.clientX - floatPos.x, y: t.clientY - floatPos.y };
  }
  function handleFloatTouchMove(e) {
    if (!floatStartRef.current) return;
    const t = e.touches[0];
    setFloatPos({ x: t.clientX - floatStartRef.current.x, y: t.clientY - floatStartRef.current.y });
  }
  function handleFloatTouchEnd() {
    floatStartRef.current = null;
    try { localStorage.setItem('featured-timer-pos', JSON.stringify(floatPos)); } catch {}
  }

  const workout = selectedDay ? resolveWorkout(selectedWeek, selectedDay) : null;
  const totalExercises = workout ? workout.exercises.length : 0;
  const exercise = currentIdx >= 0 && workout && currentIdx < workout.exercises.length ? workout.exercises[currentIdx] : null;

  // Auto-scroll to Next Exercise button when all sets on current exercise are completed
  useEffect(() => {
    if (!exercise || exercise.sets.length === 0) return;
    const allDone = exercise.sets.every((_, idx) => completedSets.has(`${exercise.name}-${idx}`));
    if (allDone) {
      setHighlightNext(true);
      setTimeout(() => {
        nextBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    } else {
      setHighlightNext(false);
    }
  }, [completedSets, exercise]);

  function handleChange(setIdx, field, value) {
    if (!exercise) return;
    const key = exercise.name;
    setEntries((prev) => {
      const updated = { ...prev };
      updated[key] = [...(updated[key] || exercise.sets.map(() => ({ weight: '', reps: '' })))];
      const parsedValue = field === 'setType' ? value : (value === '' ? '' : Math.max(0, Number(value)));
      updated[key][setIdx] = {
        ...updated[key][setIdx],
        [field]: parsedValue,
      };
      // Cascade weight changes forward — every subsequent set adopts the new weight
      // until the user manually changes it again at a later set.
      if (field === 'weight') {
        for (let i = setIdx + 1; i < updated[key].length; i++) {
          updated[key][i] = { ...updated[key][i], weight: parsedValue };
        }
      }
      return updated;
    });
  }

  function handleToggleComplete(setIdx) {
    if (!exercise) return;
    const key = `${exercise.name}-${setIdx}`;
    const isCurrentlyComplete = completedSets.has(key);
    // Sequential rule: completed sets must be a contiguous prefix.
    // - To mark complete: every previous set must already be complete.
    // - To uncomplete: no later set may still be complete.
    if (!isCurrentlyComplete) {
      for (let i = 0; i < setIdx; i++) {
        if (!completedSets.has(`${exercise.name}-${i}`)) return;
      }
    } else {
      for (let i = setIdx + 1; i < exercise.sets.length; i++) {
        if (completedSets.has(`${exercise.name}-${i}`)) return;
      }
    }
    setCompletedSets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else {
        next.add(key);
        if (navigator.vibrate) navigator.vibrate(15);
      }
      return next;
    });
  }

  function goNext() {
    if (currentIdx < totalExercises - 1) {
      setHighlightNext(false);
      setCurrentIdx(currentIdx + 1);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  function goBack() {
    navigate('/', { state: { openSection: 'featured' } });
  }

  function goPrev() {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else if (currentIdx === 0) {
      setCurrentIdx(-1);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  const progressPct = totalExercises > 0 ? Math.round(((currentIdx + 1) / totalExercises) * 100) : 0;

  // WEEK LIST VIEW — shows all 12 weeks (Nike style)
  if (!selectedWeek) {
    return (
      <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 40%, #111 70%, #0a0a0a 100%)' }}>
        {/* Ambient spotlight */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[min(600px,90vw)] h-[min(600px,90vw)] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        <div className="relative z-10 px-5 pt-6 pb-2">
          <button onClick={goBack} className="flex items-center gap-1 text-white/50 text-sm font-medium active:opacity-70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
        </div>

        <div className="relative z-10 px-5">
          {/* Program header */}
          <div style={{ marginBottom: '24px' }}>
            <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-light mb-2">Featured Program</p>
            <h1 className="text-[28px] font-black text-white leading-[0.95] tracking-tight mb-2" style={{ fontFamily: 'system-ui' }}>
              {PROGRAM.name.toUpperCase()}
            </h1>
            <p className="text-[13px] text-white/35 font-light">
              {PROGRAM.description}
            </p>
            <div className="h-px bg-white/10 my-4" />
            <p className="text-[13px] text-white/50 font-light leading-relaxed">
              Built as a 2-week cycle that repeats six times across 12 weeks. Weeks one and two will be used as a baseline to set your goal weight and reps for the future weeks. Every cycle after, you'll repeat the same workouts and aim to beat your previous numbers by adding weight or completing more reps.
            </p>
          </div>

          {/* Week cards — Nike accordion style */}
          <div className="space-y-3">
            {Array.from({ length: PROGRAM.totalWeeks }, (_, i) => i + 1).map((week) => {
              const weightBonus = Math.floor((week - 1) / 2) * 5;
              const isExpanded = expandedWeek === week;
              return (
                <div
                  key={week}
                  className="fade-slide-up"
                  style={{
                    animationDelay: `${Math.min(week * 40, 400)}ms`,
                    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                    borderRadius: '2px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header — tap to expand/collapse */}
                  <div
                    onClick={() => setExpandedWeek(isExpanded ? null : week)}
                    className="cursor-pointer active:scale-[0.98] transition-transform"
                    style={{ padding: '16px 20px', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div>
                      <div className="text-[18px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui' }}>
                        WEEK {week}
                      </div>
                      <div className="text-[11px] text-white/25 font-light mt-1">
                        {PROGRAM.daysPerWeek.map(d => WORKOUTS[d].name).join(' · ')}
                      </div>
                    </div>
                    <svg className="w-4 h-4 shrink-0 transition-transform duration-200" style={{ color: 'rgba(255,255,255,0.2)', transform: isExpanded ? 'rotate(90deg)' : 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                  {/* Expanded day list */}
                  {isExpanded && (
                    <div style={{ position: 'relative', zIndex: 1, padding: '0 20px 16px' }}>
                      <div className="h-px bg-white/5 mb-3" />

                      {/* Go to week button — pill style */}
                      <button
                        onClick={() => { setSelectedWeek(week); setExpandedWeek(null); setExpandedDay(null); window.scrollTo({ top: 0, behavior: 'instant' }); }}
                        className="active:scale-[0.97] transition-all w-full mb-4"
                        style={{
                          padding: '10px', borderRadius: '100px', border: 'none',
                          background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                          color: '#000', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                          letterSpacing: '1.5px', textTransform: 'uppercase',
                          boxShadow: '0 4px 15px rgba(255,255,255,0.08)',
                        }}
                      >
                        Go to Week {week}
                      </button>

                      {PROGRAM.daysPerWeek.map((dayKey, dayIdx) => {
                        const dayExpanded = expandedDay === `${week}-${dayIdx}`;
                        const dayWorkout = resolveWorkout(week, dayKey);
                        return (
                          <div key={dayKey}>
                            {/* Day header — tap to expand exercises */}
                            <div
                              onClick={() => setExpandedDay(dayExpanded ? null : `${week}-${dayIdx}`)}
                              className="cursor-pointer active:opacity-70 transition-opacity"
                              style={{
                                padding: '10px 0',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span className="text-[11px] font-black w-5" style={{ color: 'rgba(239,68,68,0.5)' }}>{String(dayIdx + 1).padStart(2, '0')}</span>
                                <div>
                                  <div className="text-[10px] text-white/20 font-light">Day {dayIdx + 1}</div>
                                  <div className="text-[13px] font-semibold text-white mt-0.5">
                                    {dayWorkout.name} <span className="text-white/25 font-light">· {dayWorkout.exercises.length} exercises · {dayWorkout.exercises.reduce((s, ex) => s + ex.sets.length, 0)} sets</span>
                                  </div>
                                </div>
                              </div>
                              <svg className="w-4 h-4 transition-transform duration-200" style={{ color: 'rgba(255,255,255,0.15)', transform: dayExpanded ? 'rotate(90deg)' : 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </div>
                            {/* Expanded exercise list */}
                            {dayExpanded && dayWorkout.exercises.length > 0 && (
                              <div style={{ padding: '8px 0 4px 36px' }}>
                                {dayWorkout.exercises.map((ex, exIdx) => (
                                  <div key={exIdx} className="flex items-center gap-3 py-1.5" style={{ borderBottom: exIdx < dayWorkout.exercises.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                                    <span className="text-[10px] font-black w-4 text-center" style={{ color: 'rgba(239,68,68,0.4)' }}>{exIdx + 1}</span>
                                    <div>
                                      <div className="text-[12px] text-white/60 font-light">{ex.name}</div>
                                      <div className="text-[10px] text-white/20 font-light mt-0.5">
                                        {ex.sets.length} sets{ex.setType && ex.setType !== 'straight' ? ` · ${ex.setType.replace('_', ' ')}` : ''}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {dayExpanded && dayWorkout.exercises.length === 0 && (
                              <div className="text-[11px] text-white/20 font-light" style={{ padding: '8px 0 4px 36px' }}>Coming soon</div>
                            )}
                            {dayExpanded && (
                              <div className="flex justify-end py-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (dayWorkout.exercises.length > 0) {
                                      setSelectedWeek(week);
                                      setSelectedDay(dayKey);
                                      setCurrentIdx(-1);
                                      setExpandedWeek(null);
                                      setExpandedDay(null);
                                      window.scrollTo({ top: 0, behavior: 'instant' });
                                    }
                                  }}
                                  disabled={dayWorkout.exercises.length === 0}
                                  className="active:scale-[0.95] transition-all"
                                  style={{
                                    padding: '8px 20px', borderRadius: '100px',
                                    fontSize: '9px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase',
                                    cursor: dayWorkout.exercises.length > 0 ? 'pointer' : 'not-allowed',
                                    background: dayWorkout.exercises.length > 0 ? 'transparent' : 'rgba(255,255,255,0.03)',
                                    border: dayWorkout.exercises.length > 0 ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                    color: dayWorkout.exercises.length > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)',
                                  }}
                                >
                                  Begin Workout
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Rest day */}
                      <div style={{
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex', alignItems: 'center', gap: '12px',
                      }}>
                        <span className="text-[11px] font-black w-5 text-center text-white/10">07</span>
                        <div>
                          <div className="text-[10px] text-white/15 font-light">Day 7</div>
                          <div className="text-[13px] font-semibold text-white/20 mt-0.5">Rest</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // DAY LIST VIEW — shows the 6 workouts for the selected week
  if (selectedWeek && !selectedDay) {
    const weightBonus = Math.floor((selectedWeek - 1) / 2) * 5;
    return (
      <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 40%, #111 70%, #0a0a0a 100%)' }}>
        {/* Ambient spotlight */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[min(600px,90vw)] h-[min(600px,90vw)] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        <div className="relative z-10 px-5 pt-6 pb-2">
          <button onClick={() => {
            if (arrivedWithWeek.current) {
              goBack();
            } else {
              setSelectedWeek(null);
              window.scrollTo({ top: 0, behavior: 'instant' });
            }
          }} className="flex items-center gap-1 text-white/50 text-sm font-medium active:opacity-70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {arrivedWithWeek.current ? 'Back' : 'All Weeks'}
          </button>
        </div>

        <div className="relative z-10 px-5">
          <div style={{ marginBottom: '24px' }}>
            <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-light mb-2">
              Week {selectedWeek} of {PROGRAM.totalWeeks}
            </p>
            <h1 className="text-[28px] font-black text-white leading-[0.95] tracking-tight mb-2" style={{ fontFamily: 'system-ui' }}>
              {PROGRAM.name.toUpperCase()}
            </h1>
            {weightBonus > 0 && (
              <p className="text-[12px] text-white/35 font-light">
                +{weightBonus} lbs progressive overload this week
              </p>
            )}
          </div>

          <div className="space-y-3">
            {PROGRAM.daysPerWeek.map((dayKey, i) => {
              const dayWorkout = resolveWorkout(selectedWeek, dayKey);
              const hasExercises = dayWorkout.exercises.length > 0;
              return (
                <div
                  key={dayKey}
                  onClick={() => {
                    if (hasExercises) {
                      setSelectedDay(dayKey);
                      setCurrentIdx(-1);
                      window.scrollTo({ top: 0, behavior: 'instant' });
                    }
                  }}
                  className={`fade-slide-up ${hasExercises ? 'cursor-pointer active:scale-[0.98]' : 'opacity-50'} transition-transform`}
                  style={{
                    animationDelay: `${i * 60}ms`,
                    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                    borderRadius: '2px',
                    padding: '16px 20px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span className="text-[11px] font-black w-5 text-center" style={{ color: 'rgba(239,68,68,0.5)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <div className="text-[10px] text-white/20 font-light">Day {i + 1}</div>
                        <div className="text-[14px] font-semibold text-white mt-0.5">
                          {dayWorkout.name}
                          <span className="text-white/25 font-light">
                            {hasExercises ? ` · ${dayWorkout.exercises.length} exercises` : ' · Coming soon'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {hasExercises ? (
                      <svg className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    ) : (
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Soon</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Rest day */}
            <div className="fade-slide-up" style={{
              animationDelay: `${PROGRAM.daysPerWeek.length * 60}ms`,
              background: 'linear-gradient(160deg, #1a1a1a 0%, #0f0f0f 100%)',
              borderRadius: '2px',
              padding: '16px 20px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span className="text-[11px] font-black w-5 text-center text-white/10">07</span>
                <div>
                  <div className="text-[10px] text-white/15 font-light">Day 7</div>
                  <div className="text-[14px] font-semibold text-white/20 mt-0.5">Rest</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // EXERCISE OVERVIEW — shows exercise list for the selected day's workout
  if (selectedDay && currentIdx === -1) {
    return (
      <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 40%, #111 70%, #0a0a0a 100%)' }}>
        {/* Ambient spotlight */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[min(600px,90vw)] h-[min(600px,90vw)] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        <div className="relative z-10 px-5 pt-6 pb-2">
          <button onClick={() => {
            if (arrivedWithDay.current) {
              goBack();
            } else {
              setSelectedDay(null);
              window.scrollTo({ top: 0, behavior: 'instant' });
            }
          }} className="flex items-center gap-1 text-white/50 text-sm font-medium active:opacity-70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {arrivedWithDay.current ? 'Back' : `Week ${selectedWeek}`}
          </button>
        </div>

        <div className="relative z-10 px-5">
          {/* Program title */}
          <div style={{ marginBottom: '20px' }}>
            <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-light mb-2">
              Week {selectedWeek} · Day {PROGRAM.daysPerWeek.indexOf(selectedDay) + 1}
            </p>
            <h1 className="text-[28px] font-black text-white leading-[0.95] tracking-tight" style={{ fontFamily: 'system-ui' }}>
              {PROGRAM.name.toUpperCase()}
            </h1>
          </div>

          {/* Workout header card — Nike style */}
          <div style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            padding: '20px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
            marginBottom: '20px',
          }}>
            <div className="text-[20px] font-black text-white tracking-tight uppercase" style={{ fontFamily: 'system-ui' }}>
              {workout.name}
            </div>
            <div className="text-[11px] text-white/25 font-light mt-1">
              {workout.subtitle}
            </div>
            <div className="h-px bg-white/5 my-4" />
            <p className="text-[13px] text-white/60 leading-relaxed">
              {workout.description}
            </p>

            {/* Start button — Nike pill */}
            {totalExercises > 0 && (
              <button
                onClick={() => { setCurrentIdx(0); startTimer(); }}
                className="active:scale-[0.97] transition-all w-full mt-5"
                style={{
                  padding: '12px', borderRadius: '100px', border: 'none',
                  background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                  color: '#000', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                  letterSpacing: '1.5px', textTransform: 'uppercase',
                  boxShadow: '0 4px 15px rgba(255,255,255,0.08)',
                }}
              >
                Start Guided Workout
              </button>
            )}
          </div>

          {/* Exercise list — Nike cards */}
          {totalExercises > 0 ? (
            <>
              <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-light mb-3">
                {totalExercises} Exercises
              </p>
              <div className="space-y-3">
                {workout.exercises.map((ex, i) => (
                  <div key={i} style={{
                    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                    borderRadius: '2px',
                    padding: '14px 18px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span className="text-[11px] font-black w-5 text-center" style={{ color: 'rgba(239,68,68,0.5)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div className="text-[14px] font-semibold text-white">{ex.name}</div>
                        <div className="text-[11px] text-white/25 font-light mt-0.5">
                          {ex.sets.length} sets
                          {ex.setType && ex.setType !== 'straight' && ` · ${ex.setType.replace('_', ' ')}`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏗️</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Coming Soon</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>This workout is being built. Check back soon!</div>
            </div>
          )}

        </div>
      </div>
    );
  }

  // Exercise page
  if (!exercise) return null;
  const exEntries = entries[exercise.name] || exercise.sets.map((s) => ({ weight: s.suggestedWeight || '', reps: '' }));
  // Weeks 1 & 2 act as a baseline cycle: show goal columns even on hide-goals exercises,
  // but the goal value is derived from what the user enters once the set is completed.
  const showGoals = !exercise.hideGoals || selectedWeek <= 2;
  const useDynamicGoals = exercise.hideGoals && selectedWeek <= 2;

  return (
    <div className="min-h-screen bg-black pb-24" ref={containerRef}>
      {/* Header */}
      <div className="px-4 pt-6 mb-2 flex items-center justify-between">
        <button onClick={goPrev} className="flex items-center gap-1 text-wf-red text-sm font-medium active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {currentIdx === 0 ? 'Overview' : 'Previous'}
        </button>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>
          {currentIdx + 1} / {totalExercises}
        </span>
      </div>

      {/* Sticky exercise header — stays at top when scrolling */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Progress bar */}
        <div className="px-4 pt-2 pb-2">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #ef4444, #f97316)' }}
            />
          </div>
        </div>
        {/* Workout timer — inside sticky header */}
        {timerStarted && !timerFloating && (
          <div className={`px-4 pb-2 ${!pinTimer ? 'hidden' : ''}`} id="featured-timer">
            <div className="rounded-lg overflow-hidden bg-black">
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-semibold">Workout</span>
                  <span className="bg-black/60 rounded-md px-2.5 py-1">
                    <span className="text-lg font-mono-stat font-bold text-white tracking-wider" style={{ letterSpacing: '2px' }}>{formatTime(elapsed)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setTimerFloating(true); }}
                    className="p-1.5 rounded-md text-wf-gray-500 active:scale-90 hover:text-white/70 transition-colors"
                    title="Pop out timer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5H1v14h18v-6M15 3h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPinTimer(p => !p); }}
                    className={`relative w-8 h-[18px] rounded-full transition-all duration-200 ${pinTimer ? '' : 'bg-wf-gray-700'}`}
                    style={pinTimer ? { background: 'linear-gradient(to right, rgba(239,68,68,0.8), rgba(239,68,68,0.3))' } : {}}
                    title={pinTimer ? 'Unpin timer' : 'Pin timer'}
                  >
                    {pinTimer && (
                      <svg className="absolute left-[3px] top-[3px] w-[12px] h-[12px] text-white/70" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/>
                      </svg>
                    )}
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-200 ${pinTimer ? 'translate-x-[14px]' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Navigation arrows + exercise counter */}
        <div className="px-4 pb-2 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${currentIdx === 0 ? 'opacity-20' : ''}`}
          >
            <svg className="w-5 h-5" style={{ color: 'rgba(239,68,68,0.7)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
            Exercise {currentIdx + 1} of {totalExercises}
          </div>
          <button
            onClick={goNext}
            disabled={currentIdx >= totalExercises - 1}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${currentIdx >= totalExercises - 1 ? 'opacity-20' : ''}`}
          >
            <svg className="w-5 h-5" style={{ color: 'rgba(239,68,68,0.7)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
        {/* Exercise name + timer */}
        <div className="px-4 pb-3">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                {exercise.name}
              </h2>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {exercise.sets.length} sets · {exercise.setType?.replace('_', ' ') || 'straight'}
              </div>
            </div>
            {/* Compact timer when not pinned */}
            {timerStarted && !pinTimer && !timerFloating && (
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Workout Time</span>
                <div className="flex items-center gap-1.5">
                <span className="text-sm font-mono-stat font-bold text-wf-gray-400">{formatTime(elapsed)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setTimerFloating(true); }}
                  className="p-1 rounded text-wf-gray-500 active:scale-90"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5H1v14h18v-6M15 3h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-2">

        {/* Warm Up — above video */}
        {exercise.warmupNotes && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '14px',
            padding: '16px',
            border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.5)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
              Warm Up
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
              {exercise.warmupNotes}
            </p>
          </div>
        )}

        {/* How to Perform — above video */}
        {exercise.description && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '14px',
            padding: '16px',
            border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.5)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
              How to Perform
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {exercise.description}
            </p>
          </div>
        )}

        {/* Video */}
        {exercise.videoUrl && (
          <VideoLoop key={`${exercise.name}-${currentIdx}`} src={exercise.videoUrl} />
        )}

        {/* Scoreboard timer — above sets, below video */}
        {exercise.scoreboardTimer && (
          <ScoreboardTimer key={`${exercise.name}-${currentIdx}-scoreboard`} duration={exercise.scoreboardTimer} />
        )}

        {/* Sets */}
        <div className="exercise-card-light-test glass-card" style={{
          borderRadius: '14px',
          border: '2px solid rgba(239,68,68,0.4)',
          overflow: 'hidden',
        }}>
          {/* Column headers */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-2 text-[9px] uppercase text-wf-gray-400" style={{ letterSpacing: '1px' }}>
            <div className="w-5 shrink-0" />
            <div className="w-8 shrink-0 text-center">Set</div>
            {showGoals && !exercise.hideWeight && <div className="flex-1 text-center">Goal Wt</div>}
            {!exercise.hideWeight && <div className="flex-1 text-center">{showGoals ? 'Actual Wt' : 'Weight'}</div>}
            {showGoals && <div className="flex-1 text-center">Goal Reps</div>}
            <div className="flex-1 text-center">{showGoals ? 'Actual Reps' : 'Reps'}</div>
          </div>

          {exercise.sets.map((set, idx) => {
            const entry = exEntries[idx] || {};
            const isCompleted = completedSets.has(`${exercise.name}-${idx}`);
            return (
              <Fragment key={idx}>
              <div
                className={`px-4 py-3 flex items-center gap-2 border-t transition-colors duration-200 ${isCompleted ? 'bg-green-500/10' : ''}`}
                style={{ borderColor: 'rgba(0,0,0,0.08)' }}
              >
                {/* Checkmark */}
                <button
                  onClick={() => handleToggleComplete(idx)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                    isCompleted ? 'bg-green-500 border-green-500' : 'border-wf-gray-500 bg-transparent'
                  }`}
                >
                  {isCompleted && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>

                {/* Set number */}
                <div className="w-8 shrink-0 text-center text-xs text-wf-gray-400 font-medium">{set.setNumber}</div>

                {/* Goal Weight */}
                {showGoals && !exercise.hideWeight && (
                  <div className="flex-1">
                    <div className="w-full rounded-lg px-2 py-2.5 text-center text-sm bg-black/40 border border-white/5" style={{ color: 'rgba(239,68,68,0.6)', fontFamily: 'system-ui', fontWeight: 200, letterSpacing: '-1px' }}>
                      {useDynamicGoals
                        ? (isCompleted && entry.weight ? entry.weight : 0)
                        : (set.suggestedWeight || '—')}
                    </div>
                  </div>
                )}

                {/* Actual Weight */}
                {!exercise.hideWeight && (
                  <div className="flex-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.5"
                      value={entry.weight ?? ''}
                      placeholder={set.suggestedWeight ? String(set.suggestedWeight) : '0'}
                      onChange={(e) => handleChange(idx, 'weight', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className={`w-full lcd-input rounded-lg px-2 py-2.5 text-center text-base focus:outline-none ${isCompleted ? 'completed text-white' : 'text-white'}`}
                    />
                  </div>
                )}

                {/* Goal Reps */}
                {showGoals && (
                  <div className="flex-1">
                    <div className="w-full rounded-lg px-2 py-2.5 text-center text-sm bg-black/40 border border-white/5" style={{ color: 'rgba(239,68,68,0.6)', fontFamily: 'system-ui', fontWeight: 200, letterSpacing: '-1px' }}>
                      {set.plannedReps || '—'}
                    </div>
                  </div>
                )}

                {/* Actual Reps */}
                <div className="flex-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={entry.reps ?? ''}
                    placeholder={set.plannedReps ? String(set.plannedReps) : '0'}
                    onChange={(e) => handleChange(idx, 'reps', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className={`w-full lcd-input rounded-lg px-2 py-2.5 text-center text-base focus:outline-none ${isCompleted ? 'completed text-white' : 'text-white'}`}
                  />
                </div>
              </div>
              {set.restAfter && (
                <RestTimer duration={set.restAfter} isActive={isCompleted} />
              )}
              </Fragment>
            );
          })}
        </div>

      </div>

      {/* Bottom navigation */}
      <div className="px-4 py-6">
        <div className="flex gap-3 justify-center items-center">
          {currentIdx > 0 && (
            <button
              onClick={goPrev}
              className="active:bg-white/10 transition-colors"
              style={{
                padding: '12px 40px',
                borderRadius: '100px',
                border: '1px solid rgba(255,255,255,0.7)',
                background: 'transparent',
                color: 'white',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              }}
            >
              Previous
            </button>
          )}
          {currentIdx < totalExercises - 1 ? (
            <button
              ref={nextBtnRef}
              onClick={goNext}
              className={`active:bg-white/10 transition-colors ${highlightNext ? 'animate-pulse' : ''}`}
              style={{
                padding: '12px 40px',
                borderRadius: '100px',
                border: '1px solid rgba(255,255,255,0.7)',
                background: 'transparent',
                color: 'white',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: highlightNext ? '0 0 30px rgba(239,68,68,0.6), 0 0 60px rgba(239,68,68,0.3)' : '0 4px 15px rgba(0,0,0,0.3)',
                transform: highlightNext ? 'scale(1.03)' : undefined,
              }}
            >
              Next Exercise
            </button>
          ) : (
            <button
              ref={nextBtnRef}
              onClick={() => {
                clearInterval(timerRef.current);
                setTimerFloating(false);
                setShowSummary(true);
              }}
              className={`active:bg-white/10 transition-colors ${highlightNext ? 'animate-pulse' : ''}`}
              style={{
                padding: '12px 40px',
                borderRadius: '100px',
                border: '1px solid rgba(255,255,255,0.7)',
                background: 'transparent',
                color: 'white',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: highlightNext ? '0 0 30px rgba(239,68,68,0.6), 0 0 60px rgba(239,68,68,0.3)' : '0 4px 15px rgba(0,0,0,0.3)',
                transform: highlightNext ? 'scale(1.03)' : undefined,
              }}
            >
              Complete Workout
            </button>
          )}
        </div>
      </div>

      {/* Workout Summary */}
      {showSummary && workout && (() => {
        const completedExercises = workout.exercises.filter((ex) => {
          return ex.sets.some((_, si) => completedSets.has(`${ex.name}-${si}`));
        });
        const totalSetsCompleted = completedSets.size;
        const totalSetsAvailable = workout.exercises.reduce((s, ex) => s + ex.sets.length, 0);
        const totalVolume = workout.exercises.reduce((vol, ex) => {
          const exEntries = entries[ex.name] || [];
          return vol + exEntries.reduce((sum, e) => {
            const w = Number(e.weight) || 0;
            const r = Number(e.reps) || 0;
            return sum + (w > 0 ? w * r : 0);
          }, 0);
        }, 0);

        const shareOpts = {
          workout,
          programName: PROGRAM.name,
          entries,
          completedSets,
          elapsed,
          totalSets: totalSetsAvailable,
          totalVolume,
          formatTime,
          getEntryKey: (_list, ex) => ex.name,
        };

        const openShareMenu = async () => {
          setShowShareMenu(true);
          if (!shareImage) {
            setGeneratingImage(true);
            try {
              const img = await generateSummaryImage(shareOpts);
              setShareImage(img);
            } catch (err) {
              console.error('Failed to generate share image:', err);
            }
            setGeneratingImage(false);
          }
        };

        const handleShareImage = async () => {
          if (!shareImage) return;
          try {
            const blob = dataURLtoBlob(shareImage);
            const file = new File([blob], 'workout-summary.png', { type: 'image/png' });
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
              await navigator.share({ files: [file], text: 'Check out my workout!' });
              return;
            }
          } catch {}
          // Fallback: download
          const link = document.createElement('a');
          link.download = 'workout-summary.png';
          link.href = shareImage;
          link.click();
        };

        const handleSaveImage = async () => {
          if (!shareImage) return;
          try {
            const blob = dataURLtoBlob(shareImage);
            const file = new File([blob], 'workout-summary.png', { type: 'image/png' });
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
              await navigator.share({ files: [file] });
              return;
            }
          } catch {}
          const link = document.createElement('a');
          link.download = 'workout-summary.png';
          link.href = shareImage;
          link.click();
        };

        const handleShareText = async () => {
          const text = composeShareText(shareOpts);
          if (navigator.share) {
            try { await navigator.share({ text }); } catch {}
          } else {
            try { await navigator.clipboard.writeText(text); alert('Copied to clipboard!'); } catch {}
          }
        };

        const saveAsTemplate = async () => {
          if (savingTemplate || savedAsTemplate) return;
          setSavingTemplate(true);
          try {
            const today = new Date();
            const dateLabel = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const name = `${workout.name} - ${dateLabel}`;
            const templateExercises = workout.exercises.filter((ex) => !ex.isSectionHeader).map((ex) => {
              const exEntries = entries[ex.name] || [];
              return {
                name: ex.name,
                setType: ex.setType || 'straight',
                sets: ex.sets.map((set, idx) => ({
                  reps: Number(exEntries[idx]?.reps) || set.plannedReps || 10,
                  weight: Number(exEntries[idx]?.weight) || Number(set.suggestedWeight) || 0,
                })),
              };
            });
            await api('/templates', {
              method: 'POST',
              body: JSON.stringify({ name, description: '', exercises: templateExercises }),
            });
            setSavedAsTemplate(true);
          } catch (err) {
            console.error('Failed to save template:', err);
          } finally {
            setSavingTemplate(false);
          }
        };

        return (
          <div className="fixed inset-0 z-[200] overflow-y-auto" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>
            {/* Confetti canvas */}
            <canvas ref={confettiRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 201 }} />

            <div className="min-h-full flex items-center justify-center px-4 py-6 relative" style={{ zIndex: 202 }}>
              <div className="w-full max-w-sm relative">
                {/* Ambient spotlight */}
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[min(500px,90vw)] h-[min(500px,90vw)] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

                <div style={{
                  position: 'relative',
                  background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                  borderRadius: '2px',
                  padding: '32px 24px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                  overflow: 'hidden',
                }}>
                  {/* Red accent strip */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25))' }} />

                  {/* Top action row: share icon */}
                  <div className="flex justify-end" style={{ marginTop: '-8px', marginBottom: '8px' }}>
                    <button
                      onClick={openShareMenu}
                      className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60 active:scale-90 transition-all"
                      title="Share workout summary"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                      </svg>
                    </button>
                  </div>

                  {/* Header */}
                  <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(239,68,68,0.6)', letterSpacing: '0.3em' }}>
                      Complete
                    </p>
                    <h2 className="font-black tracking-tight mb-2" style={{ fontSize: '28px', fontFamily: 'system-ui', color: 'white', lineHeight: '0.95' }}>
                      WORKOUT COMPLETE
                    </h2>
                    <p className="text-[12px] font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {workout.name} · Week {selectedWeek}
                    </p>
                  </div>

                  {/* Stats grid — Nike cards */}
                  <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '24px' }}>
                    {[
                      { value: formatTime(elapsed), label: 'Duration' },
                      { value: `${totalSetsCompleted}/${totalSetsAvailable}`, label: 'Sets' },
                      { value: completedExercises.length, label: 'Exercises' },
                      { value: totalVolume.toLocaleString(), label: 'Volume (lbs)' },
                    ].map((stat, i) => (
                      <div key={i} style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '2px',
                        padding: '16px 10px',
                        textAlign: 'center',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <div style={{ fontSize: '24px', fontWeight: 900, color: 'white', fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', lineHeight: 1 }}>
                          {stat.value}
                        </div>
                        <div className="uppercase font-light" style={{ fontSize: '8px', color: 'rgba(239,68,68,0.5)', letterSpacing: '0.25em', marginTop: '6px' }}>
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Exercise breakdown */}
                  <div style={{ marginBottom: '24px' }}>
                    <p className="uppercase font-light" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em', marginBottom: '10px' }}>
                      Exercises
                    </p>
                    {workout.exercises.map((ex, i) => {
                      const exCompleted = ex.sets.filter((_, si) => completedSets.has(`${ex.name}-${si}`)).length;
                      const allDone = exCompleted === ex.sets.length;
                      return (
                        <div key={i} className="flex items-center gap-3" style={{ padding: '10px 0', borderBottom: i < workout.exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <span className="font-black" style={{ fontSize: '11px', color: 'rgba(239,68,68,0.5)', width: '20px' }}>
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="flex-1 font-light truncate" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                            {ex.name}
                          </span>
                          <span className="font-bold tabular-nums" style={{ fontSize: '11px', color: allDone ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                            {exCompleted}/{ex.sets.length}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Save as Template */}
                  <button
                    onClick={saveAsTemplate}
                    disabled={savingTemplate || savedAsTemplate}
                    className="active:bg-white/10 transition-colors"
                    style={{
                      width: '100%',
                      padding: '14px',
                      marginBottom: '10px',
                      borderRadius: '100px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'transparent',
                      color: savedAsTemplate ? '#22c55e' : 'rgba(255,255,255,0.6)',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      cursor: savingTemplate || savedAsTemplate ? 'default' : 'pointer',
                      opacity: savingTemplate ? 0.6 : 1,
                    }}
                  >
                    {savingTemplate ? 'Saving…' : savedAsTemplate ? 'Saved as Template \u2713' : 'Save as Template'}
                  </button>

                  {/* Close — Nike pill button */}
                  <button
                    onClick={() => {
                      setShowSummary(false);
                      setCurrentIdx(-1);
                      setSelectedDay(null);
                      setTimerStarted(false);
                      setElapsed(0);
                      setShareImage(null);
                      setSavedAsTemplate(false);
                      window.scrollTo({ top: 0, behavior: 'instant' });
                    }}
                    className="active:bg-white/10 transition-colors"
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '100px',
                      border: '1px solid rgba(255,255,255,0.7)',
                      background: 'transparent',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                    }}
                  >
                    Back to Week {selectedWeek}
                  </button>
                </div>
              </div>
            </div>

            {/* Share menu bottom sheet */}
            {showShareMenu && (
              <div className="fixed inset-0 flex flex-col" style={{ zIndex: 210 }} onClick={() => setShowShareMenu(false)}>
                <div className="absolute inset-0 bg-black/60" />
                <div className="relative flex-1 flex flex-col mt-12 bg-wf-gray-900 rounded-t-2xl shadow-2xl animate-drop-down overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="shrink-0 pt-3 pb-2 px-5">
                    <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
                    <h3 className="text-lg font-black text-white">Share Workout</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 pb-24">
                    {generatingImage && (
                      <div className="mb-4 rounded-xl border border-white/10 p-8 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span className="text-sm text-wf-gray-400 ml-3">Generating image...</span>
                      </div>
                    )}
                    {shareImage && !generatingImage && (
                      <div className="mb-4 rounded-xl overflow-hidden border border-white/10">
                        <img src={shareImage} alt="Workout summary" className="w-full" />
                      </div>
                    )}

                    <div className="space-y-2">
                      <button onClick={handleShareImage} disabled={!shareImage} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 active:bg-white/10 transition-colors disabled:opacity-40">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-semibold text-white block">Share Image</span>
                          <span className="text-xs text-wf-gray-500">Share via Instagram, Messages, etc.</span>
                        </div>
                      </button>

                      <button onClick={handleSaveImage} disabled={!shareImage} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 active:bg-white/10 transition-colors disabled:opacity-40">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-semibold text-white block">Save to Camera Roll</span>
                          <span className="text-xs text-wf-gray-500">Download image to your device</span>
                        </div>
                      </button>

                      <button onClick={handleShareText} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 active:bg-white/10 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-semibold text-white block">Share as Text</span>
                          <span className="text-xs text-wf-gray-500">Copy or share text summary</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Floating timer — draggable */}
      {timerFloating && timerStarted && (
        <div
          className="fixed z-50 touch-none"
          style={{ left: floatPos.x, top: floatPos.y }}
          onTouchStart={handleFloatTouchStart}
          onTouchMove={handleFloatTouchMove}
          onTouchEnd={handleFloatTouchEnd}
        >
          <div className="bg-wf-gray-900/95 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-sm flex items-center gap-3">
            <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-semibold">Workout</span>
            <span className="text-lg font-black text-white tabular-nums font-mono-stat">{formatTime(elapsed)}</span>
            <button
              onClick={() => setTimerFloating(false)}
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
