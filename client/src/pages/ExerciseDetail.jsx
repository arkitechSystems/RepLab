import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExercises, getSubstitutesFromList } from '../hooks/useExercises';

// Curated content for Incline Bench Press — example exercise detail page
const EXERCISE_DATA = {
  name: 'Incline Bench Press',
  muscle: 'Chest',
  secondaryMuscles: ['Shoulders', 'Triceps'],
  equipment: 'Barbell, Incline Bench',
  difficulty: 'Intermediate',
  type: 'Compound',
  videoId: 'DbFgADa2PL8',
  description: 'The incline bench press is a compound upper-body exercise that primarily targets the upper portion of the pectoralis major (clavicular head). By setting the bench at a 30–45 degree angle, the movement shifts emphasis from the mid-chest to the upper chest and front deltoids.',
  instructions: [
    'Set an adjustable bench to a 30–45 degree incline.',
    'Lie back and plant your feet flat on the floor. Retract your shoulder blades and arch your upper back slightly.',
    'Grip the bar slightly wider than shoulder width. Unrack the bar and hold it directly above your upper chest with arms extended.',
    'Lower the bar with control to your upper chest, just below the collarbone. Keep your elbows at roughly a 45–75 degree angle from your torso.',
    'Press the bar back up explosively to full lockout, driving through your chest and shoulders.',
    'Repeat for the desired number of reps. Rerack the bar carefully.',
  ],
  tips: [
    'Keep your shoulder blades pinched together throughout the movement to protect your shoulders and maximize chest activation.',
    'Avoid flaring your elbows to 90 degrees — aim for 45–75 degrees to reduce shoulder stress.',
    'Do not bounce the bar off your chest. Use a controlled tempo (2–3 seconds on the way down).',
    'If you lack a spotter, use safety pins or a Smith machine for heavy sets.',
    'A 30-degree incline hits the upper chest more; 45 degrees shifts more load to the shoulders.',
  ],
  commonMistakes: [
    { mistake: 'Incline too steep', fix: 'Keep the bench at 30–45 degrees. Steeper angles turn it into a shoulder press.' },
    { mistake: 'Lifting hips off the bench', fix: 'Keep your glutes planted. Arching your lower back is fine, but lifting your hips reduces the incline angle.' },
    { mistake: 'Pressing to the wrong spot', fix: 'The bar should touch your upper chest/clavicle area, not your mid-chest.' },
    { mistake: 'No shoulder blade retraction', fix: 'Squeeze your shoulder blades together before unracking. This creates a stable base and protects your shoulders.' },
  ],
  musclesWorked: [
    { name: 'Upper Chest (Clavicular Pec)', role: 'Primary', percentage: 60 },
    { name: 'Front Deltoids', role: 'Secondary', percentage: 25 },
    { name: 'Triceps', role: 'Tertiary', percentage: 15 },
  ],
};

export default function ExerciseDetail() {
  const navigate = useNavigate();
  const { exercises } = useExercises();
  const data = EXERCISE_DATA;

  const substitutes = useMemo(() => {
    if (!exercises || exercises.length === 0) return [];
    return getSubstitutesFromList(data.name, exercises).slice(0, 6);
  }, [exercises, data.name]);

  return (
    <div className="px-4 pt-6 pb-24">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-4 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      {/* Header */}
      <h1 className="text-3xl font-black text-white tracking-tight mb-1">{data.name}</h1>
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-wf-red/15 text-wf-red">{data.muscle}</span>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-wf-gray-400 border border-white/10">{data.type}</span>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-wf-gray-400 border border-white/10">{data.difficulty}</span>
      </div>

      {/* Video */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-5 bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${data.videoId}?rel=0`}
          title={`${data.name} form guide`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Description */}
      <div className="glass-card rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">Overview</h2>
        <p className="text-sm text-wf-gray-300 leading-relaxed">{data.description}</p>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest mb-1">Equipment</p>
          <p className="text-sm font-semibold text-white">{data.equipment}</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest mb-1">Secondary Muscles</p>
          <p className="text-sm font-semibold text-white">{data.secondaryMuscles.join(', ')}</p>
        </div>
      </div>

      {/* Muscles Worked */}
      <div className="glass-card rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Muscles Worked</h2>
        <div className="space-y-3">
          {data.musclesWorked.map((m) => (
            <div key={m.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white">{m.name}</span>
                <span className="text-xs text-wf-gray-500">{m.role}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${m.percentage}%`,
                    background: m.role === 'Primary' ? '#ef4444' : m.role === 'Secondary' ? '#f59e0b' : '#6b7280',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="glass-card rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">How To Perform</h2>
        <ol className="space-y-3">
          {data.instructions.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-wf-red/15 text-wf-red text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-wf-gray-300 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Tips */}
      <div className="glass-card rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Pro Tips</h2>
        <ul className="space-y-2">
          {data.tips.map((tip, i) => (
            <li key={i} className="flex gap-2">
              <svg className="w-4 h-4 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <p className="text-sm text-wf-gray-300 leading-relaxed">{tip}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Common Mistakes */}
      <div className="glass-card rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Common Mistakes</h2>
        <div className="space-y-3">
          {data.commonMistakes.map((item, i) => (
            <div key={i} className="border-l-2 border-red-500/50 pl-3">
              <p className="text-sm font-medium text-red-400 mb-0.5">{item.mistake}</p>
              <p className="text-sm text-wf-gray-400">{item.fix}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Substitute Exercises */}
      {substitutes.length > 0 && (
        <div className="glass-card rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Similar Exercises</h2>
          <div className="space-y-1">
            {substitutes.map((ex) => (
              <div key={ex.name} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03]">
                <span className="text-sm text-white">{ex.name}</span>
                <span className="text-[10px] text-wf-gray-500 uppercase tracking-wider">{ex.muscle}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
