import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { api } from '../api';
import { getWorkoutColor } from '../utils/workoutColors';
import StickyHeader from '../components/StickyHeader';
import useCountUp from '../hooks/useCountUp';

export default function History() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const navigate = useNavigate();

  const sessionCount = useCountUp(sessions.length);
  const uniqueWorkouts = useCountUp([...new Set(sessions.map((s) => s.templateName))].length);

  useEffect(() => {
    const controller = new AbortController();
    api('/sessions', { signal: controller.signal })
      .then(setSessions)
      .catch((err) => { if (err.name !== 'AbortError') setLoadError('Failed to load session history'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <div className="pb-24">
      <StickyHeader title="History" />

      <div className="px-4">
        {/* Stats bar */}
        {!loading && sessions.length > 0 && (
          <div className="flex gap-3 mb-4 fade-slide-up">
            <div className="flex-1 glass-card rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white font-mono-stat">{sessionCount}</p>
              <p className="text-[10px] uppercase tracking-widest text-wf-gray-500 mt-0.5">Sessions</p>
            </div>
            <div className="flex-1 glass-card rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white font-mono-stat">{uniqueWorkouts}</p>
              <p className="text-[10px] uppercase tracking-widest text-wf-gray-500 mt-0.5">Workouts</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass-skeleton rounded-xl h-20" />
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-16">
            <p className="text-red-400 mb-3">{loadError}</p>
            <button onClick={() => window.location.reload()} className="text-wf-cyan text-sm">Tap to retry</button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full glass-card flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-wf-gray-400 text-base">No workouts logged yet</p>
            <p className="text-wf-gray-500 text-sm mt-1">Complete a workout to see it here</p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {sessions.map((session, idx) => {
              const color = getWorkoutColor(session.templateName);
              return (
                <button
                  key={session.id}
                  onClick={() => navigate(`/history/${session.id}`)}
                  style={{ animationDelay: `${Math.min(idx * 60, 600)}ms` }}
                  className={`w-full text-left glass-card rounded-xl p-4 active:scale-[0.98] transition-transform fade-slide-up border-l-4 ${color.border}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                        <h3 className="text-base font-semibold text-white">
                          {session.templateName}
                        </h3>
                      </div>
                      <p className="text-wf-gray-400 text-sm mt-0.5 ml-4">
                        {format(parseISO(session.date), 'EEEE, MMM d, yyyy')}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
