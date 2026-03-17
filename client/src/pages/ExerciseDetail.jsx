import { useNavigate } from 'react-router-dom';

export default function ExerciseDetail() {
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-6 pb-24">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-4 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      <h1 className="text-3xl font-black text-white tracking-tight mb-1">Incline Bench Press</h1>
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-wf-red/15 text-wf-red">Chest</span>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-wf-gray-400 border border-white/10">Compound</span>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-wf-gray-400 border border-white/10">Intermediate</span>
      </div>

      <div className="glass-card rounded-xl p-8 flex items-center justify-center">
        <p className="text-wf-gray-500 text-sm">Coming soon</p>
      </div>
    </div>
  );
}
