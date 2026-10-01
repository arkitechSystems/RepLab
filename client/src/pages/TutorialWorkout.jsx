import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const TUTORIAL_TEMPLATE = {
  id: 'tutorial',
  name: 'Tutorial Workout',
  description: 'A sample workout to learn how RepLab tracks your sets, reps, and weight.',
  exercises: [
    {
      name: 'Barbell Back Squat',
      setType: 'straight',
      sets: [
        { setNumber: 1, plannedReps: 10, suggestedWeight: 45, setType: 'warm_up' },
        { setNumber: 2, plannedReps: 8, suggestedWeight: 95, setType: 'warm_up' },
        { setNumber: 3, plannedReps: 5, suggestedWeight: 135, setType: 'warm_up' },
        { setNumber: 4, plannedReps: 5, suggestedWeight: 185, setType: 'straight' },
        { setNumber: 5, plannedReps: 5, suggestedWeight: 185, setType: 'straight' },
        { setNumber: 6, plannedReps: 5, suggestedWeight: 185, setType: 'straight' },
      ],
    },
    {
      name: 'Barbell Bench Press',
      setType: 'straight',
      sets: [
        { setNumber: 1, plannedReps: 10, suggestedWeight: 45, setType: 'warm_up' },
        { setNumber: 2, plannedReps: 8, suggestedWeight: 95, setType: 'warm_up' },
        { setNumber: 3, plannedReps: 5, suggestedWeight: 135, setType: 'warm_up' },
        { setNumber: 4, plannedReps: 6, suggestedWeight: 165, setType: 'straight' },
        { setNumber: 5, plannedReps: 6, suggestedWeight: 165, setType: 'straight' },
        { setNumber: 6, plannedReps: 6, suggestedWeight: 165, setType: 'straight' },
        { setNumber: 7, plannedReps: 0, suggestedWeight: 115, setType: 'drop' },
      ],
    },
    {
      name: 'Deadlift',
      setType: 'straight',
      sets: [
        { setNumber: 1, plannedReps: 5, suggestedWeight: 95, setType: 'warm_up' },
        { setNumber: 2, plannedReps: 5, suggestedWeight: 135, setType: 'warm_up' },
        { setNumber: 3, plannedReps: 3, suggestedWeight: 185, setType: 'warm_up' },
        { setNumber: 4, plannedReps: 5, suggestedWeight: 225, setType: 'straight' },
        { setNumber: 5, plannedReps: 5, suggestedWeight: 225, setType: 'straight' },
        { setNumber: 6, plannedReps: 5, suggestedWeight: 225, setType: 'rest_pause' },
      ],
    },
    {
      name: 'Overhead Shoulder Press',
      setType: 'straight',
      sets: [
        { setNumber: 1, plannedReps: 8, suggestedWeight: 45, setType: 'warm_up' },
        { setNumber: 2, plannedReps: 5, suggestedWeight: 65, setType: 'warm_up' },
        { setNumber: 3, plannedReps: 8, suggestedWeight: 95, setType: 'straight' },
        { setNumber: 4, plannedReps: 8, suggestedWeight: 95, setType: 'straight' },
        { setNumber: 5, plannedReps: 8, suggestedWeight: 95, setType: 'straight' },
      ],
    },
    {
      name: 'Lat Pulldown',
      setType: 'straight',
      sets: [
        { setNumber: 1, plannedReps: 12, suggestedWeight: 0, setType: 'straight' },
        { setNumber: 2, plannedReps: 12, suggestedWeight: 0, setType: 'straight' },
        { setNumber: 3, plannedReps: 12, suggestedWeight: 0, setType: 'drop' },
      ],
    },
  ],
};

export default function TutorialWorkout() {
  const navigate = useNavigate();

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    navigate(`/session/tutorial/${today}`, { replace: true, state: { tutorialTemplate: TUTORIAL_TEMPLATE } });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-8 safe-top safe-bottom relative">
      <div className="ambient-bg" />
      <div className="w-full max-w-sm relative z-10">
        <div
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div
            className="h-[3px]"
            style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }}
          />
          <div
            className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)',
              filter: 'blur(40px)',
            }}
          />
          <div className="relative p-6">
            <div className="mb-5">
              <h1 className="text-[20px] font-black tracking-wide text-white logo-glow mb-3">
                REP<span className="text-wf-red">LAB</span>
              </h1>
              <p
                className="text-[10px] uppercase font-light mb-1"
                style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}
              >
                Tutorial
              </p>
              <h2
                className="text-[28px] font-black text-white tracking-tight"
                style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}
              >
                LOADING SESSION
              </h2>
            </div>
            <div className="pt-4 border-t border-white/5">
              <p className="text-wf-gray-400 text-sm leading-relaxed mb-5">
                Spinning up a sample workout so you can see how RepLab tracks
                sets, reps, and weight. Nothing here will be saved.
              </p>
              <div className="flex items-center gap-3">
                <span className="replab-spinner inline-block" style={{ width: 18, height: 18 }} />
                <span
                  className="text-[10px] uppercase font-bold text-white/50"
                  style={{ letterSpacing: '0.3em' }}
                >
                  Preparing
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
