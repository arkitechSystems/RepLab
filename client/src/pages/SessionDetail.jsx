import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { api } from '../api';
import StickyHeader from '../components/StickyHeader';

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api(`/sessions/${id}`, { signal: controller.signal })
      .then(setSession)
      .catch((err) => { if (err.name !== 'AbortError') setLoadError('Failed to load session'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  if (loading) {
    return (
      <div className="px-4 pt-6">
        <div className="glass-skeleton rounded-xl h-12 w-48 mb-4" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-skeleton rounded-xl h-32 mb-3" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 pt-6 text-center">
        <p className="text-red-400 mb-3">{loadError}</p>
        <button onClick={() => window.location.reload()} className="text-wf-cyan text-sm">Tap to retry</button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="px-4 pt-6 text-center text-wf-gray-400">
        <p>Session not found</p>
      </div>
    );
  }

  // Group entries by exercise name
  const grouped = [];
  const seen = new Map();
  for (const entry of session.entries) {
    if (!seen.has(entry.exerciseName)) {
      seen.set(entry.exerciseName, grouped.length);
      grouped.push({ name: entry.exerciseName, sets: [] });
    }
    grouped[seen.get(entry.exerciseName)].sets.push(entry);
  }

  return (
    <div className="pb-24">
      <div className="px-4 pt-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-2 active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      <StickyHeader
        title={session.templateName}
        subtitle={format(parseISO(session.date), 'EEEE, MMM d, yyyy')}
      />

      <div className="px-4 space-y-3 pb-4">
        {grouped.map((exercise, idx) => (
          <div
            key={exercise.name}
            style={{ animationDelay: `${idx * 60}ms` }}
            className="glass-card rounded-xl overflow-hidden fade-slide-up"
          >
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">{exercise.name}</h3>
            </div>
            <div className="divide-y divide-white/5">
              {exercise.sets.map((set) => (
                <div key={set.setNumber} className="px-4 py-3 flex items-center gap-4">
                  <span className="text-wf-gray-400 text-sm font-medium w-10">
                    Set {set.setNumber}
                  </span>
                  <div className="flex-1 flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-[10px] text-wf-gray-400 uppercase">Weight</div>
                      <div className="text-white font-medium">{set.weight}</div>
                    </div>
                    <div className="text-wf-gray-600">x</div>
                    <div className="text-center">
                      <div className="text-[10px] text-wf-gray-400 uppercase">Actual</div>
                      <div className="text-white font-medium">{set.reps}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
